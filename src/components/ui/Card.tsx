import { type HTMLAttributes, type ReactNode } from "react";

type CardVariant = "default" | "compact" | "list" | "dialog" | "centered";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Visual variant of the card. */
  variant?: CardVariant;
  /** Content to render inside the card. */
  children: ReactNode;
}

const variantClasses: Record<CardVariant, string> = {
  default: "bg-white border border-neutral-200 rounded-2xl p-8 shadow-xs",
  compact: "bg-white border border-neutral-200 rounded-2xl p-6 shadow-xs",
  list: "bg-white border border-neutral-200 hover:border-neutral-400 rounded-xl p-5 shadow-2xs transition",
  dialog:
    "bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 shadow-lg w-full max-w-sm",
  centered:
    "bg-white border border-neutral-200 rounded-2xl p-10 text-center shadow-xs",
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
