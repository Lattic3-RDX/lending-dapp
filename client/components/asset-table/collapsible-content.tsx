import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Asset } from "@/types/asset";

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
    <div className="w-full">
      <div className="flex flex-col space-y-2">
        <div className="relative">
          <Input
            type="number"
            value={tempAmount}
            onChange={(e) => handleAmountChange(e.target.value)}
            className="pr-16"
            placeholder="0.00"
          />
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3"
            onClick={handleMaxClick}
          >
            Max
          </Button>
        </div>
        <div className="flex justify-between text-sm text-muted-foreground px-1">
          <span>Balance: {asset.wallet_balance}</span>
          {asset.type === 'borrow' && (
            <span>Available: {asset.available ?? 0}</span>
          )}
        </div>
        {error && <div className="text-red-500 text-sm">{error}</div>}
      </div>

      <div className="space-y-3 py-2">
        <div className="flex justify-between text-base">
          <span>{asset.type === 'borrow' ? 'Borrow APY' : 'Supply APY'}</span>
          <span className={asset.type === 'borrow' ? 'text-destructive' : 'text-success'}>
            {asset.apy}%
          </span>
        </div>
        <div className="flex justify-between text-base">
          <span>Health Factor</span>
          <span className="text-destructive">
            {asset.type === 'borrow' ? '-0.5' : '+0.5'}
          </span>
        </div>
      </div>

      <Button
        className="w-full h-12 text-base mt-4"
        onClick={handleConfirm}
        disabled={!!error || !tempAmount || parseFloat(tempAmount) <= 0}
      >
        {asset.type === 'borrow' ? 'Confirm Borrow' : 'Confirm Supply'}
      </Button>
    </div>
  );
} 