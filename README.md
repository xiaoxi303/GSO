# Global Market Intelligence

Cloudflare-first market dashboard using free or low-cost data sources. API keys stay on the server; the browser only calls local `/api/*` routes.

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Free Source Priority

Market data:
- Finnhub: `FINNHUB_API_KEY`
- Twelve Data Basic: `TWELVE_DATA_API_KEY`
- Alpha Vantage: `ALPHA_VANTAGE_API_KEY`
- Financial Modeling Prep: `FMP_API_KEY`

News metadata:
- NewsAPI: `NEWS_API_KEY`
- Finnhub News: `FINNHUB_API_KEY`
- GDELT: no key
- RSS feeds: no key

Macro / crypto / filings:
- FRED: `FRED_API_KEY`
- EIA: `EIA_API_KEY`
- CoinGecko Demo: `COINGECKO_API_KEY` optional for simple price calls
- SEC EDGAR: no key, but `SEC_CONTACT_EMAIL` is required for the User-Agent

China data:
- AKShare requires a Python sidecar or scheduled D1/KV sync because Cloudflare Workers cannot run Python.
- Tushare Pro uses `TUSHARE_TOKEN`; availability depends on token permissions and points.

## Cloudflare Secrets

Store keys with Wrangler secrets:

```bash
npx wrangler secret put FINNHUB_API_KEY
npx wrangler secret put TWELVE_DATA_API_KEY
npx wrangler secret put ALPHA_VANTAGE_API_KEY
npx wrangler secret put FMP_API_KEY
npx wrangler secret put NEWS_API_KEY
npx wrangler secret put FRED_API_KEY
npx wrangler secret put EIA_API_KEY
npx wrangler secret put COINGECKO_API_KEY
npx wrangler secret put TUSHARE_TOKEN
npx wrangler secret put SEC_CONTACT_EMAIL
```

The dashboard displays source, update time, realtime/delayed flags, cache/stale state, API key missing, and API limit reached statuses. Delayed free data is never labeled as realtime.

## Cloudflare Runtime

`wrangler.toml` binds:
- `MARKET_CACHE` for quote, macro, rate-limit, and stale cache entries
- `NEWS_CACHE` for news metadata and SEC filing cache
- `DB` for future D1 ingestion

Run Cloudflare preview:

```bash
npm run preview
```
