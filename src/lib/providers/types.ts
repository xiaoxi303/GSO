import { DataSourceStatus, MarketSummary, QuoteData, NewsItem, SecFilingItem, SectorFundFlow, RiskSignal } from '../types';

export interface MarketDataProvider {
  name: string;
  priority: number;
  supportsRealtime: boolean;
  
  getQuote(symbol: string): Promise<QuoteData>;
  getBatchQuotes(symbols: string[]): Promise<QuoteData[]>;
  getIndexQuotes(): Promise<QuoteData[]>;
  getMacroData(): Promise<QuoteData[]>;
  getSectorPerformance(market: string): Promise<SectorFundFlow[]>;
  getRiskSignals(): Promise<RiskSignal[]>;
  getMarketSummary(): Promise<MarketSummary>;
  getSourceStatuses(): Promise<DataSourceStatus[]>;
  getSecFilings(cik: string): Promise<SecFilingItem[]>;
}

export interface NewsProvider {
  name: string;
  priority: number;
  getLatestNews(): Promise<NewsItem[]>;
  getCompanyNews(symbol: string): Promise<NewsItem[]>;
}

export interface FundFlowProvider {
  name: string;
  priority: number;
  getSectorFundFlow(market: string): Promise<SectorFundFlow[]>;
}
