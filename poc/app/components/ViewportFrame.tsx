"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Info, Minus, Orbit, Plus, Redo2, Undo2, PersonStanding } from "lucide-react";
import { IconButton, cx } from "./ui";
import { useScene, useHistory, undo, redo } from "../engine/scene/store";
import * as THREE from "three";
import { currentFps, dollyBy, renderStats } from "./Viewport";

const Viewport = dynamic(() => import("./Viewport"), { ssr: false });

/** The centre region: the 3D canvas plus its floating glass furniture. */
export default function ViewportFrame() {
  const mode = useScene((s) => s.mode);
  const setMode = useScene((s) => s.setMode);
  const placing = useScene((s) => s.placingCatalogId);
  const { canUndo, canRedo } = useHistory();

  return (
    <section className="relative flex-1 overflow-hidden bg-viewport">
      <Viewport />

      {/* Top-centre pill toolbar */}
      <div className="glass absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full px-2 py-1.5 shadow-lg">
        <IconButton icon={Orbit} label="Orbit (1)" active={mode === "orbit"} onClick={() => setMode("orbit")} className="rounded-full" />
        <IconButton
          icon={PersonStanding}
          label="Walkthrough (2)"
          active={mode === "walk"}
          onClick={() => setMode("walk")}
          className="rounded-full"
        />
        <span className="mx-1 h-4 w-px bg-border-subtle" />
        <IconButton icon={Undo2} label="Undo (⌘Z)" onClick={undo} disabled={!canUndo} className="rounded-full" />
        <IconButton icon={Redo2} label="Redo (⇧⌘Z)" onClick={redo} disabled={!canRedo} className="rounded-full" />
      </div>

      {/* Bottom-left hint chip */}
      <div className="glass pointer-events-none absolute bottom-4 left-4 z-10 flex items-center gap-2 rounded-full px-3 py-1.5">
        <Info size={13} strokeWidth={1.7} className="text-text-secondary" />
        <span className="text-[11px] text-text-secondary">{hint(mode, Boolean(placing))}</span>
      </div>

      {/* Bottom-right: fps + zoom */}
      <div className="absolute bottom-4 right-4 z-10 flex items-center gap-3">
        <FpsChip />
        <div className="glass flex overflow-hidden rounded-md">
          <button
            onClick={() => dollyBy(1.18)}
            aria-label="Zoom out"
            className="border-r border-border-subtle p-1.5 text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-text-primary cursor-pointer"
          >
            <Minus size={16} strokeWidth={1.8} />
          </button>
          <button
            onClick={() => dollyBy(0.85)}
            aria-label="Zoom in"
            className="p-1.5 text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-text-primary cursor-pointer"
          >
            <Plus size={16} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      <DebugOverlay />

      {mode === "walk" ? (
        <div className="glass pointer-events-none absolute left-1/2 top-20 z-10 -translate-x-1/2 rounded-full px-4 py-2 text-[12px] text-text-secondary">
          Click the viewport to look around · WASD to walk · Esc to exit
        </div>
      ) : null}
    </section>
  );
}

function hint(mode: string, placing: boolean) {
  if (mode === "walk") return "WASD to walk · Shift to jog · Esc to exit";
  if (placing) return "Click the floor to place · Shift-click to place several";
  return "Click an item to select · drag to move · R rotates · Del removes";
}

/** Polls outside React state — an fps counter must not itself cost frames. */
function FpsChip() {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      if (t - last > 250 && ref.current) {
        last = t;
        const fps = currentFps();
        ref.current.textContent = `${fps} fps`;
        ref.current.dataset.low = String(fps < 30);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div
      ref={ref}
      className={cx(
        "glass rounded-md px-2 py-1 text-[12px] tabular text-text-secondary",
        "data-[low=true]:text-warning",
      )}
    >
      — fps
    </div>
  );
}

/**
 * `?debug=1` overlay — the performance guardrails from poc/docs/03 § Performance,
 * on screen instead of in a profiler. Not shipped in the demo path.
 */
function DebugOverlay() {
  const model = useScene((s) => s.model);
  const rooms = useScene((s) => s.doc.rooms);
  const activeRoomId = useScene((s) => s.activeRoomId);
  const [on, setOn] = React.useState(false);
  const ref = React.useRef<HTMLPreElement>(null);

  React.useEffect(() => {
    setOn(new URLSearchParams(window.location.search).get("debug") === "1");
  }, []);

  React.useEffect(() => {
    if (!on) return;
    const t = setInterval(() => {
      const s = renderStats();
      if (ref.current)
        ref.current.textContent = `${s.calls} draw calls\n${s.triangles.toLocaleString()} tris drawn\ncamera ${s.camera}`;
    }, 500);
    return () => clearInterval(t);
  }, [on]);

  if (!on || !model) return null;
  const placed = Object.values(rooms).reduce((n, r) => n + r.items.length, 0);
  const fmt = (v: THREE.Vector3) => `${v.x.toFixed(1)}, ${v.y.toFixed(1)}, ${v.z.toFixed(1)}`;
  const shellBox = new THREE.Box3().setFromObject(model.shell);
  const active = model.rooms.find((r) => r.id === activeRoomId) ?? model.rooms[0];

  return (
    <div className="glass absolute left-4 top-4 z-10 rounded-md px-3 py-2 text-[11px] leading-4 text-text-secondary">
      <div className="mb-1 font-semibold uppercase tracking-[0.05em] text-text-primary">Debug</div>
      <pre className="tabular font-[inherit]">
        {[
          `${model.stats.meshes} shell meshes`,
          `${model.stats.triangles.toLocaleString()} shell tris`,
          `ingest ${model.stats.ingestMs} ms`,
          `rooms ${model.rooms.length}${model.stats.realRooms ? "" : " (pseudo)"}`,
          `items ${placed}`,
          `shell min ${fmt(shellBox.min)}`,
          `shell size ${fmt(shellBox.getSize(new THREE.Vector3()))}`,
          active ? `room "${active.name}"` : "",
          active ? `  min  ${fmt(active.box.min)}` : "",
          active ? `  size ${fmt(active.box.getSize(new THREE.Vector3()))}` : "",
        ]
          .filter(Boolean)
          .join("\n")}
      </pre>
      <pre ref={ref} className="tabular mt-1 border-t border-border-subtle pt-1 font-[inherit]" />
    </div>
  );
}
