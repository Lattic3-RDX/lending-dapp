/* ------------------ Imports ----------------- */
use scrypto::prelude::*;

/* ----------------- Utilities ---------------- */
pub const YEAR_IN_SECONDS: i64 = 35_536_000;

pub fn now() -> i64 {
    Clock::current_time(TimePrecisionV2::Second).seconds_since_unix_epoch
}

pub fn trunc(amount: PreciseDecimal) -> Decimal {
    amount.checked_truncate(RoundingMode::ToNearestMidpointToEven).unwrap()
}
