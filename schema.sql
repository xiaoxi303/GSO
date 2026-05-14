-- D1 Tables for Global Market Intelligence

DROP TABLE IF EXISTS news_items;
CREATE TABLE news_items (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    source TEXT NOT NULL,
    url TEXT,
    published_at TEXT,
    received_at TEXT,
    language TEXT,
    raw_summary TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS news_analysis;
CREATE TABLE news_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    news_id TEXT UNIQUE,
    sentiment TEXT,
    impact_score INTEGER,
    duration TEXT,
    bullish_sectors TEXT, -- JSON list
    bearish_sectors TEXT, -- JSON list
    related_symbols TEXT, -- JSON list
    reason TEXT,
    model TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS market_snapshots;
CREATE TABLE market_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    market TEXT,
    symbol TEXT,
    price REAL,
    change REAL,
    change_percent REAL,
    volume INTEGER,
    source TEXT,
    is_realtime BOOLEAN,
    is_delayed BOOLEAN,
    delay_seconds INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS fund_flow_snapshots;
CREATE TABLE fund_flow_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    market TEXT,
    sector TEXT,
    net_inflow REAL,
    change_5m REAL,
    change_30m REAL,
    representative_stocks TEXT, -- JSON list
    source TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS risk_signals;
CREATE TABLE risk_signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    risk_type TEXT,
    risk_level TEXT,
    affected_markets TEXT,
    affected_sectors TEXT,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
