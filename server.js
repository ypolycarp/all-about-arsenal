const express = require('express');
const cron    = require('node-cron');
const path    = require('path');
const fs      = require('fs');
const { fetchAll } = require('./fetcher');

const app  = express();
const PORT = process.env.PORT || 3000;

// Serve static files (index.html, articles.json, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint — returns the latest cached articles
app.get('/api/articles', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'articles.json');
  if (!fs.existsSync(filePath)) {
    return res.status(503).json({ error: 'Articles not yet fetched. Try again in a moment.' });
  }
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.sendFile(filePath);
});

// Manual refresh endpoint (useful for testing without waiting for cron)
app.post('/api/refresh', async (req, res) => {
  try {
    const articles = await fetchAll();
    res.json({ ok: true, count: articles.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'articles.json');
  const exists   = fs.existsSync(filePath);
  const stat     = exists ? fs.statSync(filePath) : null;
  res.json({
    status:    'ok',
    dataReady: exists,
    lastWrite: stat ? stat.mtime.toISOString() : null,
  });
});

// Cron: fetch every 30 minutes
cron.schedule('*/30 * * * *', () => {
  console.log('[cron] Triggering scheduled RSS fetch…');
  fetchAll().catch(err => console.error('[cron] Fetch error:', err.message));
});

// Initial fetch on startup so the page has data immediately
fetchAll().catch(err => console.error('[startup] Initial fetch failed:', err.message));

app.listen(PORT, () => {
  console.log(`[server] All about Arsenal running on http://localhost:${PORT}`);
  console.log('[server] Cron scheduled: every 30 minutes');
});
