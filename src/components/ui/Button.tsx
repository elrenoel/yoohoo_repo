import { type ButtonHTMLAttributes, type ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "success";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant of the button. */
  variant?: ButtonVariant;
  /** Size of the button. */
  size?: ButtonSize;
  /** Content to render inside the button. */
  children: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-action-primary text-on-action-primary hover:bg-action-primary-hover shadow-xs dark:shadow-none active:scale-[0.98]",
  secondary:
    "bg-surface border border-border text-text-secondary hover:bg-surface-hover",
  danger:
    "bg-danger hover:bg-danger-hover text-on-danger shadow-xs dark:shadow-none active:scale-[0.98]",
  success:
    "bg-success hover:bg-success-hover text-on-success shadow-xs dark:shadow-none active:scale-[0.98]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-xs",
  lg: "px-5 py-2.5 text-xs sm:text-sm",
};

/**
 * Standardized Button component with consistent styling.
 *
 * Variants:
 * - primary: Dark background (neutral-900), white text — main CTAs
 * - secondary: White background with border — secondary actions
 * - danger: Rose background — destructive actions (delete, permanent delete)
 * - success: Emerald background — positive actions (submit quiz)
 */
export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
