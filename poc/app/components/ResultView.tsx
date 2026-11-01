"use client";

import * as React from "react";
import { Download, X } from "lucide-react";
import { Button, PanelTitle, cx } from "./ui";
import { useScene } from "../engine/scene/store";
import { CATALOG, finishName, styleName } from "../data/catalog";
import { download } from "../engine/render/screenshot";
import { captureViewport as capture } from "./Viewport";

/** S5 — result / before & after. */
export default function ResultView() {
  const setShowResult = useScene((s) => s.setShowResult);
  const concepts = useScene((s) => s.concepts);
  const style = useScene((s) => s.style);
  const model = useScene((s) => s.model);
  const activeRoomId = useScene((s) => s.activeRoomId);
  const room = useScene((s) => (s.activeRoomId ? s.doc.rooms[s.activeRoomId] : undefined));

  const [pair, setPair] = React.useState<{ before: string; after: string } | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [split, setSplit] = React.useState(50);
  const [error, setError] = React.useState<string | null>(null);
  const frame = React.useRef<HTMLDivElement>(null);
  // This effect mutates the store and restores it a frame later. React's
  // development double-invoke would run the restore against already-swapped
  // state and leave the room empty, so it must run exactly once.
  const captured = React.useRef(false);

  // Capture both halves from the same camera: render the snapshot, grab it,
  // then restore. Temporal is paused so the round-trip leaves no undo entries.
  React.useEffect(() => {
    if (captured.current) return;
    captured.current = true;
    const s = useScene.getState();
    const roomId = s.activeRoomId;
    const snapshot = s.snapshot;
    if (!roomId) return;

    const after = capture({ width: 1400, mime: "image/jpeg", quality: 0.92 });
    if (!after) {
      setError("The 3D viewport isn’t ready yet.");
      return;
    }

    if (!snapshot || snapshot.roomId !== roomId) {
      setPair({ before: after, after });
      return;
    }

    const current = structuredClone(s.doc.rooms[roomId]);
    const temporal = useScene.temporal.getState();
    temporal.pause();
    s.applyRoom(roomId, snapshot.room);

    // Two frames: one for React to commit the swap, one for R3F to draw it.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const before = capture({ width: 1400, mime: "image/jpeg", quality: 0.92 }) ?? after;
        s.applyRoom(roomId, current);
        temporal.resume();
        setPair({ before, after });
      }),
    );
  }, []);

  const onDrag = (e: React.PointerEvent) => {
    if (e.buttons !== 1 || !frame.current) return;
    const rect = frame.current.getBoundingClientRect();
    setSplit(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)));
  };

  const exportShot = () => {
    const url = capture({ width: 2800, mime: "image/png" });
    if (!url) {
      useScene.getState().toast({ kind: "error", message: "Couldn’t export — viewport not ready." });
      return;
    }
    download(url, `${model?.name.replace(/\.[^.]+$/, "") ?? "design"}-2x.png`);
  };

  const roomName = model?.rooms.find((r) => r.id === activeRoomId)?.name ?? "Room";
  const itemCount = room?.items.length ?? 0;
  const breakdown = countByCategory(room?.items ?? []);

  return (
    <div className="fixed inset-0 top-14 z-50 flex bg-background max-md:flex-col max-md:overflow-y-auto">
      <div className="flex flex-1 flex-col overflow-hidden p-6 max-md:min-h-[58vh] max-md:flex-none max-md:p-3">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <h2 className="text-[18px] font-semibold tracking-[-0.01em]">Before &amp; after</h2>
            <span className="text-[13px] text-text-secondary">{roomName}</span>
          </div>
          <button
            onClick={() => setShowResult(false)}
            aria-label="Close result view"
            className="rounded-md p-1.5 text-text-secondary hover:bg-surface-high hover:text-text-primary cursor-pointer"
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>

        <div
          ref={frame}
          onPointerMove={onDrag}
          onPointerDown={onDrag}
          className="relative flex-1 select-none overflow-hidden rounded-lg border border-border-subtle bg-viewport"
        >
          {error ? (
            <div className="grid h-full place-items-center text-[13px] text-text-secondary">{error}</div>
          ) : selected ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selected} alt="Selected concept" className="h-full w-full object-contain" />
          ) : pair ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pair.after} alt="After" className="absolute inset-0 h-full w-full object-contain" />
              <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pair.before} alt="Before" className="h-full w-full object-contain" />
              </div>
              <div className="absolute inset-y-0 w-0.5 cursor-ew-resize bg-primary" style={{ left: `${split}%` }}>
                <span className="absolute left-1/2 top-1/2 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-primary bg-surface text-[10px] text-primary">
                  ↔
                </span>
              </div>
              <span className="glass absolute left-4 top-4 rounded-full px-3 py-1 text-[11px]">Before</span>
              <span className="glass absolute right-4 top-4 rounded-full px-3 py-1 text-[11px]">After</span>
            </>
          ) : (
            <div className="grid h-full place-items-center text-[13px] text-text-secondary">Capturing…</div>
          )}
        </div>

        <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
          <Thumb label="Before / after" active={selected === null} onClick={() => setSelected(null)} src={pair?.before} />
          <Thumb label="Your design" active={selected === pair?.after} onClick={() => setSelected(pair?.after ?? null)} src={pair?.after} />
          {concepts.map((c, i) => (
            <Thumb
              key={c.id}
              label={`${c.placeholder ? "Demo" : "Concept"} ${i + 1}`}
              active={selected === c.url}
              onClick={() => setSelected(c.url)}
              src={c.url}
            />
          ))}
        </div>
      </div>

      <aside className="flex w-[300px] shrink-0 flex-col gap-4 border-l border-border-subtle bg-surface p-4 max-md:w-full max-md:border-l-0 max-md:border-t">
        <PanelTitle>Result</PanelTitle>
        <dl className="flex flex-col gap-2 text-[13px]">
          <Row label="Room" value={roomName} />
          <Row label="Items placed" value={String(itemCount)} />
          <Row label="Floor" value={finishName(room?.floorFinishId)} />
          <Row label="Walls" value={finishName(room?.wallFinishId)} />
          <Row label="Style" value={styleName(style)} />
          <Row label="Source" value={model?.name ?? "—"} />
        </dl>

        {breakdown.length ? (
          <div className="flex flex-col gap-1.5 rounded-lg border border-border-subtle bg-surface-dim p-3">
            <PanelTitle>Breakdown</PanelTitle>
            {breakdown.map(([category, count]) => (
              <div key={category} className="flex justify-between text-[12px]">
                <span className="text-text-secondary">{category}</span>
                <span className="tabular">{count}</span>
              </div>
            ))}
          </div>
        ) : null}

        <Button variant="primary" full icon={Download} onClick={exportShot}>
          Export screenshot (2×)
        </Button>
        <Button variant="outline" full onClick={() => setShowResult(false)}>
          Back to studio
        </Button>

        <p className="mt-auto text-[11px] leading-4 text-text-secondary">
          No prices, no totals — this proof of concept ends exactly where a quotation engine would begin.
        </p>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="min-w-0 truncate text-right">{value}</dd>
    </div>
  );
}

function Thumb({ label, src, active, onClick }: { label: string; src?: string | null; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "flex w-28 shrink-0 flex-col gap-1.5 rounded-md border p-1 text-left transition-colors cursor-pointer",
        active ? "border-primary" : "border-border-subtle hover:border-outline-variant",
      )}
    >
      <span className="grid aspect-video place-items-center overflow-hidden rounded bg-surface-low">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={label} className="h-full w-full object-cover" />
        ) : (
          <span className="text-[10px] text-text-secondary">—</span>
        )}
      </span>
      <span className="truncate px-0.5 text-[10px] text-text-secondary">{label}</span>
    </button>
  );
}

function countByCategory(items: { catalogId: string }[]) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const spec = CATALOG.find((c) => c.id === item.catalogId);
    if (!spec) continue;
    counts.set(spec.category, (counts.get(spec.category) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}
