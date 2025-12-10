use anchor_lang::prelude::*;

use crate::errors::LeftRightError;
use crate::events::RoundSettled;
use crate::state::{Config, Round, RoundStatus, Side};

#[derive(Accounts)]
pub struct SettleRound<'info> {
    #[account(
        seeds = [Config::SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [Round::SEED, round.round_id.to_le_bytes().as_ref()],
        bump = round.bump,
    )]
    pub round: Account<'info, Round>,

    /// Admin who can settle rounds
    #[account(
        constraint = admin.key() == config.admin @ LeftRightError::Unauthorized
    )]
    pub admin: Signer<'info>,
}

/// Settle round with admin-provided end price (fetched from CoinGecko/other API)
/// Note: Fees (treasury 2.5% + referrer 1%) were already collected at bet time
pub fn handler(ctx: Context<SettleRound>, end_price: i64) -> Result<()> {
    let round = &mut ctx.accounts.round;
    let clock = Clock::get()?;

    // Validate round can be settled
    require!(
        round.status == RoundStatus::Open || round.status == RoundStatus::Locked,
        LeftRightError::RoundAlreadySettled
    );
    require!(
        clock.unix_timestamp >= round.end_time,
        LeftRightError::RoundNotEnded
    );

    // Set end price (provided by admin from off-chain oracle like CoinGecko)
    round.end_price = end_price;

    // Determine winning side
    let winning_side = if end_price < round.start_price {
        Side::Left
    } else {
        Side::Right  // Ties go to RIGHT
    };
    round.winning_side = Some(winning_side);

    let total_pool = round.total_pool();
    let winning_pool = match winning_side {
        Side::Left => round.left_pool,
        Side::Right => round.right_pool,
    };

    // No fee collection here - fees were taken upfront at bet time
    // The vault contains only the pool amounts (after fees)

    // Update round status
    round.status = RoundStatus::Settling;

    emit!(RoundSettled {
        round_id: round.round_id,
        start_price: round.start_price,
        end_price,
        winning_side: winning_side as u8,
        total_pool,
        winning_pool,
    });

    Ok(())
}
