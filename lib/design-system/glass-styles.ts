/**
 * Glass Morphism Design System
 *
 * Apple-style glassmorphism utilities for Protocol Banks dashboard
 * Provides consistent styling across all dashboard components
 */

import { type ClassValue } from "clsx"

/**
 * Glass effect base styles
 */
export const glassEffects = {
  /** Primary glass effect with strong blur */
  primary: "backdrop-blur-[20px] backdrop-saturate-[1.4]",
  /** Secondary glass effect with medium blur */
  secondary: "backdrop-blur-[12px] backdrop-saturate-[1.2]",
  /** Subtle glass effect with light blur */
  subtle: "backdrop-blur-[8px] backdrop-saturate-[1.1]",
  /** Intense glass effect for modals/overlays */
  intense: "backdrop-blur-[40px] backdrop-saturate-[1.6]",
} as const

/**
 * Glass card background colors
 */
export const glassBackgrounds = {
  light: {
    /** Primary card background (70% opacity) */
    primary: "bg-white/70",
    /** Secondary card background (50% opacity) */
    secondary: "bg-white/50",
    /** Subtle card background (30% opacity) */
    subtle: "bg-white/30",
    /** Tinted backgrounds for semantic colors */
    success: "bg-green-50/60",
    warning: "bg-yellow-50/60",
    error: "bg-red-50/60",
    info: "bg-blue-50/60",
  },
  dark: {
    /** Primary card background (70% opacity) */
    primary: "bg-slate-900/70",
    /** Secondary card background (50% opacity) */
    secondary: "bg-slate-800/50",
    /** Subtle card background (30% opacity) */
    subtle: "bg-slate-700/30",
    /** Tinted backgrounds for semantic colors */
    success: "bg-green-950/60",
    warning: "bg-yellow-950/60",
    error: "bg-red-950/60",
    info: "bg-blue-950/60",
  },
} as const

/**
 * Glass border styles
 */
export const glassBorders = {
  light: {
    /** Standard border for light mode */
    default: "border border-gray-200/60",
    /** Strong border for emphasis */
    strong: "border border-gray-300/60",
    /** Subtle border */
    subtle: "border border-gray-200/40",
    /** Primary branded border */
    primary: "border border-primary/20",
  },
  dark: {
    /** Standard border for dark mode */
    default: "border border-white/10",
    /** Strong border for emphasis */
    strong: "border border-white/20",
    /** Subtle border */
    subtle: "border border-white/5",
    /** Primary branded border */
    primary: "border border-primary/30",
  },
} as const

/**
 * Glass shadow effects
 */
export const glassShadows = {
  /** Default shadow for glass cards */
  default: "shadow-[0_4px_24px_rgba(0,0,0,0.04)]",
  /** Large shadow for elevated cards */
  lg: "shadow-[0_8px_32px_rgba(0,0,0,0.08)]",
  /** Extra large shadow for modals */
  xl: "shadow-[0_12px_48px_rgba(0,0,0,0.12)]",
  /** Glow effect with primary color */
  glow: "shadow-[0_0_24px_rgba(var(--primary-rgb),0.15)]",
  /** Inner shadow for pressed state */
  inner: "shadow-[inset_0_2px_8px_rgba(0,0,0,0.06)]",
} as const

/**
 * Complete glass card variants
 */
export const glassCard = {
  /** Default glass card - most commonly used */
  default: [
    // Background & blur
    glassEffects.primary,
    "bg-white/70 dark:bg-slate-900/70",
    // Border - use visible gray in light mode, subtle white in dark mode
    "border border-gray-200/60 dark:border-white/10",
    // Shadow
    glassShadows.default,
    // Border radius
    "rounded-xl",
    // Transition
    "transition-all duration-300",
  ].join(" "),

  /** Primary branded glass card */
  primary: [
    glassEffects.primary,
    "bg-primary/5 dark:bg-primary/10",
    "border border-primary/20 dark:border-primary/30",
    glassShadows.default,
    "rounded-xl",
    "transition-all duration-300",
  ].join(" "),

  /** Success state glass card */
  success: [
    glassEffects.secondary,
    "bg-green-50/60 dark:bg-green-950/60",
    "border border-green-500/20 dark:border-green-500/30",
    glassShadows.default,
    "rounded-xl",
    "transition-all duration-300",
  ].join(" "),

  /** Warning state glass card */
  warning: [
    glassEffects.secondary,
    "bg-yellow-50/60 dark:bg-yellow-950/60",
    "border border-yellow-500/20 dark:border-yellow-500/30",
    glassShadows.default,
    "rounded-xl",
    "transition-all duration-300",
  ].join(" "),

  /** Error state glass card */
  error: [
    glassEffects.secondary,
    "bg-red-50/60 dark:bg-red-950/60",
    "border border-red-500/20 dark:border-red-500/30",
    glassShadows.default,
    "rounded-xl",
    "transition-all duration-300",
  ].join(" "),

  /** Info state glass card */
  info: [
    glassEffects.secondary,
    "bg-blue-50/60 dark:bg-blue-950/60",
    "border border-blue-500/20 dark:border-blue-500/30",
    glassShadows.default,
    "rounded-xl",
    "transition-all duration-300",
  ].join(" "),

  /** Subtle glass card with less opacity */
  subtle: [
    glassEffects.subtle,
    "bg-white/50 dark:bg-slate-800/50",
    "border border-gray-200/40 dark:border-white/5",
    "shadow-sm",
    "rounded-lg",
    "transition-all duration-300",
  ].join(" "),
} as const

