const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');

const parser = new Parser({
  timeout: 10000,
  headers: { 'User-Agent': 'AllAboutArsenal/1.0 (Arsenal News Aggregator)' },
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: false }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: false }],
      ['enclosure', 'enclosure', { keepArray: false }],
    ],
  },
});

const FEEDS = [
  {
    url: 'https://feeds.bbci.co.uk/sport/football/teams/arsenal/rss.xml',
    source: 'BBC Sport',
    defaultTag: 'news',
  },
  {
    url: 'https://www.theguardian.com/football/arsenal/rss',
    source: 'The Guardian',
    defaultTag: 'news',
  },
  {
    url: 'https://www.justarsenal.com/feed',
    source: 'Just Arsenal',
    defaultTag: 'news',
  },
  {
    url: 'https://www.skysports.com/rss/12040',
    source: 'Sky Sports',
    defaultTag: 'news',
  },
  {
    url: 'https://www.espn.com/espn/rss/soccer/news',
    source: 'ESPN FC',
    defaultTag: 'news',
  },
  {
    url: 'https://news.google.com/rss/search?q=Arsenal+FC+transfer&hl=en-GB&gl=GB&ceid=GB:en',
    source: 'Google News',
    defaultTag: 'transfer',
  },
  {
    url: 'https://news.google.com/rss/search?q=Arsenal+World+Cup+2026&hl=en-GB&gl=GB&ceid=GB:en',
    source: 'Google News',
    defaultTag: 'wc',
  },
];

const KEYWORDS = {
  ucl:      ['champions league', 'ucl', 'psg', 'budapest', 'european'],
  transfer: ['transfer', 'signing', 'signed', 'bid', 'deal', 'fee', 'window', 'loan', 'contract', 'rumour', 'target', 'linked'],
  wc:       ['world cup', 'worldcup', 'fifa', 'international', 'england squad', 'france squad', 'brazil squad', 'spain squad', 'norway squad'],
  match:    ['match report', 'vs ', 'result', 'goal', 'goals', 'score', 'beat', 'won', 'lost', 'drew', 'victory', 'defeat'],
};

function classifyTag(title, description, defaultTag) {
  const text = (title + ' ' + (description || '')).toLowerCase();
  for (const [tag, words] of Object.entries(KEYWORDS)) {
    if (words.some(w => text.includes(w))) return tag;
  }
  return defaultTag;
}

function extractImage(item) {
  if (item.mediaContent?.$.url)    return item.mediaContent.$.url;
  if (item.mediaThumbnail?.$.url)  return item.mediaThumbnail.$.url;
  if (item.enclosure?.url)         return item.enclosure.url;
  const match = (item.content || item.contentSnippet || item['content:encoded'] || '')
    .match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

function formatRelativeDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const diffMin = Math.floor((Date.now() - d) / 60000);
    if (diffMin < 60)   return diffMin <= 1 ? 'Just now' : `${diffMin}m ago`;
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
    if (diffMin < 2880) return 'Yesterday';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function isArsenalRelated(title, description) {
  const text = (title + ' ' + (description || '')).toLowerCase();
  return text.includes('arsenal') || text.includes('gunners') || text.includes('emirates');
}

function deduplicateByUrl(articles) {
  const seen = new Set();
  return articles.filter(a => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });
}

async function fetchFeed(feed) {
  try {
    const parsed = await parser.parseURL(feed.url);
    return parsed.items
      .filter(item => isArsenalRelated(item.title || '', item.contentSnippet || ''))
      .map(item => ({
        title:   (item.title || 'Untitled').replace(/&amp;/g, '&').replace(/&#039;/g, "'"),
        url:     item.link || item.guid || '#',
        image:   extractImage(item),
        date:    formatRelativeDate(item.pubDate || item.isoDate),
        rawDate: item.pubDate || item.isoDate || '',
        source:  feed.source,
        tag:     classifyTag(item.title || '', item.contentSnippet || '', feed.defaultTag),
      }));
  } catch (err) {
    console.warn(`[fetcher] Failed to fetch ${feed.source} (${feed.url}): ${err.message}`);
    return [];
  }
}

async function fetchAll() {
  console.log('[fetcher] Starting RSS fetch…');
  const results = await Promise.allSettled(FEEDS.map(fetchFeed));

  const all = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value)
    .sort((a, b) => new Date(b.rawDate) - new Date(a.rawDate));

  const deduped = deduplicateByUrl(all);

  // Strip rawDate before writing — it's only needed for sorting
  const articles = deduped.map(({ rawDate, ...rest }) => rest);

  const outputPath = path.join(__dirname, 'public', 'articles.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify({ updatedAt: new Date().toISOString(), articles }, null, 2));

  console.log(`[fetcher] Done — ${articles.length} articles written to public/articles.json`);
  return articles;
}

module.exports = { fetchAll };
