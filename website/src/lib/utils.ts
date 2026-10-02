import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** The same `cn` the app uses, so vendored components behave identically. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
