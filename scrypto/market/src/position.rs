/* ------------------ Imports ----------------- */
use crate::utils::ValueMap;
use scrypto::prelude::*;

/* ------------------- Badge ------------------ */
#[derive(NonFungibleData, ScryptoSbor, Debug)]
pub struct Position {
    #[mutable]
    pub supply: ValueMap, // Stored in terms of supply units
    #[mutable]
    pub debt: ValueMap, // Stored in terms of debt units
}

impl Position {
    pub fn new() -> Self {
        Position { supply: ValueMap::new(), debt: ValueMap::new() }
    }

    pub fn update_supply(&mut self, supply: &ValueMap) {
        for (&address, &amount) in supply {
            if amount < pdec!(0.0) {
                let existing = *self
                    .supply
                    .get(&address)
                    .expect(format!("Cannot get supply for {:?}, but amount < 0 ({:?})", address, amount).as_str());

                let new = existing.checked_add(amount).unwrap();
                assert!(new >= pdec!(0.0), "Supply for {:?} will be negative. Changed by {:?}", address, amount);

                if new == pdec!(0.0) {
                    self.supply.remove(&address);
                } else {
                    self.supply.insert(address, new);
                }
            } else {
                if let Some(existing) = self.supply.get(&address) {
                    self.supply.insert(address, existing.checked_add(amount).unwrap());
                } else {
                    self.supply.insert(address, amount);
                }
            }
        }
    }

    pub fn update_debt(&mut self, debt: &ValueMap) {
        for (&address, &amount) in debt {
            if amount < pdec!(0.0) {
                let existing = *self
                    .debt
                    .get(&address)
                    .expect(format!("Cannot get debt for {:?}, but amount < 0 ({:?})", address, amount).as_str());

                let new = existing.checked_add(amount).unwrap();
                assert!(new >= pdec!(0.0), "Debt for {:?} will be negative. Changed by {:?}", address, amount);

                if new == pdec!(0.0) {
                    self.debt.remove(&address);
                } else {
                    self.debt.insert(address, new);
                }
            } else {
                if let Some(existing) = self.debt.get(&address) {
                    self.debt.insert(address, existing.checked_add(amount).unwrap());
                } else {
                    self.debt.insert(address, amount);
                }
            }
        }
    }
}
