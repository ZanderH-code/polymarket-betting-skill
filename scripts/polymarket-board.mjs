const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value = true] = arg.replace(/^--/, "").split("=");
    return [key, value];
  }),
);

const slug = args.slug ?? process.env.npm_config_slug;
const minPrice = Number(args["min-price"] ?? 0.12);
const maxPrice = Number(args["max-price"] ?? 0.75);
const minSize = Number(args["min-size"] ?? 500);
const maxSpread = Number(args["max-spread"] ?? 0.05);
const includeProps = args.props !== "false";
const includeCombos = args.combos !== "false";
const propTypes = String(args["prop-types"] ?? [
  "soccer_exact_score",
  "soccer_player_goals",
  "soccer_anytime_goalscorer",
  "soccer_player_assists",
  "soccer_player_shots",
  "soccer_player_shots_on_target",
  "total_corners",
  "soccer_team_total_corners",
  "soccer_first_half_total_corners",
].join(",")).split(",").map((x) => x.trim()).filter(Boolean);

if (!slug) {
  console.error("Usage: node scripts/polymarket-board.mjs --slug=EVENT_SLUG [--min-price=0.12] [--max-price=0.75] [--min-size=500] [--props=false] [--combos=false]");
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

function decimal(price) {
  return price ? +(1 / Number(price)).toFixed(2) : null;
}

async function event(slug) {
  return (await getJson(`https://gamma-api.polymarket.com/events?slug=${slug}`))[0];
}

async function marketsByType(type) {
  const url = new URL("https://gamma-api.polymarket.com/markets");
  url.searchParams.set("sports_market_types", type);
  url.searchParams.set("active", "true");
  url.searchParams.set("closed", "false");
  url.searchParams.set("limit", "100");
  url.searchParams.set("order", "volume24hr");
  url.searchParams.set("ascending", "false");
  return getJson(url);
}

async function comboMarkets() {
  const markets = [];
  let cursor = null;
  for (let page = 0; page < 5; page += 1) {
    const url = new URL("https://combos-rfq-api.polymarket.com/v1/rfq/combo-markets");
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("cursor", cursor);
    const data = await getJson(url);
    markets.push(...(data.markets ?? []));
    cursor = data.next_cursor;
    if (!cursor) break;
  }
  return markets;
}

async function bestBook(token) {
  const book = await getJson(`https://clob.polymarket.com/book?token_id=${token}`);
  const bids = (book.bids ?? [])
    .map((x) => ({ price: Number(x.price), size: Number(x.size) }))
    .filter((x) => Number.isFinite(x.price))
    .sort((a, b) => b.price - a.price);
  const asks = (book.asks ?? [])
    .map((x) => ({ price: Number(x.price), size: Number(x.size) }))
    .filter((x) => Number.isFinite(x.price))
    .sort((a, b) => a.price - b.price);
  return { bid: bids[0] ?? null, ask: asks[0] ?? null };
}

async function mapLimit(items, limit, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += limit) {
    out.push(...await Promise.all(items.slice(i, i + limit).map(fn)));
  }
  return out;
}

const events = [
  await event(slug),
  await event(`${slug}-more-markets`).catch(() => null),
].filter(Boolean);

const main = events[0];
const outcomes = [];
const seenMarkets = new Set();
function addMarket(market, eventSlug, source = "event") {
  const key = market.conditionId ?? market.condition_id ?? market.id ?? market.slug;
  if (seenMarkets.has(key)) return;
  seenMarkets.add(key);
  const names = parseJson(market.outcomes);
  const tokens = parseJson(market.clobTokenIds);
  for (let i = 0; i < names.length; i += 1) {
    if (tokens[i]) {
      outcomes.push({
        source,
        eventSlug,
        type: market.sportsMarketType ?? market.sports_market_type ?? "",
        question: market.question,
        outcome: names[i],
        token: tokens[i],
      });
    }
  }
}

for (const ev of events) {
  for (const market of ev.markets ?? []) {
    addMarket(market, ev.slug);
  }
}

if (includeProps) {
  const props = (await Promise.all(propTypes.map((type) => marketsByType(type).catch(() => []))))
    .flat()
    .filter((market) => market.slug?.startsWith(`${slug}-`));
  for (const market of props) addMarket(market, slug, "props");
}

const combos = includeCombos
  ? (await comboMarkets().catch(() => []))
    .filter((market) => market.slug?.startsWith(`${slug}-`))
  : [];

const rows = await mapLimit(outcomes, 8, async (row) => {
  const { bid, ask } = await bestBook(row.token).catch(() => ({ bid: null, ask: null }));
  const spread = bid?.price != null && ask?.price != null ? ask.price - bid.price : null;
  return {
    ...row,
    bid: bid?.price ?? null,
    bidSize: bid?.size ?? null,
    ask: ask?.price ?? null,
    askSize: ask?.size ?? null,
    decimalAsk: decimal(ask?.price),
    spread,
  };
});

const playable = rows
  .filter((r) =>
    r.ask >= minPrice &&
    r.ask <= maxPrice &&
    (r.askSize ?? 0) >= minSize &&
    (r.spread == null || r.spread <= maxSpread))
  .sort((a, b) => a.ask - b.ask);

const state = {
  title: main.title,
  score: main.score ?? "",
  period: main.period ?? "",
  elapsed: main.elapsed ?? "",
  live: Boolean(main.live),
  ended: Boolean(main.ended),
  startTime: main.startTime,
};

if (args.json) {
  console.log(JSON.stringify({ state, totalOutcomes: rows.length, comboLegs: combos.length, playable }, null, 2));
} else {
  console.log(`State: ${state.title} ${state.score || "(pre)"} ${state.period || ""} ${state.elapsed || ""}`.trim());
  console.log(`Total outcomes: ${rows.length} | combo-eligible legs: ${combos.length} | playable: ${playable.length}`);
  for (const r of playable) {
    console.log(`${r.ask.toFixed(3)} (${r.decimalAsk.toFixed(2)}x) spr=${r.spread?.toFixed(3) ?? "-"} size=${Math.round(r.askSize)} | [${r.source}${r.type ? `/${r.type}` : ""}] ${r.question} :: ${r.outcome} | ${r.token}`);
  }
  if (combos.length) {
    console.log("Combo legs available through RFQ:");
    for (const m of combos.slice(0, 25)) {
      console.log(`combo-leg ${m.outcome_prices?.[0] ?? "-"} (${decimal(m.outcome_prices?.[0]) ?? "-"}x) | ${m.title} :: ${m.outcomes?.[0]} | ${m.slug}`);
    }
  }
}
