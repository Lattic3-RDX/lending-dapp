import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AssetTable } from './asset-table/asset-table';
import { columns } from './asset-table/columns';
import { borrowColumns } from './asset-table/borrow-columns';
import { Asset, AssetName, getAssetPrice } from '@/types/asset';
import { RowSelectionState } from '@tanstack/react-table';

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
}: AssetActionCardProps) {
  const [isBorrowMode, setIsBorrowMode] = React.useState(false);

  return (
    <Card>
      <CardHeader>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>{isBorrowMode ? 'Available Borrows' : 'Your Collateral'}</CardTitle>
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
          data={isBorrowMode ? supplyData.map(asset => ({
            ...asset,
            available: 100.00,
            type: 'borrow'
          })) : supplyData}
          rowSelection={isBorrowMode ? borrowRowSelection : supplyRowSelection}
          onRowSelectionChange={isBorrowMode ? onBorrowRowSelectionChange : onSupplyRowSelectionChange}
          onAmountChange={(address, amount) => onAmountChange(address, amount, isBorrowMode ? 'borrow' : 'supply')}
          mode={isBorrowMode ? 'borrow' : 'supply'}
        />
      </CardContent>
    </Card>
  );
}