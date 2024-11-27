import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useState } from "react";

interface SlippageSliderProps {
  value: number;
  onChange: (value: number) => void;
}

export function SlippageSlider({ value, onChange }: SlippageSliderProps) {
  const formatSlippage = (value: number) => `${value.toFixed(1)}%`;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <Label>Slippage Tolerance</Label>
        <span className="text-sm text-foreground">{formatSlippage(value)}</span>
      </div>
      <Slider
        defaultValue={[value]}
        max={2}
        min={0.1}
        step={0.1}
        onValueChange={(values: number[]) => onChange(values[0])}
        className="w-full"
      />
      <div className="flex justify-between text-xs text-foreground">
        <span>0.1%</span>
        <span>2%</span>
      </div>
    </div>
  );
} 