# Polymarket Betting Skill for Codex

Codex skill and public-data tools for Polymarket sports betting analysis: live odds, CLOB prices, soccer props, whale-flow scans, bankroll sizing, EV/CLV discipline, and explicit confirmation before any order.

## What It Does

- Reads Polymarket sports markets, including main lines, more markets, player props, corners, cards, and combo/RFQ-style markets.
- Converts Polymarket prices into decimal odds.
- Scans recent large trades and whale flow from public Polymarket data.
- Forces professional betting discipline: positive EV, closing-line value, fractional Kelly sizing, and no chase-betting.
- Keeps analysis separate from execution. The skill requires an exact order ticket and explicit confirmation before any trade.

## Keywords

Polymarket, Codex skill, prediction markets, sports betting, football betting, soccer betting, World Cup odds, Polymarket API, CLOB API, Gamma API, whale tracking, smart money, betting strategy, expected value, EV betting, closing line value, CLV, Kelly criterion, fractional Kelly, bankroll management, live betting, in-play betting.

## Files

- `SKILL.md` - the Codex workflow and safety rules.
- `scripts/polymarket-board.mjs` - reads a full Polymarket event board from public APIs.
- `scripts/polymarket-whales.mjs` - scans recent large public trades for an event.

## Usage

Install dependencies:

```bash
npm install
```

Read a Polymarket event board:

```bash
npm run board -- --slug=fifwc-arg-cvi-2026-07-03 --min-price=0.001 --max-price=0.999
```

Scan whale flow:

```bash
npm run whales -- --slug=fifwc-arg-cvi-2026-07-03 --minutes=60 --min=10000
```

## Safety

This public repository does not include private keys, wallet files, agent tokens, API secrets, or account credentials. The included scripts use public Polymarket data only.

The skill is designed for disciplined analysis, not blind auto-trading. Any order flow must use a separate local execution setup and an explicit user confirmation gate.
