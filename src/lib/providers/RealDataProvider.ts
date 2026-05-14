import {
  DataSourceStatus,
  MarketSummary,
  MarketType,
  NewsItem,
  QuoteData,
  SecFilingItem,
  SectorFundFlow,
  RiskSignal,
} from '../types';
import { MarketDataProvider, NewsProvider } from './types';
import {
  cachedFetch,
  compactText,
  decodeBasicEntities,
  enforceRateLimit,
  fetchJson,
  getEnvString,
  getRuntimeEnv,
  isRecord,
  ProviderError,
  RuntimeEnv,
  stableId,
  toNumber,
} from './freeApiRuntime';

type QuoteSourceId = 'finnhub' | 'twelveData' | 'alphaVantage' | 'fmp';
type SourceId =
  | QuoteSourceId
  | 'newsApi'
  | 'gdelt'
  | 'rss'
  | 'fred'
  | 'eia'
  | 'coingecko'
  | 'sec'
  | 'akshare'
  | 'tushare';

interface SourceDefinition {
  id: SourceId;
  name: string;
  category: DataSourceStatus['category'];
  priority: number;
  envKey?: string;
  noKey?: boolean;
  optionalKey?: boolean;
  notSupported?: boolean;
  isRealtime: boolean;
  isDelayed: boolean;
  delaySeconds: number;
  quotaNote?: string;
  rateLimit: { limit: number; windowSeconds: number };
}

interface AssetConfig {
  symbol: string;
  name: string;
  market: MarketType;
  assetType: QuoteData['assetType'];
  providerSymbols?: Partial<Record<QuoteSourceId, string>>;
  dataQuality?: QuoteData['dataQuality'];
  notice?: string;
}

const SOURCE_DEFINITIONS: SourceDefinition[] = [
  {
    id: 'finnhub',
    name: 'Finnhub',
    category: 'market',
    priority: 1,
    envKey: 'FINNHUB_API_KEY',
    isRealtime: false,
    isDelayed: true,
    delaySeconds: 900,
    quotaNote: 'Free plan has rate limits and market-data entitlement limits.',
    rateLimit: { limit: 45, windowSeconds: 60 },
  },
  {
    id: 'twelveData',
    name: 'Twelve Data Basic',
    category: 'market',
    priority: 2,
    envKey: 'TWELVE_DATA_API_KEY',
    isRealtime: false,
    isDelayed: true,
    delaySeconds: 900,
    quotaNote: 'Basic/free access may be delayed and rate limited.',
    rateLimit: { limit: 8, windowSeconds: 60 },
  },
  {
    id: 'alphaVantage',
    name: 'Alpha Vantage',
    category: 'market',
    priority: 3,
    envKey: 'ALPHA_VANTAGE_API_KEY',
    isRealtime: false,
    isDelayed: true,
    delaySeconds: 86400,
    quotaNote: 'Free API commonly returns delayed or end-of-day data.',
    rateLimit: { limit: 5, windowSeconds: 60 },
  },
  {
    id: 'fmp',
    name: 'Financial Modeling Prep',
    category: 'market',
    priority: 4,
    envKey: 'FMP_API_KEY',
    isRealtime: false,
    isDelayed: true,
    delaySeconds: 900,
    quotaNote: 'Free plan is rate limited and may restrict market data.',
    rateLimit: { limit: 30, windowSeconds: 60 },
  },
  {
    id: 'newsApi',
    name: 'NewsAPI',
    category: 'news',
    priority: 1,
    envKey: 'NEWS_API_KEY',
    isRealtime: false,
    isDelayed: true,
    delaySeconds: 300,
    quotaNote: 'Free developer plan has request and production-use limits.',
    rateLimit: { limit: 30, windowSeconds: 60 },
  },
  {
    id: 'gdelt',
    name: 'GDELT',
    category: 'news',
    priority: 3,
    noKey: true,
    isRealtime: false,
    isDelayed: true,
    delaySeconds: 900,
    quotaNote: 'No key required; requests are cached and deduplicated.',
    rateLimit: { limit: 20, windowSeconds: 60 },
  },
  {
    id: 'rss',
    name: 'RSS Feeds',
    category: 'news',
    priority: 4,
    noKey: true,
    isRealtime: false,
    isDelayed: true,
    delaySeconds: 900,
    quotaNote: 'Only title, summary, link, published time, and source are stored.',
    rateLimit: { limit: 20, windowSeconds: 60 },
  },
  {
    id: 'fred',
    name: 'FRED',
    category: 'macro',
    priority: 1,
    envKey: 'FRED_API_KEY',
    isRealtime: false,
    isDelayed: true,
    delaySeconds: 86400,
    quotaNote: 'Macro series update on the source schedule.',
    rateLimit: { limit: 30, windowSeconds: 60 },
  },
  {
    id: 'eia',
    name: 'EIA',
    category: 'macro',
    priority: 2,
    envKey: 'EIA_API_KEY',
    isRealtime: false,
    isDelayed: true,
    delaySeconds: 86400,
    quotaNote: 'Energy data update on the EIA release schedule.',
    rateLimit: { limit: 20, windowSeconds: 60 },
  },
  {
    id: 'coingecko',
    name: 'CoinGecko Demo',
    category: 'crypto',
    priority: 1,
    optionalKey: true,
    isRealtime: false,
    isDelayed: true,
    delaySeconds: 60,
    quotaNote: 'Demo key is optional for public simple price calls but improves quota.',
    rateLimit: { limit: 20, windowSeconds: 60 },
  },
  {
    id: 'sec',
    name: 'SEC EDGAR',
    category: 'filings',
    priority: 1,
    envKey: 'SEC_CONTACT_EMAIL',
    isRealtime: false,
    isDelayed: true,
    delaySeconds: 3600,
    quotaNote: 'Requires a compliant User-Agent with project name and contact email.',
    rateLimit: { limit: 8, windowSeconds: 1 },
  },
  {
    id: 'akshare',
    name: 'AKShare',
    category: 'china',
    priority: 1,
    notSupported: true,
    isRealtime: false,
    isDelayed: true,
    delaySeconds: 0,
    quotaNote: 'Python sidecar or scheduled D1/KV sync is required on Cloudflare.',
    rateLimit: { limit: 0, windowSeconds: 60 },
  },
  {
    id: 'tushare',
    name: 'Tushare Pro',
    category: 'china',
    priority: 2,
    envKey: 'TUSHARE_TOKEN',
    isRealtime: false,
    isDelayed: true,
    delaySeconds: 86400,
    quotaNote: 'Token is required; some APIs need points or extra permissions.',
    rateLimit: { limit: 20, windowSeconds: 60 },
  },
];

