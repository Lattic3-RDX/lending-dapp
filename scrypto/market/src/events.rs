/* ------------------ Imports ----------------- */
use crate::utils::{ValueMap, ValueTuple};
use scrypto::prelude::*;

/* ------------------ Market ------------------ */
//. General
#[derive(ScryptoSbor, ScryptoEvent)]
pub struct InstantiseEvent {
    pub component_address: ComponentAddress,
    pub asset_list: IndexSet<ResourceAddress>,
}

//. Position management
#[derive(ScryptoSbor, ScryptoEvent)]
pub struct OpenPositionEvent {
    pub position_id: NonFungibleLocalId,

    pub supply: ValueMap,
}

#[derive(ScryptoSbor, ScryptoEvent)]
pub struct PositionSupplyEvent {
    pub position_id: NonFungibleLocalId,

    pub supply: ValueMap,
    pub supply_units: ValueMap,
}

#[derive(ScryptoSbor, ScryptoEvent)]
pub struct PositionBorrowEvent {
    pub position_id: NonFungibleLocalId,

    pub debt: ValueMap,
    pub debt_units: ValueMap,
}

#[derive(ScryptoSbor, ScryptoEvent)]
pub struct PositionWithdrawEvent {
    pub position_id: NonFungibleLocalId,

    pub supply_unit: ValueTuple,
    pub withdraw: ValueTuple,
}

#[derive(ScryptoSbor, ScryptoEvent)]
pub struct PositionRepayEvent {
    pub position_id: NonFungibleLocalId,

    pub repay: ValueTuple,
}

#[derive(ScryptoSbor, ScryptoEvent)]
pub struct PositionCloseEvent {}

//. Internal position operations
#[derive(ScryptoSbor, ScryptoEvent)]
pub struct PositionHealthEvent {
    pub health: PreciseDecimal,
}

//. Asset management
#[derive(ScryptoSbor, ScryptoEvent)]
pub struct AddAssetEvent {
    pub asset: ResourceAddress,
    pub cluster_address: ComponentAddress,
    pub supply_unit_address: ResourceAddress,
}

#[derive(ScryptoSbor, ScryptoEvent)]
pub struct TrackAssetEvent {
    pub asset: ResourceAddress,
}

#[derive(ScryptoSbor, ScryptoEvent)]
pub struct UntrackAssetEvent {
    pub asset: ResourceAddress,
}
