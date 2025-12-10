from pathlib import Path

md_content = r"""# LEFT vs RIGHT: 12H Meme Candle Arena
_A Pyth-powered, fully on-chain prediction game on Solana_

## 1. Executive Summary

**LEFT vs RIGHT: 12H Meme Candle Arena** is a Solana dapp where players bet on whether a chosen asset (e.g., WIF, BONK, SOL, BTC) will close **above** or **below** its starting price over a fixed 12-hour window.

At the start of each round, the protocol snapshots the asset’s price from **Pyth** and opens a **3-hour betting window**. Players place on-chain bets in SOL on either:

- **LEFT** → asset will close **BELOW** the starting price  
- **RIGHT** → asset will close **ABOVE** the starting price  

When the 12-hour round ends, the program reads the final price from Pyth, deterministically identifies the winning side, and **automatically pays out SOL from a round vault PDA directly to all winning bettors**—no manual claim step required.

This project showcases **Solana’s unique capabilities**:

- Ultra-cheap, frequent, oracle-driven games
- Fast settlement and high throughput
- Simple, deterministic, meme-friendly UX

Built for the Indie.fun hackathon, the dapp is designed to be:
- **Technically impressive** (on-chain rounds, PDAs, Pyth integration, auto payouts)
- **Easy to understand** (ABOVE vs BELOW mechanic)
- **Meme-able & social** (WIF/BONK/SOL themed rounds + Twitter cadence)
- **Ready for future expansion** (more assets, different timeframes, fee mechanics, LP-owned pools, etc.)

---

## 2. Goals & Non-Goals

### 2.1 Goals

- Showcase a **unique Solana-native use case**:
  - High-frequency, oracle-settled prediction game
  - Auto-settled pools with on-chain distribution
- Deliver a **polished MVP** by hackathon deadline:
  - Working on-chain program on devnet/mainnet
  - Simple web frontend (connect wallet, see round, bet, see results)
  - Twitter bot that announces rounds and results every 12 hours
- Demonstrate **clean technical architecture**:
  - Anchor-based program
  - Pyth oracle integration
  - Clear PDA layout and instruction set
- Produce clear collateral for judges:
  - Indie.fun project page
  - GitHub repo with README
  - Short video trailer

### 2.2 Non-Goals (MVP)

- No complex tokenomics or custom SPL token for the game
- No leveraged bets, multi-leg parlays, or in-play hedging
- No NFT minting in MVP (can be future cosmetic add-on)
- No multi-chain support (Solana-only)

---

## 3. Core Game Design

### 3.1 Round Parameters

Each **round** has:

- `asset_symbol`: e.g. `"WIF"`, `"BONK"`, `"SOL"`
- `pyth_price_account`: Pyth price feed for that asset
- `start_price`: Pyth price at round start
- `final_price`: Pyth price at round end
- `start_timestamp`: UNIX time of round start
- `betting_close_timestamp`: `start_timestamp + 3 hours`
- `settle_timestamp`: `start_timestamp + 12 hours`
- `status`: Open → BettingClosed → Settled

### 3.2 User Bets

- Users bet SOL on one of two sides:

  - **LEFT** → price will close BELOW `start_price`
  - **RIGHT** → price will close ABOVE `start_price`

- Bets are placed during the first 3 hours of the round (betting window).
- All SOL is held in a **vault PDA** controlled by the program.

### 3.3 Outcome & Payout

- At or after `settle_timestamp`, a trusted caller (bot/anyone) calls `settle_round(round_id)`.
- Program reads **final price** from Pyth.
- Outcome is deterministic:
  - `final_price > start_price` → RIGHT wins
  - `final_price < start_price` → LEFT wins
  - `final_price == start_price` → tie rule (for MVP: full refund to all bettors)

- Let:
  - `P = total pool lamports for the round`
  - `F = fee_bps` (e.g., 0 or 500 = 5%)
  - `W = total stake on winning side (LEFT or RIGHT)`
  - `U = user’s stake amount on winning side`

- Payout per winner:

  ```text
  pool_after_fee = P * (10_000 - F) / 10_000
  user_payout = U * pool_after_fee / W
MVP requirement: Auto-payout

During settle_round, the program loops through all Bet accounts for that round and transfers the user_payout directly from the vault PDA to each winning user.

No claim() function. Users receive lamports automatically.

Note: For hackathon-scale usage (tens–hundreds of bets per round), auto payout in a loop is acceptable. For large-scale production, a hybrid “batched settlement” or “claim” model would be recommended to avoid compute limits.

4. Twitter / Social Flow
The game runs independent of Twitter, but Twitter is used for social proof and engagement.

4.1 Cadence
Every 12 hours (e.g., 00:00 and 12:00 UTC):

A new round is started on-chain.

Tweet #1 is posted when round opens.

Tweet #2 is posted when round settles (12 hours later).

4.2 Tweet #1 — Round Announcement
At start_round (T0):

Backend bot calls start_round

Fetches returned round_id, asset_symbol, start_price, betting_close_timestamp

Posts something like:

Round #42 — WIF 12H Meme Candle
Start price (via Pyth): 0.00097301

Will WIF close ABOVE or BELOW this price in 12 hours?
You have 3 hours to place your bet.

🟦 LEFT: BELOW
🟥 RIGHT: ABOVE

🔗 Play: https://yourgame.xyz

4.3 Tweet #2 — Round Result
At settle_round (T0 + 12h):

Backend bot calls settle_round(round_id)

Reads final_price, winning_side, total_pool_lamports

Posts something like:

Round #42 Results — WIF 12H Meme Candle
Start price: 0.00097301
Close price (via Pyth): 0.00110234

✅ RIGHT (ABOVE) wins.

Total Pool: 23.4 SOL
Winners have been automatically paid out on-chain.

🔍 View on Solscan: [link]

5. On-Chain Architecture (Anchor)
5.1 Accounts / PDAs
5.1.1 GlobalConfig PDA
Seed: ["config"]

Fields:

admin: Pubkey

fee_bps: u16 (basis points: 0–10_000)

min_bet_lamports: u64

max_bet_lamports: u64

next_round_id: u64

5.1.2 Round PDA
Seed: ["round", round_id]

Fields:

round_id: u64

asset_symbol: String (short string; e.g. "WIF")

pyth_price_account: Pubkey

start_timestamp: i64

betting_close_timestamp: i64

settle_timestamp: i64

start_price: i128 (Pyth price with exponent applied)

final_price: i128

total_pool_lamports: u64

total_left_stake: u64

total_right_stake: u64

winning_side: u8

0 = NotSet

1 = Left

2 = Right

status: u8

0 = Open

1 = BettingClosed

2 = Settled

5.1.3 RoundVault PDA
Seed: ["vault", round_id]

A system account owned by the program holding the SOL pool for round_id.

All bets transfer lamports here.

Settlement transfers lamports out to winners (and fee recipient, if fee > 0).

Fields:

bump: u8 (for PDA derivation)

(Lamports are stored in the account’s native balance)

5.1.4 Bet PDA
Seed: ["bet", round_id, user_pubkey]

Fields:

round_id: u64

user: Pubkey

side: u8 (1 = Left, 2 = Right)

amount_lamports: u64

Rules for MVP:

A user can only bet on one side per round.

If they call place_bet again with the same side, we just increase amount_lamports.

If they attempt to bet the opposite side, transaction fails.

5.2 Instructions
5.2.1 initialize(admin, fee_bps, min_bet, max_bet)
Creates GlobalConfig PDA.

Sets configuration values.

admin can later update fee or constraints via an update_config instruction (optional).

5.2.2 start_round(asset_symbol, pyth_price_account)
Called by the backend bot (or admin) every 12 hours.

Flow:

Derive & create new Round PDA using next_round_id from GlobalConfig.

Derive & create RoundVault PDA for this round_id.

Read current price from Pyth price account → start_price.

Set:

start_timestamp = Clock::get().unwrap().unix_timestamp

betting_close_timestamp = start_timestamp + 3 * 3600

settle_timestamp = start_timestamp + 12 * 3600

status = Open

Initialize pool values to zero.

Increment next_round_id in GlobalConfig.

Emit event RoundStarted(round_id, asset_symbol, start_price, betting_close_timestamp, settle_timestamp).

5.2.3 place_bet(round_id, side, amount_lamports)
Called by users via the frontend.

Checks:

Fetch Round PDA:

status == Open

Clock::now <= betting_close_timestamp

side ∈ {Left, Right}

amount_lamports within [min_bet, max_bet]

If Bet PDA already exists for (round_id, user):

If existing.side != side → error

Else → OK to add more to amount_lamports

Flow:

Transfer lamports from user’s wallet to RoundVault PDA using CPI to system program.

Update Round PDA:

total_pool_lamports += amount_lamports

If side == Left: total_left_stake += amount_lamports
else: total_right_stake += amount_lamports

Create or update Bet PDA with the increased amount_lamports.

Optionally, if Clock::now > betting_close_timestamp, you can auto set status = BettingClosed in this instruction. However, because we always check timestamps, status is mostly informational.

5.2.4 settle_round(round_id)
Called by backend bot (or any user) at or after settle_timestamp.

Checks:

status != Settled

Clock::now >= settle_timestamp

Flow:

Read final price from Pyth price account → final_price.

Compare final_price vs start_price:

rust
Always show details

Copy code
if final_price > start_price {
    winning_side = Right;
} else if final_price < start_price {
    winning_side = Left;
} else {
    // tie rule
    // MVP: refund all bettors fully
}
Store final_price and winning_side in Round PDA.

Compute fee_amount = total_pool_lamports * fee_bps / 10_000.

If tie:

Loop over all Bet PDAs and refund proportional to bet.amount_lamports (or just return exact amount)

Else:

Let W = total_left_stake if LEFT wins, otherwise total_right_stake.

Loop over all Bet PDAs for that round:

If bet.side == winning_side:

user_payout = bet.amount_lamports * (total_pool_lamports - fee_amount) / W

Transfer user_payout lamports from RoundVault to bet.user.

Else: user_payout = 0

Transfer fee_amount (if > 0) from RoundVault to admin or a fee recipient address.

Mark status = Settled.

Compute Consideration: For hackathon-scale and moderate user counts per round, looping over all bets and pushing payouts directly on-chain is acceptable. For very large rounds (hundreds/thousands of bettors), a more advanced “batched payout” or “claim-on-demand” design is recommended. For this MVP, we explicitly adopt the auto-payout model to showcase convenience and simplicity.

6. Frontend / UX Design
6.1 Tech Stack (Suggested)
Framework: Next.js or React + Vite

Wallet Adapter: @solana/wallet-adapter (Phantom, Solflare, Backpack, etc.)

RPC: Helius, Triton, or public RPC

UI: Tailwind or simple CSS

6.2 Pages
6.2.1 Home (/)
Shows the current live round:

Asset + icon (e.g., WIF dog, BONK dog)

Start price

Current time, time remaining until:

Betting close (betting_close_timestamp)

Settlement (settle_timestamp)

Pool stats:

Total pool (SOL)

Total LEFT vs RIGHT stake (optional)

Buttons:

Connect Wallet

Bet LEFT (Below) → prompts for amount, sends place_bet with side LEFT

Bet RIGHT (Above) → same for RIGHT

States:

If before betting close → bets allowed

After betting close & before settlement → bets disabled, show countdown

After settlement → show winning side + summary

6.2.2 Rounds History (/rounds)
List recent rounds:

Round #, asset, start & final price

Winning side & pool size

Link to view each round in detail: /rounds/[id]

6.2.3 Round Detail (/rounds/[id])
Show full details for specific round:

Prices

Timings

Winning side

Pool

Show all bets for the connected user (if accessible via program filters).

MVP: we can simply show high-level stats and rely on program logs / Solscan for deeper analytics.

7. Backend Bot
7.1 Responsibilities
Run scheduled tasks every 12 hours:

Call start_round with chosen asset + Pyth feed

Post Tweet #1

Run scheduled tasks 12 hours after each round start:

Call settle_round

Post **Tweet #2`

Optionally, monitor for errors / transaction failures and retry.

7.2 Implementation Sketch
Node.js or TypeScript script

Use cron or external scheduler (e.g., GitHub Actions, Railway, etc.)

Connect to:

Solana RPC (for sending transactions)

Twitter/X API (for posting tweets)

Store state in:

Simple JSON file or SQLite/Redis to track mapping of round_id to tweet_id, asset, etc.

8. Roadmap & Phases
Phase 1 — Core Program & Localnet (1–2 days)
Implement Anchor program:

GlobalConfig

Round, RoundVault, Bet PDAs

initialize, start_round, place_bet, settle_round

Add Pyth price read & deterministic comparison

Write localnet tests:

Start round → place bets → settle → auto payouts

Phase 2 — Devnet Deployment & Simple UI (2–3 days)
Deploy program to devnet

Build minimal React/Next.js front-end:

Show live round

Connect wallet

Place bets

See result after settlement

Use hardcoded asset (e.g. WIF) for first version

Phase 3 — Bot + Twitter Integration (1–2 days)
Build Node bot that:

Calls start_round every 12 hours

Calls settle_round every 12 hours per round

Posts tweets with round info and results

Run bot on a hosted environment (Railway, Fly.io, etc.)

Phase 4 — Polish & Hackathon Collateral (1–2 days)
Add basic theming & memes (WIF/BONK/SOL visuals)

Write README (with architecture overview)

Prepare Indie.fun project page text + images

Record 30–60s trailer:

Show UI, bets, Pyth prices, auto payouts

Overlay short explanation text

9. Hackathon Submission Checklist
 On-chain program deployed (devnet or mainnet as required)

 Public GitHub repo with:

Program code

Frontend code

Bot code

README explaining architecture and how to run

 Frontend live (Vercel / Netlify / custom host)

 Twitter bot running and posting every 12 hours

 Indie.fun project page:

Clear explanation of LEFT vs RIGHT

Screenshots / short demo

Vision and future roadmap

 Video trailer (30–90 seconds)

 All content in English as required

10. Future Extensions (Post-Hackathon)
Multi-asset rounds in parallel

Different timeframes (1h, 4h, 24h candles)

LP-based model where liquidity providers earn protocol fees

NFT-based badges for streaks / high-volume players

On-chain referral tracking and fee share

More complex conditions (e.g. “+3% or more”, “wider range bands”)

DAO governance over fee structure and asset selection

11. Summary
LEFT vs RIGHT: 12H Meme Candle Arena is a lean, fun, and technically strong Solana dapp that:

Uses Pyth as a trusted oracle for deterministic outcomes

Leverages Solana’s low fees and fast confirmation to support frequent prediction rounds

Demonstrates clean on-chain pool management and auto payouts via PDAs

Wraps everything in a meme-friendly, social-media-native narrative

This is exactly the kind of project that highlights a unique Solana use case: fast, oracle-powered games and prediction markets that are cheap enough to run every day, forever.
"""

