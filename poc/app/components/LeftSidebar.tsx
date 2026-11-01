"use client";

import * as React from "react";
import {
  Bath,
  Bed,
  ChevronDown,
  ChevronRight,
  Layers,
  type LucideIcon,
  PaintBucket,
  Sofa,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { PanelTitle, cx } from "./ui";
import { useScene } from "../engine/scene/store";
import { requestFlyTo } from "./Viewport";
import { CATALOG, FINISHES, byId, finishName } from "../data/catalog";
import type { RoomInfo } from "../engine/ingest/types";

/** Left sidebar: ROOMS + DESIGN, 240px, per the Stitch S2 frame. */
export default function LeftSidebar() {
  const model = useScene((s) => s.model);
  const activeRoomId = useScene((s) => s.activeRoomId);
  const rooms = useScene((s) => s.doc.rooms);
  const setActiveRoom = useScene((s) => s.setActiveRoom);
  const [openItems, setOpenItems] = React.useState(true);
  const [openFinishes, setOpenFinishes] = React.useState(false);

  const active = rooms[activeRoomId ?? ""];
  const itemCount = active?.items.length ?? 0;

  const pick = (room: RoomInfo) => {
    setActiveRoom(room.id);
    requestFlyTo(room, useScene.getState().mode === "walk");
  };

  return (
    <aside className="z-40 flex h-full w-60 shrink-0 flex-col border-r border-border-subtle bg-surface">
      <div className="flex-1 overflow-y-auto p-3">
        <PanelTitle className="mb-2 px-3">Rooms</PanelTitle>
        <ul className="space-y-0.5">
          {model?.rooms.map((room) => {
            const isActive = room.id === activeRoomId;
            const count = rooms[room.id]?.items.length ?? 0;
            const Icon = iconFor(room.name);
            return (
              <li key={room.id}>
                <button
                  onClick={() => pick(room)}
                  onDoubleClick={() => requestFlyTo(room)}
                  className={cx(
                    "group flex w-full items-center justify-between rounded border-l-2 px-3 py-1.5 text-left transition-colors cursor-pointer",
                    isActive
                      ? "border-primary bg-surface-highest"
                      : "border-transparent pl-[14px] hover:bg-surface-highest",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Icon size={16} strokeWidth={1.7} className={isActive ? "text-primary" : "text-on-surface-variant"} />
                    <span
                      className={cx(
                        "truncate text-[13px]",
                        isActive ? "font-medium text-primary" : "text-on-surface-variant group-hover:text-text-primary",
                      )}
                    >
                      {room.name}
                    </span>
                  </span>
                  {count > 0 ? (
                    <span className="rounded bg-surface-variant px-1.5 py-0.5 text-[10px] tabular text-text-secondary">{count}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>

        <hr className="mx-3 my-4 border-border-subtle" />

        <PanelTitle className="mb-2 px-3">Design</PanelTitle>
        <div className="space-y-1">
          <Disclosure
            open={openItems}
            onToggle={() => setOpenItems((v) => !v)}
            label={`Placed items (${itemCount})`}
            icon={Layers}
          >
            {itemCount === 0 ? (
              <p className="px-3 py-2 text-[12px] text-text-secondary">Nothing placed in this room yet.</p>
            ) : (
              <ul className="space-y-0.5">
                {active?.items.map((item) => (
                  <ItemRow key={item.id} id={item.id} name={byId.get(item.catalogId)?.name ?? item.catalogId} />
                ))}
              </ul>
            )}
          </Disclosure>

          <Disclosure
            open={openFinishes}
            onToggle={() => setOpenFinishes((v) => !v)}
            label="Finishes"
            icon={PaintBucket}
          >
            <dl className="space-y-1 px-3 py-1 text-[12px]">
              <div className="flex justify-between gap-2">
                <dt className="text-text-secondary">Floor</dt>
                <dd className="truncate">{finishName(active?.floorFinishId) ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-text-secondary">Walls</dt>
                <dd className="truncate">{finishName(active?.wallFinishId) ?? "—"}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-1.5 px-3 pb-2 pt-1">
              {FINISHES.map((f) => (
                <button
                  key={f.id}
                  title={`${f.name} (${f.kind})`}
                  onClick={() => useScene.getState().setFinish(f.kind, f.id)}
                  className={cx(
                    "h-5 w-5 rounded-full border transition-transform hover:scale-110 cursor-pointer",
                    active?.floorFinishId === f.id || active?.wallFinishId === f.id
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border-subtle",
                  )}
                  style={{ background: f.swatch }}
                />
              ))}
            </div>
          </Disclosure>
        </div>
      </div>

      <div className="border-t border-border-subtle px-3 py-2 text-[11px] text-text-secondary">
        {CATALOG.length} demo items · no prices in this PoC
      </div>
    </aside>
  );
}

function ItemRow({ id, name }: { id: string; name: string }) {
  const selected = useScene((s) => s.selectedItemId === id);
  return (
    <li
      className={cx(
        "group flex items-center justify-between rounded px-3 py-1 text-[12px] transition-colors",
        selected ? "bg-primary/12 text-primary" : "text-on-surface-variant hover:bg-surface-highest",
      )}
    >
      <button onClick={() => useScene.getState().select(id)} className="min-w-0 flex-1 truncate text-left cursor-pointer">
        {name}
      </button>
      <button
        onClick={() => useScene.getState().removeItem(id)}
        aria-label={`Remove ${name}`}
        className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-danger cursor-pointer"
      >
        <Trash2 size={13} strokeWidth={1.7} />
      </button>
    </li>
  );
}

function Disclosure({
  open,
  onToggle,
  label,
  icon: Icon,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-[13px] text-on-surface-variant transition-colors hover:bg-surface-highest hover:text-text-primary cursor-pointer"
      >
        {open ? <ChevronDown size={14} strokeWidth={1.8} /> : <ChevronRight size={14} strokeWidth={1.8} />}
        <Icon size={14} strokeWidth={1.7} />
        <span>{label}</span>
      </button>
      {open ? <div className="pb-1">{children}</div> : null}
    </div>
  );
}

/** Room icons are a display nicety — matched by name, defaulting to a sofa. */
function iconFor(name: string): LucideIcon {
  const n = name.toLowerCase();
  if (n.includes("kitchen") || n.includes("dining")) return UtensilsCrossed;
  if (n.includes("bed")) return Bed;
  if (n.includes("bath") || n.includes("wc") || n.includes("toilet")) return Bath;
  if (n.includes("floor") || n.includes("level") || n.includes("storey")) return Layers;
  return Sofa;
}
