use anchor_lang::prelude::*;

#[event]
pub struct RoundStarted {
    pub round_id: u64,
    pub asset_symbol: String,
    pub start_price: i64,
    pub start_time: i64,
    pub end_time: i64,
}

#[event]
pub struct BetPlaced {
    pub round_id: u64,
    pub bettor: Pubkey,
    pub side: u8,
    /// Amount added to pool (after fees)
    pub amount: u64,
    /// Original bet amount before fees
    pub original_amount: u64,
    /// 2.5% fee sent to treasury
    pub treasury_fee: u64,
    /// 1% fee sent to referrer (if any)
    pub referrer_fee: u64,
    pub bet_index: u32,
    pub referrer: Option<Pubkey>,
}

#[event]
pub struct RoundSettled {
    pub round_id: u64,
    pub start_price: i64,
    pub end_price: i64,
    pub winning_side: u8,
    /// Total pool (already fee-adjusted from bet time)
    pub total_pool: u64,
    pub winning_pool: u64,
}

#[event]
pub struct PayoutProcessed {
    pub round_id: u64,
    pub bettor: Pubkey,
    pub amount: u64,
}

#[event]
pub struct ConfigUpdated {
    pub fee_bps: u16,
    pub referrer_fee_bps: u16,
    pub min_bet_lamports: u64,
    pub max_bet_lamports: u64,
}

#[event]
pub struct ReferrerPaid {
    pub round_id: u64,
    pub referrer: Pubkey,
    pub amount: u64,
}