path = Path("/mnt/data/left-right-meme-candle-master-plan.md")
path.write_text(md_content, encoding="utf-8")
path

Always show details

Copy code
Result
PosixPath('/mnt/data/left-right-meme-candle-master-plan.md')
Here’s your comprehensive master plan in Markdown, with auto-payouts baked in and ready to hand to devs or drop into a repo.

You can download the file here:
Download the master plan MD

markdown
Copy code
# LEFT vs RIGHT: 12H Meme Candle Arena
_A Pyth-powered, fully on-chain prediction game on Solana_

## 1. Executive Summary

**LEFT vs RIGHT: 12H Meme Candle Arena** is a Solana dapp where players bet on whether a chosen asset (e.g., WIF, BONK, SOL, BTC) will close **above** or **below** its starting price over a fixed 12-hour window.

At the start of each round, the protocol snapshots the asset’s price from **Pyth** and opens a **3-hour betting window**. Players place on-chain bets in SOL on either:

- **LEFT** → asset will close **BELOW** the the starting price  
- **RIGHT** → asset will close **ABOVE** the starting price  

When the 12-hour round ends, the program reads the final price from Pyth, deterministically identifies the winning side, and **automatically pays out SOL from a round vault PDA directly to all winning bettors**—no manual claim step required.

This project showcases **Solana’s unique capabilities**:

