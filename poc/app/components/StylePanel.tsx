"use client";

import * as React from "react";
import { Bot, RefreshCw, Sparkles, ZoomIn } from "lucide-react";
import { Button, PanelTitle, ProgressBar, cx, inputClass } from "./ui";
import { useScene, type StyleId } from "../engine/scene/store";
import { STYLES } from "../data/catalog";
import { hashRoom } from "../engine/scene/schema";
import { captureViewport } from "./Viewport";
import { generateConcepts, readCache } from "../lib/concepts";
import { autoStyleRoom } from "../lib/autostyle";
import { FinishSwatches } from "./RightSidebar";

/** S3 — the AI Optimize tab. Non-blocking: the editor stays live while it runs. */
export default function StylePanel() {
  const style = useScene((s) => s.style);
  const setStyle = useScene((s) => s.setStyle);
  const generating = useScene((s) => s.generating);
  const concepts = useScene((s) => s.concepts);
  const activeRoomId = useScene((s) => s.activeRoomId);
  const room = useScene((s) => (s.activeRoomId ? s.doc.rooms[s.activeRoomId] : undefined));

  const [extra, setExtra] = React.useState("");
  const [elapsed, setElapsed] = React.useState(0);
  const [note, setNote] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState<string | null>(null);
  const [autoStyling, setAutoStyling] = React.useState(false);
  const abort = React.useRef<AbortController | null>(null);

  const hash = hashRoom(room);

  // Swapping style shows the cached set for that style instantly, if we have one.
  React.useEffect(() => {
    const cached = readCache(hash, style);
    useScene.getState().setConcepts(cached ?? []);
    setNote(cached?.some((c) => c.placeholder) ? DEMO_NOTE : null);
    setFailed(null);
  }, [style, hash]);

  React.useEffect(() => {
    if (!generating) return;
    const started = Date.now();
    const t = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 500);
    return () => clearInterval(t);
  }, [generating]);

  const run = async () => {
    const s = useScene.getState();
    const image = captureViewport({ width: 1024, mime: "image/jpeg", quality: 0.9 });
    if (!image) {
      s.toast({ kind: "error", message: "Couldn’t capture the viewport." });
      return;
    }
    setFailed(null);
    setNote(null);
    s.setGenerating(true);
    abort.current = new AbortController();
    try {
      const result = await generateConcepts(image, style, hash, extra, abort.current.signal);
      s.setConcepts(result.concepts);
      setNote(result.note ?? null);
      if (!result.placeholder) s.toast({ kind: "success", message: `${result.concepts.length} concepts ready.` });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setFailed(err instanceof Error ? err.message : "Concept generation failed.");
    } finally {
      s.setGenerating(false);
      abort.current = null;
    }
  };

  const runAutoStyle = async () => {
    const s = useScene.getState();
    setAutoStyling(true);
    try {
      const outcome = await autoStyleRoom(style);
      s.toast({
        kind: "success",
        message:
          outcome.source === "claude"
            ? `Claude restyled the room — ${outcome.applied} items. ${outcome.rationale}`
            : `Applied a local ${style} layout (${outcome.applied} items) — no Claude key configured.`,
      });
    } catch (err) {
      s.toast({ kind: "error", message: err instanceof Error ? err.message : "Auto-style failed." });
    } finally {
      setAutoStyling(false);
    }
  };

  if (!activeRoomId) return <div className="p-4 text-[13px] text-text-secondary">Select a room first.</div>;

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-center justify-between">
        <PanelTitle>AI Optimize</PanelTitle>
        <span className="flex items-center gap-1 rounded border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
          <Sparkles size={11} strokeWidth={2} />
          {STYLES.find((s) => s.id === style)?.name}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {STYLES.map((s) => (
          <button
            key={s.id}
            onClick={() => setStyle(s.id as StyleId)}
            className={cx(
              "flex flex-col gap-2 rounded-lg border p-2 text-left transition-colors cursor-pointer",
              style === s.id ? "border-primary bg-primary/8" : "border-border-subtle hover:border-outline-variant",
            )}
          >
            <span className="flex h-8 overflow-hidden rounded">
              {s.swatches.map((c) => (
                <span key={c} className="flex-1" style={{ background: c }} />
              ))}
            </span>
            <span className="text-[13px] font-medium">{s.name}</span>
            <span className="text-[10px] leading-3 text-text-secondary">{s.blurb}</span>
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] uppercase tracking-[0.04em] text-text-secondary">Prompt adjustments</span>
        <textarea
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          placeholder="Optional — e.g. “make it darker”, “add more plants”"
          className={cx(inputClass, "h-16 resize-none")}
        />
      </label>

      <Button variant="primary" full icon={Sparkles} onClick={run} disabled={generating}>
        {generating ? "Generating…" : concepts.length ? "Regenerate 4 concepts" : "Generate 4 concepts"}
      </Button>

      {generating ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-dim p-3">
          <div className="grid grid-cols-2 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="shimmer relative aspect-square overflow-hidden rounded-md bg-surface-low" />
            ))}
          </div>
          <ProgressBar value={Math.min(0.95, elapsed / 45)} />
          <div className="flex items-center justify-between text-[11px] text-text-secondary">
            <span>Generating {STYLES.find((s) => s.id === style)?.name} concepts… {elapsed}s</span>
            <button onClick={() => abort.current?.abort()} className="hover:text-text-primary cursor-pointer">
              Cancel
            </button>
          </div>
          <p className="text-[11px] text-text-secondary">You can keep editing meanwhile.</p>
        </div>
      ) : null}

      {failed ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border-subtle bg-surface-dim p-6 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full border border-border-subtle bg-surface-high">
            <Bot size={24} strokeWidth={1.4} className="text-danger" />
          </span>
          <div className="flex flex-col gap-1">
            <h3 className="text-[16px] font-semibold">Concept generation failed.</h3>
            <p className="text-[13px] text-text-secondary">Your design is safe.</p>
            <p className="mt-1 text-[11px] text-text-secondary">{failed}</p>
          </div>
          <Button variant="outline" icon={RefreshCw} onClick={run}>
            Retry
          </Button>
        </div>
      ) : null}

      {concepts.length > 0 && !generating ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            {concepts.map((c, i) => (
              <button
                key={c.id}
                onClick={() => useScene.getState().openLightbox(i)}
                className="group relative aspect-square overflow-hidden rounded-lg border border-border-subtle transition-colors hover:border-primary cursor-pointer"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.url} alt={c.label} className="h-full w-full object-cover" />
                <span className="absolute bottom-1 right-1 flex items-center gap-0.5 rounded border border-white/10 bg-black/60 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-white/80 backdrop-blur-sm">
                  <Sparkles size={9} />
                  {c.placeholder ? "demo" : "AI concept"}
                </span>
                <span className="absolute inset-0 grid place-items-center bg-primary/20 opacity-0 backdrop-blur-[2px] transition-opacity group-hover:opacity-100">
                  <span className="grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-black/50 text-white">
                    <ZoomIn size={18} strokeWidth={1.8} />
                  </span>
                </span>
              </button>
            ))}
          </div>
          <p className="text-center text-[12px] text-text-secondary">Inspiration only — items shown are not products.</p>
          {note ? <p className="rounded-md border border-warning/30 bg-warning/8 p-2 text-[11px] text-warning">{note}</p> : null}
        </div>
      ) : null}

      <div className="mt-2 border-t border-border-subtle pt-4">
        <Button variant="outline" full icon={Bot} onClick={runAutoStyle} disabled={autoStyling}>
          {autoStyling ? "Restyling the room…" : "Auto-style this room (beta)"}
        </Button>
        <p className="mt-2 text-[11px] leading-4 text-text-secondary">
          Replaces this room’s furniture and finishes with a {STYLES.find((s) => s.id === style)?.name} layout picked from the
          demo catalog. One undo step.
        </p>
      </div>

      <div className="mt-2 border-t border-border-subtle pt-4">
        <FinishSwatches />
      </div>
    </div>
  );
}

const DEMO_NOTE =
  "Demo mode: no image-generation key is configured, so these are style-graded views of your own render — not AI output.";
