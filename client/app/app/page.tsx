"use client";
import { useEffect, useState } from "react";
import { RowSelectionState, Updater } from "@tanstack/react-table";
import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AssetTable } from "@/components/asset-table/asset-table";
import { columns } from "@/components/asset-table/columns";
import SupplyDialog from "@/components/supply-dialog";
import { useRadixContext } from "@/contexts/provider";
import { gatewayApi, rdt } from "@/lib/radix";
import { getAssetAddrRecord, Asset, AssetName, getAssetApy, getWalletBalance, assetConfigs } from "@/types/asset";
import { PortfolioTable } from "@/components/portfolio-table/portfolio-table";
import { portfolioColumns } from "@/components/portfolio-table/portfolio-columns";
import { useToast } from "@/components/ui/use-toast";
import { ShootingStars } from "@/components/ui/shooting-stars";
import { borrowColumns } from "@/components/asset-table/borrow-columns";
import BorrowDialog from "@/components/borrow-dialog";
import config from "@/lib/config.json";
import open_position_rtm from "@/lib/manifests/open_position";
import position_supply_rtm from "@/lib/manifests/position_supply";
import position_borrow_rtm from "@/lib/manifests/position_borrow";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { AssetActionCard } from "@/components/asset-action-card";

interface SuppliedAsset {
  address: string;
  supplied_amount: number;
}

interface NFTMetadata {
  position_type?: string;
  supplied_assets?: string;
}

interface StateNonFungibleDetailsResponseItem {
  metadata?: NFTMetadata;
}

interface NFTData {
  data: {
    programmatic_json: {
      fields: Array<{
        field_name: string;
        entries: Array<{
          key: {
            value: string;  // resource address
          };
          value: {
            value: string;  // amount
          };
        }>;
      }>;
    };
  };
}