- Ultra-cheap, frequent, oracle-driven games
- Fast settlement and high throughput
- Simple, deterministic, meme-friendly UX

Built for the Indie.fun hackathon, the dapp is designed to be:
- **Technically impressive** (on-chain rounds, PDAs, Pyth integration, auto payouts)
- **Easy to understand** (ABOVE vs BELOW mechanic)
- **Meme-able & social** (WIF/BONK/SOL themed rounds + Twitter cadence)
- **Ready for future expansion** (more assets, different timeframes, fee mechanics, LP-owned pools, etc.)

---

## 2. Goals & Non-Goals

### 2.1 Goals

- Showcase a **unique Solana-native use case**:
  - High-frequency, oracle-settled prediction game
  - Auto-settled pools with on-chain distribution
- Deliver a **polished MVP** by hackathon deadline:
  - Working on-chain program on devnet/mainnet
  - Simple web frontend (connect wallet, see round, bet, see results)
  - Twitter bot that announces rounds and results every 12 hours
- Demonstrate **clean technical architecture**:
  - Anchor-based program
  - Pyth oracle integration
  - Clear PDA layout and instruction set
- Produce clear collateral for judges:
  - Indie.fun project page
  - GitHub repo with README
  - Short video trailer

### 2.2 Non-Goals (MVP)

