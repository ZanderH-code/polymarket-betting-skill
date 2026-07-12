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

Hard rule: analysis and execution are separate. Never place, cancel, or modify an order until the user explicitly confirms the exact order, except for a live-betting pre-authorization that clearly defines the limits below.

## Step 1: Detect Runtime

Check what is available before acting:

```bash
!`pwd; test -f package.json && echo PROJECT_OK || echo PROJECT_MISSING`
!`test -f scripts/polymarket-board.mjs && echo BOARD_OK || echo BOARD_MISSING`
!`test -f scripts/polymarket-whales.mjs && echo WHALES_OK || echo WHALES_MISSING`
!`test -f "$HOME/.polymarket-codex/agent.token" && echo AGENT_TOKEN_FILE_OK || echo AGENT_TOKEN_FILE_MISSING`
!`curl -sf https://clob.polymarket.com/health >/dev/null && echo CLOB_OK || echo CLOB_UNREACHABLE`
!`curl -sf https://data-api.polymarket.com/trades?limit=1 >/dev/null && echo DATA_API_OK || echo DATA_API_UNREACHABLE`
!`curl -sf https://combos-rfq-api.polymarket.com/v1/rfq/combo-markets?limit=1 >/dev/null && echo COMBOS_OK || echo COMBOS_UNREACHABLE`
```

Decision tree:
1. Use Polymarket official APIs first: Gamma for events/markets and sports market types, CLOB for live prices/books, Combos RFQ for combo-eligible markets, Data API for trades/holders/positions, Sports WebSocket or sports result payloads for live score/time when available.
2. If live data is available -> fetch current odds, match state, news, lineups, and CLOB books.
3. If `polymarket-whales.mjs` exists -> run whale scan for any serious pre-trade read.
4. If local agent is available -> account checks and dry runs are allowed.
5. If local agent is missing -> still analyze; give setup/restart steps before any trade.
6. If data is stale or incomplete -> say so and do not execute.

## Step 2: Read The Board

For each match, gather in this order:

1. Gamma event/API: slug, kickoff, active/closed status, related markets, token IDs, outcomes, and `-more-markets`.
2. Gamma market list by official `sports_market_types` for soccer props: `soccer_exact_score`, `soccer_player_goals`, `soccer_anytime_goalscorer`, `soccer_player_assists`, `soccer_player_shots`, `soccer_player_shots_on_target`, `total_corners`, `soccer_team_total_corners`, and `soccer_first_half_total_corners`.
3. Combos RFQ catalog: `https://combos-rfq-api.polymarket.com/v1/rfq/combo-markets` for combo-eligible legs. Treat displayed app combos as RFQ/combo products, not as ordinary Gamma event markets.
4. CLOB: best bid/ask, midpoint, spread, and order book depth for shortlisted tokens.
5. Sports result feed: live/ended flag, score, period, elapsed time, and last update if the match is live.
6. Data API: recent trades, holders, open interest, and user positions when needed.
7. Team news: use Polymarket if it exposes structured lineups; otherwise use Guardian/FOX/ESPN/Sofascore for confirmed lineups, injuries, rotation, suspensions, motivation, weather/venue.
8. Team form and tactical matchup: last 3-5 matches, opponent quality, score scripts, xG/shots if available, rest/travel, style clash, pressing/directness, block height, transition defense, set pieces, keeper quality, and whether the confirmed XI changes the normal roles.
9. Lineup-change read: do not treat star benching or "rotation" as an automatic downgrade. Check previous-match player ratings, substitution timing, coach quotes, and how the team changed after the subs. Classify each major change as downgrade / rest rotation / tactical upgrade / role rebalance.
10. External match stats: use FOX/Sofascore/ESPN for shots, xG, possession, cards, subs, and pressure. Do not imply Polymarket provides these unless verified.
11. User exposure from account/open orders when trading.
12. Settlement scope: read the market rules and state whether it settles on regulation time, includes stoppage time, extra time, penalties, or advancement. Never infer this from the market title alone.