const MARKET_ASSETS: AssetConfig[] = [
  { symbol: 'SPY', name: 'S&P 500 ETF', market: 'US', assetType: 'etf', notice: 'Used as an S&P 500 proxy.' },
  { symbol: 'QQQ', name: 'Nasdaq 100 ETF', market: 'US', assetType: 'etf', notice: 'Used as a Nasdaq proxy.' },
  { symbol: 'DIA', name: 'Dow Jones ETF', market: 'US', assetType: 'etf', notice: 'Used as a Dow proxy.' },
  { symbol: 'IWM', name: 'Russell 2000 ETF', market: 'US', assetType: 'etf' },
  { symbol: 'FXI', name: 'China Large-Cap ETF', market: 'CN', assetType: 'etf', notice: 'Cloudflare-safe China market proxy.' },
  { symbol: 'EWH', name: 'Hong Kong ETF', market: 'HK', assetType: 'etf', notice: 'Used as a Hong Kong market proxy.' },
  { symbol: 'EWJ', name: 'Japan ETF', market: 'AS', assetType: 'etf' },
  { symbol: 'FEZ', name: 'Euro Stoxx 50 ETF', market: 'EU', assetType: 'etf' },
];

const MACRO_ASSETS: AssetConfig[] = [
  { symbol: 'UUP', name: 'US Dollar ETF', market: 'GLOBAL', assetType: 'forex', notice: 'ETF proxy for broad USD strength.' },
  { symbol: 'GLD', name: 'Gold ETF', market: 'GLOBAL', assetType: 'commodity', notice: 'ETF proxy for spot gold.' },
  { symbol: 'USO', name: 'WTI Oil ETF', market: 'GLOBAL', assetType: 'commodity', notice: 'ETF proxy for WTI oil.' },
  { symbol: 'VXX', name: 'VIX Futures ETN', market: 'US', assetType: 'index', notice: 'Tradable volatility proxy, not the VIX index.' },
];

const SECTOR_ASSETS: AssetConfig[] = [
  { symbol: 'XLK', name: 'Technology', market: 'US', assetType: 'etf' },
  { symbol: 'XLF', name: 'Financials', market: 'US', assetType: 'etf' },
  { symbol: 'XLE', name: 'Energy', market: 'US', assetType: 'etf' },
  { symbol: 'XLV', name: 'Health Care', market: 'US', assetType: 'etf' },
  { symbol: 'XLI', name: 'Industrials', market: 'US', assetType: 'etf' },
  { symbol: 'XLY', name: 'Consumer Discretionary', market: 'US', assetType: 'etf' },
  { symbol: 'XLP', name: 'Consumer Staples', market: 'US', assetType: 'etf' },
  { symbol: 'XLU', name: 'Utilities', market: 'US', assetType: 'etf' },
  { symbol: 'KWEB', name: 'China Internet ETF', market: 'CN', assetType: 'etf' },
  { symbol: 'CQQQ', name: 'China Technology ETF', market: 'CN', assetType: 'etf' },
  { symbol: 'ASHR', name: 'China A-Share ETF', market: 'CN', assetType: 'etf' },
  { symbol: 'MCHI', name: 'MSCI China ETF', market: 'CN', assetType: 'etf' },
  { symbol: 'EWH', name: 'Hong Kong ETF', market: 'HK', assetType: 'etf' },
];

