/**
 * Utility helpers shared across the entire app.
 * clsx handles conditional class merging; twMerge resolves Tailwind
 * conflicts (e.g. two bg-* utilities on the same element).
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class names safely.
 * Using both clsx and twMerge means callers can pass arrays, objects,
 * and conditionals while still getting proper Tailwind deduplication.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
