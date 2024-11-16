"use client";

import React from "react";
import { AssetName, getAssetIcon } from "@/types/asset";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Asset } from "@/types/asset";

export const columns: ColumnDef<Asset, unknown>[] = [
  {
    id: "select",
    header: "Select assets",
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(checked) => {
          row.toggleSelected(!!checked);
        }}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "label",
    header: "Asset",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <img
          src={getAssetIcon(row.getValue("label"))}
          alt={`${row.getValue("label")} icon`}
          className="w-6 h-6 rounded-full"
        />
        <span className="font-semibold">{row.getValue("label")}</span>
      </div>
    ),
  },
  {
    accessorKey: "wallet_balance",
    header: "Wallet Balance",
    cell: ({ row }) => {
      const isExpanded = row.getIsExpanded();
      if (isExpanded) return null;
      
      const balance = row.getValue("wallet_balance");
      if (balance === -1) {
        return <span className="text-muted-foreground">Loading...</span>;
      }
      return <span className="font-semibold">{Number(balance).toFixed(2)}</span>;
    },
  },
  {
    accessorKey: "select_native",
    header: "Selected Amount",
    cell: ({ row }) => {
      const isExpanded = row.getIsExpanded();
      const isSelected = row.getIsSelected();
      if (isExpanded) return null;
      return (
        <div>
          {isSelected && row.original.select_native > 0 ? row.original.select_native : "-"}
        </div>
      );
    },
  },
  {
    accessorKey: "apy",
    header: "APY",
    cell: ({ row }) => {
      const isExpanded = row.getIsExpanded();
      if (isExpanded) return null;
      
      const apy = row.getValue("apy");
      return `${apy}%`;
    }
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const isExpanded = row.getIsExpanded();
      return (
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => row.toggleExpanded()}
        >
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      );
    },
  },
];