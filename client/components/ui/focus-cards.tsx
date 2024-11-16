"use client";
import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export const Card = React.memo(
  ({
    card,
    index,
    hovered,
    setHovered,
  }: {
    card: Card;
    index: number;
    hovered: number | null;
    setHovered: React.Dispatch<React.SetStateAction<number | null>>;
  }) => (
    <div
      onMouseEnter={() => setHovered(index)}
      onMouseLeave={() => setHovered(null)}
      className={cn(
        "rounded-lg relative overflow-hidden h-60 md:h-72 w-full transition-all duration-300 ease-out p-8",
        "bg-gradient-to-br from-background via-accent/5 to-background border border-accent/10",
        hovered !== null && hovered !== index && "blur-sm scale-[0.98] opacity-50"
      )}
    >
      <div className="h-full flex flex-col justify-between text-center">
        <div
          className={cn(
            "transition-all duration-300 transform",
            hovered === index ? "scale-110" : "scale-100"
          )}
        >
          <card.icon className="w-8 h-8 mx-auto text-primary/80" />
        </div>
        <div
          className={cn(
            "transition-all duration-300",
            hovered === index ? "translate-y-0" : "translate-y-8"
          )}
        >
          <h3 className="text-xl md:text-2xl font-medium text-foreground mb-4">
            {card.title}
          </h3>
          <p
            className={cn(
              "text-sm md:text-base text-foreground transition-opacity duration-300",
              hovered === index ? "opacity-100" : "opacity-0"
            )}
          >
            {card.description}
          </p>
        </div>
      </div>
    </div>
  )
);

Card.displayName = "Card";

type Card = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export function FocusCards({ cards }: { cards: Card[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-6xl mx-auto px-4 md:px-8 w-full text-foreground">
      {cards.map((card, index) => (
        <Card
          key={card.title}
          card={card}
          index={index}
          hovered={hovered}
          setHovered={setHovered}
        />
      ))}
    </div>
  );
} 