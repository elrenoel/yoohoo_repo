"use client";

import React from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { t as st } from "@/lib/t";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error);
    console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center px-6 text-center">
          <div className="bg-white border border-neutral-200 rounded-2xl p-8 shadow-xs max-w-sm w-full">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-neutral-100 border border-neutral-200 text-neutral-600 mb-5">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h1 className="text-lg font-semibold text-neutral-900 mb-2">
              {st("error.boundaryTitle")}
            </h1>

            <p className="text-xs text-neutral-500 leading-relaxed mb-6">
              {st("error.boundaryMessage")}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => {
                  this.handleReset();
                  window.location.reload();
                }}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{st("error.reload")}</span>
              </button>
              <a
                href="/"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-neutral-200 text-neutral-700 text-xs font-medium hover:bg-neutral-50 transition cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                <span>{st("error.home")}</span>
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