export default function App() {
  const { accounts } = useRadixContext();
  const [supplyRowSelection, setSupplyRowSelection] = React.useState<RowSelectionState>({});
  const [borrowRowSelection, setBorrowRowSelection] = React.useState<RowSelectionState>({});
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const { toast } = useToast();
  const [supplyData, setSupplyData] = useState<Asset[]>(
    Object.entries(getAssetAddrRecord()).map(([label, address]) => ({
      address,
      label: label as AssetName,
      wallet_balance: -1,
      available: 100.00,
      select_native: 0,
      apy: getAssetApy(label as AssetName, 'supply'),
      pool_unit_address: '',
    }))
  );
  const [portfolioData, setSupplyPortfolioData] = useState<Asset[]>([]);
  const [totalSupply, setTotalSupply] = useState<number>(0);
  const [totalSupplyApy, setTotalSupplyApy] = useState<number>(0);
  const [showSupplyPreview, setShowSupplyPreview] = useState(false);
  const [showBorrowPreview, setShowBorrowPreview] = useState(false);
  const [isBorrowDialogOpen, setIsBorrowDialogOpen] = useState(false);
  const [borrowPortfolioData, setBorrowPortfolioData] = useState<Asset[]>([]);
  const [totalBorrowDebt, setTotalBorrowDebt] = useState<number>(0);
  const [totalBorrowApy, setTotalBorrowApy] = useState<number>(0);
  const [borrowPowerUsed, setBorrowPowerUsed] = useState<number>(0);
  const [netWorth, setNetWorth] = useState<number>(0);
  const [netApy, setNetApy] = useState<number>(0);
  const [health, setHealth] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  const hasSelectedSupplyAssets = Object.keys(supplyRowSelection).length > 0;
  const hasSelectedBorrowAssets = Object.keys(borrowRowSelection).length > 0;

  useEffect(() => {
    console.log("Account", accounts);
    console.log("RDT", rdt);
    console.log("GatewayApi", gatewayApi);
  }, [accounts]);

  useEffect(() => {
    const fetchPortfolioData = async () => {
      try {
        if (!accounts || !gatewayApi) return;

        const borrowerBadgeAddr = config.borrowerBadgeAddr;
        if (!borrowerBadgeAddr) throw new Error("Borrower badge address not configured");

        const accountState = await gatewayApi.state.getEntityDetailsVaultAggregated(accounts[0].address);
        const getNFTBalance = accountState.non_fungible_resources.items.find(
          (fr: { resource_address: string }) => fr.resource_address === borrowerBadgeAddr
        )?.vaults.items[0];
        
        if (!getNFTBalance) {
          return { assets: [], badgeValue: 0 };
        }

        const metadata = await gatewayApi.state.getNonFungibleData(
          JSON.parse(JSON.stringify(borrowerBadgeAddr)),
          JSON.parse(JSON.stringify(getNFTBalance)).items[0]
        ) as NFTData;

        // Extract supply positions
        const supplyField = metadata.data.programmatic_json.fields.find(
          field => field.field_name === "supply"
        );

        const suppliedAssets = supplyField?.entries.map(entry => ({
          address: entry.key.value,
          supplied_amount: parseFloat(entry.value.value)
        })) || [];

        // Extract borrow positions
        const borrowField = metadata.data.programmatic_json.fields.find(
          field => field.field_name === "borrow"
        );

        const borrowedAssets = borrowField?.entries.map(entry => ({
          address: entry.key.value,
          borrowed_amount: parseFloat(entry.value.value)
        })) || [];

        const supplyPortfolioData = await Promise.all(
          suppliedAssets.map(async (suppliedAsset) => {
            const assetConfig = Object.entries(getAssetAddrRecord()).find(
              ([_, address]) => address === suppliedAsset.address
            );
        
            if (!assetConfig) return null;
            const [label] = assetConfig;
        
            return {
              address: suppliedAsset.address,
              label: label as AssetName,
              wallet_balance: await getWalletBalance(label as AssetName, accounts[0].address),
              select_native: suppliedAsset.supplied_amount,
              apy: getAssetApy(label as AssetName, 'supply'),
              pool_unit_address: assetConfigs[label as AssetName].pool_unit_address,
              type: 'supply' as const
            } as Asset;
          })
        ).then(results => results.filter((asset): asset is Asset => asset !== null));

        const borrowPortfolioData = await Promise.all(
          borrowedAssets.map(async (borrowedAsset) => {
            const assetConfig = Object.entries(getAssetAddrRecord()).find(
              ([_, address]) => address === borrowedAsset.address
            );
        
            if (!assetConfig) return null;
            const [label] = assetConfig;
        
            return {
              address: borrowedAsset.address,
              label: label as AssetName,
              wallet_balance: await getWalletBalance(label as AssetName, accounts[0].address),
              select_native: borrowedAsset.borrowed_amount,
              apy: getAssetApy(label as AssetName, 'borrow'),
              pool_unit_address: assetConfigs[label as AssetName].pool_unit_address || '',
              type: 'borrow' as const
            } satisfies Asset;
          })
        ).then(results => results.filter((asset): asset is Asset & { type: 'borrow' } => 
          asset !== null && asset.type === 'borrow'
        ));

        setSupplyPortfolioData(supplyPortfolioData);
        setBorrowPortfolioData(borrowPortfolioData);
      } catch (error) {
        console.error("Error fetching portfolio data:", error);
      }
    };

    fetchPortfolioData();

    const fetchPortfolioStats = async () => {
      try {
        // Calculate total supply and average supply APY
        const totalSupplyAmount = portfolioData.reduce(
          (sum, asset) => sum + asset.select_native,
          0
        );
        const averageSupplyApy = portfolioData.length > 0
          ? portfolioData.reduce((sum, asset) => sum + asset.apy, 0) / portfolioData.length
          : 0;
        setTotalSupply(totalSupplyAmount);
        setTotalSupplyApy(averageSupplyApy);

        // Calculate total borrow and average borrow APY
        const totalBorrowAmount = borrowPortfolioData.reduce(
          (sum, asset) => sum + asset.select_native,
          0
        );
        const averageBorrowApy = borrowPortfolioData.length > 0
          ? borrowPortfolioData.reduce((sum, asset) => sum + asset.apy, 0) / borrowPortfolioData.length
          : 0;
        setTotalBorrowDebt(totalBorrowAmount);
        setTotalBorrowApy(averageBorrowApy);

        // Keep existing borrow power calculation
        setBorrowPowerUsed(51.4);
      } catch (error) {
        console.error("Error calculating portfolio stats:", error);
        toast({
          variant: "destructive", 
          title: "Error",
          description: "Failed to calculate portfolio statistics",
        });
      }
    };

    fetchPortfolioStats();

    const fetchOverallStats = async () => {
      try {
        // TODO: Fetch actual stats from backend
        const dummyOverallStats = {
          netWorth: 2500.75,
          netApy: 8.5,
          health: 85.2
        };

        setNetWorth(dummyOverallStats.netWorth);
        setNetApy(dummyOverallStats.netApy);
        setHealth(dummyOverallStats.health);
      } catch (error) {
        console.error("Error fetching overall stats:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to fetch overall statistics",
        });
      }
    };

    fetchOverallStats();
  }, [accounts]);

  useEffect(() => {
    const updateWalletBalances = async () => {
      if (!accounts) return;
      const updatedData = await Promise.all(
        supplyData.map(async (asset) => ({
          ...asset,
          wallet_balance: await getWalletBalance(asset.label as AssetName, accounts[0].address),
        }))
      );
      setSupplyData(updatedData);
      setIsLoading(false);
    };
    
    updateWalletBalances();
  }, [accounts]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const getSelectedSupplyAssets = () => {
    return Object.keys(supplyRowSelection).map(index => supplyData[Number(index)]);
  };

  const getSelectedBorrowAssets = () => {
    return Object.keys(borrowRowSelection).map(index => supplyData[Number(index)]);
  };

  const handleSupplyConfirm = async () => {
    try {
      if (!accounts || !gatewayApi) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Wallet not connected",
        });
        return;
      }

      const selectedAssets = getSelectedSupplyAssets();
      const assetsToSupply = selectedAssets.map(asset => ({
        address: asset.address,
        amount: asset.select_native
      }));

      // Check if user has an existing position
      const accountState = await gatewayApi.state.getEntityDetailsVaultAggregated(accounts[0].address);
      console.log("Account State:", accountState);
      const getNFTBalance = accountState.non_fungible_resources.items.find(
        (fr: { resource_address: string }) => fr.resource_address === config.borrowerBadgeAddr
      )?.vaults.items[0];
      console.log("NFT Balance:", getNFTBalance);

      let manifest;
      if (!getNFTBalance?.items?.[0]) {
        // No existing position - create new one
        manifest = open_position_rtm({
          component: config.marketComponent,
          account: accounts[0].address,
          assets: assetsToSupply
        });
      } else {
        // Existing position - add to it
        manifest = position_supply_rtm({
          component: config.marketComponent,
          account: accounts[0].address,
          position_badge_address: config.borrowerBadgeAddr,
          position_badge_local_id: getNFTBalance.items[0],
          assets: assetsToSupply
        });
      }

      console.log("Supply manifest:", manifest);
      
      const result = await rdt?.walletApi.sendTransaction({
        transactionManifest: manifest,
        version: 1,
      });
      console.log("Transaction result:", result);

      if (result) {
        toast({
          title: "Supply Successful",
          description: `Supplied ${assetsToSupply.length} assets`,
        });
        await refreshPortfolioData();
      }
    } catch (error) {
      console.error("Supply error:", error);
      toast({
        variant: "destructive",
        title: "Supply Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setSupplyRowSelection({});
      setIsPreviewDialogOpen(false);
    }
  };

  const handleBorrowConfirm = async () => {
    try {
      if (!accounts || !gatewayApi) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Wallet not connected",
        });
        return;
      }

      const selectedAssets = getSelectedBorrowAssets();
      const assetsToBorrow = selectedAssets.map(asset => ({
        address: asset.address,
        amount: asset.select_native
      }));

      // Get NFT ID from account state
      const accountState = await gatewayApi.state.getEntityDetailsVaultAggregated(accounts[0].address);
      const getNFTBalance = accountState.non_fungible_resources.items.find(
        (fr: { resource_address: string }) => fr.resource_address === config.borrowerBadgeAddr
      )?.vaults.items[0];

      if (!getNFTBalance?.items?.[0]) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "No position NFT found. Please supply assets first.",
        });
        return;
      }

      const manifest = position_borrow_rtm({
        component: config.marketComponent,
        account: accounts[0].address,
        position_badge_address: config.borrowerBadgeAddr,
        position_badge_local_id: getNFTBalance.items[0],
        assets: assetsToBorrow
      });

      console.log("Borrow manifest:", manifest);

      const result = await rdt?.walletApi.sendTransaction({
        transactionManifest: manifest,
        version: 1,
      });

      if (result) {
        toast({
          title: "Borrow Successful",
          description: `Borrowed ${assetsToBorrow.length} assets`,
        });
      }
    } catch (error) {
      console.error("Borrow error:", error);
      toast({
        variant: "destructive",
        title: "Borrow Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setBorrowRowSelection({});
      setIsBorrowDialogOpen(false);
    }
  };

  const validateSelectedSupplyAssets = () => {
    const selectedAssets = Object.keys(supplyRowSelection).filter(
      (key) => supplyRowSelection[key]
    );

    const hasInvalidAmount = selectedAssets.some((key) => {
      const asset = supplyData[parseInt(key)];
      return !asset || asset.select_native <= 0;
    });

    return !hasInvalidAmount;
  };

  const validateSelectedBorrowAssets = () => {
    const selectedAssets = Object.keys(borrowRowSelection).filter(
      (key) => borrowRowSelection[key]
    );

    const hasInvalidAmount = selectedAssets.some((key) => {
      const asset = supplyData[parseInt(key)];
      return !asset || asset.select_native <= 0;
    });

    return !hasInvalidAmount;
  };

  const handlePreviewSupply = () => {
    if (!validateSelectedSupplyAssets()) {
      toast({
        variant: "destructive",
        title: "Invalid Selection",
        description: "Please ensure all selected assets have an amount greater than 0",
      });
      return;
    }
    setIsPreviewDialogOpen(true);
  };

  const handleAmountChange = (address: string, amount: number, type: 'supply' | 'borrow') => {
    setSupplyData(current =>
      current.map(row =>
        row.address === address
          ? { ...row, select_native: amount }
          : row
      )
    );
    
    // Show preview button when amount is set
    if (amount > 0) {
      if (type === 'supply') {
        setShowSupplyPreview(true);
      } else {
        setShowBorrowPreview(true);
      }
    }
  };

  const handleSupplyRowSelectionChange = (updaterOrValue: RowSelectionState | ((old: RowSelectionState) => RowSelectionState)) => {
    setSupplyRowSelection(updaterOrValue);
  };

  const handlePreviewBorrow = () => {
    if (!validateSelectedBorrowAssets()) {
      toast({
        variant: "destructive",
        title: "Invalid Selection",
        description: "Please ensure all selected assets have an amount greater than 0",
      });
      return;
    }
    setIsBorrowDialogOpen(true);
  };

  const calculateAverageApy = (assets: Asset[]) => {
    if (assets.length === 0) return 0;
    const totalApy = assets.reduce((sum, asset) => sum + asset.apy, 0);
    return totalApy / assets.length;
  };

  const refreshPortfolioData = async () => {
    try {
      setIsLoading(true);
      if (!accounts || !gatewayApi) return;

      const borrowerBadgeAddr = config.borrowerBadgeAddr;
      if (!borrowerBadgeAddr) throw new Error("Borrower badge address not configured");

      const accountState = await gatewayApi.state.getEntityDetailsVaultAggregated(accounts[0].address);
      const getNFTBalance = accountState.non_fungible_resources.items.find(
        (fr: { resource_address: string }) => fr.resource_address === borrowerBadgeAddr
      )?.vaults.items[0];
      
      if (!getNFTBalance) {
        setSupplyPortfolioData([]);
        setBorrowPortfolioData([]);
        return;
      }

      const metadata = await gatewayApi.state.getNonFungibleData(
        JSON.parse(JSON.stringify(borrowerBadgeAddr)),
        JSON.parse(JSON.stringify(getNFTBalance)).items[0]
      ) as NFTData;

      // Extract supply positions
      const supplyField = metadata.data.programmatic_json.fields.find(
        field => field.field_name === "supply"
      );

      const suppliedAssets = supplyField?.entries.map(entry => ({
        address: entry.key.value,
        supplied_amount: parseFloat(entry.value.value)
      })) || [];

      // Extract borrow positions
      const borrowField = metadata.data.programmatic_json.fields.find(
        field => field.field_name === "borrow"
      );

      const borrowedAssets = borrowField?.entries.map(entry => ({
        address: entry.key.value,
        borrowed_amount: parseFloat(entry.value.value)
      })) || [];

      // Convert to portfolio data for supply
      const supplyPortfolioData = await Promise.all(
        suppliedAssets.map(async (suppliedAsset) => {
          const assetConfig = Object.entries(getAssetAddrRecord()).find(
            ([_, address]) => address === suppliedAsset.address
          );

          if (!assetConfig) return null;
          const [label] = assetConfig;

          return {
            address: suppliedAsset.address,
            label: label as AssetName,
            wallet_balance: await getWalletBalance(label as AssetName, accounts[0].address),
            select_native: suppliedAsset.supplied_amount,
            apy: getAssetApy(label as AssetName),
            pool_unit_address: assetConfigs[label as AssetName].pool_unit_address,
            type: 'supply'
          } as Asset;
        })
      ).then(results => results.filter((asset): asset is Asset => asset !== null));

      // Convert to portfolio data for borrow
      const borrowPortfolioData: Asset[] = await Promise.all(
        borrowedAssets.map(async (borrowedAsset) => {
          const assetConfig = Object.entries(getAssetAddrRecord()).find(
            ([_, address]) => address === borrowedAsset.address
          );

          if (!assetConfig) return null;
          const [label] = assetConfig;

          return {
            address: borrowedAsset.address,
            label: label as AssetName,
            wallet_balance: await getWalletBalance(label as AssetName, accounts[0].address),
            select_native: borrowedAsset.borrowed_amount,
            apy: getAssetApy(label as AssetName),
            pool_unit_address: assetConfigs[label as AssetName].pool_unit_address,
            type: 'borrow'
          };
        })
      ).then(results => results.filter((asset): asset is Asset & { type: 'borrow' } => 
        asset !== null && asset.type === 'borrow'
      ));

      const totalSupplyApy = calculateAverageApy(supplyPortfolioData);
      const totalBorrowApy = calculateAverageApy(borrowPortfolioData);

      setSupplyPortfolioData(supplyPortfolioData);
      setBorrowPortfolioData(borrowPortfolioData);
      setTotalSupplyApy(totalSupplyApy);
      setTotalBorrowApy(totalBorrowApy);
    } catch (error) {
      console.error("Error refreshing portfolio data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-4">
      {/* First row: Supply and Borrow cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Your Supply Card */}
        <Card>
          <CardHeader>
            <div className="grid grid-cols-2">
              <CardTitle>Your Supply</CardTitle>
              <div className="flex justify-end">
                <div className="grid grid-cols-[auto,1fr] gap-x-6 items-center min-h-[72px]">
                  <CardDescription className="text-left text-foreground">Total Supply:</CardDescription>
                  <CardDescription className="text-right text-foreground">${totalSupply.toFixed(2)}</CardDescription>
                  <CardDescription className="text-left text-foreground">Total APY:</CardDescription>
                  <CardDescription className="text-right text-foreground">{totalSupplyApy.toFixed(1)}%</CardDescription>
                  <div className="col-span-2"></div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <PortfolioTable
              columns={portfolioColumns}
              data={portfolioData}
              onRefresh={refreshPortfolioData}
            />
          </CardContent>
        </Card>

        {/* Your Borrows Card */}
        <Card>
          <CardHeader>
            <div className="grid grid-cols-2">
              <CardTitle>Your Borrows</CardTitle>
              <div className="flex justify-end">
                <div className="grid grid-cols-[auto,1fr] gap-x-6 items-center min-h-[72px]">
                  <CardDescription className="text-left text-foreground">Total Debt:</CardDescription>
                  <CardDescription className="text-right text-foreground">${totalBorrowDebt.toFixed(2)}</CardDescription>
                  <CardDescription className="text-left text-foreground">Total APY:</CardDescription>
                  <CardDescription className="text-right text-foreground">{totalBorrowApy.toFixed(1)}%</CardDescription>
                  <CardDescription className="text-left text-foreground">Borrow Power Used:</CardDescription>
                  <CardDescription className="text-right text-foreground">{borrowPowerUsed.toFixed(1)}%</CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <PortfolioTable
              columns={portfolioColumns}
              data={borrowPortfolioData}
              onRefresh={refreshPortfolioData}
            />
          </CardContent>
        </Card>
      </div>

      {/* Asset Action Card - Full Width */}
      <AssetActionCard
        supplyData={supplyData}
        supplyRowSelection={supplyRowSelection}
        borrowRowSelection={borrowRowSelection}
        onSupplyRowSelectionChange={handleSupplyRowSelectionChange}
        onBorrowRowSelectionChange={setBorrowRowSelection}
        onAmountChange={handleAmountChange}
        showSupplyPreview={showSupplyPreview}
        showBorrowPreview={showBorrowPreview}
        hasSelectedSupplyAssets={hasSelectedSupplyAssets}
        hasSelectedBorrowAssets={hasSelectedBorrowAssets}
        onPreviewSupply={handlePreviewSupply}
        onPreviewBorrow={handlePreviewBorrow}
      />

      {/* Add these dialogs here, right before the closing div */}
      <SupplyDialog
        isOpen={isPreviewDialogOpen}
        onClose={() => setIsPreviewDialogOpen(false)}
        onConfirm={handleSupplyConfirm}
        selectedAssets={getSelectedSupplyAssets().filter(asset => asset.select_native > 0)}
      />

      <BorrowDialog
        isOpen={isBorrowDialogOpen}
        onClose={() => setIsBorrowDialogOpen(false)}
        onConfirm={handleBorrowConfirm}
        selectedAssets={getSelectedBorrowAssets().filter(asset => asset.select_native > 0)}
      />
    </div>
  );
}