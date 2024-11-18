import React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TruncatedNumberProps {
  value: number;
  decimals?: number;
  tooltipDecimals?: number;
  prefix?: string;
}

export function TruncatedNumber({ 
  value, 
  decimals = 2, 
  tooltipDecimals = 6,
  prefix = ''
}: TruncatedNumberProps) {
  const truncated = Number(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
  
  const full = Number(value).toLocaleString('en-US', {
    minimumFractionDigits: tooltipDecimals,
    maximumFractionDigits: tooltipDecimals
  });

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help">{prefix}{truncated}</span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{prefix}{full}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
} 