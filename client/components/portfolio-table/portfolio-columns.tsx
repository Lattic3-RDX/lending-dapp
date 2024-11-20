import { ColumnDef } from "@tanstack/react-table";
import { Asset, getAssetAPR, getAssetIcon } from "@/types/asset";
import { Button } from "../ui/button";
import { useState } from "react";
import { WithdrawDialog } from "./withdraw-dialog";
import { useToast } from "../ui/use-toast";
import { RepayDialog } from "./repay-dialog";
import position_withdraw_rtm from "@/lib/manifests/position_withdraw";
import { gatewayApi, rdt } from "@/lib/radix";
import { useRadixContext } from "@/contexts/provider";
import config from "@/lib/config.json";
import position_repay_rtm from "@/lib/manifests/position_repay";

// Create a proper React component for the action cell
function ActionCell({ 
  row, 
  refreshPortfolioData,
  totalSupply,
  totalBorrowDebt
}: { 
  row: any; 
  refreshPortfolioData: () => Promise<void>;
  totalSupply: number;
  totalBorrowDebt: number;
}) {
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [showRepayDialog, setShowRepayDialog] = useState(false);
  const { toast } = useToast();
  const { accounts } = useRadixContext();

  // Move all the handler logic here
  const handleWithdraw = async () => {
    try {
      if (!accounts || !gatewayApi) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Wallet not connected",
        });
        return;
      }

      const borrowerBadgeAddr = config.borrowerBadgeAddr;
      const marketComponent = config.marketComponent;

      if (!borrowerBadgeAddr || !marketComponent) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Contract addresses not configured",
        });
        return;
      }

      // Get NFT ID from account state
      const accountState = await gatewayApi.state.getEntityDetailsVaultAggregated(accounts[0].address);
      const getNFTBalance = accountState.non_fungible_resources.items.find(
        (fr: { resource_address: string }) => fr.resource_address === borrowerBadgeAddr
      )?.vaults.items[0];

      if (!getNFTBalance?.items?.[0]) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "No position NFT found",
        });
        return;
      }
      console.log("Pool unit address: ", row.original.pool_unit_address);

      const manifest = position_withdraw_rtm({
        component: marketComponent,
        account: accounts[0].address,
        position_badge_address: borrowerBadgeAddr,
        position_badge_local_id: getNFTBalance.items[0],
        asset: {
          address: row.original.pool_unit_address ?? "",
          amount: row.original.select_native // TODO: the inverse of what was done for PortfolioSupply, need to pass pool units
        }
      });

      console.log("Manifest: ", manifest);

      const result = await rdt?.walletApi.sendTransaction({
        transactionManifest: manifest,
        version: 1,
      });

      if (result) {
        toast({
          title: "Withdrawal Successful",
          description: `Withdrew ${row.original.select_native} ${row.original.label}`,
        });
        await refreshPortfolioData();
      }
    } catch (error) {
      console.error("Withdrawal error:", error);
      toast({
        variant: "destructive",
        title: "Withdrawal Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setShowWithdrawDialog(false);
    }
  };

  const handleRepay = async () => {
    try {
      if (!accounts || !gatewayApi) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Wallet not connected",
        });
        return;
      }

      const borrowerBadgeAddr = config.borrowerBadgeAddr;
      const marketComponent = config.marketComponent;

      if (!borrowerBadgeAddr || !marketComponent) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Contract addresses not configured",
        });
        return;
      }

      // Get NFT ID from account state
      const accountState = await gatewayApi.state.getEntityDetailsVaultAggregated(accounts[0].address);
      const getNFTBalance = accountState.non_fungible_resources.items.find(
        (fr: { resource_address: string }) => fr.resource_address === borrowerBadgeAddr
      )?.vaults.items[0];

      if (!getNFTBalance?.items?.[0]) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "No position NFT found",
        });
        return;
      }

      console.log("repaying", row.original.select_native, row.original.label);
      const manifest = position_repay_rtm({
        component: marketComponent,
        account: accounts[0].address,
        position_badge_address: borrowerBadgeAddr,
        position_badge_local_id: getNFTBalance.items[0],
        asset: {
          address: row.original.address,
          amount: row.original.select_native
        }
      });

      console.log("Repay manifest:", manifest);

      const result = await rdt?.walletApi.sendTransaction({
        transactionManifest: manifest,
        version: 1,
      });

      if (result) {
        toast({
          title: "Repayment Successful",
          description: `Repaid ${row.original.select_native} ${row.original.label}`,
        });
        await refreshPortfolioData();
      }
    } catch (error) {
      console.error("Repay error:", error);
      toast({
        variant: "destructive",
        title: "Repay Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setShowRepayDialog(false);
    }
  };

  return (
    <div className="flex justify-end gap-2">
      {row.original.type === 'supply' ? (
        <Button size="sm" onClick={() => setShowWithdrawDialog(true)}>
          Withdraw
        </Button>
      ) : (
        <Button size="sm" onClick={() => setShowRepayDialog(true)}>
          Repay
        </Button>
      )}
      <WithdrawDialog
        isOpen={showWithdrawDialog}
        onClose={() => setShowWithdrawDialog(false)}
        asset={row.original}
        onConfirm={handleWithdraw}
        totalSupply={totalSupply}
        totalBorrowDebt={totalBorrowDebt}
      />
      <RepayDialog
        isOpen={showRepayDialog}
        onClose={() => setShowRepayDialog(false)}
        asset={row.original}
        onConfirm={handleRepay}
        totalSupply={totalSupply}
        totalBorrowDebt={totalBorrowDebt}
      />
    </div>
  );
}

export const createPortfolioColumns = (
  refreshPortfolioData: () => Promise<void>,
  totalSupply: number,
  totalBorrowDebt: number
): ColumnDef<Asset>[] => [
  {
    accessorKey: "label",
    header: "Assets",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <img
          src={getAssetIcon(row.getValue("label"))}
          alt={`${row.getValue("label")} icon`}
          className="w-8 h-8 rounded-full"
        />
        {row.getValue("label")}
      </div>
    ),
  },
  {
    accessorKey: "select_native",
    header: ({ table }) => {
      const firstRow = table.getRowModel().rows[0];
      return firstRow?.original.type === 'supply' ? "Supplied" : "Debt";
    },
    cell: ({ row }) => {
      return Number(row.getValue("select_native")).toFixed(2);
    }
  },
  {
    accessorKey: "APR",
    header: "APR",
    cell: ({ row }) => {
      return (
        <div>
          {row.original.type === 'supply' 
            ? Number(row.getValue("APR")).toFixed(1)
            : Number(getAssetAPR(row.getValue("label"), 'borrow')).toFixed(1)}%
        </div>
      );
    }
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <ActionCell 
        row={row} 
        refreshPortfolioData={refreshPortfolioData}
        totalSupply={totalSupply}
        totalBorrowDebt={totalBorrowDebt}
      />
    )
  },
];
