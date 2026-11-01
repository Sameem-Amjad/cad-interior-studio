"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";

/**
 * The handful of primitives the Stitch screens actually use. Deliberately not
 * shadcn/ui: six screens need six components, and hand-rolling them keeps the
 * design tokens in one place instead of spread across generated files.
 */

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

export function PanelTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3
      className={cx(
        "text-[12px] font-semibold uppercase tracking-[0.05em] text-text-secondary",
        className,
      )}
    >
      {children}
    </h3>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md";
  icon?: LucideIcon;
  full?: boolean;
};

export function Button({ variant = "ghost", size = "md", icon: Icon, full, className, children, ...rest }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer";
  const sizes = { sm: "h-7 px-2.5 text-[12px]", md: "h-9 px-3.5 text-[13px]" };
  const variants = {
    primary: "bg-primary text-white hover:bg-[#2f74e8] active:opacity-90",
    outline: "border border-border-subtle text-text-primary hover:bg-surface-high hover:border-outline-variant",
    ghost: "text-on-surface-variant hover:bg-surface-high hover:text-text-primary",
    danger: "border border-danger/40 text-danger hover:bg-danger/10",
  };
  return (
    <button className={cx(base, sizes[size], variants[variant], full && "w-full", className)} {...rest}>
      {Icon ? <Icon size={size === "sm" ? 14 : 16} strokeWidth={1.75} /> : null}
      {children}
    </button>
  );
}

export function IconButton({
  icon: Icon,
  active,
  label,
  size = 18,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; active?: boolean; label: string; size?: number }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cx(
        "grid place-items-center rounded-md p-1.5 transition-colors cursor-pointer disabled:opacity-35 disabled:pointer-events-none",
        active ? "bg-primary/20 text-primary ring-1 ring-primary/30" : "text-on-surface-variant hover:bg-surface-high hover:text-text-primary",
        className,
      )}
      {...rest}
    >
      <Icon size={size} strokeWidth={1.75} />
    </button>
  );
}

export function Chip({
  active,
  children,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      className={cx(
        "shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors cursor-pointer",
        active
          ? "border-primary/40 bg-primary/15 text-primary"
          : "border-border-subtle bg-surface-container text-on-surface-variant hover:bg-surface-high hover:text-text-primary",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "primary" | "warning" }) {
  const tones = {
    neutral: "bg-surface-variant text-on-surface-variant",
    primary: "bg-primary/12 text-primary ring-1 ring-primary/25",
    warning: "bg-warning/12 text-warning ring-1 ring-warning/25",
  };
  return <span className={cx("rounded px-1.5 py-0.5 text-[11px] font-medium leading-4", tones[tone])}>{children}</span>;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-text-secondary">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-md border border-border-subtle bg-surface-dim px-2.5 py-1.5 text-[13px] text-text-primary tabular placeholder:text-text-secondary outline-none transition-colors focus:border-primary";

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-md px-0.5 py-1 text-[13px] text-on-surface-variant cursor-pointer hover:text-text-primary"
    >
      <span>{label}</span>
      <span
        className={cx(
          "relative h-4.5 w-8 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-surface-highest",
        )}
        style={{ height: 18, width: 32 }}
      >
        <span
          className="absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-transform"
          style={{ transform: `translateX(${checked ? 16 : 2}px)` }}
        />
      </span>
    </button>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full border border-border-subtle bg-surface-dim">
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
        style={{ width: `${Math.max(2, Math.min(100, value * 100))}%` }}
      />
    </div>
  );
}

export function EmptyState({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border-subtle bg-surface-lowest p-8 text-center">
      <Icon size={40} strokeWidth={1.2} className="text-outline-variant" />
      <span className="text-[14px] text-text-secondary">{children}</span>
    </div>
  );
}
