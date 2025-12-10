use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct Config {
    /// Admin authority that can update config and start rounds
    pub admin: Pubkey,
    /// Total fee in basis points (100 = 1%)
    pub fee_bps: u16,
    /// Referrer share of fee in basis points (e.g., 100 = 1% of pool, or 40% of 2.5% fee)
    pub referrer_fee_bps: u16,
    /// Minimum bet amount in lamports
    pub min_bet_lamports: u64,
    /// Maximum bet amount in lamports
    pub max_bet_lamports: u64,
    /// Treasury wallet for collecting fees
    pub treasury: Pubkey,
    /// Counter for round IDs
    pub round_counter: u64,
    /// Bump seed for PDA
    pub bump: u8,
}

impl Config {
    pub const LEN: usize = 8 + // discriminator
        32 + // admin
        2 +  // fee_bps
        2 +  // referrer_fee_bps
        8 +  // min_bet_lamports
        8 +  // max_bet_lamports
        32 + // treasury
        8 +  // round_counter
        1;   // bump

    pub const SEED: &'static [u8] = b"config";

    /// Calculate fee split: returns (treasury_fee, referrer_fee)
    pub fn calculate_fee_split(&self, total_pool: u64, has_referrer: bool) -> (u64, u64) {
        let total_fee = (total_pool as u128)
            .checked_mul(self.fee_bps as u128)
            .and_then(|v| v.checked_div(10000))
            .unwrap_or(0) as u64;

        if has_referrer && self.referrer_fee_bps > 0 {
            let referrer_fee = (total_pool as u128)
                .checked_mul(self.referrer_fee_bps as u128)
                .and_then(|v| v.checked_div(10000))
                .unwrap_or(0) as u64;
            let treasury_fee = total_fee.saturating_sub(referrer_fee);
            (treasury_fee, referrer_fee)
        } else {
            (total_fee, 0)
        }
    }
}