const RSS_FEEDS = [
  { source: 'CNBC', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },
  { source: 'Yahoo Finance', url: 'https://finance.yahoo.com/news/rssindex' },
  { source: 'MarketWatch', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories' },
];

const ALL_ASSETS = [...MARKET_ASSETS, ...MACRO_ASSETS, ...SECTOR_ASSETS];

export class RealDataProvider implements MarketDataProvider, NewsProvider {
  name = 'FreeAPIDataEngine';
  priority = 1;
  supportsRealtime = false;

  private healthOverlay = new Map<SourceId, Partial<DataSourceStatus>>();

  async getQuote(symbol: string): Promise<QuoteData> {
    const env = await getRuntimeEnv();
    const asset = this.getAsset(symbol);
    const chain: QuoteSourceId[] = ['finnhub', 'twelveData', 'alphaVantage', 'fmp'];

    for (const sourceId of chain) {
      try {
        return await this.fetchQuoteWithCache(env, sourceId, asset);
      } catch (error) {
        this.recordError(sourceId, error);
      }
    }

    throw new Error(`No real quote data available for ${symbol}`);
  }

  async getBatchQuotes(symbols: string[]): Promise<QuoteData[]> {
    const env = await getRuntimeEnv();
    const assets = symbols.map((symbol) => this.getAsset(symbol));
    const quotes = new Map<string, QuoteData>();

    if (assets.length > 1 && this.isConfigured(env, this.getSource('twelveData'))) {
      try {
        const batch = await this.fetchTwelveBatchQuotes(env, assets);
        for (const quote of batch) quotes.set(quote.symbol, quote);
      } catch (error) {
        this.recordError('twelveData', error);
      }
    }

    const missing = assets.filter((asset) => !quotes.has(asset.symbol));
    const settled = await Promise.allSettled(missing.map((asset) => this.getQuote(asset.symbol)));
    for (const result of settled) {
      if (result.status === 'fulfilled') quotes.set(result.value.symbol, result.value);
    }

    return assets.map((asset) => quotes.get(asset.symbol)).filter((quote): quote is QuoteData => Boolean(quote));
  }

  async getIndexQuotes(): Promise<QuoteData[]> {
    return this.getBatchQuotes(MARKET_ASSETS.map((asset) => asset.symbol));
  }

  async getMacroData(): Promise<QuoteData[]> {
    const env = await getRuntimeEnv();
    const [marketProxies, fred, crypto] = await Promise.all([
      this.getBatchQuotes(MACRO_ASSETS.map((asset) => asset.symbol)).catch((error) => {
        this.recordError('finnhub', error);
        return [];
      }),
      this.getFredMacroQuotes(env).catch((error) => {
        this.recordError('fred', error);
        return [];
      }),
      this.getCoinGeckoQuotes(env).catch((error) => {
        this.recordError('coingecko', error);
        return [];
      }),
    ]);
    return [...marketProxies, ...fred, ...crypto];
  }

  async getSectorPerformance(market: string): Promise<SectorFundFlow[]> {
    const normalizedMarket = market.toUpperCase();
    const selected = SECTOR_ASSETS.filter((asset) => {
      if (normalizedMarket === 'GLOBAL') return true;
      if (normalizedMarket === 'CN') return asset.market === 'CN' || asset.market === 'HK';
      return asset.market === normalizedMarket;
    });
    const quotes = await this.getBatchQuotes(selected.map((asset) => asset.symbol));

    return quotes.map((quote, index) => {
      const signal = quote.changePercent >= 1.5
        ? 'strong_inflow'
        : quote.changePercent > 0
          ? 'weak_inflow'
          : quote.changePercent <= -1.5
            ? 'strong_outflow'
            : quote.changePercent < 0
              ? 'weak_outflow'
              : 'neutral';

      return {
        sector: quote.name,
        market: quote.market,
        netInflow: 0,
        changePercent: quote.changePercent,
        inflowRank: index + 1,
        change5m: 0,
        change30m: 0,
        continuousInflowDays: 0,
        representativeStocks: [quote.symbol],
        timestamp: quote.timestamp,
        signal,
        source: quote.source,
        isRealtime: quote.isRealtime,
        isDelayed: quote.isDelayed,
        isStale: quote.isStale,
        dataQuality: 'proxy',
        notice: '免费源未提供可核验主力资金流；此处仅展示板块 ETF 价格代理，资金流显示为暂无数据。',
        aiReasoning: 'No verified fund-flow feed is configured. Showing ETF price proxy only.',
      };
    });
  }

  async getLatestNews(): Promise<NewsItem[]> {
    const env = await getRuntimeEnv();
    const cached = await cachedFetch<NewsItem[]>({
      env,
      namespace: 'news',
      key: 'news:latest:v2',
      ttlSeconds: 300,
      staleSeconds: 1800,
      fetcher: async () => {
        const settled = await Promise.allSettled([
          this.getFinnhubNews(env),
          this.getNewsApiNews(env),
          this.getFmpNews(env),
          this.getGdeltNews(env),
          this.getRssNews(env),
        ]);
        const items = settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
        return this.dedupeNews(items).slice(0, 40);
      },
    });

    return cached.data.map((item) => ({
      ...item,
      isCached: cached.state.hit,
      isStale: cached.state.stale,
    }));
  }

  async getCompanyNews(symbol: string): Promise<NewsItem[]> {
    const env = await getRuntimeEnv();
    try {
      const key = getEnvString(env, 'FINNHUB_API_KEY');
      if (!key) throw new ProviderError('finnhub', 'missing_key', 'API key missing: FINNHUB_API_KEY');
      await this.beforeCall(env, 'finnhub');
      const to = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString().slice(0, 10);
      const url = new URL('https://finnhub.io/api/v1/company-news');
      url.searchParams.set('symbol', symbol);
      url.searchParams.set('from', from);
      url.searchParams.set('to', to);
      url.searchParams.set('token', key);
      const data = await fetchJson<unknown[]>('finnhub', url.toString());
      this.markSource('finnhub', 'healthy', 'Company news fetched.', new Date().toISOString());
      return data.map((item) => this.mapFinnhubNewsItem(item, 'company')).filter(Boolean) as NewsItem[];
    } catch (error) {
      this.recordError('finnhub', error);
      const latest = await this.getLatestNews();
      return latest.filter((item) => item.relatedSymbols.includes(symbol));
    }
  }

  async getRiskSignals(): Promise<RiskSignal[]> {
    const macro = await this.getMacroData();
    const indexes = await this.getIndexQuotes();
    const now = new Date().toISOString();
    const signals: RiskSignal[] = [];
    const volatility = macro.find((item) => item.symbol === 'VXX');
    const btc = macro.find((item) => item.symbol === 'BTC');
    const us10y = macro.find((item) => item.symbol === 'US10Y');
    const qqq = indexes.find((item) => item.symbol === 'QQQ');

    if (volatility && volatility.changePercent >= 5) {
      signals.push({
        id: `risk-${stableId(`vol-${volatility.timestamp}`)}`,
        riskType: 'Volatility proxy spike',
        riskLevel: volatility.changePercent >= 10 ? 'high' : 'medium',
        affectedMarkets: ['US', 'GLOBAL'],
        affectedSectors: ['Growth equities', 'High beta assets'],
        safeHavens: ['USD', 'Short-duration Treasuries'],
        reason: `VXX is up ${volatility.changePercent.toFixed(2)}%. This is a tradable volatility proxy, not the spot VIX index.`,
        timestamp: now,
      });
    }

    if (btc && btc.changePercent <= -5) {
      signals.push({
        id: `risk-${stableId(`btc-${btc.timestamp}`)}`,
        riskType: 'Crypto risk appetite drop',
        riskLevel: btc.changePercent <= -10 ? 'high' : 'medium',
        affectedMarkets: ['GLOBAL'],
        affectedSectors: ['Crypto', 'High beta technology'],
        reason: `Bitcoin is down ${Math.abs(btc.changePercent).toFixed(2)}% over 24h on CoinGecko data.`,
        timestamp: now,
      });
    }

    if (us10y && us10y.change >= 0.05 && qqq && qqq.changePercent < 0) {
      signals.push({
        id: `risk-${stableId(`rates-${us10y.timestamp}`)}`,
        riskType: 'US yield pressure',
        riskLevel: 'medium',
        affectedMarkets: ['US', 'GLOBAL'],
        affectedSectors: ['Technology', 'Long-duration equities'],
        safeHavens: ['Cash', 'Short-duration bonds'],
        reason: `FRED 10Y yield increased by ${us10y.change.toFixed(3)} points while QQQ is negative.`,
        timestamp: now,
      });
    }

    return signals;
  }

  async getMarketSummary(): Promise<MarketSummary> {
    const [indexes, sectors, news] = await Promise.all([
      this.getIndexQuotes().catch(() => []),
      this.getSectorPerformance('GLOBAL').catch(() => []),
      this.getLatestNews().catch(() => []),
    ]);
    const timestamp = new Date().toISOString();
    const leaders = [...indexes].sort((a, b) => b.changePercent - a.changePercent).slice(0, 3);
    const laggards = [...indexes].sort((a, b) => a.changePercent - b.changePercent).slice(0, 3);
    const strongSectors = [...sectors].sort((a, b) => b.changePercent - a.changePercent).slice(0, 4);
    const weakSectors = [...sectors].sort((a, b) => a.changePercent - b.changePercent).slice(0, 4);
    const positiveCount = indexes.filter((item) => item.changePercent > 0).length;
    const sentiment = positiveCount > indexes.length / 2 ? 'Risk On' : positiveCount === 0 ? 'Risk Off' : 'Neutral';

    return {
      sentiment: `${sentiment} - rule-based summary from configured free sources`,
      topConclusions: [
        leaders.length
          ? `Leading proxies: ${leaders.map((item) => `${item.name} ${this.formatPercent(item.changePercent)}`).join(', ')}.`
          : 'No verified market quote data is available yet.',
        laggards.length
          ? `Weakest proxies: ${laggards.map((item) => `${item.name} ${this.formatPercent(item.changePercent)}`).join(', ')}.`
          : 'No negative market proxy has been detected.',
        news.length
          ? `Latest news metadata is aggregated from ${Array.from(new Set(news.map((item) => item.source))).slice(0, 5).join(', ')}.`
          : 'No news metadata is available from configured free sources.',
      ],
      bullishDrivers: leaders.map((item) => `${item.name} ${this.formatPercent(item.changePercent)}`),
      bearishDrivers: laggards.map((item) => `${item.name} ${this.formatPercent(item.changePercent)}`),
      inflowSectors: strongSectors.map((item) => item.sector),
      outflowSectors: weakSectors.map((item) => item.sector),
      shortTermStrong: strongSectors.map((item) => item.sector),
      mediumTermFocus: leaders.map((item) => item.symbol),
      risksToAvoid: weakSectors.map((item) => item.sector),
      tomorrowOutlook: 'This summary uses only server-side free data sources and cached metadata. Configure paid or higher-quota feeds before treating any item as realtime.',
      timestamp,
    };
  }

  async getSourceStatuses(): Promise<DataSourceStatus[]> {
    const env = await getRuntimeEnv();
    return SOURCE_DEFINITIONS.map((definition) => {
      const configured = this.isConfigured(env, definition);
      const overlay = this.healthOverlay.get(definition.id);
      const baseStatus = this.baseStatus(definition, configured);
      return {
        id: definition.id,
        name: definition.name,
        category: definition.category,
        priority: definition.priority,
        configured,
        status: overlay?.status ?? baseStatus.status,
        message: overlay?.message ?? baseStatus.message,
        lastChecked: overlay?.lastChecked,
        lastUpdated: overlay?.lastUpdated,
        isRealtime: definition.isRealtime,
        isDelayed: definition.isDelayed,
        delaySeconds: definition.delaySeconds,
        quotaNote: definition.quotaNote,
      };
    });
  }

  async getSecFilings(cik: string): Promise<SecFilingItem[]> {
    const env = await getRuntimeEnv();
    const normalizedCik = cik.replace(/\D/g, '').padStart(10, '0');
    if (!/^\d{10}$/.test(normalizedCik)) {
      throw new Error('Invalid CIK. Use digits only.');
    }
    const cached = await cachedFetch<SecFilingItem[]>({
      env,
      namespace: 'news',
      key: `sec:filings:${normalizedCik}`,
      ttlSeconds: 3600,
      staleSeconds: 86400,
      fetcher: async () => {
        await this.beforeCall(env, 'sec');
        const email = getEnvString(env, 'SEC_CONTACT_EMAIL');
        if (!email) throw new ProviderError('sec', 'missing_key', 'SEC_CONTACT_EMAIL missing.');
        const project = getEnvString(env, 'SEC_PROJECT_NAME') ?? 'GlobalMarketIntelligence';
        const response = await fetchJson<SecSubmissionsResponse>(
          'sec',
          `https://data.sec.gov/submissions/CIK${normalizedCik}.json`,
          {
            headers: {
              'User-Agent': `${project}/0.1 ${email}`,
            },
          },
        );
        const filings = this.mapSecFilings(normalizedCik, response);
        this.markSource('sec', 'healthy', 'SEC submissions fetched.', new Date().toISOString());
        return filings;
      },
    });

    if (cached.state.stale) this.markSource('sec', 'degraded', 'Using stale cached SEC submissions.');
    return cached.data;
  }

  private async fetchQuoteWithCache(env: RuntimeEnv, sourceId: QuoteSourceId, asset: AssetConfig): Promise<QuoteData> {
    const cached = await cachedFetch<QuoteData>({
      env,
      namespace: 'market',
      key: `quote:${sourceId}:${asset.symbol}`,
      ttlSeconds: 60,
      staleSeconds: 900,
      fetcher: async () => {
        await this.beforeCall(env, sourceId);
        if (sourceId === 'finnhub') return this.fetchFinnhubQuote(env, asset);
        if (sourceId === 'twelveData') return this.fetchTwelveQuote(env, asset);
        if (sourceId === 'alphaVantage') return this.fetchAlphaQuote(env, asset);
        return this.fetchFmpQuote(env, asset);
      },
    });

    const quote = { ...cached.data, isCached: cached.state.hit, isStale: cached.state.stale };
    this.markSource(
      sourceId,
      cached.state.stale ? 'degraded' : 'healthy',
      cached.state.stale ? 'Using stale quote cache.' : 'Quote data fetched.',
      quote.timestamp,
    );
    return quote;
  }

  private async fetchFinnhubQuote(env: RuntimeEnv, asset: AssetConfig): Promise<QuoteData> {
    const token = getEnvString(env, 'FINNHUB_API_KEY');
    if (!token) throw new ProviderError('finnhub', 'missing_key', 'API key missing: FINNHUB_API_KEY');
    const url = new URL('https://finnhub.io/api/v1/quote');
    url.searchParams.set('symbol', asset.providerSymbols?.finnhub ?? asset.symbol);
    url.searchParams.set('token', token);
    const data = await fetchJson<FinnhubQuoteResponse>('finnhub', url.toString());
    const price = toNumber(data.c);
    if (!price || price <= 0) throw new ProviderError('finnhub', 'offline', 'Finnhub returned no quote data.');
    const previousClose = toNumber(data.pc) ?? price;
    const change = toNumber(data.d) ?? price - previousClose;
    const changePercent = toNumber(data.dp) ?? (previousClose ? (change / previousClose) * 100 : 0);
    return this.makeQuote(asset, price, change, changePercent, 0, 'Finnhub', 'finnhub', data.t ? new Date(data.t * 1000).toISOString() : undefined);
  }

  private async fetchTwelveQuote(env: RuntimeEnv, asset: AssetConfig): Promise<QuoteData> {
    const token = getEnvString(env, 'TWELVE_DATA_API_KEY');
    if (!token) throw new ProviderError('twelveData', 'missing_key', 'API key missing: TWELVE_DATA_API_KEY');
    const url = new URL('https://api.twelvedata.com/quote');
    url.searchParams.set('symbol', asset.providerSymbols?.twelveData ?? asset.symbol);
    url.searchParams.set('apikey', token);
    const data = await fetchJson<TwelveQuoteResponse>('twelveData', url.toString());
    return this.mapTwelveQuote(asset, data);
  }

  private async fetchAlphaQuote(env: RuntimeEnv, asset: AssetConfig): Promise<QuoteData> {
    const token = getEnvString(env, 'ALPHA_VANTAGE_API_KEY');
    if (!token) throw new ProviderError('alphaVantage', 'missing_key', 'API key missing: ALPHA_VANTAGE_API_KEY');
    const url = new URL('https://www.alphavantage.co/query');
    url.searchParams.set('function', 'GLOBAL_QUOTE');
    url.searchParams.set('symbol', asset.providerSymbols?.alphaVantage ?? asset.symbol);
    url.searchParams.set('apikey', token);
    const data = await fetchJson<AlphaQuoteResponse>('alphaVantage', url.toString());
    const quote = data['Global Quote'];
    if (!quote) throw new ProviderError('alphaVantage', 'offline', 'Alpha Vantage returned no global quote.');
    const price = toNumber(quote['05. price']);
    if (!price) throw new ProviderError('alphaVantage', 'offline', 'Alpha Vantage quote has no price.');
    return this.makeQuote(
      asset,
      price,
      toNumber(quote['09. change']) ?? 0,
      toNumber(quote['10. change percent']) ?? 0,
      toNumber(quote['06. volume']) ?? 0,
      'Alpha Vantage',
      'alphaVantage',
      quote['07. latest trading day'],
    );
  }

  private async fetchFmpQuote(env: RuntimeEnv, asset: AssetConfig): Promise<QuoteData> {
    const token = getEnvString(env, 'FMP_API_KEY');
    if (!token) throw new ProviderError('fmp', 'missing_key', 'API key missing: FMP_API_KEY');
    const url = new URL(`https://financialmodelingprep.com/api/v3/quote/${asset.providerSymbols?.fmp ?? asset.symbol}`);
    url.searchParams.set('apikey', token);
    const data = await fetchJson<FmpQuoteResponse[]>('fmp', url.toString());
    const quote = data[0];
    if (!quote) throw new ProviderError('fmp', 'offline', 'FMP returned no quote data.');
    const price = toNumber(quote.price);
    if (!price) throw new ProviderError('fmp', 'offline', 'FMP quote has no price.');
    return this.makeQuote(asset, price, toNumber(quote.change) ?? 0, toNumber(quote.changesPercentage) ?? 0, toNumber(quote.volume) ?? 0, 'Financial Modeling Prep', 'fmp');
  }

  private async fetchTwelveBatchQuotes(env: RuntimeEnv, assets: AssetConfig[]): Promise<QuoteData[]> {
    const token = getEnvString(env, 'TWELVE_DATA_API_KEY');
    if (!token) throw new ProviderError('twelveData', 'missing_key', 'API key missing: TWELVE_DATA_API_KEY');
    const cacheKey = assets.map((asset) => asset.symbol).sort().join(',');
    const cached = await cachedFetch<QuoteData[]>({
      env,
      namespace: 'market',
      key: `quote:twelveData:batch:${cacheKey}`,
      ttlSeconds: 60,
      staleSeconds: 900,
      fetcher: async () => {
        await this.beforeCall(env, 'twelveData');
        const url = new URL('https://api.twelvedata.com/quote');
        url.searchParams.set('symbol', assets.map((asset) => asset.providerSymbols?.twelveData ?? asset.symbol).join(','));
        url.searchParams.set('apikey', token);
        const data = await fetchJson<unknown>('twelveData', url.toString());
        if (!isRecord(data)) throw new ProviderError('twelveData', 'offline', 'Twelve Data batch response is invalid.');
        return assets
          .map((asset) => {
            const key = asset.providerSymbols?.twelveData ?? asset.symbol;
            const value = data[key] ?? data[asset.symbol];
            return isRecord(value) ? this.mapTwelveQuote(asset, value as TwelveQuoteResponse) : undefined;
          })
          .filter((quote): quote is QuoteData => Boolean(quote));
      },
    });
    this.markSource('twelveData', cached.state.stale ? 'degraded' : 'healthy', cached.state.stale ? 'Using stale batch quote cache.' : 'Batch quote data fetched.');
    return cached.data.map((quote) => ({ ...quote, isCached: cached.state.hit, isStale: cached.state.stale }));
  }

  private async getFredMacroQuotes(env: RuntimeEnv): Promise<QuoteData[]> {
    const series = [
      { id: 'DGS10', symbol: 'US10Y', name: 'US 10Y Treasury Yield' },
      { id: 'DFF', symbol: 'FEDFUNDS', name: 'Effective Federal Funds Rate' },
    ];
    const settled = await Promise.allSettled(series.map((item) => this.fetchFredSeries(env, item.id, item.symbol, item.name)));
    return settled.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
  }

  private async fetchFredSeries(env: RuntimeEnv, seriesId: string, symbol: string, name: string): Promise<QuoteData> {
    const cached = await cachedFetch<QuoteData>({
      env,
      namespace: 'market',
      key: `fred:${seriesId}`,
      ttlSeconds: 3600,
      staleSeconds: 86400,
      fetcher: async () => {
        await this.beforeCall(env, 'fred');
        const token = getEnvString(env, 'FRED_API_KEY');
        if (!token) throw new ProviderError('fred', 'missing_key', 'API key missing: FRED_API_KEY');
        const url = new URL('https://api.stlouisfed.org/fred/series/observations');
        url.searchParams.set('series_id', seriesId);
        url.searchParams.set('api_key', token);
        url.searchParams.set('file_type', 'json');
        url.searchParams.set('sort_order', 'desc');
        url.searchParams.set('limit', '2');
        const data = await fetchJson<FredResponse>('fred', url.toString());
        const observations = data.observations?.filter((item) => item.value !== '.') ?? [];
        const latest = observations[0];
        const previous = observations[1];
        const price = toNumber(latest?.value);
        if (!latest || price === undefined) throw new ProviderError('fred', 'offline', 'FRED returned no observations.');
        const previousPrice = toNumber(previous?.value) ?? price;
        return this.makeQuote(
          { symbol, name, market: 'US', assetType: 'commodity' },
          price,
          price - previousPrice,
          previousPrice ? ((price - previousPrice) / previousPrice) * 100 : 0,
          0,
          'FRED',
          'fred',
          latest.date,
          'Macro release data, not realtime market data.',
        );
      },
    });
    this.markSource('fred', cached.state.stale ? 'degraded' : 'healthy', cached.state.stale ? 'Using stale FRED cache.' : 'FRED data fetched.');
    return { ...cached.data, isCached: cached.state.hit, isStale: cached.state.stale };
  }

  private async getCoinGeckoQuotes(env: RuntimeEnv): Promise<QuoteData[]> {
    const cached = await cachedFetch<QuoteData[]>({
      env,
      namespace: 'market',
      key: 'coingecko:simple:btc-eth',
      ttlSeconds: 60,
      staleSeconds: 600,
      fetcher: async () => {
        await this.beforeCall(env, 'coingecko');
        const url = new URL('https://api.coingecko.com/api/v3/simple/price');
        url.searchParams.set('ids', 'bitcoin,ethereum');
        url.searchParams.set('vs_currencies', 'usd');
        url.searchParams.set('include_market_cap', 'true');
        url.searchParams.set('include_24hr_vol', 'true');
        url.searchParams.set('include_24hr_change', 'true');
        url.searchParams.set('include_last_updated_at', 'true');
        const apiKey = getEnvString(env, 'COINGECKO_API_KEY');
        const data = await fetchJson<CoinGeckoResponse>('coingecko', url.toString(), {
          headers: apiKey ? { 'x-cg-demo-api-key': apiKey } : undefined,
        });
        const configs = [
          { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
          { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
        ];
        return configs.flatMap((config) => {
          const item = data[config.id];
          const price = toNumber(item?.usd);
          if (!item || !price) return [];
          const changePercent = toNumber(item.usd_24h_change) ?? 0;
          return [
            this.makeQuote(
              { symbol: config.symbol, name: config.name, market: 'GLOBAL', assetType: 'crypto' },
              price,
              (price * changePercent) / 100,
              changePercent,
              toNumber(item.usd_24h_vol) ?? 0,
              'CoinGecko',
              'coingecko',
              item.last_updated_at ? new Date(item.last_updated_at * 1000).toISOString() : undefined,
            ),
          ];
        });
      },
    });
    this.markSource('coingecko', cached.state.stale ? 'degraded' : 'healthy', cached.state.stale ? 'Using stale CoinGecko cache.' : 'Crypto data fetched.');
    return cached.data.map((quote) => ({ ...quote, isCached: cached.state.hit, isStale: cached.state.stale }));
  }

  private async getFinnhubNews(env: RuntimeEnv): Promise<NewsItem[]> {
    return this.runNewsSource('finnhub', async () => {
      const token = getEnvString(env, 'FINNHUB_API_KEY');
      if (!token) throw new ProviderError('finnhub', 'missing_key', 'API key missing: FINNHUB_API_KEY');
      const url = new URL('https://finnhub.io/api/v1/news');
      url.searchParams.set('category', 'general');
      url.searchParams.set('token', token);
      const data = await fetchJson<unknown[]>('finnhub', url.toString());
      return data.map((item) => this.mapFinnhubNewsItem(item, 'market')).filter(Boolean) as NewsItem[];
    });
  }

  private async getNewsApiNews(env: RuntimeEnv): Promise<NewsItem[]> {
    return this.runNewsSource('newsApi', async () => {
      const token = getEnvString(env, 'NEWS_API_KEY');
      if (!token) throw new ProviderError('newsApi', 'missing_key', 'API key missing: NEWS_API_KEY');
      const url = new URL('https://newsapi.org/v2/everything');
      url.searchParams.set('q', '(market OR stocks OR economy OR "Federal Reserve" OR inflation)');
      url.searchParams.set('language', 'en');
      url.searchParams.set('sortBy', 'publishedAt');
      url.searchParams.set('pageSize', '20');
      url.searchParams.set('apiKey', token);
      const data = await fetchJson<NewsApiResponse>('newsApi', url.toString());
      return (data.articles ?? []).map((article) => this.makeNewsItem({
        title: article.title,
        source: article.source?.name ?? 'NewsAPI',
        url: article.url,
        publishedAt: article.publishedAt,
        summary: article.description,
        language: 'en',
      }));
    });
  }

  private async getFmpNews(env: RuntimeEnv): Promise<NewsItem[]> {
    return this.runNewsSource('fmp', async () => {
      const token = getEnvString(env, 'FMP_API_KEY');
      if (!token) throw new ProviderError('fmp', 'missing_key', 'API key missing: FMP_API_KEY');
      const url = new URL('https://financialmodelingprep.com/api/v3/stock_news');
      url.searchParams.set('limit', '20');
      url.searchParams.set('apikey', token);
      const data = await fetchJson<FmpNewsResponse[]>('fmp', url.toString());
      return data.map((article) => this.makeNewsItem({
        title: article.title,
        source: article.site ?? 'Financial Modeling Prep',
        url: article.url,
        publishedAt: article.publishedDate,
        summary: article.text,
        language: 'en',
        relatedSymbols: article.symbol ? [article.symbol] : [],
      }));
    });
  }

  private async getGdeltNews(env: RuntimeEnv): Promise<NewsItem[]> {
    return this.runNewsSource('gdelt', async () => {
      const url = new URL('https://api.gdeltproject.org/api/v2/doc/doc');
      url.searchParams.set('query', 'market OR economy OR stocks OR inflation OR rates');
      url.searchParams.set('mode', 'ArtList');
      url.searchParams.set('format', 'json');
      url.searchParams.set('maxrecords', '20');
      url.searchParams.set('sort', 'HybridRel');
      const data = await fetchJson<GdeltResponse>('gdelt', url.toString());
      return (data.articles ?? []).map((article) => this.makeNewsItem({
        title: article.title,
        source: article.domain ?? 'GDELT',
        url: article.url,
        publishedAt: this.parseGdeltDate(article.seendate),
        summary: '',
        language: article.language ?? 'unknown',
      }));
    }, env);
  }

  private async getRssNews(env: RuntimeEnv): Promise<NewsItem[]> {
    return this.runNewsSource('rss', async () => {
      const settled = await Promise.allSettled(RSS_FEEDS.map(async (feed) => {
        const response = await fetch(feed.url, { headers: { Accept: 'application/rss+xml,text/xml' } });
        if (!response.ok) throw new ProviderError('rss', 'offline', `RSS fetch failed: ${feed.source}`, response.status);
        const xml = await response.text();
        return this.parseRssItems(xml, feed.source);
      }));
      return settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
    }, env);
  }

  private async runNewsSource(sourceId: SourceId, fetcher: () => Promise<NewsItem[]>, env?: RuntimeEnv): Promise<NewsItem[]> {
    try {
      const runtimeEnv = env ?? await getRuntimeEnv();
      await this.beforeCall(runtimeEnv, sourceId);
      const items = await fetcher();
      this.markSource(sourceId, items.length > 0 ? 'healthy' : 'degraded', items.length > 0 ? 'News metadata fetched.' : 'No news metadata returned.', new Date().toISOString());
      return items;
    } catch (error) {
      this.recordError(sourceId, error);
      return [];
    }
  }

  private parseRssItems(xml: string, source: string): NewsItem[] {
    const itemMatches = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
    return itemMatches.slice(0, 20).map((item) => {
      const title = this.readXmlField(item, 'title');
      const link = this.readXmlField(item, 'link');
      const publishedAt = this.readXmlField(item, 'pubDate') || this.readXmlField(item, 'dc:date');
      const description = this.readXmlField(item, 'description');
      return this.makeNewsItem({
        title,
        source,
        url: link,
        publishedAt,
        summary: description,
        language: 'unknown',
      });
    }).filter((item) => item.title && item.url);
  }

  private readXmlField(xml: string, tag: string): string {
    const escaped = tag.replace(':', '\\:');
    const match = xml.match(new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
    return compactText(decodeBasicEntities(match?.[1] ?? ''), 500);
  }

  private mapFinnhubNewsItem(item: unknown, type: 'market' | 'company'): NewsItem | undefined {
    if (!isRecord(item)) return undefined;
    return this.makeNewsItem({
      title: String(item.headline ?? ''),
      source: String(item.source ?? 'Finnhub'),
      url: String(item.url ?? ''),
      publishedAt: typeof item.datetime === 'number' ? new Date(item.datetime * 1000).toISOString() : undefined,
      summary: String(item.summary ?? ''),
      language: 'en',
      relatedSymbols: type === 'company' && typeof item.related === 'string' ? [item.related] : [],
    });
  }

  private makeNewsItem(input: {
    title?: string;
    source?: string;
    url?: string;
    publishedAt?: string;
    summary?: string;
    language?: string;
    relatedSymbols?: string[];
  }): NewsItem {
    const title = compactText(input.title, 300);
    const url = input.url ?? '';
    const source = input.source || 'Unknown';
    const publishedAt = input.publishedAt ? new Date(input.publishedAt).toISOString() : new Date().toISOString();
    const rawSummary = compactText(input.summary, 260);
    const relatedSymbols = input.relatedSymbols?.filter(Boolean) ?? this.inferSymbols(`${title} ${rawSummary}`);
    return {
      id: `news-${stableId(`${source}:${url}:${title}`)}`,
      title,
      source,
      url,
      publishedAt,
      receivedAt: new Date().toISOString(),
      language: input.language ?? 'unknown',
      markets: this.inferMarkets(`${title} ${rawSummary}`),
      relatedSectors: this.inferSectors(`${title} ${rawSummary}`),
      relatedSymbols,
      rawSummary,
      sentiment: 'neutral',
      impactScore: undefined,
      duration: undefined,
      isBreaking: false,
      sourceReliability: source === 'GDELT' ? 0.8 : 0.85,
      dataQuality: 'metadata_only',
    };
  }

  private dedupeNews(items: NewsItem[]): NewsItem[] {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = (item.url || item.title).toLowerCase().replace(/\?.*$/, '').trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  }

  private makeQuote(
    asset: AssetConfig,
    price: number,
    change: number,
    changePercent: number,
    volume: number,
    source: string,
    sourceId: string,
    timestamp?: string,
    notice?: string,
  ): QuoteData {
    const sourceDefinition = SOURCE_DEFINITIONS.find((definition) => definition.id === sourceId);
    return {
      symbol: asset.symbol,
      name: asset.name,
      market: asset.market,
      assetType: asset.assetType,
      price: Number(price.toFixed(asset.assetType === 'crypto' ? 2 : 4)),
      change: Number(change.toFixed(4)),
      changePercent: Number(changePercent.toFixed(2)),
      volume: Math.trunc(volume || 0),
      turnover: Math.trunc((volume || 0) * price),
      timestamp: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
      source,
      sourceId,
      isRealtime: sourceDefinition?.isRealtime ?? false,
      isDelayed: sourceDefinition?.isDelayed ?? true,
      delaySeconds: sourceDefinition?.delaySeconds ?? 900,
      dataQuality: asset.dataQuality ?? 'actual',
      notice: notice ?? asset.notice ?? sourceDefinition?.quotaNote,
    };
  }

  private mapTwelveQuote(asset: AssetConfig, data: TwelveQuoteResponse): QuoteData {
    const status = typeof data.status === 'string' ? data.status : '';
    if (status.toLowerCase() === 'error') {
      throw new ProviderError('twelveData', /limit|quota|credits/i.test(String(data.message)) ? 'limit_reached' : 'offline', String(data.message ?? 'Twelve Data error'));
    }
    const price = toNumber(data.close) ?? toNumber(data.price);
    if (!price) throw new ProviderError('twelveData', 'offline', 'Twelve Data quote has no price.');
    const timestamp = toNumber(data.timestamp);
    return this.makeQuote(
      asset,
      price,
      toNumber(data.change) ?? 0,
      toNumber(data.percent_change) ?? 0,
      toNumber(data.volume) ?? 0,
      'Twelve Data',
      'twelveData',
      timestamp ? new Date(timestamp * 1000).toISOString() : data.datetime,
    );
  }

  private mapSecFilings(normalizedCik: string, response: SecSubmissionsResponse): SecFilingItem[] {
    const recent = response.filings?.recent;
    if (!recent) return [];
    const accessionNumbers = recent.accessionNumber ?? [];
    return accessionNumbers.slice(0, 40).map((accessionNumber, index) => {
      const cikNoLeadingZeros = String(Number(normalizedCik));
      const compactAccession = accessionNumber.replace(/-/g, '');
      const primaryDocument = recent.primaryDocument?.[index] ?? '';
      return {
        accessionNumber,
        form: recent.form?.[index] ?? '',
        filingDate: recent.filingDate?.[index] ?? '',
        reportDate: recent.reportDate?.[index],
        primaryDocument,
        url: `https://www.sec.gov/Archives/edgar/data/${cikNoLeadingZeros}/${compactAccession}/${primaryDocument}`,
      };
    });
  }

  private async beforeCall(env: RuntimeEnv, sourceId: SourceId): Promise<void> {
    const definition = this.getSource(sourceId);
    if (definition.notSupported) {
      throw new ProviderError(sourceId, 'not_supported', definition.quotaNote ?? `${definition.name} is not supported on Cloudflare Workers.`);
    }
    if (!this.isConfigured(env, definition)) {
      throw new ProviderError(sourceId, 'missing_key', `API key missing: ${definition.envKey}`);
    }
    const rateLimit = await enforceRateLimit(env, sourceId, definition.rateLimit.limit, definition.rateLimit.windowSeconds);
    if (!rateLimit.allowed) {
      throw new ProviderError(sourceId, 'limit_reached', `API limit reached. Retry after ${new Date(rateLimit.resetAt).toISOString()}.`);
    }
  }

  private getAsset(symbol: string): AssetConfig {
    const normalized = symbol.trim().toUpperCase();
    return ALL_ASSETS.find((asset) => asset.symbol === normalized) ?? {
      symbol: normalized,
      name: normalized,
      market: 'GLOBAL',
      assetType: normalized.includes('USD') ? 'forex' : 'stock',
    };
  }

  private getSource(sourceId: SourceId): SourceDefinition {
    const source = SOURCE_DEFINITIONS.find((definition) => definition.id === sourceId);
    if (!source) throw new Error(`Unknown data source: ${sourceId}`);
    return source;
  }

  private isConfigured(env: RuntimeEnv, definition: SourceDefinition): boolean {
    if (definition.noKey || definition.optionalKey) return true;
    if (definition.notSupported) return Boolean(getEnvString(env, 'AKSHARE_BASE_URL'));
    if (!definition.envKey) return true;
    return Boolean(getEnvString(env, definition.envKey));
  }

  private baseStatus(definition: SourceDefinition, configured: boolean): { status: DataSourceStatus['status']; message: string } {
    if (definition.notSupported) {
      return {
        status: 'not_supported',
        message: definition.quotaNote ?? 'This data source requires a sidecar service.',
      };
    }
    if (!configured) {
      return {
        status: 'missing_key',
        message: definition.envKey === 'SEC_CONTACT_EMAIL'
          ? 'SEC User-Agent contact email missing.'
          : `API key missing: ${definition.envKey}`,
      };
    }
    return {
      status: definition.noKey || definition.optionalKey ? 'healthy' : 'degraded',
      message: definition.noKey
        ? 'No API key required.'
        : definition.optionalKey
          ? 'API key optional; running with low free quota.'
          : 'Configured and waiting for next request.',
    };
  }

  private markSource(sourceId: SourceId, status: DataSourceStatus['status'], message: string, lastUpdated?: string): void {
    this.healthOverlay.set(sourceId, {
      status,
      message,
      lastChecked: new Date().toISOString(),
      lastUpdated,
    });
  }

  private recordError(sourceId: SourceId, error: unknown): void {
    if (error instanceof ProviderError) {
      this.markSource(sourceId, error.code, error.message);
      return;
    }
    this.markSource(sourceId, 'offline', error instanceof Error ? error.message : 'Data source request failed.');
  }

  private formatPercent(value: number): string {
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  }

  private inferMarkets(text: string): MarketType[] {
    const lower = text.toLowerCase();
    const markets = new Set<MarketType>();
    if (/china|beijing|shanghai|hong kong|a-share|yuan|pboc|中国|香港|a股/i.test(text)) markets.add('CN');
    if (/fed|nasdaq|s&p|dow|wall street|treasury|dollar|sec\b|us stock/i.test(lower)) markets.add('US');
    if (/europe|ecb|dax|euro/i.test(lower)) markets.add('EU');
    if (/japan|nikkei|korea|asia/i.test(lower)) markets.add('AS');
    if (markets.size === 0) markets.add('GLOBAL');
    return Array.from(markets);
  }

  private inferSectors(text: string): string[] {
    const sectors: string[] = [];
    const checks = [
      [/ai|semiconductor|chip|nvidia|amd|tsmc/i, 'AI / Semiconductors'],
      [/oil|gas|energy|opec|crude/i, 'Energy'],
      [/bank|yield|rate|fed|treasury/i, 'Rates / Financials'],
      [/crypto|bitcoin|ethereum/i, 'Crypto'],
      [/property|real estate|housing/i, 'Real Estate'],
    ] as const;
    for (const [pattern, sector] of checks) {
      if (pattern.test(text)) sectors.push(sector);
    }
    return sectors;
  }

  private inferSymbols(text: string): string[] {
    const matches = text.match(/\b[A-Z]{2,5}\b/g) ?? [];
    return Array.from(new Set(matches.filter((symbol) => !['THE', 'AND', 'FOR', 'WITH', 'FROM'].includes(symbol)))).slice(0, 6);
  }

  private parseGdeltDate(value?: string): string {
    if (!value) return new Date().toISOString();
    const match = value.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?(\d{2})?/);
    if (!match) return new Date(value).toISOString();
    const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;
    return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`).toISOString();
  }
}

interface FinnhubQuoteResponse {
  c?: number;
  d?: number;
  dp?: number;
  pc?: number;
  t?: number;
}

interface TwelveQuoteResponse {
  close?: string;
  price?: string;
  change?: string;
  percent_change?: string;
  volume?: string;
  datetime?: string;
  timestamp?: number;
  status?: string;
  message?: string;
}

interface AlphaQuoteResponse {
  'Global Quote'?: {
    '05. price'?: string;
    '06. volume'?: string;
    '07. latest trading day'?: string;
    '09. change'?: string;
    '10. change percent'?: string;
  };
}

interface FmpQuoteResponse {
  price?: number;
  change?: number;
  changesPercentage?: number;
  volume?: number;
}

interface FredResponse {
  observations?: Array<{ date: string; value: string }>;
}

interface CoinGeckoResponse {
  [id: string]: {
    usd?: number;
    usd_market_cap?: number;
    usd_24h_vol?: number;
    usd_24h_change?: number;
    last_updated_at?: number;
  } | undefined;
}

interface NewsApiResponse {
  articles?: Array<{
    title?: string;
    description?: string;
    url?: string;
    publishedAt?: string;
    source?: { name?: string };
  }>;
}

interface FmpNewsResponse {
  symbol?: string;
  publishedDate?: string;
  title?: string;
  image?: string;
  site?: string;
  text?: string;
  url?: string;
}

interface GdeltResponse {
  articles?: Array<{
    title?: string;
    url?: string;
    domain?: string;
    seendate?: string;
    language?: string;
  }>;
}

interface SecSubmissionsResponse {
  filings?: {
    recent?: {
      accessionNumber?: string[];
      form?: string[];
      filingDate?: string[];
      reportDate?: string[];
      primaryDocument?: string[];
    };
  };
}
