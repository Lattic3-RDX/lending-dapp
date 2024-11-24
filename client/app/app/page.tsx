"use client";

import { AssetActionCard } from "@/components/asset-action-card";
import { AssetTable } from "@/components/asset-table/asset-table";
import { borrowColumns } from "@/components/asset-table/borrow-columns";
import { columns } from "@/components/asset-table/columns";
import BorrowDialog from "@/components/asset-table/borrow-dialog";
import { createPortfolioColumns } from "@/components/portfolio-table/portfolio-columns";
import { PortfolioTable } from "@/components/portfolio-table/portfolio-table";
import { StatisticsCard } from "@/components/statistics-card";
import SupplyDialog from "@/components/asset-table/supply-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { BackgroundEffects } from "@/components/background-effects";
import { useToast } from "@/components/ui/use-toast";
import { useRadixContext } from "@/contexts/provider";
import config from "@/lib/config.json";
import open_position_rtm from "@/lib/manifests/open_position";
import position_borrow_rtm from "@/lib/manifests/position_borrow";
import position_supply_rtm from "@/lib/manifests/position_supply";
import { bn, m_bn, math, num, round_dec } from "@/lib/math";
import { gatewayApi, rdt } from "@/lib/radix";
import {
  Asset,
  assetConfigs,
  AssetName,
  borrowUnitsToAmount,
  getAssetAddrRecord,
  getAssetAPR,
  getAssetPrice,
  getWalletBalance,
  supplyUnitsToAmount,
  hasEmptyPosition,
} from "@/types/asset";
import { RowSelectionState, Updater } from "@tanstack/react-table";
import { BigNumber } from "mathjs";
import React, { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AlertCircle } from "lucide-react";

interface NFTData {
  data: {
    programmatic_json: {
      fields: Array<{
        field_name: string;
        entries: Array<{
          key: {
            value: string; // resource address
          };
          value: {
            value: string; // amount
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
      wallet_balance: bn(-1),
      available: bn(0),
      select_native: bn(0),
      APR: getAssetAPR(label as AssetName, "supply"),
      pool_unit_address: "",
    })),
  );
  const [portfolioData, setSupplyPortfolioData] = useState<Asset[]>([]);
  const [totalSupply, setTotalSupply] = useState<BigNumber>(bn(0));
  const [totalSupplyAPR, setTotalSupplyAPR] = useState<number>(0);
  const [showSupplyPreview, setShowSupplyPreview] = useState(false);
  const [showBorrowPreview, setShowBorrowPreview] = useState(false);
  const [isBorrowDialogOpen, setIsBorrowDialogOpen] = useState(false);
  const [borrowPortfolioData, setBorrowPortfolioData] = useState<Asset[]>([]);
  const [totalBorrowDebt, setTotalBorrowDebt] = useState<BigNumber>(bn(0));
  const [totalBorrowAPR, setTotalBorrowAPR] = useState<number>(0);
  const [borrowPowerUsed, setBorrowPowerUsed] = useState<number>(0);
  const [netWorth, setNetWorth] = useState<number>(0);
  const [netAPR, setNetAPR] = useState<number>(0);
  const [health, setHealth] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasEmptyPositionState, setHasEmptyPositionState] = useState<boolean>(false);

  const hasSelectedSupplyAssets = Object.keys(supplyRowSelection).length > 0;
  const hasSelectedBorrowAssets = Object.keys(borrowRowSelection).length > 0;

  const calculateTotalAPR = async (assets: Asset[], type: "supply" | "borrow") => {
    if (assets.length === 0) return 0;

    let totalValue = 0;
    let weightedAPR = 0;

    await Promise.all(
      assets.map(async (asset) => {
        const price = num(await getAssetPrice(asset.label as AssetName));
        const value = num(asset.select_native) * price;
        totalValue += value;
        weightedAPR += value * getAssetAPR(asset.label, type);
      }),
    );

    return totalValue > 0 ? weightedAPR / totalValue : 0;
  };

  const calculateBorrowPower = (totalSupplyValue: number, totalDebtValue: number): number => {
    // If no debt, borrow power used is 0%
    if (totalDebtValue <= 0) return 0;

    // Calculate maximum borrowable amount (when health = 1.5)
    // At health = 1.5: totalSupplyValue / maxDebt = 1.5
    // Therefore: maxDebt = totalSupplyValue / 1.5
    const maxBorrowableDebt = totalSupplyValue / 1.5;

    // Calculate percentage of max borrowing power used
    const borrowPowerUsed = (totalDebtValue / maxBorrowableDebt) * 100;

    return borrowPowerUsed;
  };

