const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value = true] = arg.replace(/^--/, "").split("=");
    return [key, value];
  }),
);

const slug = args.slug ?? process.env.npm_config_slug;
const minutes = Number(args.minutes ?? process.env.npm_config_minutes ?? 60);
const min = Number(args.min ?? process.env.npm_config_min ?? 10000);
const limit = Number(args.limit ?? process.env.npm_config_limit ?? 500);

if (!slug) {
  console.error("Usage: npm run poly:whales -- --slug=EVENT_SLUG [--minutes=60] [--min=10000]");
  process.exit(1);
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}: ${await res.text()}`);
  return res.json();
}

function parseJson(value, fallback = []) {
  try {
    return typeof value === "string" ? JSON.parse(value) : (value ?? fallback);
  } catch {
    return fallback;
  }
}

function notional(trade) {
  return Number(trade.size ?? 0) * Number(trade.price ?? 0);
}

function decimal(price) {
  return price ? (1 / Number(price)).toFixed(2) : "";
}

async function eventMarkets(eventSlug) {
  const events = await getJson(`https://gamma-api.polymarket.com/events?slug=${eventSlug}`);
  return (events[0]?.markets ?? []).map((m) => ({
    question: m.question,
    slug: m.slug,
    conditionId: m.conditionId,
    outcomes: parseJson(m.outcomes),
    tokens: parseJson(m.clobTokenIds),
    bid: m.bestBid,
    ask: m.bestAsk,
    last: m.lastTradePrice,
  })).filter((m) => m.conditionId);
}

const markets = [
  ...await eventMarkets(slug),
  ...await eventMarkets(`${slug}-more-markets`).catch(() => []),
];

if (!markets.length) throw new Error(`No markets found for ${slug}`);

const since = Math.floor(Date.now() / 1000) - minutes * 60;
const trades = [];
for (const m of markets) {
  const rows = await getJson(`https://data-api.polymarket.com/trades?market=${m.conditionId}&limit=${limit}`);
  for (const t of rows) {
    if (Number(t.timestamp) >= since) trades.push({ ...t, marketQuestion: m.question, marketSlug: m.slug, usd: notional(t) });
  }
}

const big = trades.filter((t) => t.usd >= min).sort((a, b) => b.usd - a.usd);
const wallets = new Map();
for (const t of big) {
  const w = t.proxyWallet;
  const row = wallets.get(w) ?? { wallet: w, pseudonym: t.pseudonym || t.name || "", trades: 0, usd: 0, picks: [] };
  row.trades += 1;
  row.usd += t.usd;
  row.picks.push(t);
  wallets.set(w, row);
}

const topWallets = [...wallets.values()].sort((a, b) => b.usd - a.usd).slice(0, 8);

console.log(`\nPolymarket whale scan: ${slug}`);
console.log(`Window: ${minutes} min | Big trade >= $${min.toLocaleString()} | Markets: ${markets.length} | Big trades: ${big.length}\n`);

console.log("Top wallets");
for (const w of topWallets) {
  console.log(`- ${w.pseudonym || "(no name)"} ${w.wallet}`);
  console.log(`  $${w.usd.toFixed(0)} across ${w.trades} big trades`);
  for (const t of w.picks.slice(0, 4)) {
    console.log(`  ${new Date(t.timestamp * 1000).toLocaleTimeString()} | ${t.marketQuestion} | ${t.side} ${t.outcome} | $${t.usd.toFixed(0)} @ ${t.price} (${decimal(t.price)}x)`);
  }
}

console.log("\nLargest trades");
for (const t of big.slice(0, 15)) {
  console.log(`- ${new Date(t.timestamp * 1000).toLocaleTimeString()} | ${t.pseudonym || t.proxyWallet} | ${t.marketQuestion} | ${t.side} ${t.outcome} | $${t.usd.toFixed(0)} @ ${t.price} (${decimal(t.price)}x)`);
}

console.log("\nMarket pressure");
const pressure = new Map();
for (const t of trades) {
  const key = `${t.marketQuestion} :: ${t.side} ${t.outcome}`;
  pressure.set(key, (pressure.get(key) ?? 0) + t.usd);
}
for (const [key, usd] of [...pressure.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  console.log(`- $${usd.toFixed(0)} | ${key}`);
}
