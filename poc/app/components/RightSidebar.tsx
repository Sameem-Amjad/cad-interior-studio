"use client";

import * as React from "react";
import { RotateCw, Search, Trash2, X } from "lucide-react";
import { Chip, EmptyState, PanelTitle, Toggle, cx, inputClass } from "./ui";
import { useScene } from "../engine/scene/store";
import { CATALOG, CATEGORIES, FINISHES, byId, type Category } from "../data/catalog";
import { thumbnailFor } from "../engine/render/thumbnails";
import { clampToRoom, snapRotation } from "../engine/editor/placement";
import StylePanel from "./StylePanel";
import type { Vec3 } from "../engine/scene/schema";

export default function RightSidebar() {
  const tab = useScene((s) => s.rightTab);
  const setTab = useScene((s) => s.setRightTab);
  const selected = useScene((s) => s.selectedItemId);

  // Selecting something swings the panel to the inspector; the tabs stay usable.
  const effective = selected && tab === "inspector" ? "inspector" : tab;

  return (
    <aside className="z-40 flex h-full w-[300px] shrink-0 flex-col border-l border-border-subtle bg-surface">
      <div className="flex gap-4 border-b border-border-subtle px-4 pt-2">
        {(["catalog", "style"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cx(
              "border-b-2 px-2 pb-2 text-[13px] capitalize transition-colors cursor-pointer",
              effective === t
                ? "border-primary font-medium text-primary"
                : "border-transparent text-on-surface-variant hover:text-text-primary",
            )}
          >
            {t}
          </button>
        ))}
        {selected ? (
          <button
            onClick={() => setTab("inspector")}
            className={cx(
              "border-b-2 px-2 pb-2 text-[13px] transition-colors cursor-pointer",
              effective === "inspector"
                ? "border-primary font-medium text-primary"
                : "border-transparent text-on-surface-variant hover:text-text-primary",
            )}
          >
            Inspector
          </button>
        ) : null}
      </div>

      {effective === "catalog" ? <CatalogPanel /> : effective === "style" ? <StylePanel /> : <InspectorPanel />}
    </aside>
  );
}

// ── Catalog ────────────────────────────────────────────────────────────────

