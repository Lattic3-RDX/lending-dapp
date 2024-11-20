import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AssetTable } from './asset-table/asset-table';
import { columns } from './asset-table/columns';
import { borrowColumns } from './asset-table/borrow-columns';
import { Asset } from '@/types/asset';
import { RowSelectionState } from '@tanstack/react-table';
import { bn, m_bn, math, num } from "@/lib/math";
import { getAssetPrice } from "@/types/asset";
import { BigNumber } from 'mathjs';

interface AssetActionCardProps {
  supplyData: Asset[];
  supplyRowSelection: RowSelectionState;
  borrowRowSelection: RowSelectionState;
  onSupplyRowSelectionChange: (value: RowSelectionState) => void;
  onBorrowRowSelectionChange: (value: RowSelectionState) => void;
  onAmountChange: (address: string, amount: number, type: 'supply' | 'borrow') => void;
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
  const [isBorrowMode, setIsBorrowMode] = React.useState(false);
  const [localSupplyData, setLocalSupplyData] = useState(supplyData);

  // Calculate available borrows when supply or debt changes
  useEffect(() => {
    const updateAvailableBorrows = async () => {
      const updatedData = await Promise.all(
        supplyData.map(async (asset) => {
          const assetPrice = await getAssetPrice(asset.label);
          console.log(`Asset ${asset.label} price:`, assetPrice.toString());
          console.log("Total Supply:", totalSupply.toString());
          
          // If there's no debt, we can borrow up to totalSupply/1.5
          if (math.smallerEq(totalBorrowDebt, 0)) {
            // Calculate max borrow in USD (totalSupply/1.5)
            const maxBorrowUSD = m_bn(math.divide(totalSupply, 1.5));
            console.log("Max Borrow USD:", maxBorrowUSD.toString());
            
            // Convert back to token amount
            const available = num(m_bn(math.divide(maxBorrowUSD, assetPrice)));
            console.log(`Max borrow for ${asset.label} in tokens:`, available);
            return { ...asset, available };
          }

          // If there is existing debt, calculate how much more we can borrow
          // while maintaining health ratio >= 1.5
          const maxAdditionalDebtUSD = m_bn(
            math.subtract(
              m_bn(math.divide(totalSupply, 1.5)),
              totalBorrowDebt
            )
          );

          const availableAmount = m_bn(math.divide(maxAdditionalDebtUSD, assetPrice));
          const available = num(math.larger(availableAmount, 0) ? availableAmount : bn(0));
          console.log(`Available amount for ${asset.label}:`, available);
          return { ...asset, available };
        })
      );

      console.log("Updated data:", updatedData);
      setLocalSupplyData(updatedData);
    };

    updateAvailableBorrows();
  }, [supplyData, totalSupply, totalBorrowDebt]);

  return (
    <Card>
      <CardHeader>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>{isBorrowMode ? 'Available Borrows' : 'Supply Collateral'}</CardTitle>
            </div>
            {((showSupplyPreview && hasSelectedSupplyAssets && !isBorrowMode) ||
              (showBorrowPreview && hasSelectedBorrowAssets && isBorrowMode)) && (
              <Button onClick={isBorrowMode ? onPreviewBorrow : onPreviewSupply}>
                Preview {isBorrowMode ? 'Borrow' : 'Supply'}
              </Button>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Label htmlFor="mode-toggle">Supply</Label>
            <Switch
              id="mode-toggle"
              checked={isBorrowMode}
              onCheckedChange={setIsBorrowMode}
            />
            <Label htmlFor="mode-toggle">Borrow</Label>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <AssetTable
          columns={isBorrowMode ? borrowColumns : columns}
          data={isBorrowMode ? localSupplyData : supplyData}
          rowSelection={isBorrowMode ? borrowRowSelection : supplyRowSelection}
          onRowSelectionChange={isBorrowMode ? onBorrowRowSelectionChange : onSupplyRowSelectionChange}
          onAmountChange={(address, amount) => onAmountChange(address, amount, isBorrowMode ? 'borrow' : 'supply')}
          mode={isBorrowMode ? 'borrow' : 'supply'}
        />
      </CardContent>
    </Card>
  );
}