import { bn, m_bn, math, round_dec } from "@/lib/math";
import { gatewayApi } from "@/lib/radix";
import { FungibleResourcesCollectionAllOfToJSON } from "@radixdlt/babylon-gateway-api-sdk";
import { BigNumber } from "mathjs";
import config from "@/lib/config.json";

// Add this interface near the top with your other interfaces
interface NFTData {
  data: {
    programmatic_json: {
      fields: Array<{
        field_name: string;
        value?: {
          value: string;
        };
        entries?: Array<{
          value: {
            value: string;
          };
        }>;
      }>;
    };
  };
}

export type AssetName = "XRD" | "xUSDT" | "HUG";

export interface Asset {
  address: string;
  label: AssetName;
  pool_unit_address: string;
  wallet_balance: BigNumber;
  select_native: BigNumber;
  APR: number;
  type?: "supply" | "borrow";
  available?: BigNumber;
}

export interface AssetConfig {
  address: string;
  label: AssetName;
  icon: string;
  supply_APR: number;
  borrow_APR: number;
  pool_unit_address?: string;
}

export const assetConfigs: Record<AssetName, AssetConfig> = {
  XRD: {
    address: "resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc",
    label: "XRD",
    icon: "https://assets.radixdlt.com/icons/icon-xrd-32x32.png",
    pool_unit_address: "resource_tdx_2_1t44uv2jertt0w0mwl2prqzslvng49k25xq4aaz343kc39g2xw4dhvd",
    supply_APR: 5,
    borrow_APR: 10,
  },
  HUG: {
    address: "resource_tdx_2_1tkuj2rqsa63f8ygkzezgt27trj50srht5e666jaz28j5ss8fasg5kl",
    label: "HUG",
    icon: "https://tokens.defiplaza.net/cdn-cgi/imagedelivery/QTzOBjs3mHq3EhZxDosDSw/f5cdcf72-c7a2-4032-1252-1be08edb0700/token",
    pool_unit_address: "resource_tdx_2_1t5x3749x84uzl996rqkxds57nnu8ax2g9h7s2tu5rqhn8ut7en66fk",
    supply_APR: 5,
    borrow_APR: 10,
  },
  xUSDT: {
    address: "resource_tdx_2_1t57e50rm28cyqwn26jn336qyhu8nkt8cknacq8rnsn5kul2l3zvjut",
    label: "xUSDT",
    icon: "https://assets.instabridge.io/tokens/icons/xUSDT.png",
    pool_unit_address: "resource_tdx_2_1t5wcz4xt9j2zkjj42ld0fp45j98lprvdt9hc5g4d9dtjq0eswtggf2",
    supply_APR: 5,
    borrow_APR: 10,
  },
};

// Helper functions
export const getAssetConfig = (label: AssetName): AssetConfig | undefined => assetConfigs[label];
export const getAssetIcon = (label: AssetName): string =>
  assetConfigs[label]?.icon || "https://assets.radixdlt.com/icons/icon-default-32x32.png";
export const getAssetAddress = (label: AssetName): string => assetConfigs[label]?.address || "";
export const getAssetAPR = (label: AssetName, type: "supply" | "borrow" = "supply"): number =>
  type === "supply" ? assetConfigs[label]?.supply_APR || 0 : assetConfigs[label]?.borrow_APR || 0;

// Remove the separate assetAddrRecord and instead create a helper function
export const getAssetAddrRecord = (): Record<AssetName, string> => {
  return Object.entries(assetConfigs).reduce(
    (acc, [label, config]) => ({
      ...acc,
      [label]: config.address,
    }),
    {} as Record<AssetName, string>,
  );
};

export const getUnitBalance = async (accountAddress: string, label: AssetName): Promise<BigNumber> => {
  const unitAddress = assetConfigs[label]?.pool_unit_address;
  if (!gatewayApi) {
    console.error("Gateway API not initialized");
    return bn(-1);
  }
  try {
    const response = await gatewayApi.state.getEntityDetailsVaultAggregated(accountAddress);

    const fungibleResources = response.fungible_resources.items || [];
    fungibleResources.filter((resource) => resource.resource_address === unitAddress);

    if (fungibleResources.length === 0) {
      return bn(-1);
    }

    return bn(fungibleResources[0].vaults.items[0].amount);
  } catch (error) {
    console.error("Error fetching wallet balances:", error);
    return bn(-1);
  }
};