function CatalogPanel() {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<"All" | Category>("All");
  const placing = useScene((s) => s.placingCatalogId);
  const setPlacing = useScene((s) => s.setPlacing);

  const results = CATALOG.filter(
    (i) =>
      (category === "All" || i.category === category) &&
      (query.trim() === "" ||
        `${i.name} ${i.tag} ${i.category} ${i.styles.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase())),
  );

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div className="relative w-full">
        <Search size={16} strokeWidth={1.7} className="pointer-events-none absolute left-2.5 top-2 text-text-secondary" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products…"
          className={cx(inputClass, "pl-9")}
        />
      </div>

      <div className="flex shrink-0 gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((c) => (
          <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
            {c}
          </Chip>
        ))}
      </div>

      {results.length === 0 ? (
        <EmptyState icon={Search}>No items match — try “sofa”</EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {results.map((item) => (
            <button
              key={item.id}
              onClick={() => setPlacing(placing === item.id ? null : item.id)}
              className={cx(
                "relative flex cursor-pointer flex-col gap-2 rounded-lg border bg-surface-dim p-2 text-left transition-colors",
                placing === item.id ? "border-primary" : "border-border-subtle hover:border-primary/50",
              )}
            >
              {placing === item.id ? (
                <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-primary text-[11px] font-semibold text-white shadow">
                  +
                </span>
              ) : null}
              <span className="grid aspect-square place-items-center overflow-hidden rounded-md bg-surface-low">
                <Thumbnail id={item.id} name={item.name} />
              </span>
              <span className="flex flex-col">
                <span className="truncate text-[13px] font-medium">{item.name}</span>
                <span className="mt-0.5 truncate text-[11px] text-text-secondary">{item.tag}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <p className="mt-auto pt-2 text-[11px] leading-4 text-text-secondary">
        Click a card, then click the floor. Shift-click to place several in a row.
      </p>
    </div>
  );
}

/** Thumbnails are rendered from the real geometry on first paint, then cached. */
function Thumbnail({ id, name }: { id: string; name: string }) {
  const [src, setSrc] = React.useState<string | null>(null);
  React.useEffect(() => {
    let alive = true;
    // Off the critical path: one WebGL render per card would jank the panel open.
    const handle = requestAnimationFrame(() => {
      try {
        const url = thumbnailFor(id);
        if (alive) setSrc(url);
      } catch {
        /* no WebGL — the initials placeholder below is fine */
      }
    });
    return () => {
      alive = false;
      cancelAnimationFrame(handle);
    };
  }, [id]);

  if (!src) return <span className="text-[11px] text-text-secondary">···</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={name} className="h-full w-full object-contain p-1" draggable={false} />;
}

// ── Inspector (S2b) ────────────────────────────────────────────────────────

function InspectorPanel() {
  const selectedId = useScene((s) => s.selectedItemId);
  const doc = useScene((s) => s.doc);
  const activeRoomId = useScene((s) => s.activeRoomId);
  const model = useScene((s) => s.model);
  const snapEnabled = useScene((s) => s.snapEnabled);

  const item = activeRoomId ? doc.rooms[activeRoomId]?.items.find((i) => i.id === selectedId) : undefined;
  const spec = item ? byId.get(item.catalogId) : undefined;
  const roomName = model?.rooms.find((r) => r.id === activeRoomId)?.name ?? "Room";

  if (!item || !spec) {
    return (
      <div className="p-4">
        <EmptyState icon={Search}>Nothing selected — click an item in the viewport.</EmptyState>
      </div>
    );
  }

  const setPos = (axis: 0 | 2, value: number) => {
    const room = model?.rooms.find((r) => r.id === activeRoomId);
    if (!room) return;
    const next: Vec3 = [...item.position] as Vec3;
    next[axis] = value;
    useScene.getState().moveItem(item.id, clampToRoom(spec, next, item.rotationY, room));
  };

  const degrees = Math.round((item.rotationY * 180) / Math.PI);

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[11px] text-text-secondary">
          {roomName} / <span className="text-text-primary">{spec.name}</span>
        </span>
        <button onClick={() => useScene.getState().select(null)} aria-label="Deselect" className="text-text-secondary hover:text-text-primary cursor-pointer">
          <X size={14} strokeWidth={1.8} />
        </button>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface-dim p-2">
        <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-md bg-surface-low">
          <Thumbnail id={spec.id} name={spec.name} />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[13px] font-medium">{spec.name}</span>
          <span className="text-[11px] text-text-secondary">{spec.tag}</span>
          <span className="text-[11px] tabular text-text-secondary">
            {spec.footprint.w.toFixed(2)} × {spec.footprint.d.toFixed(2)} m
          </span>
        </span>
      </div>

      <PanelTitle>Position</PanelTitle>
      <div className="grid grid-cols-2 gap-2">
        {([0, 2] as const).map((axis) => (
          <label key={axis} className="flex flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-[0.04em] text-text-secondary">{axis === 0 ? "X (m)" : "Z (m)"}</span>
            <input
              type="number"
              step={0.05}
              value={item.position[axis].toFixed(2)}
              onChange={(e) => setPos(axis, Number(e.target.value))}
              className={inputClass}
            />
          </label>
        ))}
      </div>

      <PanelTitle>Rotation</PanelTitle>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={-180}
          max={180}
          step={15}
          value={degrees}
          onChange={(e) => useScene.getState().rotateItem(item.id, (Number(e.target.value) * Math.PI) / 180)}
          className="flex-1 accent-[#3b82f6]"
        />
        <span className="w-12 text-right text-[12px] tabular text-text-secondary">{degrees}°</span>
        <button
          onClick={() => useScene.getState().rotateItem(item.id, snapRotation(item.rotationY + Math.PI / 12, true))}
          aria-label="Rotate 15°"
          className="rounded-md p-1.5 text-on-surface-variant hover:bg-surface-high hover:text-text-primary cursor-pointer"
        >
          <RotateCw size={15} strokeWidth={1.8} />
        </button>
      </div>

      <div className="rounded-md border border-border-subtle bg-surface-dim px-2.5 py-1.5">
        <Toggle checked={snapEnabled} onChange={() => useScene.getState().toggleSnap()} label="Snap to grid (5 cm / 15°)" />
      </div>

      <FinishSwatches />

      <button
        onClick={() => useScene.getState().removeItem(item.id)}
        className="mt-auto flex items-center justify-center gap-2 rounded-md border border-danger/40 px-3 py-2 text-[13px] text-danger transition-colors hover:bg-danger/10 cursor-pointer"
      >
        <Trash2 size={15} strokeWidth={1.7} />
        Remove item
      </button>
    </div>
  );
}

/** Shared by the inspector and the style tab — finishes are room-level, not item-level. */
export function FinishSwatches() {
  const activeRoomId = useScene((s) => s.activeRoomId);
  const room = useScene((s) => (s.activeRoomId ? s.doc.rooms[s.activeRoomId] : undefined));
  if (!activeRoomId) return null;

  return (
    <div className="flex flex-col gap-3">
      {(["floor", "wall"] as const).map((kind) => (
        <div key={kind} className="flex flex-col gap-2">
          <PanelTitle>{kind === "floor" ? "Floor finish" : "Wall paint"}</PanelTitle>
          <div className="flex gap-2">
            {FINISHES.filter((f) => f.kind === kind).map((f) => {
              const active = (kind === "floor" ? room?.floorFinishId : room?.wallFinishId) === f.id;
              return (
                <button
                  key={f.id}
                  title={f.name}
                  onClick={() => useScene.getState().setFinish(kind, f.id)}
                  className={cx(
                    "flex flex-1 flex-col items-center gap-1.5 rounded-md border p-2 transition-colors cursor-pointer",
                    active ? "border-primary bg-primary/8" : "border-border-subtle hover:border-outline-variant",
                  )}
                >
                  <span className="h-7 w-full rounded border border-black/20" style={{ background: f.swatch }} />
                  <span className="w-full truncate text-center text-[10px] text-text-secondary">{f.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
