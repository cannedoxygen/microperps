# LEFT vs RIGHT: 12H Meme Candle Arena

A Pyth-powered, fully on-chain prediction game on Solana.

## Overview

Players bet on whether a chosen asset (WIF, BONK, SOL, BTC) will close **above** or **below** its starting price over a fixed 12-hour window.

- **LEFT** = Price closes BELOW start price
- **RIGHT** = Price closes ABOVE start price

Winners are automatically paid out from the round vault - no claim step required.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Web App (Next.js)  │  Bot Service  │  Twitter Integration  │
├─────────────────────────────────────────────────────────────┤
│                    Shared SDK (@left-right/sdk)             │
├─────────────────────────────────────────────────────────────┤
│              Solana Program (Anchor) + Pyth Oracle          │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Rust 1.75+
- Solana CLI 1.18+
- Anchor CLI 0.30+

### Install Dependencies

```bash
pnpm install
```

### Local Development

1. **Start local validator with Pyth:**
   ```bash
   solana-test-validator
   ```

2. **Build and deploy program:**
   ```bash
   cd packages/programs/left-right-candle
   anchor build
   anchor deploy
   ```

3. **Run web app:**
   ```bash
   pnpm --filter @left-right/web dev
   ```

4. **Run bot (optional):**
   ```bash
   pnpm --filter @left-right/bot dev
   ```

### Testing

```bash
# Run all tests
pnpm test

# Run program tests only
pnpm test:program
```

## Project Structure

```
├── apps/
│   ├── web/          # Next.js frontend
│   └── bot/          # Scheduling + Twitter bot
├── packages/
│   ├── sdk/          # Shared TypeScript SDK
│   └── programs/
│       └── left-right-candle/  # Anchor program
```

## Environment Variables

Copy `.env.example` files in each app/package and fill in values:

- `apps/web/.env.example` - RPC URL, program ID
- `apps/bot/.env.example` - RPC URL, admin keypair, Twitter API
- `packages/programs/left-right-candle/.env.example` - Cluster config

## License

MIT
