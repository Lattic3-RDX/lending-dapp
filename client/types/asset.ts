import { gatewayApi } from '@/lib/radix';
import { FungibleResourcesCollectionAllOfToJSON } from '@radixdlt/babylon-gateway-api-sdk';

export type AssetName = 'XRD' | 'xwBTC' | 'FLOOP' | 'xUSDC' | 'EARLY' | 'HUG' | 'DFP2' | 'xETH' | 'ASTRL' | 'CAVIAR';

export interface Asset {
  address: string;
  label: AssetName;
  pool_unit_address: string;
  wallet_balance: number;
  select_native: number;
  apy: number;
  type?: 'supply' | 'borrow';
  available?: number;
}

export interface AssetConfig {
  address: string;
  label: AssetName;
  icon: string;
  apy: number;
  pool_unit_address?: string;
}

export const assetConfigs: Record<AssetName, AssetConfig> = {
  XRD: {
    address: "resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc",
    label: "XRD",
    icon: "https://assets.radixdlt.com/icons/icon-xrd-32x32.png",
    apy: 10.3,
    pool_unit_address: "resource_tdx_2_1tkvdgqm60teajxd44ma6k0xyt6xvxxcyzrmc25q406fx08eaek36e4",
  },
  xwBTC: {
    address: "resource_xwbtc",
    label: "xwBTC",
    icon: "https://assets.instabridge.io/tokens/icons/xwBTC.png",
    apy: 5.5,
    pool_unit_address: "resource_123",
  },
  FLOOP: {
    address: "resource_floop",
    label: "FLOOP",
    icon: "https://assets.caviarnine.com/tokens/floop_babylon.png",
    apy: 5.2,
    pool_unit_address: "resource_123",
  },
  xUSDC: {
    address: "resource_xusdc",
    label: "xUSDC",
    icon: "https://assets.instabridge.io/tokens/icons/xUSDC.png",
    apy: 4.8,
    pool_unit_address: "resource_123",
  },
  EARLY: {
    address: "resource_early",
    label: "EARLY",
    icon: "https://arweave.net/uXCQ9YVGkEijn7PS2wdkXqwkU_YrdgpNtQPH2Y1-Qcs",
    apy: 23.1,
    pool_unit_address: "resource_123",
  },
  HUG: {
    address: "resource_hug",
    label: "HUG",
    icon: "https://tokens.defiplaza.net/cdn-cgi/imagedelivery/QTzOBjs3mHq3EhZxDosDSw/f5cdcf72-c7a2-4032-1252-1be08edb0700/token",
    apy: 23.1,
    pool_unit_address: "resource_123",
  },
  DFP2: {
    address: "resource_dfp2",
    label: "DFP2",
    icon: "https://radix.defiplaza.net/assets/img/babylon/defiplaza-icon.png",
    apy: 23.1,
    pool_unit_address: "resource_123",
  },
  xETH: {
    address: "resource_xeth",
    label: "xETH",
    icon: "https://assets.instabridge.io/tokens/icons/xETH.png",
    apy: 23.1,
    pool_unit_address: "resource_123",
  },
  ASTRL: {
    address: "resource_astrl",
    label: "ASTRL",
    icon: "https://astrolescent.com/assets/img/tokens/astrl.png",
    apy: 23.1,
    pool_unit_address: "resource_123",
  },
  CAVIAR: {
    address: "resource_caviar",
    label: "CAVIAR",
    icon: "https://assets.caviarnine.com/tokens/caviar_babylon.png",
    apy: 23.1,
    pool_unit_address: "resource_123",
  },
};

// Helper functions
export const getAssetConfig = (label: AssetName): AssetConfig | undefined => assetConfigs[label];
export const getAssetIcon = (label: AssetName): string => 
  assetConfigs[label]?.icon || 'https://assets.radixdlt.com/icons/icon-default-32x32.png';
export const getAssetAddress = (label: AssetName): string => assetConfigs[label]?.address || '';
export const getAssetApy = (label: AssetName): number => assetConfigs[label]?.apy || 0;

// Remove the separate assetAddrRecord and instead create a helper function
export const getAssetAddrRecord = (): Record<AssetName, string> => {
  return Object.entries(assetConfigs).reduce((acc, [label, config]) => ({
    ...acc,
    [label]: config.address
  }), {} as Record<AssetName, string>);
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
    fungibleResources.forEach(resource => {
      // Find matching asset config by address
      const assetEntry = Object.entries(assetConfigs).find(
        ([_, config]) => config.address === resource.resource_address
      );

      if (assetEntry) {
        const [assetName] = assetEntry;
        // Convert from string to number and handle decimal places
        balances[assetName as AssetName] = Number(resource.vaults.items[0].amount);
      }
    });

    // Fill in zero balances for assets not found in the response
    Object.keys(assetConfigs).forEach(assetName => {
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