use anchor_lang::prelude::*;

use crate::errors::LeftRightError;
use crate::events::RoundStarted;
use crate::state::{Config, Round, RoundStatus};

#[derive(Accounts)]
#[instruction(asset_symbol: String)]
pub struct StartRound<'info> {
    #[account(
        mut,
        seeds = [Config::SEED],
        bump = config.bump,
        has_one = admin @ LeftRightError::Unauthorized,
    )]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = admin,
        space = Round::LEN,
        seeds = [Round::SEED, config.round_counter.to_le_bytes().as_ref()],
        bump
    )]
    pub round: Account<'info, Round>,

    /// Vault PDA to hold bets for this round
    /// CHECK: PDA owned by program
    #[account(
        seeds = [b"vault", config.round_counter.to_le_bytes().as_ref()],
        bump
    )]
    pub vault: SystemAccount<'info>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Start a new round with admin-provided start price (fetched from CoinGecko/other API)
/// Round cycle: 12h betting + 12h waiting = 24h total
pub fn handler(ctx: Context<StartRound>, asset_symbol: String, start_price: i64) -> Result<()> {
    // Validate asset symbol is not empty and not too long
    require!(!asset_symbol.is_empty() && asset_symbol.len() <= 16, LeftRightError::InvalidAssetSymbol);

    let clock = Clock::get()?;
    let start_time = clock.unix_timestamp;
    let betting_end_time = start_time + Round::BETTING_DURATION; // 12h betting window
    let end_time = start_time + Round::ROUND_DURATION; // 24h total (12h betting + 12h waiting)

    // Initialize round
    let round = &mut ctx.accounts.round;
    let config = &mut ctx.accounts.config;

    round.round_id = config.round_counter;
    round.asset_symbol = asset_symbol.clone();
    round.start_price = start_price;
    round.end_price = 0;
    round.start_time = start_time;
    round.betting_end_time = betting_end_time;
    round.end_time = end_time;
    round.status = RoundStatus::Open;
    round.left_pool = 0;
    round.right_pool = 0;
    round.left_weighted_pool = 0;
    round.right_weighted_pool = 0;
    round.bet_count = 0;
    round.payouts_processed = 0;
    round.winning_side = None;
    round.bump = ctx.bumps.round;

    // Increment round counter
    config.round_counter = config.round_counter.checked_add(1)
        .ok_or(LeftRightError::MathOverflow)?;

    emit!(RoundStarted {
        round_id: round.round_id,
        asset_symbol,
        start_price,
        start_time,
        end_time,
    });

    Ok(())
}
