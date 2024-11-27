import { useRadixContext } from "@/contexts/provider";
import config from "@/lib/config.json";
import position_repay_rtm from "@/lib/manifests/position_repay";
import position_withdraw_rtm from "@/lib/manifests/position_withdraw";
import { bn, m_bn, math, num, round_dec } from "@/lib/math";
import { gatewayApi, rdt } from "@/lib/radix";
import {
  Asset,
  AssetName,
  ammountToSupplyUnits,
  getAssetAPR,
  getAssetIcon,
  supplyUnitsToAmount,
  getUnitBalance,
} from "@/types/asset";
import { ColumnDef } from "@tanstack/react-table";
import { BigNumber } from "mathjs";
import { useState } from "react";
import { Button } from "../ui/button";
import { useToast } from "../ui/use-toast";
import { RepayDialog } from "./repay-dialog";
import { WithdrawDialog } from "./withdraw-dialog";

// Create a proper React component for the action cell
function ActionCell({
  row,
  refreshPortfolioData,
  totalSupply,
  totalBorrowDebt,
}: {
  row: any;
  refreshPortfolioData: () => Promise<void>;
  totalSupply: BigNumber;
  totalBorrowDebt: BigNumber;
}) {
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [showRepayDialog, setShowRepayDialog] = useState(false);
  const { toast } = useToast();
  const { accounts } = useRadixContext();

  // Move all the handler logic here
  const handleWithdraw = async (amount: BigNumber, slippageMultiplier: BigNumber) => {
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
        (fr: { resource_address: string }) => fr.resource_address === borrowerBadgeAddr,
      )?.vaults.items[0];

      const supplyUnitBalance = await getUnitBalance(accounts[0].address, row.original.label as AssetName);

      console.log("row", row.original.address);
      console.log("Native: ", amount.toString());
      console.log("Wallet balance:", supplyUnitBalance.toString());

      // Errors if the user doesn't have any supply units, or if the promise returns -1, which means there was an error
      if (math.smallerEq(supplyUnitBalance, 0)) {
        toast({
          variant: "destructive",
          title: "Withdrawal Failed",
          description: "supplyUnitBalanceError",
        });
        return;
      }

      // Calculate how many supply units will be passed to the tx
      const supplyRecord: Record<AssetName, BigNumber> = {
        [row.original.label]: amount,
      } as Record<AssetName, BigNumber>;

      let supplyUnits = m_bn(math.multiply(await ammountToSupplyUnits(supplyRecord), slippageMultiplier));
      supplyUnits = m_bn(math.min(supplyUnits, supplyUnitBalance));

      let supplyRequested = "None";
      if (!math.equal(supplyUnits, supplyUnitBalance)) {
        // Value of the supply units un-adjusted for slipapge
        // ! Removed due to causing lower-than-expected estimation
        // const supplyUnitValue = math.multiply(
        //   await supplyUnitsToAmount({ [row.original.label]: supplyUnits } as Record<AssetName, BigNumber>),
        //   math.subtract(2, slippageMultiplier),
        // );

        const supplyUnitValue = await supplyUnitsToAmount({ [row.original.label]: supplyUnits } as Record<
          AssetName,
          BigNumber
        >);

        console.log("Supply unit value:", supplyUnitValue.toString());
        supplyRequested = math.min(amount, m_bn(supplyUnitValue)).toString();
      }

      if (!getNFTBalance?.items?.[0]) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "No position NFT found",
        });
        return;
      }

      const manifest = position_withdraw_rtm({
        component: marketComponent,
        account: accounts[0].address,
        position_badge_address: borrowerBadgeAddr,
        position_badge_local_id: getNFTBalance.items[0],
        asset: {
          address: row.original.pool_unit_address ?? "",
          amount: round_dec(supplyUnits).toString(),
        },
        requested: supplyRequested.toString(),
      });

      console.log("Manifest: ", manifest);

      const result = await rdt?.walletApi.sendTransaction({
        transactionManifest: manifest,
        version: 1,
      });
      console.log("Withdraw result: ", result);
      if (result?.isOk()) {
        toast({
          title: "Withdrawal Successful",
          description: `Withdrew ${amount} ${row.original.label}`,
        });
        await refreshPortfolioData();
      } else if (result) {
        const errorResult = result as { error: { error: string } };
        let message = errorResult.error.error || "Transaction failed";
        if (errorResult.error.error.includes("rejectedByUser")) {
          message = "Transaction rejected by user";
        }
        toast({
          variant: "destructive",
          title: "Withdrawal Failed",
          description: message,
        });
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

  const handleRepay = async (amount: BigNumber, slippageMultiplier: BigNumber) => {
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
        (fr: { resource_address: string }) => fr.resource_address === borrowerBadgeAddr,
      )?.vaults.items[0];

      if (!getNFTBalance?.items?.[0]) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "No position NFT found",
        });
        return;
      }
      console.log("repaying", amount.toString(), row.original.label, row.original.wallet_balance.toString());
      const debtAmount = m_bn(math.min(m_bn(math.multiply(amount, slippageMultiplier)), row.original.wallet_balance));
      console.log("Debt amount:", debtAmount.toString());

      const debtRequested = math.largerEq(debtAmount, row.original.select_native) ? "None" : round_dec(amount);

      const manifest = position_repay_rtm({
        component: marketComponent,
        account: accounts[0].address,
        position_badge_address: borrowerBadgeAddr,
        position_badge_local_id: getNFTBalance.items[0],
        asset: {
          address: row.original.address,
          amount: round_dec(debtAmount).toString(),
        },
        requested: debtRequested.toString(),
      });

      console.log("Repay manifest:", manifest);

      const result = await rdt?.walletApi.sendTransaction({
        transactionManifest: manifest,
        version: 1,
      });

      if (result?.isOk()) {
        toast({
          title: "Repayment Successful",
          description: `Repaid ${amount} ${row.original.label}`,
        });
        await refreshPortfolioData();
      } else if (result) {
        const errorResult = result as { error: { error: string } };
        let message = errorResult.error.error || "Transaction failed";
        if (errorResult.error.error.includes("rejectedByUser")) {
          message = "Transaction rejected by user";
        }
        toast({
          variant: "destructive",
          title: "Repayment Failed",
          description: message,
        });
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
      {row.original.type === "supply" ? (
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
  totalSupply: BigNumber,
  totalBorrowDebt: BigNumber,
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
      return firstRow?.original.type === "supply" ? "Supplied" : "Debt";
    },
    cell: ({ row }: { row: any }) => {
      console.log("Row select native:", row.getValue("select_native"));
      return Number(row.getValue("select_native")).toFixed(2);
    },
  },
  {
    accessorKey: "APR",
    header: "APR",
    cell: ({ row }) => {
      return (
        <div>
          {row.original.type === "supply"
            ? Number(row.getValue("APR")).toFixed(1)
            : Number(getAssetAPR(row.getValue("label"), "borrow")).toFixed(1)}
          %
        </div>
      );
    },
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
    ),
  },
];