- No complex tokenomics or custom SPL token for the game
- No leveraged bets, multi-leg parlays, or in-play hedging
- No NFT minting in MVP (can be future cosmetic add-on)
- No multi-chain support (Solana-only)

---

## 3. Core Game Design

### 3.1 Round Parameters

Each **round** has:

- `asset_symbol`: e.g. `"WIF"`, `"BONK"`, `"SOL"`
- `pyth_price_account`: Pyth price feed for that asset
- `start_price`: Pyth price at round start
- `final_price`: Pyth price at round end
- `start_timestamp`: UNIX time of round start
- `betting_close_timestamp`: `start_timestamp + 3 hours`
- `settle_timestamp`: `start_timestamp + 12 hours`
- `status`: Open → BettingClosed → Settled

### 3.2 User Bets

- Users bet SOL on one of two sides:

  - **LEFT** → price will close BELOW `start_price`
  - **RIGHT** → price will close ABOVE `start_price`

- Bets are placed during the first 3 hours of the round (betting window).
- All SOL is held in a **vault PDA** controlled by the program.

### 3.3 Outcome & Payout

- At or after `settle_timestamp`, a trusted caller (bot/anyone) calls `settle_round(round_id)`.
- Program reads **final price** from Pyth.
- Outcome is deterministic:
  - `final_price > start_price` → RIGHT wins
  - `final_price < start_price` → LEFT wins
  - `final_price == start_price` → tie rule (for MVP: full refund to all bettors)

