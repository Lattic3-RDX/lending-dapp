/* ------------------ Imports ----------------- */
use scrypto::prelude::*;

/* ----------------- Utilities ---------------- */
pub const YEAR_IN_SECONDS: i64 = 31_622_400; // Expected 35_536_000, but from resim testing found 31_622_400 to be representative of a year

/// Returns the number of seconds since the Unix epoch, i.e. January 1st, 1970 00:00:00 UTC.
pub fn now() -> i64 {
    Clock::current_time(TimePrecisionV2::Second).seconds_since_unix_epoch
}

pub fn trunc(amount: PreciseDecimal) -> Decimal {
    amount.checked_truncate(RoundingMode::ToNearestMidpointToEven).unwrap()
}
