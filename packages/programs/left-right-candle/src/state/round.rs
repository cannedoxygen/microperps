use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum RoundStatus {
    /// Round is accepting bets
    Open,
    /// Betting closed, waiting for settlement
    Locked,
    /// Settlement in progress, processing payouts
    Settling,
    /// Round complete, all payouts processed
    Settled,
}

impl Default for RoundStatus {
    fn default() -> Self {
        RoundStatus::Open
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum Side {
    /// Price closes BELOW start price
    Left = 0,
    /// Price closes ABOVE start price
    Right = 1,
}

impl TryFrom<u8> for Side {
    type Error = ();

    fn try_from(value: u8) -> std::result::Result<Self, Self::Error> {
        match value {
            0 => Ok(Side::Left),
            1 => Ok(Side::Right),
            _ => Err(()),
        }
    }
}

#[account]
#[derive(Default)]
pub struct Round {
    /// Unique round identifier
    pub round_id: u64,
    /// Asset symbol (e.g., "WIF", "BONK", "SOL", "BTC")
    pub asset_symbol: String,
    /// Start price (scaled integer, e.g., price * 1e8)
    pub start_price: i64,
    /// End price (populated at settlement)
    pub end_price: i64,
    /// Unix timestamp when round started
    pub start_time: i64,
    /// Unix timestamp when betting ends (12 hours after start)
    pub betting_end_time: i64,
    /// Unix timestamp when round settles (24 hours after start)
    pub end_time: i64,
    /// Current round status
    pub status: RoundStatus,
    /// Total lamports bet on LEFT side
    pub left_pool: u64,
    /// Total lamports bet on RIGHT side
    pub right_pool: u64,
    /// Weighted total for LEFT side (for payout calculation)
    pub left_weighted_pool: u64,
    /// Weighted total for RIGHT side (for payout calculation)
    pub right_weighted_pool: u64,
    /// Number of bets placed
    pub bet_count: u32,
    /// Number of payouts processed
    pub payouts_processed: u32,
    /// Winning side (set at settlement)
    pub winning_side: Option<Side>,
    /// Bump seed for PDA
    pub bump: u8,
}

impl Round {
    pub const LEN: usize = 8 +  // discriminator
        8 +   // round_id
        4 + 10 + // asset_symbol (String with max 10 chars)
        8 +   // start_price
        8 +   // end_price
        8 +   // start_time
        8 +   // betting_end_time
        8 +   // end_time
        1 +   // status (enum)
        8 +   // left_pool
        8 +   // right_pool
        8 +   // left_weighted_pool
        8 +   // right_weighted_pool
        4 +   // bet_count
        4 +   // payouts_processed
        1 + 1 + // winning_side (Option<Side>)
        1;    // bump

    pub const SEED: &'static [u8] = b"round";

    /// Duration of betting window in seconds (12 hours)
    pub const BETTING_DURATION: i64 = 12 * 60 * 60;

    /// Duration of waiting period after betting closes (12 hours)
    pub const WAITING_DURATION: i64 = 12 * 60 * 60;

    /// Total round duration (24 hours)
    pub const ROUND_DURATION: i64 = Self::BETTING_DURATION + Self::WAITING_DURATION;

    pub fn total_pool(&self) -> u64 {
        self.left_pool.saturating_add(self.right_pool)
    }

    pub fn total_weighted_pool(&self) -> u64 {
        self.left_weighted_pool.saturating_add(self.right_weighted_pool)
    }

    pub fn is_betting_open(&self, current_time: i64) -> bool {
        self.status == RoundStatus::Open &&
        current_time < self.betting_end_time
    }

    pub fn is_ready_to_settle(&self, current_time: i64) -> bool {
        current_time >= self.end_time
    }
}
