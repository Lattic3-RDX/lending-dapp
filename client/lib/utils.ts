/* ------------------ Imports ----------------- */
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import config from "@/lib/config.json";

/* ----------------- Functions ---------------- */
export declare function reverse<T extends Record<PropertyKey, PropertyKey>>(obj: T): Reverse<T>;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function findField(obj: any, field: string) {
  return obj.filter((field: any) => field.field_name === field)[0].value;
}

/* ----------------- Constants ---------------- */
// Util types
type Reverse<T extends Record<PropertyKey, PropertyKey>> = {
  [P in keyof T as T[P]]: P;
};

// Radix Addresses
export const definitionAddress: string = config.dAppDefinitionAddr;
export const borrowerBadge_Resource: string = config.borrowerBadgeAddr;
