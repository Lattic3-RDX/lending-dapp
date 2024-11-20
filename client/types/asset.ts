import { gatewayApi } from "@/lib/radix";
import { FungibleResourcesCollectionAllOfToJSON } from "@radixdlt/babylon-gateway-api-sdk";

export type AssetName = "XRD" | "xwBTC" | "FLOOP" | "xUSDT" | "EARLY" | "HUG" | "DFP2" | "xETH" | "ASTRL" | "CAVIAR";

export interface Asset {
  address: string;
  label: AssetName;
  pool_unit_address: string;
  wallet_balance: number;
  select_native: number;
  APR: number;
  type?: "supply" | "borrow";
  available?: number;
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
    pool_unit_address: "resource_tdx_2_1tkzjn6yxfy29afl4xfjrw76mt4uvkyt6727c93xr7n3k50my8k6ert",
    supply_APR: 5,
    borrow_APR: 10,
  },
  xwBTC: {
    address: "resource_xwbtc",
    label: "xwBTC",
    icon: "https://assets.instabridge.io/tokens/icons/xwBTC.png",
    pool_unit_address: "resource_123",
    supply_APR: 5,
    borrow_APR: 10,
  },
  FLOOP: {
    address: "resource_floop",
    label: "FLOOP",
    icon: "https://assets.caviarnine.com/tokens/floop_babylon.png",
    pool_unit_address: "resource_123",
    supply_APR: 5,
    borrow_APR: 10,
  },
  xUSDT: {
    address: "resource_tdx_2_1t57e50rm28cyqwn26jn336qyhu8nkt8cknacq8rnsn5kul2l3zvjut",
    label: "xUSDT",
    icon: "https://assets.instabridge.io/tokens/icons/xUSDT.png",
    pool_unit_address: "resource_tdx_2_1t4tf5u3fayhnyxcf6f0qzsn6zfejn3zteuu72c08vqyxnqz3xpylmn",
    supply_APR: 5,
    borrow_APR: 10,
  },
  EARLY: {
    address: "resource_early",
    label: "EARLY",
    icon: "https://arweave.net/uXCQ9YVGkEijn7PS2wdkXqwkU_YrdgpNtQPH2Y1-Qcs",
    pool_unit_address: "resource_123",
    supply_APR: 5,
    borrow_APR: 10,
  },
  HUG: {
    address: "resource_tdx_2_1tkuj2rqsa63f8ygkzezgt27trj50srht5e666jaz28j5ss8fasg5kl",
    label: "HUG",
    icon: "https://tokens.defiplaza.net/cdn-cgi/imagedelivery/QTzOBjs3mHq3EhZxDosDSw/f5cdcf72-c7a2-4032-1252-1be08edb0700/token",
    pool_unit_address: "resource_tdx_2_1t4pjqyp6wc94vtlw5fu099p6yf4vj55vgll5yxzhx9wqdgsd299ymn",
    supply_APR: 5,
    borrow_APR: 10,
  },
  DFP2: {
    address: "resource_dfp2",
    label: "DFP2",
    icon: "https://radix.defiplaza.net/assets/img/babylon/defiplaza-icon.png",
    pool_unit_address: "resource_123",
    supply_APR: 5,
    borrow_APR: 10,
  },
  xETH: {
    address: "resource_xeth",
    label: "xETH",
    icon: "https://assets.instabridge.io/tokens/icons/xETH.png",
    pool_unit_address: "resource_123",
    supply_APR: 5,
    borrow_APR: 10,
  },
  ASTRL: {
    address: "resource_astrl",
    label: "ASTRL",
    icon: "https://astrolescent.com/assets/img/tokens/astrl.png",
    pool_unit_address: "resource_123",
    supply_APR: 5,
    borrow_APR: 10,
  },
  CAVIAR: {
    address: "resource_caviar",
    label: "CAVIAR",
    icon: "https://assets.caviarnine.com/tokens/caviar_babylon.png",
    pool_unit_address: "resource_123",
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

// Replace mockWalletBalances with a function to fetch real balances
export const getWalletBalances = async (accountAddress: string): Promise<Record<AssetName, number>> => {
  if (!gatewayApi) {
    console.error("Gateway API not initialized");
    return {} as Record<AssetName, number>;
  }

  try {
    const response = await gatewayApi.state.getEntityDetailsVaultAggregated(accountAddress);
    const balances: Partial<Record<AssetName, number>> = {};

    const fungibleResources = response.fungible_resources.items || [];
    fungibleResources.forEach((resource) => {
      // Find matching asset config by address
      const assetEntry = Object.entries(assetConfigs).find(
        ([_, config]) => config.address === resource.resource_address,
      );

      if (assetEntry) {
        const [assetName] = assetEntry;
        // Convert from string to number and handle decimal places
        balances[assetName as AssetName] = Number(resource.vaults.items[0].amount);
      }
    });

    // Fill in zero balances for assets not found in the response
    Object.keys(assetConfigs).forEach((assetName) => {
      if (!(assetName in balances)) {
        balances[assetName as AssetName] = 0;
      }
    });
    return balances as Record<AssetName, number>;
  } catch (error) {
    console.error("Error fetching wallet balances:", error);
    return {} as Record<AssetName, number>;
  }
};

// Update the getWalletBalance helper to use the new async function
export const getWalletBalance = async (asset: AssetName, accountAddress: string): Promise<number> => {
  const balances = await getWalletBalances(accountAddress);
  return balances[asset] || 0;
};

export const getAssetPrice = async (asset: AssetName): Promise<number> => {
  const res = await fetch("api/assets/prices", { method: "GET" });
  if (res.status !== 200) {
    console.error("Error fetching asset prices:", res.statusText);
    return -1;
  }

  const { prices } = await res.json();

  if (!Array.isArray(prices)) {
    console.error("Unexpected price data format: prices is not an array");
    return -1;
  }

  // Get the resource address for the asset
  const assetAddress = getAssetAddress(asset);
  // Find the price entry where asset matches our resource address
  const priceEntry = prices.find((p) => p.asset === assetAddress);

  if (!priceEntry) {
    console.warn(`No price found for asset ${asset} (${assetAddress})`);
    return 0;
  }

  return Number(priceEntry.price);
};

export const supplyUnitsToAmount = async (asset: Record<AssetName, number>) => {
  const address = getAssetAddress(Object.keys(asset)[0] as AssetName);
  const amount = Object.values(asset)[0];

  console.log("Address: ", address);
  console.log("Amount: ", amount);

  const cluster_states_res: any = await fetch("api/assets/clusters", { method: "GET" });

  if (!cluster_states_res.ok) {
    console.error("Error fetching cluster states:", cluster_states_res.statusText);
    return -1;
  }

  const cluster_states = await cluster_states_res.json();
  const cluster: any = cluster_states[address];

  if (!cluster) {
    console.error(`No cluster state found for asset ${address}`);
    return -1;
  }

  return amount / cluster.supply_ratio;
};

export const borrowUnitsToAmount = async (asset: Record<AssetName, number>) => {
  const address = getAssetAddress(Object.keys(asset)[0] as AssetName);
  const amount = Object.values(asset)[0];

  const cluster_states_res: any = await fetch("api/assets/clusters", { method: "GET" });

  if (!cluster_states_res.ok) {
    console.error("Error fetching cluster states:", cluster_states_res.statusText);
    return -1;
  }

  const cluster_states = await cluster_states_res.json();
  const cluster: any = cluster_states[address];

  if (!cluster) {
    console.error(`No cluster state found for asset ${address}`);
    return -1;
  }

  return amount / cluster.debt_ratio;
};
