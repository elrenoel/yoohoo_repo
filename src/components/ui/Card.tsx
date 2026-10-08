import { type HTMLAttributes, type ReactNode } from "react";

type CardVariant = "default" | "compact" | "list" | "dialog" | "centered";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Visual variant of the card. */
  variant?: CardVariant;
  /** Content to render inside the card. */
  children: ReactNode;
}

const variantClasses: Record<CardVariant, string> = {
  default: "bg-surface border border-border rounded-2xl p-8 shadow-xs dark:shadow-none",
  compact: "bg-surface border border-border rounded-2xl p-6 shadow-xs dark:shadow-none",
  list: "bg-surface border border-border hover:border-border-strong rounded-xl p-5 shadow-2xs dark:shadow-none transition",
  dialog:
    "bg-surface-raised border border-border rounded-2xl p-6 sm:p-8 shadow-lg dark:shadow-none w-full max-w-sm",
  centered:
    "bg-surface border border-border rounded-2xl p-10 text-center shadow-xs dark:shadow-none",
};

/**
 * Reusable Card component with consistent styling.
 *
 * Variants:
 * - default: Standard card with padding (forms, content sections)
 * - compact: Smaller padding (skeletons, compact content)
 * - list: Hover-interactive card for document lists
 * - dialog: Modal dialog card (fixed width, larger shadow)
 * - centered: Centered content card (empty states, error states)
 */
export default function Card({
  variant = "default",
  className = "",
  children,
  ...props
}: CardProps) {
  return (
    <div className={`${variantClasses[variant]} ${className}`} {...props}>
      {children}
    </div>
  );
}
