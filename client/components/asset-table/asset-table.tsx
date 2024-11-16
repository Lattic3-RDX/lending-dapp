"use client";

import * as React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  ColumnFiltersState,
  getFilteredRowModel,
  RowSelectionState,
  Updater,
  TableState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { AssetCollapsibleContent } from "./collapsible-content";
import { Asset } from "@/types/asset";
import { Search } from "lucide-react";

interface AssetTableProps<TData extends Asset, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  rowSelection: RowSelectionState;
  onRowSelectionChange: (value: RowSelectionState) => void;
  onAmountChange: (address: string, amount: number, type: 'borrow' | 'supply') => void;
  type: 'borrow' | 'supply';
}

export function AssetTable<TData extends Asset, TValue>({
  columns,
  data,
  rowSelection,
  onRowSelectionChange,
  onAmountChange,
  type,
}: AssetTableProps<TData, TValue>) {
  const [tableData, setTableData] = React.useState(data);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [expandedRows, setExpandedRows] = React.useState<Record<string, boolean>>({});

  const handleAmountChange = (address: string, amount: number) => {
    setTableData(current =>
      current.map(row =>
        row.address === address
          ? { ...row, select_native: amount }
          : row
      )
    );
    onAmountChange(address, amount, type);
  };

  const handleConfirm = (asset: Asset, amount: number) => {
    setExpandedRows({});
  };

  // Handle row selection changes
  const handleRowSelectionChange = (updaterOrValue: Updater<RowSelectionState>) => {
    const newSelection = typeof updaterOrValue === 'function' 
      ? updaterOrValue(rowSelection)
      : updaterOrValue;

    // Reset amounts for unselected assets
    setTableData(current =>
      current.map(row => {
        const rowIndex = table.getRowModel().rows.findIndex(r => r.original.address === row.address);
        const isSelected = newSelection[rowIndex];
        if (!isSelected) {
          onAmountChange(row.address, 0, type); // Notify parent of amount change
        }
        return isSelected ? row : { ...row, select_native: 0 };
      })
    );
    
    // Update expanded rows based on selection state
    setExpandedRows(prev => {
      const updatedRows: Record<string, boolean> = {};
      
      Object.keys(prev).forEach(rowId => {
        updatedRows[rowId] = false;
      });
      
      const selectedRowIds = Object.entries(newSelection)
        .filter(([_, isSelected]) => isSelected)
        .map(([id]) => id);
      
      if (selectedRowIds.length > 0) {
        const lastSelectedId = selectedRowIds[selectedRowIds.length - 1];
        updatedRows[lastSelectedId] = true;
      }

      return updatedRows;
    });
    
    onRowSelectionChange(newSelection);
  };

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: handleRowSelectionChange,
    enableExpanding: true,
    onExpandedChange: (updaterOrValue) => {
      const newValue = typeof updaterOrValue === 'function'
        ? updaterOrValue(expandedRows)
        : updaterOrValue;
      
      const expandedState = typeof newValue === 'boolean' 
        ? {} 
        : newValue as Record<string, boolean>;
      
      // Always ensure only one row is expanded
      const expandedRowIds = Object.entries(expandedState)
        .filter(([_, expanded]) => expanded)
        .map(([id]) => id);
      
      // Create a new state with all rows collapsed
      const newState: Record<string, boolean> = {};
      Object.keys(expandedState).forEach(id => {
        newState[id] = false;
      });
      
      // If there's an expanded row, only expand the last one
      if (expandedRowIds.length > 0) {
        const lastExpandedId = expandedRowIds[expandedRowIds.length - 1];
        newState[lastExpandedId] = true;
      }
      
      setExpandedRows(newState);
    },
    state: {
      columnFilters,
      rowSelection,
      expanded: expandedRows,
    },
  });

  // Custom row sorting function
  const sortedRows = React.useMemo(() => {
    const rows = [...table.getRowModel().rows];
    return rows.sort((a, b) => {
      const aSelected = a.getIsSelected() ? 1 : 0;
      const bSelected = b.getIsSelected() ? 1 : 0;
      return bSelected - aSelected;
    });
  }, [table.getRowModel().rows, rowSelection]);

  const handleExpansionChange = (rowId: string) => {
    setExpandedRows(prev => {
      // If clicking on already expanded row, allow it to close
      if (prev[rowId]) {
        return {};
      }
      // Otherwise, expand the clicked row and close others
      return { [rowId]: true };
    });
  };

  return (
    <div className="rounded-md border">
      <div className="relative max-w-sm m-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground" />
        <Input
          placeholder="Find assets..."
          value={(table.getColumn("label")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("label")?.setFilterValue(event.target.value)
          }
          className="pl-9 placeholder:text-foreground"
        />
      </div>
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
          {sortedRows.length ? (
            sortedRows.map((row) => (
              <Collapsible
                key={row.id}
                asChild
                open={expandedRows[row.id]}
              >
                <>
                  <TableRow data-state={row.getIsSelected() && "selected"}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                  <CollapsibleContent asChild>
                    <TableRow>
                      <TableCell className="p-0" colSpan={columns.length}>
                        <div className="bg-accent p-4">
                          <AssetCollapsibleContent 
                            asset={row.original} 
                            onAmountChange={(amount) => handleAmountChange(row.original.address, amount)}
                            onConfirm={(amount) => handleConfirm(row.original, amount)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  </CollapsibleContent>
                </>
              </Collapsible>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}