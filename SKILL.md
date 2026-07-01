---
name: polymarket-betting
description: >
  Analyze sports betting markets, Polymarket odds, whale flow, and place orders only after explicit confirmation.
  Triggers: "帮我下单", "Polymarket 下单", "看看盘口然后买", "今天世界杯怎么下",
  "赔率多少买", "帮我交易", "确认后下单", "用我的余额操作", "大单异动",
  "胜率高的地址", "跟单", "鲸鱼单", "聪明钱".
  Also use when the user asks for live odds, lineups/news, whale scan, position sizing, or a trade.
---

# Polymarket Betting

Use this for any live sports betting analysis that may involve Polymarket odds, whale flow, or trading.

Hard rule: analysis and execution are separate. Never place, cancel, or modify an order until the user explicitly confirms the exact order.

## Step 1: Detect Runtime

Check what is available before acting:

```bash
!`pwd; test -f package.json && echo PROJECT_OK || echo PROJECT_MISSING`
!`test -f scripts/polymarket-whales.mjs && echo WHALES_OK || echo WHALES_MISSING`
!`test -f "$HOME/.polymarket-codex/agent.token" && echo AGENT_TOKEN_FILE_OK || echo AGENT_TOKEN_FILE_MISSING`
!`curl -sf https://clob.polymarket.com/health >/dev/null && echo CLOB_OK || echo CLOB_UNREACHABLE`
!`curl -sf https://data-api.polymarket.com/trades?limit=1 >/dev/null && echo DATA_API_OK || echo DATA_API_UNREACHABLE`
```

Decision tree:
1. Use Polymarket official APIs first: Gamma for events/markets, CLOB for live prices/books, Data API for trades/holders/positions, Sports WebSocket or sports result payloads for live score/time when available.
2. If live data is available -> fetch current odds, match state, news, lineups, and CLOB books.
3. If `polymarket-whales.mjs` exists -> run whale scan for any serious pre-trade read.
4. If local agent is available -> account checks and dry runs are allowed.
5. If local agent is missing -> still analyze; give setup/restart steps before any trade.
6. If data is stale or incomplete -> say so and do not execute.

## Step 2: Read The Board

For each match, gather in this order:

1. Gamma event/API: slug, kickoff, active/closed status, related markets, token IDs, outcomes, and `-more-markets`.
2. CLOB: best bid/ask, midpoint, spread, and order book depth for shortlisted tokens.
3. Sports result feed: live/ended flag, score, period, elapsed time, and last update if the match is live.
4. Data API: recent trades, holders, open interest, and user positions when needed.
5. Team news: use Polymarket if it exposes structured lineups; otherwise use Guardian/FOX/ESPN/Sofascore for confirmed lineups, injuries, rotation, suspensions, motivation, weather/venue.
6. External match stats: use FOX/Sofascore/ESPN for shots, xG, possession, cards, subs, and pressure. Do not imply Polymarket provides these unless verified.
7. User exposure from account/open orders when trading.

For Polymarket soccer, check both the main event and `-more-markets` event; totals, spreads, BTTS, team totals, extra time, and penalties may live under `more-markets`.

When live:
- Refresh score/time before recommending, before showing a ticket, and again immediately before execution.
- Treat a goal, red card, halftime/fulltime, major injury, or large price gap as a new market state.
- Do not use stale pre-match odds language once the match has started.

## Step 3: Run Whale Flow

For any event slug, run:

```bash
node scripts/polymarket-whales.mjs --slug=EVENT_SLUG --minutes=60 --min=10000
```

Use `--minutes=30` when kickoff is close or live. Use `--min=5000` for thin markets; keep `--min=10000` for liquid World Cup markets.
If updating the script, prefer Data API server-side filters such as cash amount filters instead of downloading everything and filtering locally.

Read whale flow as signal, not truth:

| Signal | Meaning |
|---|---|
| Repeated large buys on same side | Strong directional pressure |
| Large buys on both sides | Disagreement; avoid overconfidence |
| One whale only, no follow-through | Watch, do not blindly follow |
| Big order after lineup/news | Higher signal than stale early order |
| Big buy at bad price | Possible hedge/arbitrage; downgrade |

Never claim a wallet is "profitable" from closed positions alone unless losses/open positions are also checked. Prefer "large flow" over "smart money" unless history supports it.

## Step 4: Recommend

Use decimal odds for the user. Convert Polymarket price `p` to decimal odds as `1 / p`.

Defaults:

| Parameter | Default |
|---|---|
| Bankroll | Use known balance if user gave it; otherwise do not assume |
| Unit | $5 when bankroll is about $200 |
| Normal stake | 1u to 2u |
| Test stake | Only for first-time API verification |
| Max single-match exposure | 5% bankroll normally; 10% only with explicit user confirmation |
| Order type | Limit order |
| Price | Current best ask for BUY, unless recommending a patient bid |
| Whale scan | Last 60 min, min $10k |

Recommendation must include:

1. Pick and market name.
2. Current price and decimal odds.
3. Stake in dollars and units.
4. Freshness: source and timestamp/elapsed match state.
5. Existing related exposure.
6. Whale flow summary: supports / conflicts / neutral.
7. Why this is better than the closest alternatives.
8. What score/game script wins and loses.
9. Confidence: lean / playable / strong; avoid "lock" language.

If no edge is clear, recommend no bet.

## Step 5: Confirmation Gate

Before execution, show an order ticket and wait.

Required ticket:

```text
准备下单：
比赛：
市场：
方向：
价格：
小数赔率：
数量：
预计成本：
最大成本：
token：
有效期：

回复“确认下单”我才执行。
```

Only execute if the user clearly confirms this exact ticket, for example:
- "确认下单"
- "按这个下"
- "yes, execute"

Confirmation expires if price moves above the ticket price, line/market changes, 2 minutes pass, kickoff/live state changes materially, or the user asks a new analysis question.

If the user changes price, size, market, or asks a new question, return to recommendation or confirmation. Do not treat a general "帮我下单" as confirmation.

## Step 6: Execute Safely

Before real execution:

1. Run a dry run with the same token, price, size, and max cost.
2. If dry run fails, stop and report the error.
3. Re-check live score/time and best ask/bid if the market is live or close to kickoff.
4. If dry run passes and confirmation is still current, execute once.
5. Query account/trades afterward.

Never:
- Ask the user to paste a private key in chat.
- Store secrets in plaintext.
- Increase stake because balance is available without confirmation.
- Chase a moved price unless the ticket allowed that max price.
- Auto-follow whales without a separate explicit confirmation.

## Step 7: Respond

After execution or no-trade decision, respond in Chinese with:

1. **结论**: placed / not placed / waiting for confirmation.
2. **盘口**: price and decimal odds.
3. **仓位**: cost, units, total match exposure.
4. **状态**: matched/open/failed plus tx hash or order id if available.
5. **资金流**: whale flow in one short line.
6. **依据**: one short line on lineup/news/market reason.
