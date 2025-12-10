use anchor_lang::prelude::*;

#[error_code]
pub enum LeftRightError {
    #[msg("Fee basis points must be <= 10000")]
    InvalidFeeBps,

    #[msg("Minimum bet must be less than maximum bet")]
    InvalidBetLimits,

    #[msg("Bet amount is below minimum")]
    BetTooSmall,

    #[msg("Bet amount exceeds maximum")]
    BetTooLarge,

    #[msg("Round is not accepting bets")]
    RoundNotOpen,

    #[msg("Round betting period has ended")]
    BettingPeriodEnded,

    #[msg("Round has not ended yet")]
    RoundNotEnded,

    #[msg("Round has already been settled")]
    RoundAlreadySettled,

    #[msg("Invalid side: must be 0 (LEFT) or 1 (RIGHT)")]
    InvalidSide,

    #[msg("Unauthorized: only admin can perform this action")]
    Unauthorized,

    #[msg("Arithmetic overflow")]
    MathOverflow,

    #[msg("Round has no bets to settle")]
    NoBetsToSettle,

    #[msg("Payout already processed for this bet")]
    PayoutAlreadyProcessed,

    #[msg("Invalid asset symbol")]
    InvalidAssetSymbol,

    #[msg("Round is not in settling state")]
    RoundNotSettling,
}
