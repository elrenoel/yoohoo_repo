"use client";

import { Laptop, Moon, Sun, type LucideIcon } from "lucide-react";
import { useTheme } from "next-themes";

type ThemeOption = {
  value: "system" | "light" | "dark";
  label: string;
  icon: LucideIcon;
};

const OPTIONS: ThemeOption[] = [
  { value: "system", label: "Sistem", icon: Laptop },
  { value: "light", label: "Terang", icon: Sun },
  { value: "dark", label: "Gelap", icon: Moon },
];

export default function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="rounded-xl border border-border bg-surface-subtle p-1" aria-label="Tema tampilan">
      <div className="grid grid-cols-3 gap-1">
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const active = theme === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              aria-pressed={active}
              title={`Tema ${label}`}
              className={`inline-flex min-w-0 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-medium transition-colors ${
                active
                  ? "bg-accent-subtle text-accent"
                  : "text-text-muted hover:bg-surface-hover hover:text-text"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
