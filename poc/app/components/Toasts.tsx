"use client";

import { CheckCircle2, CircleAlert, Info, TriangleAlert, X, type LucideIcon } from "lucide-react";
import { cx } from "./ui";
import { useScene, type Toast } from "../engine/scene/store";

/** S6 — the toast side of the error & empty-state set. */
const STYLES: Record<Toast["kind"], { icon: LucideIcon; border: string; tint: string }> = {
  error: { icon: CircleAlert, border: "border-danger", tint: "text-danger" },
  warning: { icon: TriangleAlert, border: "border-warning", tint: "text-warning" },
  success: { icon: CheckCircle2, border: "border-success/60", tint: "text-success" },
  info: { icon: Info, border: "border-border-subtle", tint: "text-primary" },
};

export default function Toasts() {
  const toasts = useScene((s) => s.toasts);
  const dismiss = useScene((s) => s.dismissToast);
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[200] flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4">
      {toasts.map((toast) => {
        const style = STYLES[toast.kind];
        const Icon = style.icon;
        return (
          <div
            key={toast.id}
            className={cx(
              "pointer-events-auto flex items-start gap-3 rounded-lg border bg-surface p-4 shadow-lg shadow-black/40",
              style.border,
            )}
          >
            <Icon size={18} strokeWidth={1.7} className={cx("mt-0.5 shrink-0", style.tint)} />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-[14px] leading-5">{toast.message}</span>
              {toast.action ? (
                <button
                  onClick={() => {
                    toast.action?.run();
                    dismiss(toast.id);
                  }}
                  className="w-fit text-[11px] font-medium text-primary hover:underline cursor-pointer"
                >
                  {toast.action.label}
                </button>
              ) : null}
            </div>
            <button
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss"
              className="shrink-0 text-text-secondary hover:text-text-primary cursor-pointer"
            >
              <X size={14} strokeWidth={1.8} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