For Polymarket soccer, check the main event, `-more-markets`, official sports prop market types, and combo RFQ. Totals, spreads, BTTS, team totals, extra time, and penalties may live under `more-markets`; exact score, corners, player goals/assists/shots may live only in Gamma market searches by `sports_market_types`; app combo cards use the combo/RFQ surface.

If `scripts/polymarket-board.mjs` exists, use it as the fixed board read:

```bash
node scripts/polymarket-board.mjs --slug=EVENT_SLUG --min-price=0.001 --max-price=0.999 --min-size=0 --max-spread=0.50
```

Use `--props=false` or `--combos=false` only when intentionally narrowing a quick check. If a user asks to "遍历盘口", "所有盘口", "球员进球", "角球", "组合盘", or "props", do not disable these sources.

When live:
- Use the main Gamma event's `score`, `live`, `period`, `elapsed`, and `ended` fields as the primary match-state source.
- Do not use `-more-markets` as the score/time source; it can lag the main event. Use it for extra markets and token IDs only.
- Refresh main-event score/time before recommending, before showing a ticket, and again immediately before execution.
- Track substitutions and shape changes: who left/entered, position/role, set-piece takers, fresh legs vs fatigue, press intensity, block height, transition threat, and whether a player prop became worse after a role/minute change.
- Treat a goal, red card, halftime/fulltime, major injury, or large price gap as a new market state.
- Do not use stale pre-match odds language once the match has started.
- Before recommending a live total or player prop, verify current shots, shots on target, xG or dangerous attacks, box touches, substitutions, role, and remaining minutes from an external stats source. If the required evidence is unavailable, downgrade to a lean or no bet.

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

Apply professional betting discipline before recommending:

| Rule | Practice |
|---|---|
| Positive EV only | Estimate true probability and compare it with market price `p`; recommend only when the edge is clear after vig/spread/liquidity. |
| CLV matters | Prefer bets likely to beat the closing price; after the match, record entry price vs close to judge process quality. |
| Fractional Kelly | Use half Kelly or quarter Kelly when edge can be estimated; use flat staking when the edge is fuzzy. Never use full Kelly for soccer. |
| Market priority | Prefer liquid main lines first, then team totals/BTTS/corners/cards, then player props only with confirmed role and price error. |
| Combos | Downgrade combo/parlay markets unless correlation is clearly underpriced; do not chase high displayed payout. |
| Live betting | Bet only new positive EV after a state change; never add because an existing position is losing. |
| Lineup changes | Price the role impact, not the name. A famous attacker benched after a poor tactical fit can be a team upgrade; a less famous runner/holder may improve pressing, balance, or transition defense. |
| Correlated exposure | Group bets by the game script that makes them win or lose. Team goals, match over, BTTS, scorer props, and attacking spreads can be one risk even when market names differ. Size the group, not each ticket independently. |
| Settlement scope | Match the thesis to the settlement window. A regulation-time total does not benefit from extra-time goals; advancement and match-winner markets may settle differently. |
| Player props | Do not convert "team likely to score" into "star likely to score." Require confirmed minutes/role, set-piece or penalty status, individual shot/box-touch evidence, matchup, and a price edge versus team totals and other scorers. |

Lineup-change checklist:

| Signal | Read |
|---|---|
| Star benched after poor rating, early sub, or bad fit | Possible tactical upgrade, not automatic downgrade |
| Team improved after the replacement entered last match | Upgrade or role rebalance signal |
| Coach/media describe a shape or intensity change | Higher signal than generic "rotation" |
| Replacement weakens set pieces, chance creation, or ball progression | Real downgrade |
| Market overreacts to name value | Look for contrarian value on the supposedly weakened team |

Before recommending multiple bets on one match:

1. Write the winning and losing game script for each bet.
2. Mark bets as strongly correlated when the same event drives both, such as match over plus striker goal.
3. Compare the package with the best single bet. Add the second bet only if it has an independent edge, not merely a larger payout.
4. Cap all strongly correlated positions at the stake justified for one thesis. Do not apply the normal stake to every leg separately.
5. Prefer the more liquid, broader market when evidence supports team-level scoring but not the named player.

