"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Download, Sparkles, X } from "lucide-react";
import { Button } from "./ui";
import { useScene } from "../engine/scene/store";
import { download } from "../engine/render/screenshot";

/** S4 — concept lightbox over a dimmed studio. */
export default function ConceptLightbox() {
  const index = useScene((s) => s.lightboxIndex);
  const concepts = useScene((s) => s.concepts);
  const open = useScene((s) => s.openLightbox);

  React.useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") open((index + 1) % concepts.length);
      if (e.key === "ArrowLeft") open((index - 1 + concepts.length) % concepts.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, concepts.length, open]);

  if (index === null || !concepts[index]) return null;
  const concept = concepts[index];

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-8 backdrop-blur-sm"
      onClick={() => open(null)}
    >
      <div
        className="relative flex max-h-full w-full max-w-5xl gap-0 overflow-hidden rounded-lg border border-border-subtle bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex-1 bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={concept.url} alt={concept.label} className="max-h-[75vh] w-full object-contain" />
          <span className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[11px] text-white/85 backdrop-blur-sm">
            <Sparkles size={12} />
            {concept.placeholder ? "Demo render — style grade, not AI" : "AI concept — inspiration"}
          </span>
        </div>

        <div className="flex w-64 shrink-0 flex-col gap-4 border-l border-border-subtle p-4">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[13px] font-medium">{concept.label}</span>
            <button onClick={() => open(null)} aria-label="Close" className="text-text-secondary hover:text-text-primary cursor-pointer">
              <X size={16} strokeWidth={1.8} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={ChevronLeft}
              onClick={() => open((index - 1 + concepts.length) % concepts.length)}
              aria-label="Previous"
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={ChevronRight}
              onClick={() => open((index + 1) % concepts.length)}
              aria-label="Next"
            >
              Next
            </Button>
          </div>

          <p className="text-[11px] leading-4 text-text-secondary">
            Inspiration only — the items shown are not products, and nothing here is priced.
          </p>

          <div className="mt-auto flex flex-col gap-2">
            <Button variant="primary" full icon={Download} onClick={() => download(concept.url, `${concept.id}.png`)}>
              Download
            </Button>
            <Button
              full
              onClick={() => {
                useScene.getState().setRightTab("style");
                open(null);
              }}
            >
              Back to studio
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
