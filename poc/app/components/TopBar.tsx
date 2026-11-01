"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FolderOpen, Save, Sparkles, SplitSquareHorizontal } from "lucide-react";
import { Badge, Button, IconButton } from "./ui";
import { useScene } from "../engine/scene/store";
import { SceneDoc } from "../engine/scene/schema";
import { downloadJson } from "../engine/render/screenshot";

export default function TopBar() {
  const router = useRouter();
  const model = useScene((s) => s.model);
  const setRightTab = useScene((s) => s.setRightTab);
  const setShowResult = useScene((s) => s.setShowResult);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const onSave = () => {
    const doc = useScene.getState().save();
    downloadJson(doc, `${doc.source.name.replace(/\.[^.]+$/, "")}-design.json`);
    useScene.getState().toast({ kind: "success", message: "Design saved to this browser and downloaded." });
  };

  const onLoad = async (file: File) => {
    const s = useScene.getState();
    try {
      const parsed = SceneDoc.safeParse(JSON.parse(await file.text()));
      if (!parsed.success) {
        // Never a white screen on a bad file — poc/docs/03 § Persistence.
        s.toast({ kind: "error", message: "That design file doesn’t match this app’s format." });
        return;
      }
      s.loadDoc(parsed.data);
      s.toast({ kind: "success", message: `Loaded “${file.name}”.` });
    } catch {
      s.toast({ kind: "error", message: "Couldn’t read that design file." });
    }
  };

  const kindBadge = model?.kind === "ifc" ? "IFC" : model?.kind === "glb" ? "GLB" : "SAMPLE";

  return (
    <header className="flex h-14 w-full shrink-0 items-center justify-between border-b border-border-subtle bg-surface px-4">
      <div className="flex items-center gap-4">
        <IconButton icon={ArrowLeft} label="Back to file loader" onClick={() => router.push("/")} />
        <div className="flex items-center gap-2">
          <span className="text-[18px] font-semibold tracking-[-0.01em]">Studio PoC</span>
          <span className="px-1 text-on-surface-variant">|</span>
          <span className="max-w-[280px] truncate text-[14px]">{model?.name ?? "—"}</span>
          <Badge>{kindBadge}</Badge>
          {model && !model.stats.realRooms ? <Badge tone="warning">no room data</Badge> : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button icon={Save} onClick={onSave}>
          Save design
        </Button>
        <Button icon={FolderOpen} onClick={() => fileRef.current?.click()}>
          Load
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onLoad(f);
            e.target.value = "";
          }}
        />
        <Button icon={SplitSquareHorizontal} onClick={() => setShowResult(true)}>
          Result
        </Button>
        <Button
          variant="primary"
          icon={Sparkles}
          className="ml-2"
          onClick={() => setRightTab("style")}
        >
          AI Optimize
        </Button>
      </div>
    </header>
  );
}
