use anchor_lang::prelude::*;
use super::Side;

#[account]
#[derive(Default)]
pub struct Bet {
    /// Round this bet belongs to
    pub round_id: u64,
    /// Bettor's wallet
    pub bettor: Pubkey,
    /// Which side (LEFT=0, RIGHT=1)
    pub side: u8,
    /// Amount in pool after fees (used for payout calculation)
    pub amount: u64,
    /// Original bet amount before fees (for display/reference)
    pub original_amount: u64,
    /// Unix timestamp when bet was placed
    pub bet_time: i64,
    /// Weight multiplier (scaled by 100, e.g., 150 = 1.5x)
    pub weight: u64,
    /// Index of this bet in the round
    pub bet_index: u32,
    /// Whether payout has been processed
    pub paid_out: bool,
    /// Referrer who shared the blink (receives fee cut)
    pub referrer: Option<Pubkey>,
    /// Bump seed for PDA
    pub bump: u8,
}

impl Bet {
    pub const LEN: usize = 8 + // discriminator
        8 +  // round_id
        32 + // bettor
        1 +  // side
        8 +  // amount (pool contribution)
        8 +  // original_amount
        8 +  // bet_time
        8 +  // weight
        4 +  // bet_index
        1 +  // paid_out
        1 + 32 + // referrer (Option<Pubkey>)
        1;   // bump

    pub const SEED: &'static [u8] = b"bet";

    /// Weight multipliers scaled by 100 (e.g., 150 = 1.5x)
    pub const WEIGHT_TIER_1: u64 = 150; // Hours 0-3: 1.5x
    pub const WEIGHT_TIER_2: u64 = 130; // Hours 3-6: 1.3x
    pub const WEIGHT_TIER_3: u64 = 115; // Hours 6-9: 1.15x
    pub const WEIGHT_TIER_4: u64 = 100; // Hours 9-12: 1.0x

    /// Calculate weight based on time elapsed since round start
    pub fn calculate_weight(round_start: i64, bet_time: i64) -> u64 {
        let elapsed_seconds = bet_time.saturating_sub(round_start);
        let elapsed_hours = elapsed_seconds / 3600;

        if elapsed_hours < 3 {
            Self::WEIGHT_TIER_1
        } else if elapsed_hours < 6 {
            Self::WEIGHT_TIER_2
        } else if elapsed_hours < 9 {
            Self::WEIGHT_TIER_3
        } else {
            Self::WEIGHT_TIER_4
        }
    }

    /// Calculate weighted amount for payout distribution
    pub fn weighted_amount(&self) -> u64 {
        // amount * weight / 100
        (self.amount as u128 * self.weight as u128 / 100) as u64
    }

    pub fn side_enum(&self) -> Option<Side> {
        Side::try_from(self.side).ok()
    }
}
