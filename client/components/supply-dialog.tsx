"use client";
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowRight, X } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { getAssetIcon, AssetName } from '@/types/asset';
import { getCachedAssetPrice } from '@/lib/price-cache';
interface Asset {
  label: string;
  address: string;
  select_native: number;
  APR: number;
}

interface SupplyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  selectedAssets: Asset[];
  totalSupply: number;
  totalBorrowDebt: number;
}

const columns: ColumnDef<Asset>[] = [
  {
    accessorKey: 'label',
    header: 'Asset',
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <img
          src={getAssetIcon(row.getValue('label') as AssetName)}
          alt={`${row.getValue('label')} icon`}
          className="w-6 h-6 rounded-full"
        />
        <span className="font-semibold">{row.getValue('label')}</span>
      </div>
    ),
  },
  {
    accessorKey: 'select_native',
    header: 'Amount',
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <span className="font-semibold">
          {Number(row.getValue('select_native')).toFixed(2)}
        </span>
      </div>
    ),
  },
  {
    accessorKey: 'APR',
    header: () => <div className="text-right">APR</div>,
    cell: ({ row }) => (
      <div className="text-right text-green-500 font-medium">
        {Number(row.getValue('APR')).toFixed(2)}%
      </div>
    ),
  },
];

const SupplyDialog: React.FC<SupplyDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  selectedAssets,
  totalSupply,
  totalBorrowDebt,
}) => {
  const [totalUsdValue, setTotalUsdValue] = React.useState(0);
  const [transactionState, setTransactionState] = useState<'idle' | 'awaiting_signature' | 'processing' | 'error'>('idle');

  React.useEffect(() => {
    const calculateTotal = async () => {
      const total = await selectedAssets.reduce(async (sumPromise, asset) => {
        const sum = await sumPromise;
        const price = await getCachedAssetPrice(asset.label as AssetName);
        return sum + (asset.select_native * price);
      }, Promise.resolve(0));
      setTotalUsdValue(total);
    };
    calculateTotal();
  }, [selectedAssets]);

  // Calculate current and new health factors
  const currentHealthFactor = totalBorrowDebt <= 0 ? -1 : totalSupply / totalBorrowDebt;
  const newHealthFactor = totalBorrowDebt <= 0 ? -1 : (totalSupply + totalUsdValue) / totalBorrowDebt;

  const table = useReactTable({
    data: selectedAssets,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleConfirm = async () => {
    setTransactionState('awaiting_signature');
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      setTransactionState('error');
      setTimeout(() => setTransactionState('idle'), 2000);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Preview Supply</DialogTitle>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-500">Total Value</div>
              <div className="text-xl font-semibold">
                ≈ ${totalUsdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="flex flex-col items-end">
              <div className="text-sm text-gray-500">Health Factor</div>
              <div className="flex items-center gap-2">
                <div className={currentHealthFactor < 1.5 && currentHealthFactor !== -1 ? "text-red-500" : "text-green-500"}>
                  {currentHealthFactor === -1 ? '∞' : currentHealthFactor.toFixed(2)}
                </div>
                <ArrowRight className="w-4 h-4" />
                <div className={newHealthFactor < 1.5 && newHealthFactor !== -1 ? "text-red-500" : "text-green-500"}>
                  {newHealthFactor === -1 ? '∞' : newHealthFactor.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-6">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No assets selected
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="mt-6">
          <Button
            onClick={handleConfirm}
            className="w-full h-12 text-base"
            disabled={transactionState !== 'idle'}
          >
            {transactionState === 'error' ? (
              <div className="flex items-center gap-2">
                <X className="w-4 h-4 text-destructive" />
                Transaction Failed
              </div>
            ) : transactionState === 'awaiting_signature' ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Waiting for signature...
              </div>
            ) : transactionState === 'processing' ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Supplying...
              </div>
            ) : (
              "Confirm Supply"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SupplyDialog;