  const refreshPortfolioData = async () => {
    try {
      setIsLoading(true);
      if (!accounts || !gatewayApi) {
        console.log("No accounts or gatewayApi found");
        return;
      }

      const borrowerBadgeAddr = config.borrowerBadgeAddr;
      if (!borrowerBadgeAddr) {
        console.log("No borrowerBadgeAddr found");
        throw new Error("Borrower badge address not configured");
      }

      const accountState = await gatewayApi.state.getEntityDetailsVaultAggregated(accounts[0].address);

      const getNFTBalance = accountState.non_fungible_resources.items.find(
        (fr: { resource_address: string }) => fr.resource_address === borrowerBadgeAddr,
      )?.vaults.items[0];

      if (!getNFTBalance) {
        console.log("No NFT balance found, resetting state");
        setSupplyPortfolioData([]);
        setBorrowPortfolioData([]);
        setHealth(0);
        return;
      }

      const metadata = (await gatewayApi.state.getNonFungibleData(
        JSON.parse(JSON.stringify(borrowerBadgeAddr)),
        JSON.parse(JSON.stringify(getNFTBalance)).items[0],
      )) as NFTData;
      console.log("NFT metadata:", metadata);

      // Extract supply positions
      const supplyField = metadata.data.programmatic_json.fields.find((field) => field.field_name === "supply");

      const suppliedAssets =
        supplyField?.entries.map((entry) => ({
          address: entry.key.value,
          supplied_amount: bn(entry.value.value),
        })) || [];

      // Extract borrow positions
      const borrowField = metadata.data.programmatic_json.fields.find((field) => field.field_name === "debt");

      const borrowedAssets =
        borrowField?.entries.map((entry) => ({
          address: entry.key.value,
          borrowed_amount: bn(entry.value.value),
        })) || [];

      let totalSupplyValue = bn(0);
      let totalDebtValue = bn(0);

      // Convert to portfolio data for supply
      const supplyPortfolioData = await Promise.all(
        suppliedAssets.map(async (suppliedAsset) => {
          const assetConfig = Object.entries(getAssetAddrRecord()).find(
            ([_, address]) => address === suppliedAsset.address,
          );

          if (!assetConfig) return null;
          const [label] = assetConfig;
          const assetName = label as AssetName;

          console.log("Supplied amount: ", suppliedAsset.supplied_amount.toString());

          // Create a properly typed record with a single asset
          const unitRecord: Record<AssetName, BigNumber> = {
            [assetName]: suppliedAsset.supplied_amount,
          } as Record<AssetName, BigNumber>;

          const supplyUnits = await supplyUnitsToAmount(unitRecord);
          console.log("Amount units: ", supplyUnits.toString());
          const price = await getAssetPrice(assetName);
          totalSupplyValue = m_bn(math.add(totalSupplyValue, m_bn(math.multiply(supplyUnits, price))));

          console.log(
            "Get wallet balance: ",
            (await getWalletBalance(label as AssetName, accounts[0].address)).toString(),
          );
          return {
            address: suppliedAsset.address,
            label: label as AssetName,
            wallet_balance: await getWalletBalance(label as AssetName, accounts[0].address),
            select_native: supplyUnits,
            APR: getAssetAPR(label as AssetName),
            pool_unit_address: assetConfigs[label as AssetName].pool_unit_address,
            type: "supply",
          } as Asset;
        }),
      ).then((results) => results.filter((asset): asset is Asset => asset !== null));

      // Convert to portfolio data for borrow
      const borrowPortfolioData: Asset[] = await Promise.all(
        borrowedAssets.map(async (borrowedAsset) => {
          const assetConfig = Object.entries(getAssetAddrRecord()).find(
            ([_, address]) => address === borrowedAsset.address,
          );

          if (!assetConfig) return null;
          const [label] = assetConfig;

          const assetName = label as AssetName;
          const unitRecord: Record<AssetName, BigNumber> = {
            [assetName]: borrowedAsset.borrowed_amount,
          } as Record<AssetName, BigNumber>;

          const amount = await borrowUnitsToAmount(unitRecord);
          const price = await getAssetPrice(assetName);
          totalDebtValue = m_bn(math.add(totalDebtValue, math.multiply(amount, price)));

          return {
            address: borrowedAsset.address,
            label: label as AssetName,
            wallet_balance: await getWalletBalance(label as AssetName, accounts[0].address),
            select_native: amount,
            APR: getAssetAPR(label as AssetName),
            pool_unit_address: assetConfigs[label as AssetName].pool_unit_address,
            type: "borrow",
          };
        }),
      ).then((results) =>
        results.filter((asset): asset is Asset & { type: "borrow" } => asset !== null && asset.type === "borrow"),
      );

      // Calculate health ratio
      const healthRatio: number = math.larger(totalSupplyValue, 0)
        ? num(math.divide(totalSupplyValue, totalDebtValue).toString())
        : -1;
      console.log("Health Ratio: ", healthRatio.toString());
      const netWorthValue: number = num(totalSupplyValue) - num(totalDebtValue);
      console.log("Net Worth: ", netWorthValue.toString());

      // Calculate total APRs from the portfolio data
      const calculatedSupplyAPR: number = await calculateTotalAPR(supplyPortfolioData, "supply");
      const calculatedBorrowAPR: number = await calculateTotalAPR(borrowPortfolioData, "borrow");
      const netAPRValue: number =
        math.larger(totalSupplyValue, 0) || math.larger(totalDebtValue, 0)
          ? (calculatedSupplyAPR * num(totalSupplyValue) - calculatedBorrowAPR * num(totalDebtValue)) /
            (num(totalSupplyValue) > 0 ? num(totalSupplyValue) : num(totalDebtValue))
          : 0;

      console.log("Supply APR: ", calculatedSupplyAPR);
      console.log("Borrow APR: ", calculatedBorrowAPR);
      console.log("Net APR: ", netAPRValue);

      setHealth(healthRatio);
      setNetWorth(netWorthValue);
      setNetAPR(netAPRValue);
      setTotalSupply(totalSupplyValue);
      setTotalBorrowDebt(totalDebtValue);

      // Use the calculated values instead of the state values
      setTotalSupplyAPR(calculatedSupplyAPR);
      setTotalBorrowAPR(calculatedBorrowAPR);

      setSupplyPortfolioData(supplyPortfolioData);
      setBorrowPortfolioData(borrowPortfolioData);

      const borrowPowerPercentage = calculateBorrowPower(num(totalSupplyValue), num(totalDebtValue));
      setBorrowPowerUsed(borrowPowerPercentage);
    } catch (error) {
      console.error("Error refreshing portfolio data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    console.log("Account", accounts);

    if (accounts && gatewayApi) {
      refreshPortfolioData();
    }
  }, [accounts, gatewayApi]);

  useEffect(() => {
    const updateWalletBalances = async () => {
      if (!accounts) return;
      const updatedData = await Promise.all(
        supplyData.map(async (asset) => ({
          ...asset,
          wallet_balance: await getWalletBalance(asset.label as AssetName, accounts[0].address),
        })),
      );
      setSupplyData(updatedData);
    };

    updateWalletBalances();
  }, [accounts]);

  useEffect(() => {
    const checkEmptyPosition = async () => {
      if (accounts && accounts[0]) {
        const isEmpty = await hasEmptyPosition(accounts[0].address);
        setHasEmptyPositionState(isEmpty);
      }
    };

    checkEmptyPosition();
  }, [accounts, totalSupply]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  //! Temporarily fixed to treat index as a resource address; should be an int
  const getSelectedSupplyAssets = () => {
    return Object.entries(supplyRowSelection)
      .filter(([_, selected]) => selected)
      .map(([index]) => {
        const n = parseInt(index);
        if (isNaN(n)) {
          console.log(supplyData.filter((asset) => asset.address === index)[0]);
          return supplyData.filter((asset) => asset.address === index)[0];
        } else {
          return supplyData[n];
        }
      });
  };

  //! Temporarily fixed to treat index as a resource address; should be an int
  const getSelectedBorrowAssets = () => {
    return Object.keys(borrowRowSelection).map((index) => {
      const n = parseInt(index);
      if (isNaN(n)) {
        console.log(supplyData.filter((asset) => asset.address === index)[0]);
        return supplyData.filter((asset) => asset.address === index)[0];
      } else {
        return supplyData[n];
      }
    });
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
      const assetsToSupply = selectedAssets.map((asset) => ({
        address: asset.address,
        amount: round_dec(asset.select_native).toString(),
      }));

      // Check if user has an existing position
      const accountState = await gatewayApi.state.getEntityDetailsVaultAggregated(accounts[0].address);
      console.log("Account State:", accountState);
      const getNFTBalance = accountState.non_fungible_resources.items.find(
        (fr: { resource_address: string }) => fr.resource_address === config.borrowerBadgeAddr,
      )?.vaults.items[0];
      console.log("NFT Balance:", getNFTBalance);

      let manifest;
      if (!getNFTBalance?.items?.[0]) {
        // No existing position - create new one
        manifest = open_position_rtm({
          component: config.marketComponent,
          account: accounts[0].address,
          assets: assetsToSupply,
        });
      } else {
        // Existing position - add to it
        manifest = position_supply_rtm({
          component: config.marketComponent,
          account: accounts[0].address,
          position_badge_address: config.borrowerBadgeAddr,
          position_badge_local_id: getNFTBalance.items[0],
          assets: assetsToSupply,
        });
      }

      console.log("Supply manifest:", manifest);

      const result = await rdt?.walletApi.sendTransaction({
        transactionManifest: manifest,
        version: 1,
      });
      console.log("Transaction result:", result);

      if (result?.isOk()) {
        toast({
          title: "Supply Successful",
          description: `Supplied ${assetsToSupply.length} assets`,
        });
        await refreshPortfolioData();
      } else if (result) {
        const errorResult = result as { error: { error: string } };
        let message = errorResult.error.error || "Transaction failed";
        if (errorResult.error.error.includes("rejectedByUser")) {
          message = "Transaction rejected by user";
        }
        toast({
          variant: "destructive",
          title: "Supply Failed",
          description: message,
        });
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
      const assetsToBorrow = selectedAssets.map((asset) => ({
        address: asset.address,
        amount: round_dec(asset.select_native).toString(),
      }));

      // Get NFT ID from account state
      const accountState = await gatewayApi.state.getEntityDetailsVaultAggregated(accounts[0].address);
      const getNFTBalance = accountState.non_fungible_resources.items.find(
        (fr: { resource_address: string }) => fr.resource_address === config.borrowerBadgeAddr,
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
        assets: assetsToBorrow,
      });

      console.log("Borrow manifest:", manifest);

      const result = await rdt?.walletApi.sendTransaction({
        transactionManifest: manifest,
        version: 1,
      });

      if (result?.isOk()) {
        toast({
          title: "Borrow Successful",
          description: `Borrowed ${assetsToBorrow.length} assets`,
        });
        await refreshPortfolioData();
      } else if (result) {
        const errorResult = result as { error: { error: string } };
        let message = errorResult.error.error || "Transaction failed";
        if (errorResult.error.error.includes("rejectedByUser")) {
          message = "Transaction rejected by user";
        }
        toast({
          variant: "destructive",
          title: "Borrow Failed",
          description: message,
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
    //! Temporarily changed to treat key as resource address instead of int
    // const selectedAssets = Object.keys(supplyRowSelection).filter((key) => supplyRowSelection[key]);
    const selectedAssets = getSelectedSupplyAssets();

    const hasInvalidAmount = selectedAssets.some((key) => {
      // const asset = supplyData[parseInt(key)];
      const asset = key;
      return !asset || math.smallerEq(asset.select_native, 0);
    });

    return !hasInvalidAmount;
  };

  const validateSelectedBorrowAssets = () => {
    //! Temporarily changed to treat key as resource address instead of int
    // const selectedAssets = Object.keys(borrowRowSelection).filter((key) => borrowRowSelection[key]);
    const selectedAssets = getSelectedBorrowAssets();

    const hasInvalidAmount = selectedAssets.some((key) => {
      // const asset = supplyData[parseInt(key)];
      const asset = key;
      return !asset || math.smallerEq(asset.select_native, 0);
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

  const handleAmountChange = (address: string, amount: BigNumber, type: "supply" | "borrow") => {
    setSupplyData((current) =>
      current.map((row) => (row.address === address ? { ...row, select_native: amount } : row)),
    );

    // Show preview button when amount is set
    if (math.largerEq(amount, 0)) {
      if (type === "supply") {
        setShowSupplyPreview(true);
      } else {
        setShowBorrowPreview(true);
      }
    }
  };

  const handleSupplyRowSelectionChange = (
    updaterOrValue: RowSelectionState | ((old: RowSelectionState) => RowSelectionState),
  ) => {
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

  const closePosition = async () => {
    // TODO: Implement close position logic
    console.log("Close position clicked");
  };

  const columns = createPortfolioColumns(refreshPortfolioData, totalSupply, totalBorrowDebt);

  return (
    <div className="relative min-h-screen">
      <BackgroundEffects />
      <main className="flex min-h-screen flex-col p-8">
        <div className="container mx-auto space-y-4">
          {/* Title */}
          <div className="flex flex-col space-y-1.5 mb-6">
            <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">Lattic3 Market</h1>
          </div>

          {/* Statistics Card */}
          <StatisticsCard healthRatio={health} netWorth={netWorth} netAPR={netAPR} isLoading={isLoading} />

          {/* Empty Position Warning */}
          {hasEmptyPositionState && (
            <Card className="bg-red-500/5 border-red-500/20">
              <CardContent className="flex items-center justify-between p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-red-500/10">
                    <AlertCircle className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-red-500">Empty Position</h3>
                    <p className="text-foreground">
                      You have no assets supplied or borrowed. You can close your position.
                    </p>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  className="bg-red-500 hover:bg-red-600"
                  onClick={closePosition}
                >
                  Close Position
                </Button>
              </CardContent>
            </Card>
          )}

          {/* First row: Supply and Borrow cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Your Supply Card */}
            <Card>
              <CardHeader>
                <div className="grid grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <CardTitle>Your Supply</CardTitle>
                    <span className="text-2xl font-semibold">${totalSupply.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-end h-[60px] sm:h-[70px] md:h-[80px] lg:h-[90px]">
                    <div className="space-y-4">
                      <div className="flex flex-col gap-2">
                        {/* APR */}
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-foreground">APR</span>
                          <span
                            className={`px-2 py-1 text-sm font-medium rounded-full ${
                              totalSupplyAPR > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                            }`}
                          >
                            {totalSupplyAPR.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <PortfolioTable columns={columns} data={portfolioData} onRefresh={refreshPortfolioData} />
              </CardContent>
            </Card>

            {/* Your Borrows Card */}
            <Card>
              <CardHeader>
                <div className="grid grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <CardTitle>Your Borrows</CardTitle>
                    <span className="text-2xl font-semibold">${totalBorrowDebt.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-end h-[60px] sm:h-[70px] md:h-[80px] lg:h-[90px]">
                    <div className="space-y-4">
                      <div className="flex flex-col gap-2">
                        {/* APR */}
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-foreground">APR</span>
                          <span
                            className={`px-2 py-1 text-sm font-medium rounded-full ${
                              totalBorrowAPR > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                            }`}
                          >
                            {totalBorrowAPR.toFixed(1)}%
                          </span>
                        </div>

                        {/* Borrow Power Section */}
                        <div className="flex flex-col gap-2">
                          <div className="flex justify-between items-center gap-x-4">
                            <span className="text-sm text-foreground">Borrow Power Used</span>
                            <span
                              className={`text-sm font-semibold ${
                                borrowPowerUsed >= 80
                                  ? "text-red-500"
                                  : borrowPowerUsed >= 50
                                    ? "text-yellow-500"
                                    : "text-blue-500"
                              }`}
                            >
                              {borrowPowerUsed.toFixed(1)}%
                            </span>
                          </div>

                          {/* Progress Bar */}
                          <div className="relative w-full h-3">
                            <div className="absolute w-full h-full bg-secondary rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  borrowPowerUsed >= 80
                                    ? "bg-gradient-to-r from-red-500 to-red-400"
                                    : borrowPowerUsed >= 50
                                      ? "bg-gradient-to-r from-yellow-500 to-yellow-400"
                                      : "bg-gradient-to-r from-blue-500 to-blue-400"
                                }`}
                                style={{ width: `${Math.min(borrowPowerUsed, 100)}%` }}
                              />
                            </div>
                            <div className="absolute w-full h-full flex justify-between items-center px-[2px]">
                              {[25, 50, 75].map((milestone) => (
                                <div
                                  key={milestone}
                                  className={`w-0.5 h-1.5 bg-secondary-foreground/20 rounded-full ${
                                    borrowPowerUsed >= milestone ? "opacity-100" : "opacity-50"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>

                          {/* Risk Labels */}
                          <div className="flex justify-between items-center text-[10px] uppercase tracking-wider font-medium text-muted-foreground/60">
                            <span>Safe</span>
                            <span>Moderate</span>
                            <span>High Risk</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <PortfolioTable columns={columns} data={borrowPortfolioData} onRefresh={refreshPortfolioData} />
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
            totalSupply={totalSupply}
            totalBorrowDebt={totalBorrowDebt}
          />

          {/* Add these dialogs here, right before the closing div */}
          <SupplyDialog
            isOpen={isPreviewDialogOpen}
            onClose={() => setIsPreviewDialogOpen(false)}
            onConfirm={handleSupplyConfirm}
            selectedAssets={getSelectedSupplyAssets().filter((asset) => math.larger(asset.select_native, 0))}
            totalSupply={totalSupply}
            totalBorrowDebt={totalBorrowDebt}
          />

          <BorrowDialog
            isOpen={isBorrowDialogOpen}
            onClose={() => setIsBorrowDialogOpen(false)}
            onConfirm={handleBorrowConfirm}
            selectedAssets={getSelectedBorrowAssets().filter((asset) => math.larger(asset.select_native, 0))}
            totalSupply={totalSupply}
            totalBorrowDebt={totalBorrowDebt}
          />
        </div>
      </main>
    </div>
  );
}