// Replace mockWalletBalances with a function to fetch real balances
export const getWalletBalances = async (accountAddress: string): Promise<Record<AssetName, BigNumber>> => {
  if (!gatewayApi) {
    console.error("Gateway API not initialized");
    return {} as Record<AssetName, BigNumber>;
  }

  try {
    const response = await gatewayApi.state.getEntityDetailsVaultAggregated(accountAddress);
    const balances: Partial<Record<AssetName, BigNumber>> = {};

    const fungibleResources = response.fungible_resources.items || [];
    fungibleResources.forEach((resource) => {
      // Find matching asset config by address
      const assetEntry = Object.entries(assetConfigs).find(
        ([_, config]) => config.address === resource.resource_address,
      );

      if (assetEntry) {
        const [assetName] = assetEntry;
        // Convert from string to number and handle decimal places
        balances[assetName as AssetName] = bn(resource.vaults.items[0].amount);
      }
    });

    // Fill in zero balances for assets not found in the response
    Object.keys(assetConfigs).forEach((assetName) => {
      if (!(assetName in balances)) {
        balances[assetName as AssetName] = bn(0);
      }
    });
    return balances as Record<AssetName, BigNumber>;
  } catch (error) {
    console.error("Error fetching wallet balances:", error);
    return {} as Record<AssetName, BigNumber>;
  }
};

// Update the getWalletBalance helper to use the new async function
export const getWalletBalance = async (asset: AssetName, accountAddress: string): Promise<BigNumber> => {
  const balances = await getWalletBalances(accountAddress);
  return balances[asset] || bn(0);
};

export const getAssetPrice = async (asset: AssetName): Promise<BigNumber> => {
  const res = await fetch("api/assets/prices", { method: "GET" });
  if (res.status !== 200) {
    console.error("Error fetching asset prices:", res.statusText);
    return bn(-1);
  }

  const { prices } = await res.json();

  if (!Array.isArray(prices)) {
    console.error("Unexpected price data format: prices is not an array");
    return bn(-1);
  }

  // Get the resource address for the asset
  const assetAddress = getAssetAddress(asset);
  // Find the price entry where asset matches our resource address
  const priceEntry = prices.find((p) => p.asset === assetAddress);

  if (!priceEntry) {
    console.warn(`No price found for asset ${asset} (${assetAddress})`);
    return bn(0);
  }

  return bn(priceEntry.price);
};

export const supplyUnitsToAmount = async (asset: Record<AssetName, BigNumber>): Promise<BigNumber> => {
  const address = getAssetAddress(Object.keys(asset)[0] as AssetName);
  const supplyUnits = Object.values(asset)[0];

  console.log("Address: ", address);
  console.log("Supply unit amount: ", supplyUnits.toString());

  const cluster_states_res = await fetch("api/assets/clusters", { method: "GET" });

  if (!cluster_states_res.ok) {
    console.error("Error fetching cluster states:", cluster_states_res.statusText);
    return bn(-1);
  }

  const cluster_states = await cluster_states_res.json();
  const cluster = cluster_states[address];

  if (!cluster) {
    console.error(`No cluster state found for asset ${address}`);
    return bn(-1);
  }

  const amount = round_dec(m_bn(math.divide(supplyUnits, bn(cluster.supply_ratio))));
  console.log("Amount: ", amount.toString());

  return amount;
};

