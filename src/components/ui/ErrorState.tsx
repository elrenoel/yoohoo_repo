"use client";

import Link from "next/link";
import { AlertTriangle, Home } from "lucide-react";
import { t as st } from "@/lib/t";

interface ErrorActionButton {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary";
}

interface ErrorStateProps {
  title?: string;
  message?: string;
  actions?: ErrorActionButton[];
  compact?: boolean;
}

export default function ErrorState({
  title,
  message,
  actions,
  compact = false,
}: ErrorStateProps) {
  const containerClass = compact
    ? "w-full"
    : "w-full max-w-sm mx-auto text-center";

  const cardClass = compact
    ? "bg-surface border border-border rounded-2xl p-6 shadow-xs dark:shadow-none"
    : "bg-surface border border-border rounded-2xl p-8 shadow-xs dark:shadow-none";

  return (
    <div className={containerClass}>
      <div className={cardClass}>
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-surface-subtle border border-border text-text-secondary mb-4">
          <AlertTriangle className="w-5 h-5" />
        </div>

        <h2 className="text-base font-semibold text-text mb-1.5">
          {title || st("error.defaultTitle")}
        </h2>

        <p className="text-xs text-text-secondary leading-relaxed max-w-xs mx-auto">
          {message || st("error.defaultMessage")}
        </p>

        {actions && actions.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mt-6">
            {actions.map((action, idx) => {
              const baseClass =
                "inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer";

              const variantClass =
                action.variant === "primary"
                  ? "bg-action-primary text-on-action-primary hover:bg-action-primary-hover shadow-xs dark:shadow-none"
                  : "bg-surface border border-control-border text-text-secondary hover:bg-surface-hover";

              if (action.href) {
                return (
                  <Link
                    key={idx}
                    href={action.href}
                    className={`${baseClass} ${variantClass}`}
                  >
                    {action.label}
                  </Link>
                );
              }

              return (
                <button
                  key={idx}
                  onClick={action.onClick}
                  className={`${baseClass} ${variantClass}`}
                >
                  {action.label}
                </button>
              );
            })}
          </div>
        )}

        {!actions && (
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-accent underline underline-offset-4 transition hover:text-accent-hover"
            >
              <Home className="w-3 h-3" /> {st("error.backToHome")}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export function ErrorStateNotFound({
  title,
  message,
  backHref,
}: {
  title?: string;
  message?: string;
  backHref?: string;
}) {
  return (
    <ErrorState
      title={title || st("error.notFound")}
      message={message || st("error.notFoundMessage")}
      actions={[
        ...(backHref
          ? [
              {
                label: st("error.back"),
                href: backHref,
                variant: "secondary" as const,
              },
            ]
          : []),
        {
          label: st("error.home"),
          href: "/",
          variant: "primary" as const,
        },
      ]}
    />
  );
}

export function ErrorStateLoadFailed({
  title,
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <ErrorState
      title={title || st("error.loadFailed")}
      message={message || st("error.loadFailedMessage")}
      actions={[
        ...(onRetry
          ? [
              {
                label: st("error.retry"),
                onClick: onRetry,
                variant: "primary" as const,
              },
            ]
          : []),
        {
          label: st("error.home"),
          href: "/",
          variant: "secondary" as const,
        },
      ]}
    />
  );
}
