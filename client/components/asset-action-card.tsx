import React, { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AssetTable } from "./asset-table/asset-table";
import { columns } from "./asset-table/columns";
import { borrowColumns } from "./asset-table/borrow-columns";
import { Asset } from "@/types/asset";
import { RowSelectionState } from "@tanstack/react-table";
import { bn, m_bn, math, num } from "@/lib/math";
import { getAssetPrice } from "@/types/asset";
import { BigNumber } from "mathjs";

interface AssetActionCardProps {
  supplyData: Asset[];
  supplyRowSelection: RowSelectionState;
  borrowRowSelection: RowSelectionState;
  onSupplyRowSelectionChange: (value: RowSelectionState) => void;
  onBorrowRowSelectionChange: (value: RowSelectionState) => void;
  onAmountChange: (address: string, amount: BigNumber, type: "supply" | "borrow") => void;
  showSupplyPreview: boolean;
  showBorrowPreview: boolean;
  hasSelectedSupplyAssets: boolean;
  hasSelectedBorrowAssets: boolean;
  onPreviewSupply: () => void;
  onPreviewBorrow: () => void;
  totalSupply: BigNumber;
  totalBorrowDebt: BigNumber;
}

export function AssetActionCard({
  supplyData,
  supplyRowSelection,
  borrowRowSelection,
  onSupplyRowSelectionChange,
  onBorrowRowSelectionChange,
  onAmountChange,
  showSupplyPreview,
  showBorrowPreview,
  hasSelectedSupplyAssets,
  hasSelectedBorrowAssets,
  onPreviewSupply,
  onPreviewBorrow,
  totalSupply,
  totalBorrowDebt,
}: AssetActionCardProps) {
  const [isBorrowMode, setIsBorrowMode] = useState(false);
  const [borrowData, setBorrowData] = useState(supplyData);

  // Add ref to track latest data
  const latestBorrowData = useRef(borrowData);

  useEffect(() => {
    latestBorrowData.current = borrowData;
  }, [borrowData]);

  useEffect(() => {
    const updateAvailableBorrows = async () => {
      if (!isBorrowMode || math.equal(totalSupply, 0)) {
        return;
      }

      try {
        const updatedData = await Promise.all(
          supplyData.map(async (asset) => {
            const assetPrice = await getAssetPrice(asset.label);

            if (math.smallerEq(totalBorrowDebt, 0)) {
              const maxBorrowUSD = m_bn(math.divide(totalSupply, 1.5));
              const available = m_bn(math.divide(maxBorrowUSD, assetPrice));

              return {
                ...asset,
                available,
              };
            }

            const maxAdditionalDebtUSD = m_bn(math.subtract(m_bn(math.divide(totalSupply, 1.5)), totalBorrowDebt));

            const availableAmount = m_bn(math.divide(maxAdditionalDebtUSD, assetPrice));
            const available = math.larger(availableAmount, 0) ? availableAmount : bn(0);

            return {
              ...asset,
              available,
            };
          }),
        );

        console.log("Setting borrow data:", updatedData);
        setBorrowData(updatedData);
        console.log("Borrow data after set:", latestBorrowData.current);
      } catch (error) {
        console.error("Error updating available amounts:", error);
      }
    };

    updateAvailableBorrows();
  }, [supplyData, totalSupply, totalBorrowDebt, isBorrowMode]);

  // console.log('Rendering AssetActionCard with data:', isBorrowMode ? borrowData : supplyData);

  return (
    <Card>
      <CardHeader>
        <div className="space-y-4">
          <div className="flex justify-between items-center h-9">
            <div className="flex items-center gap-2">
              <div className="flex items-center">
                <CardTitle>{isBorrowMode ? "Borrow Assets" : "Supply Assets"}</CardTitle>
              </div>
              <div className="w-24">
                {isBorrowMode ? (
                  <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700">Debt</span>
                ) : (
                  <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">Collateral</span>
                )}
              </div>
            </div>
            {((showSupplyPreview && hasSelectedSupplyAssets && !isBorrowMode) ||
              (showBorrowPreview && hasSelectedBorrowAssets && isBorrowMode)) && (
              <Button onClick={isBorrowMode ? onPreviewBorrow : onPreviewSupply}>
                Preview {isBorrowMode ? "Borrow" : "Supply"}
              </Button>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-16 text-center">
              <span 
                className={`transition-all ${
                  !isBorrowMode 
                    ? "font-bold text-green-700" 
                    : "font-normal text-foreground opacity-40"
                }`}
              >
                Supply
              </span>
            </div>
            <Switch 
              id="mode-toggle" 
              checked={isBorrowMode} 
              onCheckedChange={setIsBorrowMode}
              className={isBorrowMode ? "data-[state=checked]:bg-red-500" : "data-[state=checked]:bg-green-500"}
            />
            <div className="w-16 text-center">
              <span 
                className={`transition-all ${
                  isBorrowMode 
                    ? "font-bold text-red-700" 
                    : "font-normal text-foreground opacity-40"
                }`}
              >
                Borrow
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="bg-background">
        <AssetTable
          columns={isBorrowMode ? borrowColumns : columns}
          data={isBorrowMode ? borrowData : supplyData}
          rowSelection={isBorrowMode ? borrowRowSelection : supplyRowSelection}
          onRowSelectionChange={isBorrowMode ? onBorrowRowSelectionChange : onSupplyRowSelectionChange}
          onAmountChange={(address, amount) => onAmountChange(address, amount, isBorrowMode ? "borrow" : "supply")}
          mode={isBorrowMode ? "borrow" : "supply"}
        />
      </CardContent>
    </Card>
  );
}
