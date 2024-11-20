import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { getAssetIcon, AssetName, getAssetAPR, getAssetPrice } from "@/types/asset";
import { num } from "@/lib/math";

interface Asset {
  label: string;
  address: string;
  select_native: number;
  APR: number;
}

interface BorrowDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  selectedAssets: Asset[];
  totalSupply: number;
  totalBorrowDebt: number;
}

const columns: ColumnDef<Asset>[] = [
  {
    accessorKey: "label",
    header: "Asset",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <img
          src={getAssetIcon(row.getValue("label") as AssetName)}
          alt={`${row.getValue("label")} icon`}
          className="w-6 h-6 rounded-full"
        />
        <span className="font-semibold">{row.getValue("label")}</span>
      </div>
    ),
  },
  {
    accessorKey: "select_native",
    header: "Amount",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <span className="font-semibold">{Number(row.getValue("select_native")).toFixed(2)}</span>
      </div>
    ),
  },
  {
    accessorKey: "APR",
    header: () => <div className="text-right">APR</div>,
    cell: ({ row }) => (
      <div className="text-right text-red-500 font-medium">
        {getAssetAPR(row.getValue("label") as AssetName, "borrow").toFixed(2)}%
      </div>
    ),
  },
];

const BorrowDialog: React.FC<BorrowDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  selectedAssets,
  totalSupply,
  totalBorrowDebt,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const assetsToBorrow = React.useMemo(
    () => selectedAssets.filter((asset) => asset.select_native > 0),
    [selectedAssets],
  );

  const [totalUsdValue, setTotalUsdValue] = React.useState(0);

  React.useEffect(() => {
    const calculateTotal = async () => {
      const total = await assetsToBorrow.reduce(async (sumPromise, asset) => {
        const sum = await sumPromise;
        const price = num(await getAssetPrice(asset.label as AssetName));
        return sum + asset.select_native * price;
      }, Promise.resolve(0));
      setTotalUsdValue(total);
    };
    calculateTotal();
  }, [assetsToBorrow]);

  const currentHealthFactor = totalBorrowDebt <= 0 ? -1 : totalSupply / totalBorrowDebt;
  const newHealthFactor = totalSupply / (totalBorrowDebt + totalUsdValue);

  const table = useReactTable({
    data: assetsToBorrow,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Preview Borrow</DialogTitle>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-500">Total Value</div>
              <div className="text-xl font-semibold">
                ${totalUsdValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="flex flex-col items-end">
              <div className="text-sm text-gray-500">Health Factor</div>
              <div className="flex items-center gap-2">
                <div
                  className={
                    currentHealthFactor < 1.5 && currentHealthFactor !== -1 ? "text-red-500" : "text-green-500"
                  }
                >
                  {currentHealthFactor === -1 ? "∞" : currentHealthFactor.toFixed(2)}
                </div>
                <ArrowRight className="w-4 h-4" />
                <div className={newHealthFactor < 1.5 && newHealthFactor !== -1 ? "text-red-500" : "text-green-500"}>
                  {newHealthFactor === -1 ? "∞" : newHealthFactor.toFixed(2)}
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
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
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
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
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

        <DialogFooter>
          <Button className="w-full h-12 text-base" onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Borrowing...
              </div>
            ) : (
              "Confirm Borrow"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BorrowDialog;
