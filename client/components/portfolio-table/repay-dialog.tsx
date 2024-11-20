import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Asset, getAssetIcon, getAssetPrice } from "@/types/asset";
import { ArrowRight, X } from "lucide-react";
import { TruncatedNumber } from "@/components/ui/truncated-number";

interface RepayDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (amount: number) => Promise<void>;
  asset: Asset;
  totalSupply: number;
  totalBorrowDebt: number;
}

export function RepayDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  asset,
  totalSupply,
  totalBorrowDebt 
}: RepayDialogProps) {
  const [tempAmount, setTempAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [newHealthFactor, setNewHealthFactor] = useState<number>(
    totalBorrowDebt <= 0 ? -1 : totalSupply / totalBorrowDebt
  );
  const [assetPrice, setAssetPrice] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [transactionState, setTransactionState] = useState<'idle' | 'awaiting_signature' | 'processing' | 'error'>('idle');

  const validateAmount = (value: string) => {
    const amount = parseFloat(value);
    if (!amount || amount <= 0) {
      setError("Amount must be greater than 0");
      return false;
    }
    if (amount > asset.wallet_balance) {
      setError("Amount exceeds wallet balance");
      return false;
    }
    if (amount > asset.select_native) {
      setError("Amount exceeds borrowed amount");
      return false;
    }
    setError(null);
    return true;
  };

  // Update health factor when amount changes
  const handleAmountChange = async (value: string) => {
    setTempAmount(value);
    const amount = parseFloat(value) || 0;
    
    if (isNaN(amount)) {
      setError("Please enter a valid number");
      return;
    }
    
    // Calculate new health factor
    const repayValue = amount * assetPrice;
    const newBorrowDebt = totalBorrowDebt - repayValue;
    const newHF = newBorrowDebt <= 0 ? -1 : totalSupply / newBorrowDebt;
    setNewHealthFactor(newHF);
    
    validateAmount(value);
  };

  // Fetch asset price when dialog opens
  useEffect(() => {
    getAssetPrice(asset.label).then(setAssetPrice);
  }, [asset.label]);

  const calculateNewHealthFactor = (repayAmount: number) => {
    const repayValue = repayAmount * assetPrice;
    const newDebtValue = totalBorrowDebt - repayValue;
    
    // If repaying all debt, health ratio is infinite
    if (newDebtValue <= 0) return -1;
    
    // Calculate new health ratio
    return totalSupply / newDebtValue;
  };

  const handleMaxClick = () => {
    const maxAmount = Math.min(asset.select_native, asset.wallet_balance);
    setTempAmount(maxAmount.toString());
    handleAmountChange(maxAmount.toString());
  };

  const handleConfirm = async () => {
    const amount = parseFloat(tempAmount);
    if (!isNaN(amount) && amount > 0 && !error) {
      setTransactionState('awaiting_signature');
      try {
        await onConfirm(amount);
        onClose();
      } catch (error) {
        setTransactionState('error');
        setTimeout(() => setTransactionState('idle'), 2000); // Reset after 2s
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Repay {asset.label}</DialogTitle>
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
                <span>≈ ${tempAmount ? <TruncatedNumber value={Number(tempAmount) * assetPrice} /> : "0.00"}</span>
                <span>Current debt: <TruncatedNumber value={asset.select_native} /></span>
              </div>

              {error && <div className="text-red-500 text-sm">{error}</div>}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-base">
              <span>Health Factor</span>
              <div className="flex items-center gap-2">
                <span className={totalBorrowDebt <= 0 ? "text-green-500" : (totalSupply / totalBorrowDebt < 1.5 ? "text-red-500" : "text-green-500")}>
                  {totalBorrowDebt <= 0 ? '∞' : (totalSupply / totalBorrowDebt).toFixed(2)}
                </span>
                <ArrowRight className="w-4 h-4" />
                <span className={newHealthFactor === -1 ? "text-green-500" : (newHealthFactor < 1.5 ? "text-red-500" : "text-green-500")}>
                  {newHealthFactor === -1 ? '∞' : newHealthFactor.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <Button 
            className="w-full h-12 text-base"
            onClick={handleConfirm}
            disabled={!!error || !tempAmount || transactionState !== 'idle'}
          >
            {transactionState === 'error' ? (
              <div className="flex items-center gap-2">
                <X className="w-4 h-4 text-destructive" />
                Transaction Failed
              </div>
            ) : transactionState === 'awaiting_signature' ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Waiting for signature...
              </div>
            ) : transactionState === 'processing' ? (
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