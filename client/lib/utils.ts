/* ------------------ Imports ----------------- */
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import config from "@/lib/config.json";

/* ----------------- Functions ---------------- */
export declare function reverse<T extends Record<PropertyKey, PropertyKey>>(obj: T): Reverse<T>;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function findField(obj: any, name: string) {
  return obj.filter((field: any) => field.field_name === name)[0].value;
}

export function shortenAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 4)}...${address.slice(-6)}`;
}

/* ----------------- Constants ---------------- */
// Util types
type Reverse<T extends Record<PropertyKey, PropertyKey>> = {
  [P in keyof T as T[P]]: P;
};

// Radix Addresses
export const definitionAddress: string = config.dAppDefinitionAddr;
export const borrowerBadge_Resource: string = config.borrowerBadgeAddr;