export const ammountToSupplyUnits = async (asset: Record<AssetName, BigNumber>): Promise<BigNumber> => {
  const address = getAssetAddress(Object.keys(asset)[0] as AssetName);
  const amount = Object.values(asset)[0];

  console.log("Address: ", address);
  console.log("Supply amount: ", amount.toString());

  const cluster_states_res = await fetch("api/assets/clusters", { method: "GET" });

  if (!cluster_states_res.ok) {
    console.error("Error fetching cluster states:", cluster_states_res.statusText);
    return bn(-1);
  }

  const cluster_states = await cluster_states_res.json();
  const cluster = cluster_states[address];

  if (!cluster) {
    console.error(`No cluster state found for asset ${address}`);
    return bn(-1);
  }

  const units = round_dec(m_bn(math.multiply(amount, bn(cluster.supply_ratio))));
  console.log("Supply units: ", units.toString());

  return units;
};

export const borrowUnitsToAmount = async (asset: Record<AssetName, BigNumber>): Promise<BigNumber> => {
  const address = getAssetAddress(Object.keys(asset)[0] as AssetName);
  const borrowUnits = Object.values(asset)[0];

  console.log("Address: ", address.toString());
  console.log("Borrow unit amount: ", borrowUnits.toString());

  const cluster_states_res = await fetch("api/assets/clusters", { method: "GET" });

  if (!cluster_states_res.ok) {
    console.error("Error fetching cluster states:", cluster_states_res.statusText);
    return bn(-1);
  }

  const cluster_states = await cluster_states_res.json();
  const cluster = cluster_states[address];
  console.log("Cluster: ", cluster);

  if (!cluster) {
    console.error(`No cluster state found for asset ${address}`);
    return bn(-1);
  }

  const amount = round_dec(m_bn(math.divide(borrowUnits, bn(cluster.debt_ratio))));
  console.log("Amount: ", amount.toString());

  return amount;
};

export const amountToBorrowUnits = async (asset: Record<AssetName, BigNumber>): Promise<BigNumber> => {
  const address = getAssetAddress(Object.keys(asset)[0] as AssetName);
  const borrowUnits = Object.values(asset)[0];

  console.log("Address: ", address.toString());
  console.log("Amount: ", borrowUnits.toString());

  const cluster_states_res = await fetch("api/assets/clusters", { method: "GET" });

  if (!cluster_states_res.ok) {
    console.error("Error fetching cluster states:", cluster_states_res.statusText);
    return bn(-1);
  }

  const cluster_states = await cluster_states_res.json();
  const cluster = cluster_states[address];
  console.log("Cluster: ", cluster);

  if (!cluster) {
    console.error(`No cluster state found for asset ${address}`);
    return bn(-1);
  }

  const amount = round_dec(m_bn(math.multiply(borrowUnits, bn(cluster.debt_ratio))));
  console.log("Borrow unit amount: ", amount.toString());

  return amount;
};

export const hasEmptyPosition = async (accountAddress: string): Promise<boolean> => {
  if (!gatewayApi) {
    console.error("Gateway API not initialized");
    return false;
  }

  try {
    const accountState = await gatewayApi.state.getEntityDetailsVaultAggregated(accountAddress);
    
    // Check if user has borrower badge NFT
    const borrowerBadgeAddr = config.borrowerBadgeAddr;
    const hasNFT = accountState.non_fungible_resources.items.some(
      (fr) => fr.resource_address === borrowerBadgeAddr
    );

    // If they don't have the NFT, they don't have an empty position
    if (!hasNFT) {
      return false;
    }

    // Get supply positions
    const getNFTBalance = accountState.non_fungible_resources.items.find(
      (fr) => fr.resource_address === borrowerBadgeAddr
    )?.vaults.items[0];

    if (!getNFTBalance?.items?.[0]) {
      return false;
    }

    const metadata = await gatewayApi.state.getNonFungibleData(
      borrowerBadgeAddr,
      getNFTBalance.items[0]
    ) as NFTData;

    // Check supply field
    const supplyField = metadata.data.programmatic_json.fields.find(
      (field) => field.field_name === "supply"
    );

    // If there's no supply field or no entries, consider it empty
    if (!supplyField || !supplyField.entries || supplyField.entries.length === 0) {
      return true;
    }

    // Check if all supply entries are 0
    return supplyField.entries.every((entry) => 
      math.equal(bn(entry.value.value), 0)
    );
  } catch (error) {
    console.error("Error checking for empty position:", error);
    return false;
  }
};
