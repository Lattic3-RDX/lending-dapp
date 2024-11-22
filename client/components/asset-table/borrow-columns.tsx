import React from "react";
import { getAssetAPR, getAssetIcon, Asset } from "@/types/asset";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { bn, m_bn, math } from "@/lib/math";
import { TruncatedNumber } from "../ui/truncated-number";

export const borrowColumns: ColumnDef<Asset>[] = [
  {
    id: "select",
    header: "Select assets",
    size: 100,
    cell: ({ row }) => {
      const isUnavailable = !row.original.available || row.original.available.toNumber() <= 0;
      return (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(checked) => {
            row.toggleSelected(!!checked);
          }}
          aria-label="Select row"
          disabled={isUnavailable}
          className={isUnavailable ? "opacity-50" : ""}
        />
      );
    },
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "label",
    header: "Asset",
    size: 200,
    cell: ({ row }) => {
      const isUnavailable = !row.original.available || row.original.available.toNumber() <= 0;
      return (
        <div className={`flex items-center gap-3 ${isUnavailable ? "opacity-50" : ""}`}>
          <img
            src={getAssetIcon(row.getValue("label"))}
            alt={`${row.getValue("label")} icon`}
            className="w-6 h-6 rounded-full"
          />
          <span className="font-semibold">{row.getValue("label")}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "available",
    header: "Available",
    size: 150,
    cell: ({ row, table }) => {
      const isExpanded = row.getIsExpanded();
      if (isExpanded) return null;

      const originalData = table.options.data;
      const asset = originalData.find((a) => a.address === row.original.address);
      const available = asset?.available;

      console.log("Rendering available for asset:", asset);

      return (
        <span className={`font-semibold ${Number(available) <= 0 ? "opacity-50" : ""}`}>
          <TruncatedNumber value={Number(available)} />
        </span>
      );
    },
  },
  {
    accessorKey: "select_native",
    header: "Selected Amount",
    size: 150,
    cell: ({ row }) => {
      const isExpanded = row.getIsExpanded();
      const isSelected = row.getIsSelected();
      if (isExpanded) return null;
      return <div>{isSelected && row.original.select_native.toNumber() > 0 ? row.original.select_native.toNumber() : "-"}</div>;
    },
  },
  {
    accessorKey: "APR",
    header: "APR",
    size: 150,
    cell: ({ row }) => {
      const isExpanded = row.getIsExpanded();
      if (isExpanded) return null;
      const APR = getAssetAPR(row.getValue("label"), "borrow");
      return `${Number(APR).toFixed(1)}%`;
    },
  },
  {
    id: "actions",
    size: 100,
    cell: ({ row }) => {
      const isExpanded = row.getIsExpanded();
      return (
        <Button variant="ghost" size="sm" onClick={() => row.toggleExpanded()}>
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      );
    },
  },
];