- Let:
  - `P = total pool lamports for the round`
  - `F = fee_bps` (e.g., 0 or 500 = 5%)
  - `W = total stake on winning side (LEFT or RIGHT)`
  - `U = user’s stake amount on winning side`

- Payout per winner:

  ```text
  pool_after_fee = P * (10_000 - F) / 10_000
  user_payout = U * pool_after_fee / W
MVP requirement: Auto-payout

During settle_round, the program loops through all Bet accounts for that round and transfers the user_payout directly from the vault PDA to each winning user.

No claim() function. Users receive lamports automatically.

Note: For hackathon-scale usage (tens–hundreds of bets per round), auto payout in a loop is acceptable. For large-scale production, a hybrid “batched settlement” or “claim” model would be recommended to avoid compute limits.

4. Twitter / Social Flow
The game runs independent of Twitter, but Twitter is used for social proof and engagement.

4.1 Cadence
Every 12 hours (e.g., 00:00 and 12:00 UTC):

A new round is started on-chain.

Tweet #1 is posted when round opens.

Tweet #2 is posted when round settles (12 hours later).

4.2 Tweet #1 — Round Announcement
At start_round (T0):

Backend bot calls start_round

Fetches returned round_id, asset_symbol, start_price, betting_close_timestamp

Posts something like:

Round #42 — WIF 12H Meme Candle
Start price (via Pyth): 0.00097301

Will WIF close ABOVE or BELOW this price in 12 hours?
You have 3 hours to place your bet.

🟦 LEFT: BELOW
🟥 RIGHT: ABOVE

🔗 Play: https://yourgame.xyz

4.3 Tweet #2 — Round Result
At settle_round (T0 + 12h):

Backend bot calls settle_round(round_id)

Reads final_price, winning_side, total_pool_lamports

Posts something like:

Round #42 Results — WIF 12H Meme Candle
Start price: 0.00097301
Close price (via Pyth): 0.00110234

✅ RIGHT (ABOVE) wins.

Total Pool: 23.4 SOL
Winners have been automatically paid out on-chain.

🔍 View on Solscan: [link]

5. On-Chain Architecture (Anchor)
5.1 Accounts / PDAs
5.1.1 GlobalConfig PDA
Seed: ["config"]

Fields:

admin: Pubkey

fee_bps: u16 (basis points: 0–10_000)

min_bet_lamports: u64

max_bet_lamports: u64

next_round_id: u64

5.1.2 Round PDA
Seed: ["round", round_id]

Fields:

round_id: u64

asset_symbol: String (short string; e.g. "WIF")

pyth_price_account: Pubkey

start_timestamp: i64

betting_close_timestamp: i64

settle_timestamp: i64

start_price: i128 (Pyth price with exponent applied)

final_price: i128

total_pool_lamports: u64

total_left_stake: u64

total_right_stake: u64

winning_side: u8

0 = NotSet

1 = Left

2 = Right

status: u8

0 = Open

1 = BettingClosed

2 = Settled

5.1.3 RoundVault PDA
Seed: ["vault", round_id]

A system account owned by the program holding the SOL pool for round_id.

All bets transfer lamports here.

Settlement transfers lamports out to winners (and fee recipient, if fee > 0).

Fields:

bump: u8 (for PDA derivation)

(Lamports are stored in the account’s native balance)

5.1.4 Bet PDA
Seed: ["bet", round_id, user_pubkey]

Fields:

round_id: u64

user: Pubkey

side: u8 (1 = Left, 2 = Right)

amount_lamports: u64

Rules for MVP:

A user can only bet on one side per round.

If they call place_bet again with the same side, we just increase amount_lamports.

If they attempt to bet the opposite side, transaction fails.

5.2 Instructions
5.2.1 initialize(admin, fee_bps, min_bet, max_bet)
Creates GlobalConfig PDA.

Sets configuration values.

admin can later update fee or constraints via an update_config instruction (optional).

5.2.2 start_round(asset_symbol, pyth_price_account)
Called by the backend bot (or admin) every 12 hours.

Flow:

Derive & create new Round PDA using next_round_id from GlobalConfig.

Derive & create RoundVault PDA for this round_id.

Read current price from Pyth price account → start_price.

Set:

start_timestamp = Clock::get().unwrap().unix_timestamp

betting_close_timestamp = start_timestamp + 3 * 3600

settle_timestamp = start_timestamp + 12 * 3600

status = Open

Initialize pool values to zero.

Increment next_round_id in GlobalConfig.

Emit event RoundStarted(round_id, asset_symbol, start_price, betting_close_timestamp, settle_timestamp).

5.2.3 place_bet(round_id, side, amount_lamports)
Called by users via the frontend.

Checks:

Fetch Round PDA:

status == Open

Clock::now <= betting_close_timestamp

side ∈ {Left, Right}

amount_lamports within [min_bet, max_bet]

If Bet PDA already exists for (round_id, user):

If existing.side != side → error

Else → OK to add more to amount_lamports

Flow:

Transfer lamports from user’s wallet to RoundVault PDA using CPI to system program.

Update Round PDA:

total_pool_lamports += amount_lamports

If side == Left: total_left_stake += amount_lamports
else total_right_stake += amount_lamports

Create or update Bet PDA with the increased amount_lamports.

Optionally, if Clock::now > betting_close_timestamp, you can auto set status = BettingClosed in this instruction. However, because we always check timestamps, status is mostly informational.

5.2.4 settle_round(round_id)
Called by backend bot (or any user) at or after settle_timestamp.

Checks:

status != Settled

Clock::now >= settle_timestamp

Flow:

Read final price from Pyth price account → final_price.

Compare final_price vs start_price:

rust
Copy code
if final_price > start_price {
    winning_side = Right;
} else if final_price < start_price {
    winning_side = Left;
} else {
    // tie rule
    // MVP: refund all bettors fully
}
Store final_price and winning_side in Round PDA.

Compute fee_amount = total_pool_lamports * fee_bps / 10_000.

If tie:

Loop over all Bet PDAs and refund proportional to bet.amount_lamports (or just return exact amount).

Else:

Let W = total_left_stake if LEFT wins, otherwise total_right_stake.

Loop over all Bet PDAs for that round:

If bet.side == winning_side:

user_payout = bet.amount_lamports * (total_pool_lamports - fee_amount) / W

Transfer user_payout lamports from RoundVault to bet.user.

Else: user_payout = 0

Transfer fee_amount (if > 0) from RoundVault to admin or a fee recipient address.

Mark status = Settled.

Compute Consideration: For hackathon-scale and moderate user counts per round, looping over all bets and pushing payouts directly on-chain is acceptable. For very large rounds (hundreds/thousands of bettors), a more advanced “batched payout” or “claim-on-demand” design is recommended. For this MVP, we explicitly adopt the auto-payout model to showcase convenience and simplicity.

6. Frontend / UX Design
6.1 Tech Stack (Suggested)
Framework: Next.js or React + Vite

Wallet Adapter: @solana/wallet-adapter (Phantom, Solflare, Backpack, etc.)

RPC: Helius, Triton, or public RPC

UI: Tailwind or simple CSS

6.2 Pages
6.2.1 Home (/)
Shows the current live round:

Asset + icon (e.g., WIF dog, BONK dog)

Start price

Current time, time remaining until:

Betting close (betting_close_timestamp)

Settlement (settle_timestamp)

Pool stats:

Total pool (SOL)

Total LEFT vs RIGHT stake (optional)

Buttons:

Connect Wallet

Bet LEFT (Below) → prompts for amount, sends place_bet with side LEFT

Bet RIGHT (Above) → same for RIGHT

States:

If before betting close → bets allowed

After betting close & before settlement → bets disabled, show countdown

After settlement → show winning side + summary

6.2.2 Rounds History (/rounds)
List recent rounds:

Round #, asset, start & final price

Winning side & pool size

Link to view each round in detail: /rounds/[id]

6.2.3 Round Detail (/rounds/[id])
Show full details for specific round:

Prices

Timings

Winning side

Pool

Show all bets for the connected user (if accessible via program filters).

MVP: we can simply show high-level stats and rely on program logs / Solscan for deeper analytics.

7. Backend Bot
7.1 Responsibilities
Run scheduled tasks every 12 hours:

Call start_round with chosen asset + Pyth feed

Post Tweet #1

Run scheduled tasks 12 hours after each round start:

Call settle_round

Post **Tweet #2`

