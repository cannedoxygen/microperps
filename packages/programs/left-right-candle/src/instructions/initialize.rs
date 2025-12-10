use anchor_lang::prelude::*;
use crate::errors::LeftRightError;
use crate::events::ConfigUpdated;
use crate::state::Config;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = admin,
        space = Config::LEN,
        seeds = [Config::SEED],
        bump
    )]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub admin: Signer<'info>,

    /// CHECK: Treasury wallet to receive fees
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<Initialize>,
    fee_bps: u16,
    referrer_fee_bps: u16,
    min_bet_lamports: u64,
    max_bet_lamports: u64,
) -> Result<()> {
    require!(fee_bps <= 10000, LeftRightError::InvalidFeeBps);
    require!(referrer_fee_bps <= fee_bps, LeftRightError::InvalidFeeBps);
    require!(min_bet_lamports < max_bet_lamports, LeftRightError::InvalidBetLimits);

    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key();
    config.fee_bps = fee_bps;
    config.referrer_fee_bps = referrer_fee_bps;
    config.min_bet_lamports = min_bet_lamports;
    config.max_bet_lamports = max_bet_lamports;
    config.treasury = ctx.accounts.treasury.key();
    config.round_counter = 0;
    config.bump = ctx.bumps.config;

    emit!(ConfigUpdated {
        fee_bps,
        referrer_fee_bps,
        min_bet_lamports,
        max_bet_lamports,
    });

    Ok(())
}
