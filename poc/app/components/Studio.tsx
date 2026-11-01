"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useScene } from "../engine/scene/store";
import TopBar from "./TopBar";
import LeftSidebar from "./LeftSidebar";
import RightSidebar from "./RightSidebar";
import ViewportFrame from "./ViewportFrame";
import ResultView from "./ResultView";
import ConceptLightbox from "./ConceptLightbox";
import Toasts from "./Toasts";
import { snapRotation } from "../engine/editor/placement";

/** S2 — the studio. Fixed-fluid-fixed: 240px / viewport / 300px under a 56px bar. */
export default function Studio() {
  const router = useRouter();
  const model = useScene((s) => s.model);
  const showResult = useScene((s) => s.showResult);

  // Deep link straight to /studio with nothing loaded: send them to the drop zone.
  React.useEffect(() => {
    if (!model) router.replace("/");
  }, [model, router]);

  useKeyboardShortcuts();

  if (!model) return <div className="grid h-screen place-items-center text-[13px] text-text-secondary">No model loaded — returning…</div>;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <TopBar />
      <main className="flex h-[calc(100vh-56px)] flex-1 overflow-hidden">
        <LeftSidebar />
        <ViewportFrame />
        <RightSidebar />
      </main>
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