Optionally, monitor for errors / transaction failures and retry.

7.2 Implementation Sketch
Node.js or TypeScript script

Use cron or external scheduler (e.g., GitHub Actions, Railway, etc.)

Connect to:

Solana RPC (for sending transactions)

Twitter/X API (for posting tweets)

Store state in:

Simple JSON file or SQLite/Redis to track mapping of round_id to tweet_id, asset, etc.

8. Roadmap & Phases
Phase 1 — Core Program & Localnet (1–2 days)
Implement Anchor program:

GlobalConfig

Round, RoundVault, Bet PDAs

initialize, start_round, place_bet, settle_round

Add Pyth price read & deterministic comparison

Write localnet tests:

Start round → place bets → settle → auto payouts

Phase 2 — Devnet Deployment & Simple UI (2–3 days)
Deploy program to devnet

Build minimal React/Next.js front-end:

Show live round

Connect wallet

Place bets

See result after settlement

Use hardcoded asset (e.g. WIF) for first version

Phase 3 — Bot + Twitter Integration (1–2 days)
Build Node bot that:

Calls start_round every 12 hours

Calls settle_round every 12 hours per round

Posts tweets with round info and results

Run bot on a hosted environment (Railway, Fly.io, etc.)

Phase 4 — Polish & Hackathon Collateral (1–2 days)
Add basic theming & memes (WIF/BONK/SOL visuals)

