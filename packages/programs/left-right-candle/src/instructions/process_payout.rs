use anchor_lang::prelude::*;

use crate::errors::LeftRightError;
use crate::events::PayoutProcessed;
use crate::state::{Bet, Round, RoundStatus};

#[derive(Accounts)]
pub struct ProcessPayout<'info> {
    #[account(
        mut,
        seeds = [Round::SEED, round.round_id.to_le_bytes().as_ref()],
        bump = round.bump,
    )]
    pub round: Account<'info, Round>,

    #[account(
        mut,
        seeds = [
            Bet::SEED,
            round.round_id.to_le_bytes().as_ref(),
            bet.bet_index.to_le_bytes().as_ref()
        ],
        bump = bet.bump,
        constraint = bet.round_id == round.round_id,
    )]
    pub bet: Account<'info, Bet>,

    /// Round vault holding pool funds (already fee-adjusted)
    /// CHECK: PDA owned by program
    #[account(
        mut,
        seeds = [b"vault", round.round_id.to_le_bytes().as_ref()],
        bump
    )]
    pub vault: SystemAccount<'info>,

    /// Bettor receiving payout
    /// CHECK: Validated against bet record
    #[account(
        mut,
        constraint = bettor.key() == bet.bettor @ LeftRightError::Unauthorized
    )]
    pub bettor: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

/// Process payout for a single bet
///
/// Payout formula (weighted distribution with guaranteed return):
///   1. Winners get their original bet back (minus fee already deducted)
///   2. Losers' pool is distributed to winners based on weighted share
///
///   payout = bet.amount + (bet.weighted_amount / winning_weighted_pool) * losing_pool
///
/// Weight tiers based on bet timing (early bird bonus):
/// - Hours 0-3: 1.5x weight
/// - Hours 3-6: 1.3x weight
/// - Hours 6-9: 1.15x weight
/// - Hours 9-12: 1.0x weight
pub fn handler(ctx: Context<ProcessPayout>) -> Result<()> {
    let round = &mut ctx.accounts.round;
    let bet = &mut ctx.accounts.bet;

    // Validate round is in settling state
    require!(
        round.status == RoundStatus::Settling,
        LeftRightError::RoundNotSettling
    );

    // Check bet hasn't been paid out already
    require!(!bet.paid_out, LeftRightError::PayoutAlreadyProcessed);

    // Get winning side
    let winning_side = round.winning_side.ok_or(LeftRightError::RoundNotSettling)?;
    let bet_side = bet.side_enum().ok_or(LeftRightError::InvalidSide)?;

    // Note: Referrer fees were already paid at bet time, nothing to do here

    if bet_side == winning_side {
        // Get pools based on winning side
        let (winning_pool, winning_weighted_pool, losing_pool) = match winning_side {
            crate::state::Side::Left => (
                round.left_pool,
                round.left_weighted_pool,
                round.right_pool,
            ),
            crate::state::Side::Right => (
                round.right_pool,
                round.right_weighted_pool,
                round.left_pool,
            ),
        };

        // Calculate payout
        // Step 1: Winner gets their bet back
        let mut payout = bet.amount;

        // Step 2: Add weighted share of losing pool (if there are losers)
        if losing_pool > 0 && winning_weighted_pool > 0 {
            // Calculate this bet's weighted amount
            let bet_weighted_amount = bet.weighted_amount();

            // Their share of the losers' pool
            // share = (bet_weighted_amount / winning_weighted_pool) * losing_pool
            let bonus = (bet_weighted_amount as u128)
                .checked_mul(losing_pool as u128)
                .and_then(|v| v.checked_div(winning_weighted_pool as u128))
                .ok_or(LeftRightError::MathOverflow)? as u64;

            payout = payout
                .checked_add(bonus)
                .ok_or(LeftRightError::MathOverflow)?;
        }

        if payout > 0 {
            // Transfer payout from vault to bettor
            let vault_info = ctx.accounts.vault.to_account_info();
            let bettor_info = ctx.accounts.bettor.to_account_info();

            **vault_info.try_borrow_mut_lamports()? -= payout;
            **bettor_info.try_borrow_mut_lamports()? += payout;

            emit!(PayoutProcessed {
                round_id: round.round_id,
                bettor: bet.bettor,
                amount: payout,
            });
        }
    }

    // Mark bet as paid out (even if they lost, to track progress)
    bet.paid_out = true;

    // Update payout counter
    round.payouts_processed = round.payouts_processed
        .checked_add(1)
        .ok_or(LeftRightError::MathOverflow)?;

    // If all payouts processed, mark round as settled
    if round.payouts_processed >= round.bet_count {
        round.status = RoundStatus::Settled;
    }

    Ok(())
}
