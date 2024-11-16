"use client";
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
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
import { getAssetIcon, AssetName, getAssetPrice } from '@/types/asset';

interface Asset {
  label: string;
  address: string;
  select_native: number;
  apy: number;
}

interface SupplyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  selectedAssets: Asset[];
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
    accessorKey: 'apy',
    header: () => <div className="text-right">APY</div>,
    cell: ({ row }) => (
      <div className="text-right text-green-500 font-medium">
        {Number(row.getValue('apy')).toFixed(2)}%
      </div>
    ),
  },
];

const SupplyDialog: React.FC<SupplyDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  selectedAssets,
}) => {
  // Calculate total USD value
  const totalUsdValue = React.useMemo(
    () => selectedAssets.reduce((sum, asset) => {
      const price = getAssetPrice(asset.label as AssetName);
      return sum + (asset.select_native * price);
    }, 0),
    [selectedAssets]
  );

  const table = useReactTable({
    data: selectedAssets,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Preview Supply</DialogTitle>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-500">Total Value</div>
              <div className="text-xl font-semibold">
                ${totalUsdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="flex flex-col items-end">
              <div className="text-sm text-gray-500">Total Health Factor</div>
              <div className="flex items-center gap-2">
                <div className="text-red-500 font-semibold">1.0</div>
                <ArrowRight className="w-4 h-4" />
                <div className="text-green-500 font-semibold">2.0</div>
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
            onClick={onConfirm}
            className="w-full bg-black text-white hover:bg-gray-800"
            disabled={selectedAssets.length === 0}
          >
            Confirm Supply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SupplyDialog;