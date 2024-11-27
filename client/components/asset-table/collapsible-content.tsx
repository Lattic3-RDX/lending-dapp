import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TruncatedNumber } from "@/components/ui/truncated-number";
import { useToast } from "@/components/ui/use-toast";
import { bn, m_bn, math, num } from "@/lib/math";
import { shortenAddress } from "@/lib/utils";
import { Asset, getAssetIcon, getAssetPrice } from "@/types/asset";
import { Copy } from "lucide-react";
import { BigNumber } from "mathjs";
import React, { useEffect, useMemo, useState } from "react";

interface AssetCollapsibleContentProps {
  asset: Asset;
  onAmountChange: (amount: BigNumber) => void;
  onConfirm: (amount: BigNumber) => void;
  mode: "supply" | "borrow";
}

export function AssetCollapsibleContent({ asset, onAmountChange, onConfirm, mode }: AssetCollapsibleContentProps) {
  const [tempAmount, setTempAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [usdValue, setUsdValue] = useState(bn(0));
  const { toast } = useToast();

  const isUnavailable =
    mode === "borrow"
      ? !asset.available || math.smallerEq(asset.available, 0)
      : math.smallerEq(asset.wallet_balance, 0);

  useEffect(() => {
    const calculateUsdValue = async () => {
      const amount = bn(tempAmount == "" ? 0 : tempAmount);

      if (amount.isNaN()) {
        return;
      }

      const price = await getAssetPrice(asset.label);
      setUsdValue(m_bn(math.multiply(amount, price)));
    };
    calculateUsdValue();
  }, [tempAmount, asset.label]);

  const handleAmountChange = (value: string) => {
    setTempAmount(value);
    const numValue = bn(value == "" ? 0 : value);

    setTempAmount(numValue.toString());
    onAmountChange(numValue);
    validateAmount(numValue.toString());
  };

  const validateAmount = (value: string) => {
    const numValue = bn(value == "" ? 0 : value);
    const maxAmount = mode === "borrow" ? (asset.available ?? 0) : asset.wallet_balance;

    if (numValue.isNaN()) {
      setError("Please enter a valid number");
    } else if (math.smaller(numValue, 0)) {
      setError("Amount must be greater than or equal to 0");
    } else if (math.larger(numValue, maxAmount)) {
      setError(`Amount cannot exceed ${maxAmount}`);
    } else {
      setError(null);
    }
  };

  const handleMaxClick = () => {
    const maxAmount = mode === "borrow" ? (asset.available ?? bn(0)) : asset.wallet_balance;
    setTempAmount(maxAmount.toString());
    onAmountChange(maxAmount);
    validateAmount(maxAmount.toString());
  };

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(asset.address);
    toast({
      description: "Address copied to clipboard",
      duration: 2000,
    });
  };

  return (
    <div className={`space-y-4 ${isUnavailable ? "opacity-50 pointer-events-none" : ""}`}>
      <div className="space-y-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <img src={getAssetIcon(asset.label)} alt={asset.label} className="w-8 h-8 rounded-full" />
            <span className="text-lg font-semibold">{asset.label}</span>
          </div>
          <span className="text-sm text-foreground ml-10 flex items-center gap-2">
            {shortenAddress(asset.address)}
            <button onClick={handleCopyAddress} className="hover:text-accent transition-colors">
              <Copy className="h-3 w-3" />
            </button>
          </span>
        </div>
        <div className="flex flex-col space-y-3">
          <div className="relative">
            <Input
              type="number"
              value={tempAmount}
              onChange={(e) => handleAmountChange(e.target.value)}
              className="pr-16 bg-background border-accent/20 focus:border-accent/40 placeholder:text-foreground"
              placeholder="0.00"
            />
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 hover:bg-accent/10"
              onClick={handleMaxClick}
            >
              Max
            </Button>
          </div>
          <div className="flex justify-between text-sm text-foreground px-1">
            <span>
              ≈ $<TruncatedNumber value={usdValue.toNumber()} />
            </span>
            {mode === "borrow" ? (
              <span>
                Available: <TruncatedNumber value={asset.available?.toNumber() ?? 0} />
              </span>
            ) : (
              <span>
                Balance: <TruncatedNumber value={asset.wallet_balance.toNumber()} />
              </span>
            )}
          </div>
          {error && <div className="text-destructive text-sm">{error}</div>}
        </div>

        <div className="space-y-3 py-2 border-t border-accent/10">
          <div className="flex justify-between text-base text-foreground">
            <span>{mode === "borrow" ? "Borrow APR" : "Supply APR"}</span>
            <span>{mode === "borrow" ? "10.00" : Number(asset.APR).toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
