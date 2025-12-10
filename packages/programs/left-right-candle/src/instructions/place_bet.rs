use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::errors::LeftRightError;
use crate::events::BetPlaced;
use crate::state::{Bet, Config, Round, RoundStatus, Side};

#[derive(Accounts)]
pub struct PlaceBet<'info> {
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

    #[account(
        init,
        payer = bettor,
        space = Bet::LEN,
        seeds = [
            Bet::SEED,
            round.round_id.to_le_bytes().as_ref(),
            round.bet_count.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub bet: Account<'info, Bet>,

    /// Round vault PDA to hold bets (after fees)
    /// CHECK: PDA owned by program
    #[account(
        mut,
        seeds = [b"vault", round.round_id.to_le_bytes().as_ref()],
        bump
    )]
    pub vault: SystemAccount<'info>,

    /// Treasury to receive platform fees
    /// CHECK: Validated against config
    #[account(
        mut,
        constraint = treasury.key() == config.treasury @ LeftRightError::Unauthorized
    )]
    pub treasury: UncheckedAccount<'info>,

    #[account(mut)]
    pub bettor: Signer<'info>,

    /// Optional referrer who shared the blink - receives 1% fee immediately
    /// CHECK: Any valid pubkey, validated if provided
    #[account(mut)]
    pub referrer: Option<UncheckedAccount<'info>>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<PlaceBet>, side: u8, amount_lamports: u64) -> Result<()> {
    let config = &ctx.accounts.config;
    let round = &mut ctx.accounts.round;
    let clock = Clock::get()?;

    // Validate side
    let side_enum = Side::try_from(side)
        .map_err(|_| LeftRightError::InvalidSide)?;

    // Validate round is open for betting
    require!(round.status == RoundStatus::Open, LeftRightError::RoundNotOpen);
    require!(
        round.is_betting_open(clock.unix_timestamp),
        LeftRightError::BettingPeriodEnded
    );

    // Validate bet amount
    require!(amount_lamports >= config.min_bet_lamports, LeftRightError::BetTooSmall);
    require!(amount_lamports <= config.max_bet_lamports, LeftRightError::BetTooLarge);

    // ============================================
    // FEE CALCULATION (taken upfront from bet)
    // ============================================

    // 2.5% platform fee to treasury
    let treasury_fee = (amount_lamports as u128)
        .checked_mul(config.fee_bps as u128)
        .and_then(|v| v.checked_div(10000))
        .ok_or(LeftRightError::MathOverflow)? as u64;

    // 1% referrer fee (only if valid referrer exists and not self-referral)
    let referrer_key = ctx.accounts.referrer
        .as_ref()
        .map(|r| r.key())
        .filter(|r| *r != ctx.accounts.bettor.key());

    let referrer_fee = if referrer_key.is_some() {
        (amount_lamports as u128)
            .checked_mul(config.referrer_fee_bps as u128)
            .and_then(|v| v.checked_div(10000))
            .ok_or(LeftRightError::MathOverflow)? as u64
    } else {
        0
    };

    // Amount that goes into the pool (after fees)
    let pool_amount = amount_lamports
        .checked_sub(treasury_fee)
        .and_then(|v| v.checked_sub(referrer_fee))
        .ok_or(LeftRightError::MathOverflow)?;

    // ============================================
    // TRANSFERS
    // ============================================

    // 1. Transfer treasury fee
    if treasury_fee > 0 {
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.bettor.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
            ),
            treasury_fee,
        )?;
    }

    // 2. Transfer referrer fee (if applicable)
    if referrer_fee > 0 {
        if let Some(ref referrer_account) = ctx.accounts.referrer {
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.bettor.to_account_info(),
                        to: referrer_account.to_account_info(),
                    },
                ),
                referrer_fee,
            )?;
        }
    }

    // 3. Transfer remaining amount to vault (the actual pool)
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.bettor.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        ),
        pool_amount,
    )?;

    // ============================================
    // CALCULATE WEIGHT BASED ON BET TIMING
    // ============================================
    let bet_time = clock.unix_timestamp;
    let weight = Bet::calculate_weight(round.start_time, bet_time);

    // Weighted amount for pool distribution
    let weighted_amount = (pool_amount as u128 * weight as u128 / 100) as u64;

    // ============================================
    // UPDATE STATE
    // ============================================

    // Update round pools with the POOL AMOUNT (after fees)
    // and weighted pools for payout calculation
    match side_enum {
        Side::Left => {
            round.left_pool = round.left_pool
                .checked_add(pool_amount)
                .ok_or(LeftRightError::MathOverflow)?;
            round.left_weighted_pool = round.left_weighted_pool
                .checked_add(weighted_amount)
                .ok_or(LeftRightError::MathOverflow)?;
        }
        Side::Right => {
            round.right_pool = round.right_pool
                .checked_add(pool_amount)
                .ok_or(LeftRightError::MathOverflow)?;
            round.right_weighted_pool = round.right_weighted_pool
                .checked_add(weighted_amount)
                .ok_or(LeftRightError::MathOverflow)?;
        }
    }

    // Create bet record
    // Store the POOL AMOUNT (what's actually in the pool for payout calculation)
    let bet = &mut ctx.accounts.bet;
    bet.round_id = round.round_id;
    bet.bettor = ctx.accounts.bettor.key();
    bet.side = side;
    bet.amount = pool_amount;  // Store pool contribution, not original bet
    bet.original_amount = amount_lamports;  // Store original for reference
    bet.bet_time = bet_time;  // Store when bet was placed
    bet.weight = weight;  // Store weight multiplier (scaled by 100)
    bet.bet_index = round.bet_count;
    bet.paid_out = false;
    bet.referrer = referrer_key;
    bet.bump = ctx.bumps.bet;

    let bet_index = round.bet_count;
    round.bet_count = round.bet_count
        .checked_add(1)
        .ok_or(LeftRightError::MathOverflow)?;

    emit!(BetPlaced {
        round_id: round.round_id,
        bettor: ctx.accounts.bettor.key(),
        side,
        amount: pool_amount,
        original_amount: amount_lamports,
        treasury_fee,
        referrer_fee,
        bet_index,
        referrer: referrer_key,
    });

    Ok(())
}
