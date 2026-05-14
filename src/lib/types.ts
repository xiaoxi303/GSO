// Types for Global Market Intelligence Dashboard

export type Sentiment = 'bullish' | 'bearish' | 'neutral';
export type Duration = 'short' | 'medium' | 'long';
export type RiskLevel = 'low' | 'medium' | 'high' | 'extreme';
export type MarketType = 'US' | 'CN' | 'HK' | 'EU' | 'AS' | 'GLOBAL';
export type ApiHealth = 'healthy' | 'degraded' | 'offline' | 'missing_key' | 'limit_reached' | 'not_supported';
export type DataSourceCategory = 'market' | 'news' | 'macro' | 'crypto' | 'filings' | 'china';

export interface DataSourceStatus {
  id: string;
  name: string;
  category: DataSourceCategory;
  priority: number;
  configured: boolean;
  status: ApiHealth;
  message: string;
  lastChecked?: string;
  lastUpdated?: string;
  isRealtime: boolean;
  isDelayed: boolean;
  delaySeconds: number;
  quotaNote?: string;
}

export interface QuoteData {
  symbol: string;
  name: string;
  market: MarketType;
  assetType: 'stock' | 'index' | 'etf' | 'commodity' | 'forex' | 'crypto';
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  turnover: number;
  timestamp: string;
  source: string;
  sourceId?: string;
  isRealtime: boolean;
  isDelayed: boolean;
  delaySeconds: number;
  isCached?: boolean;
  isStale?: boolean;
  dataQuality?: 'actual' | 'proxy' | 'unavailable';
  notice?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  receivedAt: string;
  language: string;
  markets: MarketType[];
  relatedSectors: string[];
  relatedSymbols: string[];
  rawSummary: string;
  aiSummary?: string;
  isCached?: boolean;
  isStale?: boolean;
  dataQuality?: 'actual' | 'metadata_only';
  
  // AI Analysis results (can be undefined if not processed yet)
  sentiment?: Sentiment;
  impactScore?: number; // 1-5
  duration?: Duration;
  bullishSectors?: string[];
  bearishSectors?: string[];
  reason?: string;
  isBreaking?: boolean;
  sourceReliability?: number;
}

export interface NewsAnalysisSchema {
  title: string;
  event_type: 'policy' | 'earnings' | 'macro' | 'commodity' | 'technology' | 'geopolitics' | 'merger' | 'regulation' | 'industry';
  sentiment: Sentiment;
  bullish_sectors: string[];
  bearish_sectors: string[];
  affected_markets: MarketType[];
  impact_score: number; // 1-5
  duration: Duration;
  reason: string;
}

export interface SectorFundFlow {
  sector: string;
  market: MarketType;
  netInflow: number; // in local currency
  changePercent: number; // price change
  inflowRank: number;
  change5m: number;
  change30m: number;
  continuousInflowDays: number;
  representativeStocks: string[];
  timestamp: string;
  signal: 'strong_inflow' | 'weak_inflow' | 'neutral' | 'weak_outflow' | 'strong_outflow';
  aiReasoning?: string;
  source?: string;
  isRealtime?: boolean;
  isDelayed?: boolean;
  isStale?: boolean;
  dataQuality?: 'actual' | 'proxy' | 'unavailable';
  notice?: string;
}

export interface ETFData {
  symbol: string;
  name: string;
  market: MarketType;
  priceChangePercent: number;
  netInflow: number;
  volume24h: number;
  timestamp: string;
}

export interface InstitutionalView {
  institution: string;
  summary: string;
  bullishSectors: string[];
  bearishSectors: string[];
  targetMarkets: MarketType[];
  confidence: number; // 1-5
  isAlignedWithFlow: boolean;
}

export interface RiskSignal {
  id: string;
  riskType: string;
  riskLevel: RiskLevel;
  affectedMarkets: MarketType[];
  affectedSectors: string[];
  safeHavens?: string[]; // Beneficiary assets
  reason: string;
  timestamp: string;
}

export interface MarketSummary {
  sentiment: string;
  topConclusions: string[];
  bullishDrivers: string[];
  bearishDrivers: string[];
  inflowSectors: string[];
  outflowSectors: string[];
  shortTermStrong: string[];
  mediumTermFocus: string[];
  risksToAvoid: string[];
  tomorrowOutlook: string;
  timestamp: string;
}

export interface DashboardOverview {
  riskMood: 'Risk On' | 'Risk Off' | 'Neutral';
  status: {
    realtimeConnected: boolean;
    lastUpdated: string;
    dataDelay: string;
    activeSources: string[];
    apiHealth: 'healthy' | 'degraded' | 'offline';
    marketSession: string;
    sourceStatuses: DataSourceStatus[];
  };
  indexes: QuoteData[];
  macro: QuoteData[];
  sectors: SectorFundFlow[];
}

export interface SecFilingItem {
  accessionNumber: string;
  form: string;
  filingDate: string;
  reportDate?: string;
  primaryDocument: string;
  url: string;
}
