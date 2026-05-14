import { DataSourceStatus, QuoteData, NewsItem, SecFilingItem, SectorFundFlow, RiskSignal, MarketSummary, MarketType } from '../types';
import { MarketDataProvider, NewsProvider } from './types';

export class MockDataProvider implements MarketDataProvider, NewsProvider {
  name = 'MockEngine';
  priority = 99;
  supportsRealtime = true;

  private getRandomChange(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  private getTimestamp(): string {
    return new Date().toISOString();
  }

  async getQuote(symbol: string): Promise<QuoteData> {
    const price = symbol === 'BTC' ? 68500 + this.getRandomChange(-500, 500) : 150 + this.getRandomChange(-5, 5);
    const pct = this.getRandomChange(-2.5, 2.5);
    return {
      symbol,
      name: `Mock Asset ${symbol}`,
      market: 'GLOBAL',
      assetType: symbol === 'BTC' ? 'crypto' : 'stock',
      price,
      change: (price * pct) / 100,
      changePercent: pct,
      volume: Math.floor(Math.random() * 5000000),
      turnover: Math.floor(Math.random() * 100000000),
      timestamp: this.getTimestamp(),
      source: 'Mock Data',
      isRealtime: true,
      isDelayed: false,
      delaySeconds: 0,
    };
  }

  async getBatchQuotes(symbols: string[]): Promise<QuoteData[]> {
    return Promise.all(symbols.map(s => this.getQuote(s)));
  }

  async getIndexQuotes(): Promise<QuoteData[]> {
    const list: Partial<QuoteData>[] = [
      { symbol: '^IXIC', name: '纳斯达克', market: 'US', assetType: 'index', price: 16274.94, changePercent: 1.24 },
      { symbol: '^GSPC', name: '标普 500', market: 'US', assetType: 'index', price: 5222.68, changePercent: 0.89 },
      { symbol: '000001.SS', name: '上证指数', market: 'CN', assetType: 'index', price: 3123.55, changePercent: -0.18 },
      { symbol: '399001.SZ', name: '深证成指', market: 'CN', assetType: 'index', price: 9541.12, changePercent: -0.32 },
      { symbol: '^HSI', name: '恒生指数', market: 'HK', assetType: 'index', price: 18532.64, changePercent: 1.55 },
      { symbol: '^N225', name: '日经 225', market: 'AS', assetType: 'index', price: 38157.94, changePercent: 0.42 },
      { symbol: '^GDAXI', name: '德国 DAX', market: 'EU', assetType: 'index', price: 18404.90, changePercent: 0.65 },
    ];

    return list.map(idx => {
      const jitter = this.getRandomChange(-0.05, 0.05);
      const finalPct = (idx.changePercent || 0) + jitter;
      const curPrice = (idx.price || 0) * (1 + jitter / 100);
      return {
        symbol: idx.symbol!,
        name: idx.name!,
        market: idx.market!,
        assetType: idx.assetType!,
        price: parseFloat(curPrice.toFixed(2)),
        change: parseFloat((curPrice * (finalPct / 100)).toFixed(2)),
        changePercent: parseFloat(finalPct.toFixed(2)),
        volume: Math.floor(Math.random() * 10000000),
        turnover: Math.floor(Math.random() * 100000000),
        timestamp: this.getTimestamp(),
        source: 'Simulated Feed',
        isRealtime: true,
        isDelayed: false,
        delaySeconds: 0,
      };
    });
  }

  async getMacroData(): Promise<QuoteData[]> {
    const list: Partial<QuoteData>[] = [
      { symbol: 'US10Y', name: '美债 10 年收益率', market: 'US', assetType: 'commodity', price: 4.421, changePercent: 0.54 },
      { symbol: 'DXY', name: '美元指数', market: 'GLOBAL', assetType: 'forex', price: 105.12, changePercent: -0.12 },
      { symbol: 'GC=F', name: 'COMEX 黄金', market: 'GLOBAL', assetType: 'commodity', price: 2354.20, changePercent: 0.85 },
      { symbol: 'CL=F', name: 'WTI 原油', market: 'GLOBAL', assetType: 'commodity', price: 79.45, changePercent: -1.02 },
      { symbol: '^VIX', name: 'VIX 恐慌指数', market: 'US', assetType: 'index', price: 13.45, changePercent: -3.22 },
      { symbol: 'BTC', name: '比特币', market: 'GLOBAL', assetType: 'crypto', price: 66125.30, changePercent: 2.45 },
    ];
    return list.map(item => {
      const jitter = this.getRandomChange(-0.1, 0.1);
      const finalPct = (item.changePercent || 0) + jitter;
      const basePrice = (item.price || 0);
      const finalPrice = item.symbol === 'US10Y' ? basePrice + jitter * 0.01 : basePrice * (1 + jitter / 100);
      return {
        symbol: item.symbol!,
        name: item.name!,
        market: item.market!,
        assetType: item.assetType!,
        price: parseFloat(finalPrice.toFixed(item.symbol === 'US10Y' ? 3 : 2)),
        change: parseFloat((finalPrice * (finalPct / 100)).toFixed(3)),
        changePercent: parseFloat(finalPct.toFixed(2)),
        volume: Math.floor(Math.random() * 50000),
        turnover: Math.floor(Math.random() * 100000),
        timestamp: this.getTimestamp(),
        source: 'Simulated Macro',
        isRealtime: true,
        isDelayed: false,
        delaySeconds: 0,
      };
    });
  }

  async getSectorPerformance(market: string): Promise<SectorFundFlow[]> {
    const usSectors = [
      { sector: 'AI 算力', netInflow: 2500000000, changePercent: 2.45, stocks: ['NVDA', 'AMD', 'AVGO'] },
      { sector: '半导体', netInflow: 1800000000, changePercent: 1.89, stocks: ['TSM', 'ASML', 'MU'] },
      { sector: '云计算', netInflow: 1200000000, changePercent: 1.12, stocks: ['MSFT', 'AMZN', 'GOOG'] },
      { sector: '金融科技', netInflow: 450000000, changePercent: 0.34, stocks: ['JPM', 'V', 'PYPL'] },
      { sector: '传统能源', netInflow: -550000000, changePercent: -1.45, stocks: ['XOM', 'CVX', 'SLB'] },
      { sector: '医疗保健', netInflow: -120000000, changePercent: -0.12, stocks: ['LLY', 'JNJ', 'UNH'] },
      { sector: '国防军工', netInflow: 850000000, changePercent: 1.25, stocks: ['LMT', 'RTX', 'NOC'] },
    ];

    const cnSectors = [
      { sector: '人工智能', netInflow: 1200000000, changePercent: 1.85, stocks: ['科大讯飞', '工业富联', '浪潮信息'] },
      { sector: '低空经济', netInflow: 850000000, changePercent: 4.21, stocks: ['中信海直', '万丰奥威', '宗申动力'] },
      { sector: '半导体设备', netInflow: 980000000, changePercent: 2.15, stocks: ['北方华创', '中微公司', '拓荆科技'] },
      { sector: '新能源车', netInflow: -450000000, changePercent: -0.85, stocks: ['比亚迪', '赛力斯', '宁德时代'] },
      { sector: '光伏产业链', netInflow: -780000000, changePercent: -2.34, stocks: ['隆基绿能', '阳光电源', '通威股份'] },
      { sector: '地产链', netInflow: 1500000000, changePercent: 3.55, stocks: ['万科A', '保利发展', '招商蛇口'] },
      { sector: '白酒医药', netInflow: -320000000, changePercent: -0.55, stocks: ['贵州茅台', '五粮液', '恒瑞医药'] },
    ];

    const source = market === 'CN' ? cnSectors : usSectors;
    const mkt = (market as MarketType) || 'US';

    return source.map((s, idx) => {
      const jitter = this.getRandomChange(-0.3, 0.3);
      const inflow = s.netInflow * (1 + this.getRandomChange(-0.1, 0.1));
      const changePercent = s.changePercent + jitter;
      
      let signal: SectorFundFlow['signal'] = 'neutral';
      if (inflow > 1000000000 && changePercent > 1.5) signal = 'strong_inflow';
      else if (inflow > 0 && changePercent > 0) signal = 'weak_inflow';
      else if (inflow < -500000000 && changePercent < -1.0) signal = 'strong_outflow';
      else if (inflow < 0 && changePercent < 0) signal = 'weak_outflow';

      return {
        sector: s.sector,
        market: mkt,
        netInflow: Math.floor(inflow),
        changePercent: parseFloat(changePercent.toFixed(2)),
        inflowRank: idx + 1,
        change5m: Math.floor(inflow * this.getRandomChange(0.01, 0.05)),
        change30m: Math.floor(inflow * this.getRandomChange(0.1, 0.25)),
        continuousInflowDays: Math.floor(Math.random() * 5),
        representativeStocks: s.stocks,
        timestamp: this.getTimestamp(),
        signal,
        aiReasoning: `受盘中 ${s.sector} 核心概念及利好情绪催化，主力资金呈现${signal === 'strong_inflow' ? '显著抢筹' : '小幅流入'}态势。`,
      };
    });
  }

  async getLatestNews(): Promise<NewsItem[]> {
    return [
      {
        id: 'n1',
        title: '英伟达宣布推迟Blackwell出货的传闻不实，Blackwell 需求依然火爆，供应链开始全面铺货',
        source: 'Reuters',
        url: 'https://www.reuters.com/nvidia-update',
        publishedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        receivedAt: this.getTimestamp(),
        language: 'zh-CN',
        markets: ['US', 'HK', 'CN'],
        relatedSectors: ['AI算力', '半导体', '液冷', '光模块'],
        relatedSymbols: ['NVDA', 'AMD', 'TSM', '工业富联'],
        rawSummary: '分析师重申买入评级，认为Blackwell架构在三季度交付进展顺利。',
        aiSummary: '英伟达Blackwell芯片辟谣延迟，产业供需两旺，产业链情绪被点燃。',
        sentiment: 'bullish',
        impactScore: 5,
        duration: 'medium',
        bullishSectors: ['AI算力', '光模块', '先进封装'],
        bearishSectors: ['传统服务器'],
        reason: '该信息有力回击了盘中对于硬件延迟交付的悲观预期，对美股及A股AI算力板块构成显著利好。',
        isBreaking: true,
        sourceReliability: 0.95
      },
      {
        id: 'n2',
        title: '国家统计局：多措并举刺激住房需求，一线城市全面放松限购传闻再起',
        source: '财联社',
        url: 'https://cls.cn/property-policy',
        publishedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        receivedAt: this.getTimestamp(),
        language: 'zh-CN',
        markets: ['CN', 'HK'],
        relatedSectors: ['房地产', '水泥建材', '白酒'],
        relatedSymbols: ['万科A', '保利发展', '龙湖集团'],
        rawSummary: '多地政府近期陆续出台房地产优化调控政策。',
        aiSummary: '政策利好预期持续发酵，推动地产及上下游产业链大涨。',
        sentiment: 'bullish',
        impactScore: 4,
        duration: 'short',
        bullishSectors: ['房地产', '建材', '钢铁'],
        bearishSectors: [],
        reason: '地产支持政策是目前内需信心的关键锚点，短期情绪释放强烈。',
        isBreaking: false,
        sourceReliability: 0.9
      },
      {
        id: 'n3',
        title: '美联储两位官员重申“鹰派”立场：若通胀顽固，不排除重新加息的可能',
        source: 'Bloomberg',
        url: 'https://bloomberg.com/fed-officials',
        publishedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        receivedAt: this.getTimestamp(),
        language: 'zh-CN',
        markets: ['US', 'GLOBAL'],
        relatedSectors: ['成长股', '黄金', '纳斯达克'],
        relatedSymbols: ['TLT', 'GLD', 'QQQ'],
        rawSummary: '鹰派发言导致美债收益率在美盘盘前拉升，压制成长股表现。',
        aiSummary: '美联储鹰派重弹压制了降息预期，推升短端美债利率。',
        sentiment: 'bearish',
        impactScore: 4,
        duration: 'long',
        bullishSectors: ['美元指数', '货币市场'],
        bearishSectors: ['科技成长股', '黄金', '高成长ETF'],
        reason: '鹰派论调使得折现率面临高位，直接压制高估值的科技成长风格。',
        isBreaking: true,
        sourceReliability: 0.98
      },
      {
        id: 'n4',
        title: '中东局势出现短暂缓和迹象，主要国家达成停火框架共识，国际油价跌破80美元',
        source: 'CNBC',
        url: 'https://cnbc.com/oil-drop',
        publishedAt: new Date(Date.now() - 60 * 1000 * 90).toISOString(),
        receivedAt: this.getTimestamp(),
        language: 'zh-CN',
        markets: ['GLOBAL'],
        relatedSectors: ['石油天然气', '航运航空', '交运'],
        relatedSymbols: ['XOM', 'CVX', 'UAL', 'DAL'],
        rawSummary: '避险情绪降温与停火谈判提振民航股，原油期货重挫。',
        aiSummary: '地缘危机消解导致油价下跌，利好航空物流等低能耗下游，利空传统能源。',
        sentiment: 'neutral',
        impactScore: 3,
        duration: 'medium',
        bullishSectors: ['航运', '物流', '航空'],
        bearishSectors: ['油气开采', '油服'],
        reason: '油价下跌显著降低了下游航空交通运输业的燃油成本压力，但导致上游能源巨头盈利预期下修。',
        isBreaking: false,
        sourceReliability: 0.88
      }
    ];
  }

  async getCompanyNews(symbol: string): Promise<NewsItem[]> {
    const news = await this.getLatestNews();
    return news.filter(n => n.relatedSymbols.includes(symbol));
  }

  async getRiskSignals(): Promise<RiskSignal[]> {
    return [
      {
        id: 'r1',
        riskType: '美债收益率攀升',
        riskLevel: 'medium',
        affectedMarkets: ['US', 'GLOBAL'],
        affectedSectors: ['科技成长股', '高估值科创'],
        safeHavens: ['美元', '短期美债'],
        reason: '由于联储官员发表鹰派言论，10年期美债收益率在5分钟内飙升 4.5 个基点，触及 4.42% 关口。',
        timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString()
      },
      {
        id: 'r2',
        riskType: '大宗商品异动',
        riskLevel: 'low',
        affectedMarkets: ['GLOBAL'],
        affectedSectors: ['能源开采', '石油石化'],
        safeHavens: ['航空', '交运'],
        reason: 'WTI 原油盘中跌破 80 美元整数支撑，连续三天放量下行，关注对能源板块主力流出的压制。',
        timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString()
      }
    ];
  }

  async getMarketSummary(): Promise<MarketSummary> {
    return {
      sentiment: '偏向Risk-On，但科技与顺周期分化加剧',
      topConclusions: [
        '全球流动性情绪受英伟达供应链乐观进展点燃，算力与半导体仍为主力抢筹方向。',
        '中国房地产政策发酵，使得顺周期地产链出现久违的大幅反弹，带动指数企稳。',
        '美联储鹰派声音回潮，美债收益率快速上行对纳斯达克非科技成长股构成估值压力。'
      ],
      bullishDrivers: [
        '英伟达Blackwell芯片澄清与AI硬科技持续高景气',
        '中国房地产政策传闻大幅改善顺周期风险偏好'
      ],
      bearishDrivers: [
        '美债收益率持续上行打压折现因子',
        '油价下跌打击美股传统能源股权重板块'
      ],
      inflowSectors: ['AI算力', '房地产', '半导体', '低空经济'],
      outflowSectors: ['传统能源', '光伏', '白酒医药'],
      shortTermStrong: ['房地产概念股', '低空经济', '光模块CPO'],
      mediumTermFocus: ['英伟达AI芯片链', '先进半导体设备'],
      risksToAvoid: ['高能耗航运概念(波动剧烈)', '估值过高的CXO药企'],
      tomorrowOutlook: '密切关注晚间美国CPI前瞻数据及美债标售，若美债收益率企稳回撤，科技股将迎来进一步的上行催化。',
      timestamp: this.getTimestamp()
    };
  }

  async getSourceStatuses(): Promise<DataSourceStatus[]> {
    return [
      {
        id: 'mock',
        name: 'Mock Data',
        category: 'market',
        priority: 99,
        configured: true,
        status: 'degraded',
        message: 'Mock provider is for development only and must not be used as real market data.',
        lastChecked: this.getTimestamp(),
        lastUpdated: this.getTimestamp(),
        isRealtime: false,
        isDelayed: true,
        delaySeconds: 0,
      },
    ];
  }

  async getSecFilings(_cik: string): Promise<SecFilingItem[]> {
    void _cik;
    return [];
  }
}
