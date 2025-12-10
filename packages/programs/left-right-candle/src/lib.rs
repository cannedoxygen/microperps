use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("81K7nKnv7JiRhBCRNmagKot27Yu82eRWeeNA7dtGGaX6");

#[program]
pub mod left_right_candle {
    use super::*;

    /// Initialize the global configuration
    pub fn initialize(
        ctx: Context<Initialize>,
        fee_bps: u16,
        referrer_fee_bps: u16,
        min_bet_lamports: u64,
        max_bet_lamports: u64,
    ) -> Result<()> {
        instructions::initialize::handler(ctx, fee_bps, referrer_fee_bps, min_bet_lamports, max_bet_lamports)
    }

    /// Start a new betting round with admin-provided start price
    pub fn start_round(
        ctx: Context<StartRound>,
        asset_symbol: String,
        start_price: i64,
    ) -> Result<()> {
        instructions::start_round::handler(ctx, asset_symbol, start_price)
    }

    /// Place a bet on a round
    pub fn place_bet(
        ctx: Context<PlaceBet>,
        side: u8,
        amount_lamports: u64,
    ) -> Result<()> {
        instructions::place_bet::handler(ctx, side, amount_lamports)
    }

    /// Settle a round with admin-provided end price
    pub fn settle_round(ctx: Context<SettleRound>, end_price: i64) -> Result<()> {
        instructions::settle_round::handler(ctx, end_price)
    }

    /// Process a single payout (called in a loop by the settler)
    pub fn process_payout(ctx: Context<ProcessPayout>) -> Result<()> {
        instructions::process_payout::handler(ctx)
    }
}
