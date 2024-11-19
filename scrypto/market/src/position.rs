/* ------------------ Imports ----------------- */
use crate::utils::ValueMap;
use scrypto::prelude::*;

/* ------------------- Badge ------------------ */
#[derive(NonFungibleData, ScryptoSbor, Debug)]
pub struct Position {
    #[mutable]
    pub supply: ValueMap,
    #[mutable]
    pub debt: ValueMap,
}

impl Position {
    pub fn new() -> Self {
        Position { supply: ValueMap::new(), debt: ValueMap::new() }
    }

    pub fn update_supply(&mut self, supply: &ValueMap) {
        for (&address, &amount) in supply {
            if let Some(existing) = self.supply.get(&address) {
                self.supply.insert(address, existing.checked_add(amount).unwrap());
            } else {
                self.supply.insert(address, amount);
            }
        }
    }

    pub fn update_debt(&mut self, debt: &ValueMap) {
        for (&address, &amount) in debt {
            if let Some(existing) = self.debt.get(&address) {
                self.debt.insert(address, existing.checked_add(amount).unwrap());
            } else {
                self.debt.insert(address, amount);
            }
        }
    }
}
