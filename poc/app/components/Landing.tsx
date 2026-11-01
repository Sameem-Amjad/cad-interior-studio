"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Boxes, CloudUpload, FileBox, Info, TriangleAlert } from "lucide-react";
import { Button, ProgressBar, cx } from "./ui";
import { useScene } from "../engine/scene/store";
import { buildSampleBuilding } from "../engine/ingest/sample";
import type { BuildingModel } from "../engine/ingest/types";

/** S1 — Landing / Load a building, including the in-progress conversion state. */

type Phase = { kind: "idle" } | { kind: "loading"; file: string; progress: number; note: string } | { kind: "error"; message: string };

export default function Landing() {
  const router = useRouter();
  const loadModel = useScene((s) => s.loadModel);
  const [phase, setPhase] = React.useState<Phase>({ kind: "idle" });
  const [dragging, setDragging] = React.useState(false);
  const cancelled = React.useRef(false);

  const go = React.useCallback(
    (model: BuildingModel) => {
      loadModel(model);
      // Carry ?debug=1 across so the overlay survives the client-side nav; the
      // store is in memory, so /studio can never be opened cold with a model.
      router.push(`/studio${window.location.search}`);
    },
    [loadModel, router],
  );

  const openSample = React.useCallback(() => {
    setPhase({ kind: "loading", file: "sample-apartment", progress: 0.4, note: "Building the sample…" });
    // One frame so the progress card paints before the (fast) synchronous build.
    requestAnimationFrame(() => go(buildSampleBuilding()));
  }, [go]);

  const handleFile = React.useCallback(
    async (file: File) => {
      cancelled.current = false;
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext !== "ifc" && ext !== "glb" && ext !== "gltf") {
        setPhase({ kind: "error", message: `“${file.name}” isn’t an IFC or GLB file.` });
        return;
      }
      setPhase({ kind: "loading", file: file.name, progress: 0.02, note: "Reading file…" });
      try {
        const buffer = await file.arrayBuffer();
        const onProgress = (p: number, note?: string) => {
          if (cancelled.current) return;
          setPhase({ kind: "loading", file: file.name, progress: p, note: note ?? "Working…" });
        };
        const model =
          ext === "ifc"
            ? await (await import("../engine/ingest/ifc")).loadIfc(buffer, file.name, onProgress)
            : await (await import("../engine/ingest/glb")).loadGlb(buffer, file.name, onProgress);
        if (cancelled.current) return;
        if (!model.stats.realRooms) {
          useScene.getState().toast({
            kind: "warning",
            message: "This file has no room data — showing whole floors instead.",
          });
        }
        go(model);
      } catch (err) {
        if (cancelled.current) return;
        console.error(err);
        setPhase({
          kind: "error",
          message: ext === "ifc" ? "Couldn’t read this file — is it a valid IFC?" : "Couldn’t read this model file.",
        });
      }
    },
    [go],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <header className="flex w-full items-center gap-3 p-4">
        <div className="grid h-8 w-8 place-items-center rounded-md border border-border-subtle bg-surface-high">
          <Boxes size={18} strokeWidth={1.6} className="text-primary" />
        </div>
        <h1 className="text-[18px] font-semibold tracking-[-0.01em]">Studio PoC</h1>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4">
        {phase.kind === "loading" ? (
          <ConvertingCard
            file={phase.file}
            progress={phase.progress}
            note={phase.note}
            onCancel={() => {
              cancelled.current = true;
              setPhase({ kind: "idle" });
            }}
          />
        ) : (
          <div className="flex w-full max-w-[720px] flex-col items-center">
            <label
              onDragEnter={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cx(
                "group relative flex h-80 w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed transition-colors duration-200",
                dragging ? "border-primary bg-surface-low" : "border-border-subtle bg-surface-lowest hover:border-primary hover:bg-surface-low",
              )}
            >
              <input
                type="file"
                accept=".ifc,.glb,.gltf"
                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                  e.target.value = "";
                }}
              />
              <div className="z-0 flex flex-col items-center gap-4 p-8 text-center">
                <div className="grid h-16 w-16 place-items-center rounded-full bg-surface-container transition-transform duration-300 group-hover:scale-110 group-hover:bg-primary/10">
                  <CloudUpload size={32} strokeWidth={1.4} className="text-text-secondary transition-colors group-hover:text-primary" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-[24px] font-semibold leading-8 tracking-[-0.02em]">Drop your building file</h2>
                  <p className="mx-auto max-w-md text-[14px] text-text-secondary">
                    IFC or GLB — converted in your browser, nothing is uploaded to a server
                  </p>
                </div>
              </div>
            </label>

            {phase.kind === "error" ? (
              <div className="mt-6 flex w-full max-w-md items-start gap-3 rounded-lg border border-danger bg-surface p-4">
                <TriangleAlert size={18} strokeWidth={1.6} className="mt-0.5 shrink-0 text-danger" />
                <div className="flex flex-col gap-1.5">
                  <span className="text-[14px]">{phase.message}</span>
                  <button onClick={openSample} className="w-fit text-[11px] font-medium text-primary hover:underline cursor-pointer">
                    Try sample building
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-8 flex w-full flex-row items-center justify-center gap-4">
              <label className="relative">
                <input
                  type="file"
                  accept=".ifc,.glb,.gltf"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(f);
                    e.target.value = "";
                  }}
                />
                <span className="flex h-12 items-center rounded-md border border-border-subtle px-6 text-[12px] font-semibold uppercase tracking-[0.05em] transition-colors hover:bg-surface-container">
                  Browse files
                </span>
              </label>

              <button
                onClick={openSample}
                className="group flex h-12 items-center gap-3 rounded-lg border border-border-subtle bg-surface p-1 pr-4 text-left transition-colors hover:border-primary hover:bg-surface-low cursor-pointer"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md border border-border-subtle bg-surface-highest">
                  <FileBox size={20} strokeWidth={1.4} className="text-on-surface-variant transition-colors group-hover:text-primary" />
                </span>
                <span className="whitespace-nowrap text-[11px] font-medium">Open sample building</span>
              </button>
            </div>

            <div className="mt-6 flex items-center gap-2 text-[11px] text-text-secondary">
              <Info size={13} strokeWidth={1.6} />
              <span>Big IFC files take up to a minute. Everything stays on this machine.</span>
            </div>
          </div>
        )}
      </main>

      <footer className="flex w-full items-center justify-center p-4">
        <p className="text-[11px] text-text-secondary opacity-50">Proof of concept — no account needed</p>
      </footer>
    </div>
  );
}

function ConvertingCard({
  file,
  progress,
  note,
  onCancel,
}: {
  file: string;
  progress: number;
  note: string;
  onCancel: () => void;
}) {
  return (
    <div className="relative flex w-full max-w-md flex-col gap-6 rounded-lg border border-border-subtle bg-surface-container p-6 shadow-lg shadow-black/50">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-border-subtle bg-surface">
          <FileBox size={20} strokeWidth={1.5} className="text-primary" />
        </div>
        <div className="flex flex-1 flex-col overflow-hidden">
          <span className="truncate text-[14px] font-medium">{file}</span>
          <span className="truncate text-[13px] text-text-secondary">{note}</span>
        </div>
        <div className="shrink-0 text-[12px] tabular text-text-secondary">{Math.round(progress * 100)}%</div>
      </div>
      <ProgressBar value={progress} />
      <div className="mt-1 flex justify-center">
        <Button size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
