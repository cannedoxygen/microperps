# Architecture

## System Overview

LEFT vs RIGHT is a Solana-based prediction game using Pyth oracle for price feeds.

### Components

1. **Solana Program** (`packages/programs/left-right-candle`)
   - Anchor-based smart contract
   - Manages rounds, bets, and payouts
   - Integrates with Pyth for price data

2. **Web Application** (`apps/web`)
   - Next.js 14 with App Router
   - Wallet connection via @solana/wallet-adapter
   - Real-time round display and betting UI

3. **Bot Service** (`apps/bot`)
   - Node.js scheduler
   - Starts rounds every 12 hours
   - Settles rounds at expiry
   - Posts to Twitter (optional)

4. **Shared SDK** (`packages/sdk`)
   - TypeScript types and IDL
   - Program client wrapper
   - PDA derivation helpers

## On-Chain Architecture

### Account Structure

```
GlobalConfig (PDA: ["config"])
├── admin: Pubkey
├── fee_bps: u16
├── min_bet_lamports: u64
├── max_bet_lamports: u64
└── next_round_id: u64

Round (PDA: ["round", round_id])
├── round_id: u64
├── asset_symbol: String
├── pyth_price_account: Pubkey
├── start_timestamp: i64
├── betting_close_timestamp: i64
├── settle_timestamp: i64
├── start_price: i128
├── final_price: i128
├── total_pool_lamports: u64
├── total_left_stake: u64
├── total_right_stake: u64
├── winning_side: u8
└── status: u8

RoundVault (PDA: ["vault", round_id])
└── Native SOL balance (no data, just lamports)

Bet (PDA: ["bet", round_id, user])
├── round_id: u64
├── user: Pubkey
├── side: u8
└── amount_lamports: u64
```

### Instruction Flow

```
1. initialize()
   └── Creates GlobalConfig

2. start_round(asset_symbol, pyth_account)
   ├── Creates Round PDA
   ├── Creates RoundVault PDA
   ├── Reads start_price from Pyth
   └── Emits RoundStarted event

3. place_bet(round_id, side, amount)
   ├── Validates betting window
   ├── Creates/updates Bet PDA
   ├── Transfers SOL to vault
   └── Emits BetPlaced event

4. settle_round(round_id)
   ├── Validates settle timestamp
   ├── Reads final_price from Pyth
   ├── Determines winning side
   ├── Loops through bets, pays winners
   └── Emits RoundSettled event
```

## Security Considerations

See [SECURITY.md](./SECURITY.md) for details.

## Data Flow

```
User                  Web App              Program              Pyth
 │                      │                    │                   │
 │──Connect Wallet─────►│                    │                   │
 │                      │                    │                   │
 │──Place Bet──────────►│                    │                   │
 │                      │──place_bet tx─────►│                   │
 │                      │                    │──Read price──────►│
 │                      │                    │◄─────price────────│
 │                      │                    │                   │
 │                      │◄──tx confirmed─────│                   │
 │◄──Update UI──────────│                    │                   │
```

## Scalability Notes

MVP targets 10-50 bets per round. Auto-payout loop is within Solana compute limits for this scale.

For larger rounds (100+ bets), consider:
- Batched settlement (multiple settle_batch instructions)
- Claim-based model with merkle proofs
- Off-chain indexing with on-chain verification
