import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TruncatedNumber } from "@/components/ui/truncated-number";
import { bn, m_bn, math, num, round_dec } from "@/lib/math";
import {
  ammountToSupplyUnits,
  Asset,
  AssetName,
  getAssetIcon,
  getAssetPrice,
  getUnitBalance,
  supplyUnitsToAmount,
} from "@/types/asset";
import { ArrowRight, X } from "lucide-react";
import { BigNumber } from "mathjs";
import React, { useEffect, useState } from "react";
import { TransactionPreview } from "@/components/transaction-preview";
import { useRadixContext } from "@/contexts/provider";
import position_withdraw_rtm from "@/lib/manifests/position_withdraw";
import config from "@/lib/config.json";
import { gatewayApi } from "@/lib/radix";
import { SlippageSlider } from "@/components/slippage-slider";

interface WithdrawDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (amount: BigNumber, slippageMultiplier: BigNumber) => Promise<void>;
  asset: Asset;
  totalSupply: BigNumber;
  totalBorrowDebt: BigNumber;
}

export function WithdrawDialog({
  isOpen,
  onClose,
  onConfirm,
  asset,
  totalSupply,
  totalBorrowDebt,
}: WithdrawDialogProps) {
  const [tempAmount, setTempAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [newHealthFactor, setNewHealthFactor] = useState<BigNumber>(
    math.smallerEq(totalBorrowDebt, 0) ? bn(-1) : m_bn(math.divide(totalSupply, totalBorrowDebt)),
  );
  const [assetPrice, setAssetPrice] = useState(bn(0));
  const [transactionState, setTransactionState] = useState<"idle" | "awaiting_signature" | "processing" | "error">(
    "idle",
  );
  const { accounts } = useRadixContext();
  const [manifest, setManifest] = useState<string>("");
  const [nftInfo, setNftInfo] = useState<{ address: string; localId: string } | null>(null);
  const [slippage, setSlippage] = useState(0.5);

  const validateAmount = (value: string) => {
    const amount = bn(value != "" ? value : 0);
    if (!amount || math.smallerEq(amount, 0)) {
      setError("Amount must be greater than 0");
      return false;
    }
    console.log(amount.toString(), asset.select_native.toString());
    if (math.larger(amount, asset.select_native)) {
      setError("Amount exceeds supplied balance");
      return false;
    }
    setError(null);
    return true;
  };

  // Reset health factor when dialog opens/closes or asset changes
  useEffect(() => {
    setNewHealthFactor(math.smallerEq(totalBorrowDebt, 0) ? bn(-1) : m_bn(math.divide(totalSupply, totalBorrowDebt)));
  }, [isOpen, asset.address, totalSupply, totalBorrowDebt]);

  // Add this effect to fetch price when asset changes
  useEffect(() => {
    getAssetPrice(asset.label).then(setAssetPrice);
  }, [asset.label]);

  // Update health factor when amount changes
  const handleAmountChange = async (value: string) => {
    setTempAmount(value);
    const amount = bn(value != "" ? value : 0) || bn(0);

    // Calculate new health factor
    const withdrawValue = math.multiply(amount, assetPrice);
    const newSupplyValue = math.subtract(totalSupply, withdrawValue);
    const newHF = math.smallerEq(totalBorrowDebt, 0) ? bn(-1) : m_bn(math.divide(newSupplyValue, totalBorrowDebt));
    setNewHealthFactor(newHF);

    if (!math.equal(newHF, -1) && math.smaller(newHF, bn(1))) {
      setError("Withdrawal would put health ratio below minimum");
      return;
    }

    validateAmount(value);
  };

  const handleMaxClick = () => {
    setTempAmount(asset.select_native.toString());
    setError(null);
  };

  const handleConfirm = async () => {
    const amount = bn(tempAmount);
    if (math.larger(amount, 0) && !error) {
      setTransactionState("awaiting_signature");
      try {
        // Add slippage to amount (convert percentage to decimal)
        const slippageMultiplier = 1 + slippage / 100;
        // const amountWithSlippage = m_bn(math.multiply(amount, slippageMultiplier));

        await onConfirm(amount, bn(slippageMultiplier));
        onClose();
      } catch (error) {
        setTransactionState("error");
        setTimeout(() => setTransactionState("idle"), 2000);
      }
    }
  };

  // Add NFT info fetching effect
  useEffect(() => {
    const fetchNFTInfo = async () => {
      if (!accounts || !isOpen) return;

      const accountState = await gatewayApi?.state.getEntityDetailsVaultAggregated(accounts[0].address);
      const getNFTBalance = accountState?.non_fungible_resources.items.find(
        (fr: { resource_address: string }) => fr.resource_address === config.borrowerBadgeAddr,
      )?.vaults.items[0];

      if (getNFTBalance?.items?.[0]) {
        setNftInfo({
          address: config.borrowerBadgeAddr,
          localId: getNFTBalance.items[0],
        });
      }
    };

    fetchNFTInfo();
  }, [accounts, isOpen]);

  // Add manifest generation effect
  useEffect(() => {
    // if (!accounts || !isOpen || !nftInfo || !tempAmount) return;

    const preview = async () => {
      if (!accounts || !isOpen || !nftInfo || !tempAmount) return;

      const amount = bn(tempAmount);

      const supplyUnitBalance = await getUnitBalance(accounts[0].address, asset.label);

      const supplyRecord: Record<AssetName, BigNumber> = {
        [asset.label]: amount,
      } as Record<AssetName, BigNumber>;
      const rawSupplyUnits = await ammountToSupplyUnits(supplyRecord);

      let supplyUnits = m_bn(math.multiply(rawSupplyUnits, 1 + slippage / 100));
      supplyUnits = m_bn(math.min(supplyUnits, supplyUnitBalance));

      let supplyRequested = "None";
      if (!math.equal(supplyUnits, supplyUnitBalance)) {
        // Value of the supply units un-adjusted for slipapge
        // ! Removed due to causing lower-than-expected estimation
        // const supplyUnitValue = math.multiply(
        //   await supplyUnitsToAmount({ [row.original.label]: supplyUnits } as Record<AssetName, BigNumber>),
        //   math.subtract(2, slippageMultiplier),
        // );

        const supplyUnitValue = await supplyUnitsToAmount({ [asset.label]: supplyUnits } as Record<
          AssetName,
          BigNumber
        >);
        supplyRequested = round_dec(math.min(amount, m_bn(supplyUnitValue))).toString();
      }

      const previewManifest = position_withdraw_rtm({
        component: config.marketComponent,
        account: accounts[0].address,
        position_badge_address: nftInfo.address,
        position_badge_local_id: nftInfo.localId,
        asset: {
          address: asset.pool_unit_address,
          amount: round_dec(supplyUnits).toString(),
        },
        requested: supplyRequested,
      });

      setManifest(previewManifest);
    };

    preview();
  }, [accounts, asset, tempAmount, isOpen, nftInfo]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Withdraw</DialogTitle>
        </DialogHeader>

        {/* Asset Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 relative">
            <img src={getAssetIcon(asset.label)} alt={`${asset.label} icon`} className="w-10 h-10 rounded-full" />
          </div>
          <span className="text-2xl font-semibold">{asset.label}</span>
        </div>

        <div className="space-y-8">
          <div className="space-y-3">
            <span className="text-lg font-semibold block mb-2">Amount</span>
            <div className="space-y-2">
              {/* Input container */}
              <div className="relative">
                <Input
                  type="number"
                  value={tempAmount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className="pr-24 h-12"
                  placeholder={asset.label}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMaxClick}
                    className="h-8 px-3 text-sm font-medium hover:bg-transparent"
                  >
                    Max
                  </Button>
                </div>
              </div>

              {/* Value and available balance */}
              <div className="flex justify-between text-sm text-foreground px-1">
                <span>≈ ${tempAmount ? <TruncatedNumber value={Number(tempAmount) * num(assetPrice)} /> : "0.00"}</span>
                <span>
                  Current supply: <TruncatedNumber value={asset.select_native.toNumber()} />
                </span>
              </div>

              {error && <div className="text-red-500 text-sm">{error}</div>}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-base">
              <span>Health Factor</span>
              <div className="flex items-center gap-2">
                <span
                  className={
                    num(totalBorrowDebt) <= 0
                      ? "text-green-500"
                      : num(totalSupply) / num(totalBorrowDebt) < 1.5
                        ? "text-red-500"
                        : "text-green-500"
                  }
                >
                  {num(totalBorrowDebt) <= 0 ? "∞" : (num(totalSupply) / num(totalBorrowDebt)).toFixed(2)}
                </span>
                <ArrowRight className="w-4 h-4" />
                <span
                  className={
                    num(newHealthFactor) === -1
                      ? "text-green-500"
                      : num(newHealthFactor) < 1.5
                        ? "text-red-500"
                        : "text-green-500"
                  }
                >
                  {num(newHealthFactor) === -1 ? "∞" : newHealthFactor.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <SlippageSlider value={slippage} onChange={setSlippage} />

          <TransactionPreview manifest={manifest} />

          <Button
            className="w-full h-12 text-base"
            onClick={handleConfirm}
            disabled={
              !!error ||
              !tempAmount ||
              parseFloat(tempAmount) <= 0 ||
              transactionState !== "idle" ||
              (num(newHealthFactor) !== -1 && num(newHealthFactor) <= 1.5)
            }
          >
            {transactionState === "error" ? (
              <div className="flex items-center gap-2">
                <X className="w-4 h-4 text-destructive" />
                Transaction Failed
              </div>
            ) : transactionState === "awaiting_signature" ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Waiting for signature...
              </div>
            ) : transactionState === "processing" ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Withdrawing...
              </div>
            ) : num(newHealthFactor) !== -1 && num(newHealthFactor) <= 1.5 ? (
              "Health ratio would be too low"
            ) : (
              "Confirm Withdrawal"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
