# Polymarket Betting Skill

A Codex skill for reading Polymarket sports markets, checking lineups/news, scanning whale flow, sizing bets, and requiring explicit confirmation before any order.

## Contents

- `SKILL.md` - the Codex workflow.
- `scripts/polymarket-whales.mjs` - a public-data whale-flow scanner.

## Whale Scan

```bash
node scripts/polymarket-whales.mjs --slug=fifwc-bel-sen-2026-07-01 --minutes=60 --min=10000
```

The script uses public Polymarket APIs only. It does not need private keys, wallet files, API tokens, or account credentials.

## Safety Rule

The skill separates analysis from execution. It requires an exact order ticket and explicit user confirmation before any trade.
