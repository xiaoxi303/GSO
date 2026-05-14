import { RealDataProvider } from '../providers/RealDataProvider';
import { MarketDataProvider, NewsProvider } from '../providers/types';
import { DataSourceStatus } from '../types';

// Registry for multi-provider failover. The real provider handles free-source
// priority, KV cache, rate limits, stale fallback, and health metadata.
export class DataService {
  private static currentProvider: MarketDataProvider & NewsProvider = new RealDataProvider();

  static setProvider(provider: MarketDataProvider & NewsProvider) {
    DataService.currentProvider = provider;
  }

  static async getOverview() {
    const [indexes, macro, sectorsUS, sectorsCN] = await Promise.all([
      DataService.currentProvider.getIndexQuotes().catch(() => []),
      DataService.currentProvider.getMacroData().catch(() => []),
      DataService.currentProvider.getSectorPerformance('US').catch(() => []),
      DataService.currentProvider.getSectorPerformance('CN').catch(() => []),
    ]);
    const sourceStatuses = await DataService.currentProvider.getSourceStatuses();

    const volatilityProxy = macro.find(item => item.symbol === 'VXX')?.changePercent || 0;
    const btc = macro.find(item => item.symbol === 'BTC')?.changePercent || 0;
    const nasdaqProxy = indexes.find(item => item.symbol === 'QQQ')?.changePercent || 0;

    let riskMood: 'Risk On' | 'Risk Off' | 'Neutral' = 'Neutral';
    if (volatilityProxy < 0 && (nasdaqProxy > 0.5 || btc > 1)) {
      riskMood = 'Risk On';
    } else if (volatilityProxy > 5 || (nasdaqProxy < -0.8 && btc < -2)) {
      riskMood = 'Risk Off';
    }

    return {
      riskMood,
      status: {
        realtimeConnected: indexes.some(item => item.isRealtime) || macro.some(item => item.isRealtime),
        lastUpdated: new Date().toISOString(),
        dataDelay: this.getDataDelayLabel([...indexes, ...macro]),
        activeSources: this.getActiveSources([...indexes, ...macro]),
        apiHealth: this.getApiHealth(sourceStatuses),
        marketSession: this.getMarketSession(),
        sourceStatuses,
      },
      indexes,
      macro,
      sectors: [...sectorsUS, ...sectorsCN],
    };
  }

  static async getLatestNews() {
    return DataService.currentProvider.getLatestNews();
  }

  static async getQuote(symbol: string) {
    return DataService.currentProvider.getQuote(symbol);
  }

  static async getSectorPerformance(market: string) {
    return DataService.currentProvider.getSectorPerformance(market);
  }

  static async getRiskSignals() {
    return DataService.currentProvider.getRiskSignals();
  }

  static async getMarketSummary() {
    return DataService.currentProvider.getMarketSummary();
  }

  static async getSourceStatuses() {
    return DataService.currentProvider.getSourceStatuses();
  }

  static async getSecFilings(cik: string) {
    return DataService.currentProvider.getSecFilings(cik);
  }

  private static getMarketSession(): string {
    const hour = new Date().getUTCHours();
    if (hour >= 1 && hour < 8) return '亚洲常规交易时段';
    if (hour >= 13 && hour < 21) return '欧美活跃交易时段';
    return '盘前 / 盘后非交易时段';
  }

  private static getActiveSources(items: Array<{ source?: string }>): string[] {
    return Array.from(new Set(items.map(item => item.source).filter((source): source is string => Boolean(source))));
  }

  private static getDataDelayLabel(items: Array<{ isDelayed?: boolean; delaySeconds?: number; isStale?: boolean }>): string {
    if (items.length === 0) return '暂无行情数据';
    if (items.some(item => item.isStale)) return '使用 stale 缓存';
    const delayed = items.filter(item => item.isDelayed);
    if (delayed.length === 0) return '实时或近实时';
    const maxDelay = Math.max(...delayed.map(item => item.delaySeconds ?? 0));
    if (maxDelay >= 86400) return '部分数据按日更新';
    if (maxDelay >= 3600) return '部分数据延迟超过 1 小时';
    return `免费源可能延迟约 ${Math.ceil(maxDelay / 60)} 分钟`;
  }

  private static getApiHealth(statuses: DataSourceStatus[]): 'healthy' | 'degraded' | 'offline' {
    const healthy = statuses.some(status => status.status === 'healthy');
    const blocking = statuses.some(status => status.status === 'offline' || status.status === 'limit_reached');
    if (!healthy) return 'offline';
    if (blocking || statuses.some(status => status.status === 'missing_key' || status.status === 'degraded' || status.status === 'not_supported')) {
      return 'degraded';
    }
    return 'healthy';
  }
}