/**
 * Glass card interactive states
 */
export const glassInteractive = {
  /** Hover effect for cards */
  hover: [
    "hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)]",
    "hover:scale-[1.01]",
    "hover:border-gray-300/60 dark:hover:border-white/20",
  ].join(" "),

  /** Active/pressed state */
  active: [
    "active:scale-[0.99]",
    glassShadows.inner,
  ].join(" "),

  /** Focus ring with primary color */
  focus: [
    "focus-visible:outline-none",
    "focus-visible:ring-4",
    "focus-visible:ring-primary/10",
  ].join(" "),
} as const

/**
 * Glass section styles (for larger content areas)
 */
export const glassSection = {
  /** Default section */
  default: [
    glassEffects.secondary,
    "bg-white/60 dark:bg-slate-900/60",
    "border border-gray-200/40 dark:border-white/5",
    "rounded-2xl",
    "p-6",
  ].join(" "),

  /** With gradient overlay */
  gradient: [
    glassEffects.primary,
    "bg-gradient-to-br from-white/70 via-white/60 to-white/50",
    "dark:from-slate-900/70 dark:via-slate-900/60 dark:to-slate-900/50",
    "border border-gray-200/60 dark:border-white/10",
    "rounded-2xl",
    "p-6",
  ].join(" "),
} as const

/**
 * Icon container glass styles
 */
export const glassIcon = {
  /** Circular icon container */
  circle: {
    default: [
      glassEffects.subtle,
      "p-2.5 rounded-full",
      "bg-primary/10 dark:bg-primary/20",
      "border border-primary/20 dark:border-primary/30",
    ].join(" "),
    success: [
      glassEffects.subtle,
      "p-2.5 rounded-full",
      "bg-green-500/10 dark:bg-green-500/20",
      "border border-green-500/20 dark:border-green-500/30",
    ].join(" "),
    warning: [
      glassEffects.subtle,
      "p-2.5 rounded-full",
      "bg-yellow-500/10 dark:bg-yellow-500/20",
      "border border-yellow-500/20 dark:border-yellow-500/30",
    ].join(" "),
    error: [
      glassEffects.subtle,
      "p-2.5 rounded-full",
      "bg-red-500/10 dark:bg-red-500/20",
      "border border-red-500/20 dark:border-red-500/30",
    ].join(" "),
  },

  /** Square icon container */
  square: {
    default: [
      glassEffects.subtle,
      "p-2 rounded-lg",
      "bg-primary/10 dark:bg-primary/20",
      "border border-primary/20 dark:border-primary/30",
    ].join(" "),
    success: [
      glassEffects.subtle,
      "p-2 rounded-lg",
      "bg-green-500/10 dark:bg-green-500/20",
      "border border-green-500/20 dark:border-green-500/30",
    ].join(" "),
    warning: [
      glassEffects.subtle,
      "p-2 rounded-lg",
      "bg-yellow-500/10 dark:bg-yellow-500/20",
      "border border-yellow-500/20 dark:border-yellow-500/30",
    ].join(" "),
    error: [
      glassEffects.subtle,
      "p-2 rounded-lg",
      "bg-red-500/10 dark:bg-red-500/20",
      "border border-red-500/20 dark:border-red-500/30",
    ].join(" "),
  },
} as const

/**
 * Browser fallback for unsupported backdrop-filter
 */
export const glassFallback = {
  light: "bg-white/95",
  dark: "bg-slate-900/95",
} as const

/**
 * Utility: Check if browser supports backdrop-filter
 */
export function supportsBackdropFilter(): boolean {
  if (typeof window === "undefined") return true // SSR default
  return CSS.supports("backdrop-filter", "blur(20px)") ||
         CSS.supports("-webkit-backdrop-filter", "blur(20px)")
}

/**
 * Utility: Get glass styles with fallback
 */
export function getGlassStyles(variant: keyof typeof glassCard = "default"): string {
  if (typeof window !== "undefined" && !supportsBackdropFilter()) {
    return [
      glassFallback.light,
      `dark:${glassFallback.dark}`,
      "border border-border",
      "rounded-xl",
      glassShadows.default,
    ].join(" ")
  }
  return glassCard[variant]
}

/**
 * Type exports
 */
export type GlassVariant = keyof typeof glassCard
export type GlassIconVariant = keyof typeof glassIcon.circle
