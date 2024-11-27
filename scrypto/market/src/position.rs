/* ------------------ Imports ----------------- */
use crate::utils::ValueMap;
use scrypto::prelude::*;

/* ------------------- Badge ------------------ */
// Position NFT
#[derive(NonFungibleData, ScryptoSbor, Debug)]
pub struct Position {
    #[mutable]
    pub supply: ValueMap, // Stored in terms of supply units
    #[mutable]
    pub debt: ValueMap, // Stored in terms of debt units
}

impl Position {
    /// Initialises a new, empty `Position` struct.
    pub fn new() -> Self {
        Position { supply: ValueMap::new(), debt: ValueMap::new() }
    }

    /// Updates the supply of the position based on the given `ValueMap`.
    ///
    /// Modifies the supply by adding to an entry if the given asset exists in the map,
    /// or inserting a new one if it doesn't. If the amount is negative, it ensures
    /// that the net result is non-negative, removing the entry if it becomes zero.
    ///
    /// # Panics
    /// This function will panic if:
    /// * A supply unit will have an amount <= 0.
    /// * An entry in the passed `ValueMap` with an amount < 0, does not have an existing entry.
    pub fn update_supply(&mut self, supply: &ValueMap) {
        for (&address, &units) in supply {
            if units < dec!(0.0) {
                let existing = *self
                    .supply
                    .get(&address)
                    .expect(format!("Cannot get supply for {:?}, but amount < 0 ({:?})", address, units).as_str());

                let new_units = existing.checked_add(units).unwrap();
                assert!(
                    new_units >= dec!(0.0),
                    "Supply for {:?} will be negative. Changed by {:?}",
                    address,
                    units
                );

                // / let value = price_stream
                // /     .get_price(address)
                // /     .expect(format!("Unable to get price of {:?}", address).as_str())
                // /     .checked_mul(new_amount)
                // /     .unwrap();

                if new_units == dec!(0.0) {
                    self.supply.remove(&address);
                } else {
                    self.supply.insert(address, new_units);
                }
            } else {
                if let Some(existing) = self.supply.get(&address) {
                    self.supply.insert(address, existing.checked_add(units).unwrap());
                } else {
                    self.supply.insert(address, units);
                }
            }
        }
    }

    /// Updates the debt of the position based on the given `ValueMap`.
    ///
    /// Modifies the debt by adding to an entry if the given asset exists in the map,
    /// or inserting a new one if it doesn't. If the amount is negative, it ensures
    /// that the net result is non-negative, removing the entry if it becomes zero.
    ///
    /// # Panics
    /// This function will panic if:
    /// * A debt unit will have an amount <= 0.
    /// * An entry in the passed `ValueMap` with an amount < 0 does not have an existing entry.
    pub fn update_debt(&mut self, debt: &ValueMap) {
        for (&address, &units) in debt {
            if units < dec!(0.0) {
                let existing = *self
                    .debt
                    .get(&address)
                    .expect(format!("Cannot get debt for {:?}, but amount < 0 ({:?})", address, units).as_str());

                let new_units = existing.checked_add(units).unwrap();
                assert!(new_units >= dec!(0.0), "Debt for {:?} will be negative. Changed by {:?}", address, units);

                // // Convert existing units into amount, and get its sum
                // / let ratio = units.checked_div(amount.checked_mul(dec!(-1)).unwrap()).unwrap();
                // / let existing_amount = existing.checked_div(ratio).unwrap();

                // / let new_amount = existing_amount.checked_sub(amount).unwrap();

                // / let value = price_stream
                // /     .get_price(address)
                // /     .expect(format!("Unable to get price of {:?}", address).as_str())
                // /     .checked_mul(new_amount)
                // /     .unwrap();

                if new_units == dec!(0.0) {
                    self.debt.remove(&address);
                } else {
                    self.debt.insert(address, new_units);
                }
            } else {
                if let Some(existing) = self.debt.get(&address) {
                    self.debt.insert(address, existing.checked_add(units).unwrap());
                } else {
                    self.debt.insert(address, units);
                }
            }
        }
    }
}
