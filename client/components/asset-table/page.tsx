import { columns } from "./columns";
import { Asset, assetConfigs } from "@/types/asset";
import { AssetTable } from "./asset-table";

async function getData(): Promise<Asset[]> {
  // Fetch data from your API here.
  // For now, use mock data based on our centralized config
  return Object.values(assetConfigs).map(config => ({
    address: config.address,
    label: config.label,
    wallet_balance: 0.00,
    select_native: 0.00,
    supply_APR: config.supply_APR,
    borrow_APR: config.borrow_APR,
    pool_unit_address: config.pool_unit_address ? config.pool_unit_address : '',
    APR: config.supply_APR
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
