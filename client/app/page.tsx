"use client";

import { Button } from "@/components/ui/button";
import { BackgroundEffects } from "@/components/background-effects";
import { FocusCards } from "@/components/ui/focus-cards";
import { TypewriterEffectSmooth } from "@/components/ui/typewriter-effect";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Wallet, Shield, Percent } from "lucide-react";

const features = [
  {
    title: "Multi-Collateral Lending",
    description:
      "Leverage multiple assets as collateral for your loans, maximizing capital efficiency and flexibility in your DeFi strategy.",
    icon: Wallet,
  },
  {
    title: "Secure Protocol",
    description:
      "Built on Radix's secure asset-oriented architecture with formal verification, ensuring the safety of your assets.",
    icon: Shield,
  },
  {
    title: "Competitive Rates",
    description:
      "Earn attractive yields on supplied assets and access competitive borrowing rates in the DeFi ecosystem.",
    icon: Percent,
  },
];

const words = [
  {
    text: "This",
  },
  {
    text: "is",
  },
  {
    text: "Lattic3",
    className: "text-accent-foreground",
  },
];

export default function Home() {
  return (
    <>
      <main className="flex min-h-screen flex-col items-center justify-center p-8 relative overflow-hidden">
        <BackgroundEffects />

        {/* Hero Section */}
        <div className="text-center space-y-6 relative z-10 max-w-3xl mx-auto mb-24">
          <div>
            <TypewriterEffectSmooth words={words} />
          </div>

          <motion.p
            className="text-xl text-foreground"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Multi-collateralized Lending DApp. Diversify your collateral and mint stablecoins for your financial needs.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Link href="/app">
              <Button className="px-8 py-6 text-lg rounded-full">
                Launch App
                <ArrowRight className="ml-2" />
              </Button>
            </Link>
          </motion.div>
        </div>

        {/* Features Section with Focus Cards */}
        <motion.div
          className="w-full relative z-10"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.6 }}
        >
          <FocusCards cards={features} />
        </motion.div>
      </main>
    </>
  );
}
