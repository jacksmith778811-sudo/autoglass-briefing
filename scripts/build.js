import Parser from 'rss-parser';
import fs from 'fs';

const parser = new Parser();

// Expanded sources: targeted Google News queries + industry RSS + safety orgs
const feeds = [
  // Google News targeted queries
  'https://news.google.com/rss/search?q=%28automotive+windshield+OR+windscreen+OR+%22auto+glass%22+OR+%22windshield+replacement%22+OR+%22windshield+repair%22+OR+%22ADAS+calibration%22%29&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=%28windshield+recall+OR+windshield+crack+OR+laminated+glass%29&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=%28Safelite+OR+Belron+OR+Pilkington+OR+NSG+OR+Xinyi+Glass%29+%28windshield+OR+glass%29&hl=en-US&gl=US&ceid=US:en',

  // Industry / trade feeds
  'https://www.glassbytes.com/feed/',
  'https://www.agrrmag.com/feed/',
  'https://www.repairerdrivennews.com/feed/',

  // Safety / testing orgs
  'https://www.iihs.org/rss/news',
  // NHTSA site sometimes changes RSS endpoints; keep but ignore errors gracefully
  'https://www.nhtsa.gov/rss' 
];

const relevance = (title = '', link = '') => {
  const hay = `${title} ${link}`.toLowerCase();
  return /windshield|windscreen|auto\s*glass|adas|calibration|glassbyte|safelite|belron|pilkington|laminated/.test(hay);
};

function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const key = (it.link || '').replace(/\?.*$/, '').toLowerCase();
    if (key && !seen.has(key)) { seen.add(key); out.push(it); }
  }
  return out;
}

function toDate(x) {
  const d = new Date(x || 0);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

function esc(s='') { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

(async () => {
  const all = [];
  for (const url of feeds) {
    try {
      const feed = await parser.parseURL(url);
      for (const item of feed.items || []) {
        all.push({
          source: feed.title || url,
          title: item.title || '(untitled)',
          link: item.link || '',
          pubDate: item.isoDate || item.pubDate || null,
          date: toDate(item.isoDate || item.pubDate)
        });
      }
    } catch (e) {
      console.error('Feed error', url, e.message);
    }
  }
  const now = new Date();
  const h = (n) => 1000*60*60*n;
  const cutoffTight = new Date(now.getTime() - h(72)); // try last 72h first
  const cutoffLoose = new Date(now.getTime() - h(14*24)); // fallback to 14 days if quiet

  let items = dedupe(all)
    .filter(it => it.date > cutoffTight)
    .filter(it => relevance(it.title, it.link))
    .sort((a,b) => b.date - a.date);

  if (items.length < 10) {
    items = dedupe(all)
      .filter(it => it.date > cutoffLoose)
      .filter(it => relevance(it.title, it.link))
      .sort((a,b) => b.date - a.date);
  }

  items = items.slice(0, 40);

  const dateStr = now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', weekday:'long', month:'long', day:'numeric', year:'numeric' });

  const list = items.map(it => `
      <li>
        <a href="${esc(it.link)}" target="_blank" rel="noopener">${esc(it.title)}</a>
        <span class="src">${esc(it.source)}</span>
        <time>${it.date.toLocaleString('en-US', { hour: '2-digit', minute:'2-digit', month:'short', day:'numeric' })}</time>
      </li>`).join('\n');

  const emptyMsg = '<li>No recent headlines matched yet. Please check back soon.</li>';

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Automotive Glass Daily Briefing</title>
  <meta name="description" content="Curated headlines on automotive glass: windshield replacement, ADAS calibration, supply chain, and industry news." />
  <style>
    :root { color-scheme: light dark; }
    body { margin: 0; font: 16px/1.5 -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
    header { padding: 32px 20px; text-align: center; background: #0b132b; color: #e0e6f8; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    .date { opacity: 0.9; }
    main { max-width: 820px; margin: 24px auto; padding: 0 16px 40px; }
    ul { list-style: none; padding: 0; margin: 0; }
    li { padding: 14px 12px; border-bottom: 1px solid rgba(0,0,0,0.08); display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: baseline; }
    li a { color: #174ea6; text-decoration: none; font-weight: 600; }
    li a:hover { text-decoration: underline; }
    .src { font-size: 12px; opacity: 0.7; margin-left: 8px; }
    time { font-size: 12px; opacity: 0.7; }
    footer { text-align: center; padding: 20px; opacity: 0.7; font-size: 13px; }
  </style>
</head>
<body>
  <header>
    <h1>Automotive Glass Daily Briefing</h1>
    <div class="date">${esc(dateStr)} (PT)</div>
  </header>
  <main>
    <ul>
      ${list || emptyMsg}
    </ul>
  </main>
  <footer>
    Sources: Google News queries, glassBYTEs, AGRR Magazine, Repairer Driven News, IIHS, NHTSA.
  </footer>
</body>
</html>`;

  fs.writeFileSync('docs/index.html', html);
  console.log(`Wrote ${items.length} items`);
})();
