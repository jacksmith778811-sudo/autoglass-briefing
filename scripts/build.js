import Parser from 'rss-parser';
import fs from 'fs';

const parser = new Parser();

const feeds = [
  'https://news.google.com/rss/search?q=automotive+glass+OR+windshield+replacement+OR+ADAS+calibration&hl=en-US&gl=US&ceid=US:en',
  'https://glassbytes.com/feed/'
];

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
  const cutoff = new Date(now.getTime() - 1000*60*60*36); // last 36 hours
  const items = dedupe(all)
    .filter(it => it.date > cutoff)
    .sort((a,b) => b.date - a.date)
    .slice(0, 25);

  const dateStr = now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', weekday:'long', month:'long', day:'numeric', year:'numeric' });

  const list = items.map(it => `
      <li>
        <a href="${esc(it.link)}" target="_blank" rel="noopener">${esc(it.title)}</a>
        <span class="src">${esc(it.source)}</span>
        <time>${it.date.toLocaleString('en-US', { hour: '2-digit', minute:'2-digit', month:'short', day:'numeric' })}</time>
      </li>`).join('\n');

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Automotive Glass Daily Briefing</title>
  <meta name="description" content="Curated daily headlines on automotive glass: windshield replacement, ADAS calibration, supply chain, and industry news." />
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
      ${list || '<li>No fresh headlines in the last day. Check back tomorrow.</li>'}
    </ul>
  </main>
  <footer>
    Sources include Google News and industry feeds. Links open in a new tab.
  </footer>
</body>
</html>`;

  fs.writeFileSync('docs/index.html', html);
  console.log(`Wrote ${items.length} items`);
})();
