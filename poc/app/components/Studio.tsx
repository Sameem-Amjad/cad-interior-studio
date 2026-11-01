"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, Sofa, Sparkles } from "lucide-react";
import { useScene } from "../engine/scene/store";
import TopBar from "./TopBar";
import LeftSidebar from "./LeftSidebar";
import RightSidebar from "./RightSidebar";
import ViewportFrame from "./ViewportFrame";
import ResultView from "./ResultView";
import ConceptLightbox from "./ConceptLightbox";
import Toasts from "./Toasts";
import { snapRotation } from "../engine/editor/placement";
import { cx } from "./ui";

/** True below the md breakpoint, where the sidebars become sheets. */
function useNarrow() {
  const [narrow, setNarrow] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return narrow;
}

type Sheet = "rooms" | "panel" | null;

/**
 * S2 — the studio. Fixed-fluid-fixed: 240px / viewport / 300px under a 56px bar.
 * On phones the viewport takes the width and the sidebars open as sheets from a bottom bar.
 */
export default function Studio() {
  const router = useRouter();
  const model = useScene((s) => s.model);
  const showResult = useScene((s) => s.showResult);
  const placing = useScene((s) => s.placingCatalogId);
  const activeRoomId = useScene((s) => s.activeRoomId);
  const rightTab = useScene((s) => s.rightTab);
  const setRightTab = useScene((s) => s.setRightTab);
  const narrow = useNarrow();
  const [sheet, setSheet] = React.useState<Sheet>(null);

  // Arming a catalog card or picking a room hands the screen back to the viewport.
  React.useEffect(() => {
    if (placing) setSheet(null);
  }, [placing]);
  React.useEffect(() => {
    setSheet(null);
  }, [activeRoomId]);

  // Deep link straight to /studio with nothing loaded: send them to the drop zone.
  React.useEffect(() => {
    if (!model) router.replace("/");
  }, [model, router]);

  useKeyboardShortcuts();

  if (!model) return <div className="grid h-screen place-items-center text-[13px] text-text-secondary">No model loaded — returning…</div>;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <TopBar />
      <main className="relative flex h-[calc(100vh-56px)] flex-1 overflow-hidden max-md:h-[calc(100dvh-56px-56px)]">
        {narrow ? (
          <>
            <ViewportFrame />
            {sheet ? (
              <div className="absolute inset-x-0 bottom-0 z-40 h-[62%] overflow-hidden rounded-t-2xl border-t border-border-subtle shadow-2xl">
                {sheet === "rooms" ? <LeftSidebar /> : <RightSidebar />}
              </div>
            ) : null}
          </>
        ) : (
          <>
            <LeftSidebar />
            <ViewportFrame />
            <RightSidebar />
          </>
        )}
      </main>
      {narrow ? (
        <nav className="flex h-14 shrink-0 items-stretch border-t border-border-subtle bg-surface" aria-label="Studio panels">
          {([
            { key: "rooms", label: "Rooms", icon: LayoutGrid, open: () => setSheet(sheet === "rooms" ? null : "rooms") },
            { key: "catalog", label: "Catalog", icon: Sofa, open: () => { setRightTab("catalog"); setSheet(sheet === "panel" && rightTab === "catalog" ? null : "panel"); } },
            { key: "style", label: "Style", icon: Sparkles, open: () => { setRightTab("style"); setSheet(sheet === "panel" && rightTab === "style" ? null : "panel"); } },
          ] as const).map(({ key, label, icon: Icon, open }) => {
            const active = key === "rooms" ? sheet === "rooms" : sheet === "panel" && rightTab === key;
            return (
              <button
                key={key}
                onClick={open}
                aria-pressed={active}
                className={cx("flex flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 text-[11px]", active ? "text-primary" : "text-on-surface-variant")}
              >
                <Icon size={18} strokeWidth={1.7} />
                {label}
              </button>
            );
          })}
        </nav>
      ) : null}
      {showResult ? <ResultView /> : null}
      <ConceptLightbox />
      <Toasts />
    </div>
  );
}

function useKeyboardShortcuts() {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const s = useScene.getState();

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) useScene.temporal.getState().redo();
        else useScene.temporal.getState().undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        s.save();
        s.toast({ kind: "success", message: "Design saved to this browser." });
        return;
      }

      switch (e.key) {
        case "Escape":
          if (s.lightboxIndex !== null) s.openLightbox(null);
          else if (s.showResult) s.setShowResult(false);
          else if (s.placingCatalogId) s.setPlacing(null);
          else if (s.mode === "walk") s.setMode("orbit");
          else s.select(null);
          break;
        case "Delete":
        case "Backspace":
          if (s.selectedItemId) {
            e.preventDefault();
            s.removeItem(s.selectedItemId);
          }
          break;
        case "r":
        case "R": {
          if (!s.selectedItemId) break;
          const item = Object.values(s.doc.rooms)
            .flatMap((r) => r.items)
            .find((i) => i.id === s.selectedItemId);
          if (item) s.rotateItem(item.id, snapRotation(item.rotationY + (e.shiftKey ? -Math.PI / 12 : Math.PI / 12), true));
          break;
        }
        case "1":
          s.setMode("orbit");
          break;
        case "2":
          s.setMode("walk");
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
