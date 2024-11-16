"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <motion.div
        className={cn(
          "h-12 w-12 rounded-full border-4 border-accent-foreground border-t-transparent",
          className
        )}
        animate={{ rotate: 360 }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: "linear",
        }}
      />
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="mt-4 text-foreground"
      >
        Loading asset data...
      </motion.p>
    </div>
  );
} 