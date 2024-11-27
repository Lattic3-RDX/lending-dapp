import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TruncatedNumber } from "@/components/ui/truncated-number";
import { bn, m_bn, math, num, round_dec } from "@/lib/math";
import {
  Asset,
  getAssetIcon,
  getAssetPrice,
  ammountToSupplyUnits,
  getUnitBalance,
  AssetName,
  getWalletBalance,
} from "@/types/asset";
import { ArrowRight, X } from "lucide-react";
import { BigNumber } from "mathjs";
import React, { useEffect, useState } from "react";
import { TransactionPreview } from "@/components/transaction-preview";
import { useRadixContext } from "@/contexts/provider";
import position_repay_rtm from "@/lib/manifests/position_repay";
import config from "@/lib/config.json";
import { gatewayApi } from "@/lib/radix";
import { SlippageSlider } from "@/components/slippage-slider";

interface RepayDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (amount: BigNumber, slippageMultiplier: BigNumber) => Promise<void>;
  asset: Asset;
  totalSupply: BigNumber;
  totalBorrowDebt: BigNumber;
}

export function RepayDialog({ isOpen, onClose, onConfirm, asset, totalSupply, totalBorrowDebt }: RepayDialogProps) {
  const [tempAmount, setTempAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [newHealthFactor, setNewHealthFactor] = useState<BigNumber>(
    math.smallerEq(totalBorrowDebt, 0) ? bn(-1) : m_bn(math.divide(totalSupply, totalBorrowDebt)),
  );
  const [assetPrice, setAssetPrice] = useState(bn(0));
  const [isLoading, setIsLoading] = useState(false);
  const [transactionState, setTransactionState] = useState<"idle" | "awaiting_signature" | "processing" | "error">(
    "idle",
  );
  const { accounts } = useRadixContext();
  const [manifest, setManifest] = useState<string>("");
  const [nftInfo, setNftInfo] = useState<{ address: string; localId: string } | null>(null);
  const [slippage, setSlippage] = useState(0.5); // Default 0.5%

  const validateAmount = (value: string) => {
    const amount = bn(value != "" ? value : 0);
    if (!amount || math.smallerEq(amount, 0)) {
      setError("Amount must be greater than 0");
      return false;
    }
    if (math.larger(amount, asset.select_native)) {
      setError("Amount exceeds supplied balance");
      return false;
    }
    if (math.larger(amount, asset.wallet_balance)) {
      setError("Amount exceeds wallet balance");
      return false;
    }
    setError(null);
    return true;
  };

  // Update health factor when amount changes
  const handleAmountChange = async (value: string) => {
    setTempAmount(value);
    const amount = bn(value != "" ? value : 0) || bn(0);

    // Calculate new health factor
    const repayValue = math.multiply(amount, assetPrice);
    const newDebtValue = math.subtract(totalBorrowDebt, repayValue);
    const newHF = math.smallerEq(newDebtValue, 0) ? bn(-1) : m_bn(math.divide(totalSupply, newDebtValue));
    setNewHealthFactor(newHF);

    if (!math.equal(newHF, -1) && math.smaller(newHF, bn(1))) {
      setError("Withdrawal would put health ratio below minimum");
      return;
    }

    validateAmount(value);
  };

  // Fetch asset price when dialog opens
  useEffect(() => {
    getAssetPrice(asset.label).then(setAssetPrice);
  }, [asset.label]);

  const calculateNewHealthFactor = (repayAmount: BigNumber): BigNumber => {
    const repayValue = math.multiply(repayAmount, assetPrice);
    const newDebtValue = math.subtract(totalBorrowDebt, repayValue);

    // If repaying all debt, health ratio is infinite
    if (math.smallerEq(newDebtValue, 0)) return bn(-1);

    // Calculate new health ratio
    return m_bn(math.divide(totalSupply, newDebtValue));
  };

  const handleMaxClick = () => {
    const maxAmount = math.min(asset.select_native, asset.wallet_balance);
    setTempAmount(maxAmount.toString());
    handleAmountChange(maxAmount.toString());
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
    const preview = async () => {
      if (!accounts || !isOpen || !nftInfo || !tempAmount) return;

      const selectAmount = round_dec(bn(tempAmount));

      // const debtRecord: Record<AssetName, BigNumber> = {
      //   [asset.label]: selectAmount,
      // } as Record<AssetName, BigNumber>;

      const debtAmount = m_bn(math.min(m_bn(math.multiply(selectAmount, 1 + slippage / 100)), asset.wallet_balance));
      console.log("Debt amount:", debtAmount.toString());
      console.log("wallet balance:", asset.wallet_balance.toString());
      console.log("select native:", asset.select_native.toString());

      // If the repayment * slippage is larger than the amount owed, do not limit the transaction
      const debtRequested = math.largerEq(debtAmount, asset.select_native) ? "None" : round_dec(selectAmount);

      const previewManifest = position_repay_rtm({
        component: config.marketComponent,
        account: accounts[0].address,
        position_badge_address: nftInfo.address,
        position_badge_local_id: nftInfo.localId,
        asset: {
          address: asset.address,
          amount: round_dec(debtAmount).toString(),
        },
        requested: debtRequested.toString(),
      });

      setManifest(previewManifest);
    };

    preview();
  }, [accounts, asset, tempAmount, isOpen, nftInfo, slippage]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Repay {asset.label}</DialogTitle>
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
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">Amount</span>
            </div>
            <div className="space-y-2">
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

              <div className="flex justify-between text-sm text-foreground px-1">
                <span>≈ ${tempAmount ? <TruncatedNumber value={Number(tempAmount) * num(assetPrice)} /> : "0.00"}</span>
                <span>
                  Current debt: <TruncatedNumber value={asset.select_native.toNumber()} />
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
                  {num(totalBorrowDebt) <= 0 || num(totalSupply) / num(totalBorrowDebt) === Infinity
                    ? "∞"
                    : (num(totalSupply) / num(totalBorrowDebt)).toFixed(2)}
                </span>
                <ArrowRight className="w-4 h-4" />
                <span
                  className={
                    num(newHealthFactor) === -1 || num(newHealthFactor) === Infinity
                      ? "text-green-500"
                      : num(newHealthFactor) < 1.5
                        ? "text-red-500"
                        : "text-green-500"
                  }
                >
                  {num(newHealthFactor) === -1 || num(newHealthFactor) === Infinity ? "∞" : newHealthFactor.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <SlippageSlider value={slippage} onChange={setSlippage} />

          <TransactionPreview manifest={manifest} />

          <Button
            className="w-full h-12 text-base"
            onClick={handleConfirm}
            disabled={!!error || !tempAmount || transactionState !== "idle"}
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
                Repaying...
              </div>
            ) : (
              "Confirm Repayment"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