Player-goal props are no-bet unless all are verified: expected remaining minutes, role/position, penalty and set-piece status, recent or live individual shot involvement, opponent matchup, and positive EV at the available price. For live props, observe at least 5-10 minutes after kickoff or a major tactical change unless an obvious price error is independently supported.

Use this quick sizing rule when the user has not given a specific stake:

| Confidence | Stake |
|---|---|
| Lean | 0.5u to 1u |
| Playable | 1u to 2u |
| Strong | 2u to 4u |
| Exceptional | 5u+ only with explicit confirmation and obvious price error |

Defaults:

| Parameter | Default |
|---|---|
| Bankroll | Use known balance if user gave it; otherwise do not assume |
| Unit | $5 when bankroll is about $200 |
| Normal stake | 1u to 2u |
| Test stake | Only for first-time API verification |
| Max single-match exposure | 5% bankroll normally; 10% only with explicit user confirmation |
| Correlated thesis exposure | Treat correlated tickets as one position; use the confidence stake once across the group |
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
9. Tactical/form read: recent form, lineup-change classification, role changes from the lineup/substitutions, previous-match ratings or substitution evidence, and the specific matchup that supports or weakens the bet.
10. Edge source: lineup/news, model/probability gap, market movement, or live state.
11. CLV read: likely to beat close / neutral / likely late-bad price.
12. Confidence: lean / playable / strong; avoid "lock" language.
13. Settlement scope: regulation time / includes extra time / advancement, quoted from or verified against the market rules.
14. Correlation audit: list existing and proposed bets driven by the same game script and show their combined dollars and units.
15. Player-prop evidence: minutes, role, penalties/set pieces, shot involvement, matchup, and why it beats the closest team-level market.

If no edge is clear, recommend no bet.

## Step 5: Confirmation Gate

Before execution, show an order ticket and wait, unless an active live pre-authorization covers the order.

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

### Live Pre-Authorization

For live betting only, the user may pre-authorize fast execution before or during a match. This replaces repeated per-order confirmation only inside strict limits.

Required pre-authorization ticket:

```text
滚球预授权：
比赛：
允许市场：
单注上限：
本场新增总上限：
价格上限/下限：
有效期：
触发条件：
禁止事项：

回复“确认滚球预授权”后，在这些边界内我可以直接下单；超出边界必须重新确认。
```

Allowed only when all are true:
- The user explicitly replies "确认滚球预授权" or equivalent wording for that exact ticket.
- The match, market family, side, stake cap, total exposure cap, price limit, and expiry are all specified.
- The order is a limit order within the pre-authorized price and stake.
- Live score/time and best bid/ask are refreshed immediately before execution.
- A dry run succeeds.

Pre-authorization expires immediately if:
- A goal, red card, penalty, halftime/fulltime, extra time, shootout, or market suspension occurs.
- The market line changes, e.g. O/U 2.5 to O/U 3.5.
- Price moves outside the approved limit.
- The single-order or total match exposure cap would be exceeded.
- The user asks for new analysis, changes strategy, or says stop/cancel.
- The stated time window expires.

Never use pre-authorization for futures, outright markets, deposits/withdrawals, wallet changes, or any trade outside the named match.

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
- Treat "以后不用确认" as unlimited trading permission; require a bounded live pre-authorization ticket.

## Step 7: Respond

After execution or no-trade decision, respond in Chinese with:

1. **结论**: placed / not placed / waiting for confirmation.
2. **盘口**: price and decimal odds.
3. **仓位**: cost, units, total match exposure.
4. **状态**: matched/open/failed plus tx hash or order id if available.
5. **资金流**: whale flow in one short line.
6. **EV/CLV**: one short line on estimated edge and closing-line expectation.
7. **依据**: one short line on lineup/news/market reason.
