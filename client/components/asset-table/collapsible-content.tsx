import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Asset, getAssetIcon } from "@/types/asset";

interface AssetCollapsibleContentProps {
  asset: Asset;
  onAmountChange: (amount: number) => void;
  onConfirm: (amount: number) => void;
}

export function AssetCollapsibleContent({ asset, onAmountChange, onConfirm }: AssetCollapsibleContentProps) {
  const [tempAmount, setTempAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleAmountChange = (value: string) => {
    setTempAmount(value);
    validateAmount(value);
  };

  const validateAmount = (value: string) => {
    const numValue = Number(value);
    const maxAmount = asset.type === 'borrow'
      ? (asset.available ?? 0)
      : asset.wallet_balance;

    if (isNaN(numValue)) {
      setError("Please enter a valid number");
    } else if (numValue <= 0) {
      setError("Amount must be greater than 0");
    } else if (numValue > maxAmount) {
      setError(`Amount cannot exceed ${maxAmount}`);
    } else {
      setError(null);
    }
  };

  const handleMaxClick = () => {
    const maxAmount = asset.type === 'borrow'
      ? (asset.available ?? 0)
      : asset.wallet_balance;
    setTempAmount(maxAmount.toString());
    validateAmount(maxAmount.toString());
  };

  const handleConfirm = () => {
    if (!error && tempAmount) {
      onAmountChange(parseFloat(tempAmount));
      setTempAmount("");
      onConfirm(parseFloat(tempAmount));
    }
  };

  return (
    <div className="w-full bg-accent/5 rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <img
          src={getAssetIcon(asset.label)}
          alt={`${asset.label} icon`}
          className="w-8 h-8 rounded-full"
        />
        <span className="text-lg font-semibold text-foreground">{asset.label}</span>
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
        <div className="flex justify-between text-sm text-foreground/80 px-1">
          <span>Balance: {asset.wallet_balance}</span>
          {asset.type === 'borrow' && (
            <span>Available: {asset.available ?? 0}</span>
          )}
        </div>
        {error && <div className="text-destructive text-sm">{error}</div>}
      </div>

      <div className="space-y-3 py-2 border-t border-accent/10">
        <div className="flex justify-between text-base text-foreground">
          <span>{asset.type === 'borrow' ? 'Borrow APY' : 'Supply APY'}</span>
          <span className={asset.type === 'borrow' ? 'text-destructive' : 'text-success'}>
            {asset.apy}%
          </span>
        </div>
        <div className="flex justify-between text-base text-foreground">
          <span>Health Factor</span>
          <span className="text-destructive">
            {asset.type === 'borrow' ? '-0.5' : '+0.5'}
          </span>
        </div>
      </div>

      <Button
        className="w-full h-12 text-base"
        onClick={handleConfirm}
        disabled={!!error || !tempAmount || parseFloat(tempAmount) <= 0}
      >
        {asset.type === 'borrow' ? 'Confirm Borrow' : 'Confirm Supply'}
      </Button>
    </div>
  );
} 