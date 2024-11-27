import { columns } from "./columns";
import { Asset, assetConfigs, getWalletBalances } from "@/types/asset";
import { AssetTable } from "./asset-table";
import { bn } from "@/lib/math";

async function getData(): Promise<Asset[]> {
  return Object.values(assetConfigs).map((config) => ({
    address: config.address,
    label: config.label,
    wallet_balance: bn(0),
    select_native: bn(0),
    supply_APR: config.supply_APR,
    borrow_APR: config.borrow_APR,
    pool_unit_address: config.pool_unit_address ? config.pool_unit_address : "",
    APR: config.supply_APR,
  }));
}

export default async function DemoPage() {
  const data = await getData();

  return (
    <div className="container mx-auto py-10">
      <AssetTable
        columns={columns}
        data={data}
        rowSelection={{}}
        onRowSelectionChange={() => {}}
        onAmountChange={() => {}}
        mode="supply"
      />
    </div>
  );
}
