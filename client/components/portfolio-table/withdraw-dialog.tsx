import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Asset, getAssetIcon, getAssetPrice } from "@/types/asset";

interface WithdrawDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (amount: number) => void;
  asset: Asset;
}

export function WithdrawDialog({ isOpen, onClose, onConfirm, asset }: WithdrawDialogProps) {
  const [tempAmount, setTempAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [newHealthFactor, setNewHealthFactor] = useState<number>(2.0);
  const [assetPrice, setAssetPrice] = useState<number>(0);

  useEffect(() => {
    setTempAmount("");
    setError(null);
    const price = getAssetPrice(asset.label);
    setAssetPrice(price);
  }, [asset.address, asset.label]);

  const handleAmountChange = (value: string) => {
    setTempAmount(value);
    const amount = parseFloat(value);
    if (isNaN(amount)) {
      setError("Please enter a valid number");
    } else if (amount > asset.select_native) {
      setError("Amount exceeds supplied balance");
    } else {
      setError(null);
      setNewHealthFactor(2.0 - (amount / asset.select_native) * 0.5);
    }
  };

  const handleMaxClick = () => {
    setTempAmount(asset.select_native.toString());
    setError(null);
  };

  const handleConfirm = () => {
    const amount = parseFloat(tempAmount);
    if (!isNaN(amount) && amount > 0 && !error) {
      onConfirm(amount);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Withdraw</DialogTitle>
        </DialogHeader>
        
        {/* Asset Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 relative">
            <img
              src={getAssetIcon(asset.label)}
              alt={`${asset.label} icon`}
              className="w-10 h-10 rounded-full"
            />
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
                <span>${tempAmount ? (Number(tempAmount) * assetPrice).toFixed(2) : "0.00"}</span>
                <span>Current supply: {asset.select_native}</span>
              </div>

              {error && <div className="text-red-500 text-sm">{error}</div>}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-base">
              <span>New Health Factor</span>
              <span className={newHealthFactor < 1.5 ? "text-red-500" : "text-green-500"}>
                {newHealthFactor.toFixed(2)}
              </span>
            </div>
          </div>

          <Button 
            className="w-full h-12 text-base"
            onClick={handleConfirm}
            disabled={!!error || !tempAmount || parseFloat(tempAmount) <= 0}
          >
            Confirm Withdrawal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 