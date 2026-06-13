# All about Arsenal — Arsenal FC News Blog (Self-Hosted)

A self-hosted Node.js news aggregator that fetches Arsenal FC headlines from multiple RSS feeds every 30 minutes, classifies them by category, and serves a polished editorial frontend.

```
all-about-arsenal/
├── server.js          # Express server + cron scheduler
├── fetcher.js         # RSS fetcher, classifier, deduplicator
├── public/
│   ├── index.html     # Frontend (loads /api/articles)
│   └── articles.json  # Written by fetcher, served as static file
├── Dockerfile
├── package.json
└── .gitignore
```

---

## Quick start

```bash
git clone <your-repo>
cd all-about-arsenal
npm install
npm start
# → http://localhost:3000
```

The server fetches all RSS feeds immediately on startup, writes `public/articles.json`, then re-fetches every 30 minutes automatically.

---

## How it works

```
Startup / Cron (every 30 min)
        │
        ▼
  fetcher.fetchAll()
        │
        ├─ Fetch 7 RSS feeds in parallel (BBC Sport, Guardian,
        │  Just Arsenal, Sky Sports, ESPN, Google News ×2)
        │
        ├─ Filter: keep only Arsenal-related items
        │  (title/description contains "arsenal", "gunners", "emirates")
        │
        ├─ Classify tag per article:
        │   ucl       → "champions league", "psg", "ucl"
        │   transfer  → "transfer", "signing", "bid", "deal", "fee"
        │   wc        → "world cup", "fifa", "international squad"
        │   match     → "match report", "result", "goal", "beat"
        │   news      → everything else
        │
        ├─ Sort by pubDate descending
        ├─ Deduplicate by URL
        └─ Write → public/articles.json  { updatedAt, articles[] }
                          │
                          ▼
              Express serves /api/articles
                          │
                          ▼
              index.html fetches on load
              + auto-reloads every 30 min
              + "Refresh now" button triggers POST /api/refresh
```

---

## RSS feeds

| Feed | Source | Default tag |
|---|---|---|
| `feeds.bbci.co.uk/sport/football/teams/arsenal/rss.xml` | BBC Sport | news |
| `theguardian.com/football/arsenal/rss` | The Guardian | news |
| `justarsenal.com/feed` | Just Arsenal | news |
| `skysports.com/rss/12040` | Sky Sports | news |
| `espn.com/espn/rss/soccer/news` | ESPN FC | news |
| Google News — `Arsenal FC transfer` | Google News | transfer |
| Google News — `Arsenal World Cup 2026` | Google News | wc |

Add more feeds in `fetcher.js` by appending to the `FEEDS` array:

```js
{
  url: 'https://example.com/rss.xml',
  source: 'Example Source',
  defaultTag: 'news',   // fallback if classifier doesn't match
}
```

---

## Article data shape

Each article written to `articles.json`:

```json
{
  "title":  "Arsenal bid £40m for Serie A full-back",
  "url":    "https://www.justarsenal.com/...",
  "image":  "https://cdn.example.com/image.jpg",
  "date":   "2h ago",
  "source": "Just Arsenal",
  "tag":    "transfer"
}
```

`image` is extracted from `media:content`, `media:thumbnail`, `enclosure`, or the first `<img>` in the feed item body, in that order. Falls back to a coloured placeholder icon in the UI.

---

## API endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/articles` | Returns cached `articles.json` (60s cache header) |
| `POST` | `/api/refresh` | Triggers an immediate RSS fetch outside the cron schedule |
| `GET` | `/api/health` | Returns server status and last write timestamp |

### Example health response
```json
{
  "status": "ok",
  "dataReady": true,
  "lastWrite": "2026-06-06T10:45:00.000Z"
}
```

---

## Configuration

| Environment variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port the server listens on |

Change the cron schedule in `server.js`:

```js
// Every 30 minutes (default)
cron.schedule('*/30 * * * *', () => { ... });

// Every 15 minutes
cron.schedule('*/15 * * * *', () => { ... });

// Every hour at :00
cron.schedule('0 * * * *', () => { ... });
```

---

## npm scripts

```bash
npm start         # Start server (production)
npm run dev       # Start with --watch (auto-restart on file changes)
npm run fetch     # Run a one-off RSS fetch without starting the server
```

---

## Docker

```bash
# Build
docker build -t all-about-arsenal .

# Run
docker run -p 3000:3000 all-about-arsenal
```

The container exposes port 3000. `articles.json` is written inside the container — mount a volume if you want it to persist across restarts:

```bash
docker run -p 3000:3000 -v $(pwd)/data:/app/public all-about-arsenal
```

---

## License

MIT —  #COYG 🔴