Write README (with architecture overview)

Prepare Indie.fun project page text + images

Record 30–60s trailer:

Show UI, bets, Pyth prices, auto payouts

Overlay short explanation text

9. Hackathon Submission Checklist
 On-chain program deployed (devnet or mainnet as required)

 Public GitHub repo with:

Program code

Frontend code

Bot code

README explaining architecture and how to run

 Frontend live (Vercel / Netlify / custom host)

 Twitter bot running and posting every 12 hours

 Indie.fun project page:

Clear explanation of LEFT vs RIGHT

Screenshots / short demo

Vision and future roadmap

 Video trailer (30–90 seconds)

 All content in English as required

10. Future Extensions (Post-Hackathon)
Multi-asset rounds in parallel

Different timeframes (1h, 4h, 24h candles)

LP-based model where liquidity providers earn protocol fees

NFT-based badges for streaks / high-volume players

On-chain referral tracking and fee share

More complex conditions (e.g. “+3% or more”, “wider range bands”)

DAO governance over fee structure and asset selection

11. Summary
LEFT vs RIGHT: 12H Meme Candle Arena is a lean, fun, and technically strong Solana dapp that:

Uses Pyth as a trusted oracle for deterministic outcomes

Leverages Solana’s low fees and fast confirmation to support frequent prediction rounds

Demonstrates clean on-chain pool management and auto payouts via PDAs

Wraps everything in a meme-friendly, social-media-native narrative

This is exactly the kind of project that highlights a unique Solana use case: fast, oracle-powered games and prediction markets that are cheap enough to run every day, forever.

perl
Copy code
 ​:contentReference[oaicite:0]{index=0}​






