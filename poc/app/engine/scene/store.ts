import { create, useStore } from "zustand";
import { temporal } from "zundo";
import { emptyDoc, PlacedItem, SceneDoc, SCHEMA_VERSION, Vec3 } from "./schema";
import type { BuildingModel, RoomInfo } from "../ingest/types";

/**
 * One store = the scene document + the ephemeral editor state around it.
 *
 * Only `doc` is tracked by zundo: undo must replay design changes, not camera
 * moves or panel tabs. R3F components render *from* here; three objects never
 * own state. Drag gestures mutate a ref per frame and commit once on pointer-up
 * so one gesture is one undo entry.
 */

export type Mode = "orbit" | "walk";
export type RightTab = "catalog" | "style" | "inspector";

export type StyleId = "modern" | "japandi" | "scandinavian" | "luxury";

export type Concept = {
  id: string;
  url: string;
  style: StyleId;
  label: string;
  /** True when produced by the offline placeholder generator, not a real model. */
  placeholder: boolean;
};

export type Toast = {
  id: string;
  kind: "error" | "warning" | "success" | "info";
  message: string;
  action?: { label: string; run: () => void };
};

type TrackedState = { doc: SceneDoc };

export type SceneStore = TrackedState & {
  // ── loaded building (not part of the doc: geometry is re-derived on load) ──
  model: BuildingModel | null;
  activeRoomId: string | null;

  // ── editor ephemera ──
  mode: Mode;
  rightTab: RightTab;
  placingCatalogId: string | null;
  selectedItemId: string | null;
  snapEnabled: boolean;
  showResult: boolean;
  /** Room snapshot taken on entry — the "before" half of before/after. */
  snapshot: { roomId: string; room: SceneDoc["rooms"][string] } | null;

  // ── AI ──
  style: StyleId;
  generating: boolean;
  generationStartedAt: number | null;
  concepts: Concept[];
  lightboxIndex: number | null;

  toasts: Toast[];

  // ── actions ──
  loadModel: (model: BuildingModel) => void;
  setActiveRoom: (roomId: string) => void;
  setMode: (m: Mode) => void;
  setRightTab: (t: RightTab) => void;
  setPlacing: (catalogId: string | null) => void;
  select: (itemId: string | null) => void;
  toggleSnap: () => void;
  setShowResult: (v: boolean) => void;

  placeItem: (catalogId: string, position: Vec3, rotationY?: number) => void;
  moveItem: (itemId: string, position: Vec3) => void;
  rotateItem: (itemId: string, rotationY: number) => void;
  removeItem: (itemId: string) => void;
  setFinish: (kind: "floor" | "wall", finishId: string) => void;
  /** Wholesale room replacement — used by AI auto-style, one undo entry. */
  applyRoom: (roomId: string, room: SceneDoc["rooms"][string]) => void;

  takeSnapshot: () => void;

  setStyle: (s: StyleId) => void;
  setGenerating: (v: boolean) => void;
  setConcepts: (c: Concept[]) => void;
  openLightbox: (i: number | null) => void;

  toast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;

  save: () => SceneDoc;
  loadDoc: (doc: SceneDoc) => void;
  reset: () => void;
};

const uid = () => Math.random().toString(36).slice(2, 10);

const BLANK: SceneDoc = emptyDoc({ kind: "sample", name: "untitled" }, []);

/** Find which room an item lives in, without forcing callers to know. */
function findItem(doc: SceneDoc, itemId: string): { roomId: string; index: number } | null {
  for (const [roomId, room] of Object.entries(doc.rooms)) {
    const index = room.items.findIndex((i) => i.id === itemId);
    if (index >= 0) return { roomId, index };
  }
  return null;
}

export const useScene = create<SceneStore>()(
  temporal(
    (set, get) => ({
      doc: BLANK,
      model: null,
      activeRoomId: null,
      mode: "orbit",
      rightTab: "catalog",
      placingCatalogId: null,
      selectedItemId: null,
      snapEnabled: true,
      showResult: false,
      snapshot: null,
      style: "japandi",
      generating: false,
      generationStartedAt: null,
      concepts: [],
      lightboxIndex: null,
      toasts: [],

      loadModel: (model) => {
        const restored = readLocal(model.name);
        const doc =
          restored && Object.keys(restored.rooms).length > 0
            ? restored
            : emptyDoc({ kind: model.kind, name: model.name }, model.rooms.map((r) => r.id));
        // Rooms present in the model but missing from a restored doc (schema drift).
        for (const r of model.rooms) doc.rooms[r.id] ??= { items: [] };
        const first = model.rooms[0]?.id ?? null;
        set({
          model,
          doc,
          activeRoomId: first,
          selectedItemId: null,
          placingCatalogId: null,
          showResult: false,
          concepts: [],
          snapshot: first ? { roomId: first, room: structuredClone(doc.rooms[first]) } : null,
        });
        useScene.temporal.getState().clear();
      },

      setActiveRoom: (roomId) =>
        set((s) => ({
          activeRoomId: roomId,
          selectedItemId: null,
          // Snapshot on room entry — the "before" the result view compares against.
          snapshot:
            s.snapshot?.roomId === roomId
              ? s.snapshot
              : { roomId, room: structuredClone(s.doc.rooms[roomId] ?? { items: [] }) },
        })),

      setMode: (mode) => set({ mode, selectedItemId: null, placingCatalogId: null }),
      setRightTab: (rightTab) => set({ rightTab }),
      setPlacing: (placingCatalogId) =>
        set({ placingCatalogId, selectedItemId: placingCatalogId ? null : get().selectedItemId }),
      select: (selectedItemId) =>
        set({
          selectedItemId,
          placingCatalogId: null,
          rightTab: selectedItemId ? "inspector" : get().rightTab === "inspector" ? "catalog" : get().rightTab,
        }),
      toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
      setShowResult: (showResult) => set({ showResult }),

      placeItem: (catalogId, position, rotationY = 0) => {
        const roomId = get().activeRoomId;
        if (!roomId) return;
        const item: PlacedItem = { id: uid(), catalogId, position, rotationY, scale: 1 };
        set((s) => ({
          doc: {
            ...s.doc,
            rooms: {
              ...s.doc.rooms,
              [roomId]: { ...s.doc.rooms[roomId], items: [...(s.doc.rooms[roomId]?.items ?? []), item] },
            },
          },
          selectedItemId: item.id,
        }));
      },

      moveItem: (itemId, position) =>
        set((s) => {
          const at = findItem(s.doc, itemId);
          if (!at) return s;
          const items = s.doc.rooms[at.roomId].items.slice();
          items[at.index] = { ...items[at.index], position };
          return { doc: { ...s.doc, rooms: { ...s.doc.rooms, [at.roomId]: { ...s.doc.rooms[at.roomId], items } } } };
        }),

      rotateItem: (itemId, rotationY) =>
        set((s) => {
          const at = findItem(s.doc, itemId);
          if (!at) return s;
          const items = s.doc.rooms[at.roomId].items.slice();
          items[at.index] = { ...items[at.index], rotationY };
          return { doc: { ...s.doc, rooms: { ...s.doc.rooms, [at.roomId]: { ...s.doc.rooms[at.roomId], items } } } };
        }),

      removeItem: (itemId) =>
        set((s) => {
          const at = findItem(s.doc, itemId);
          if (!at) return s;
          const items = s.doc.rooms[at.roomId].items.filter((i) => i.id !== itemId);
          return {
            doc: { ...s.doc, rooms: { ...s.doc.rooms, [at.roomId]: { ...s.doc.rooms[at.roomId], items } } },
            selectedItemId: s.selectedItemId === itemId ? null : s.selectedItemId,
          };
        }),

      setFinish: (kind, finishId) =>
        set((s) => {
          const roomId = s.activeRoomId;
          if (!roomId) return s;
          const room = s.doc.rooms[roomId] ?? { items: [] };
          return {
            doc: {
              ...s.doc,
              rooms: {
                ...s.doc.rooms,
                [roomId]: kind === "floor" ? { ...room, floorFinishId: finishId } : { ...room, wallFinishId: finishId },
              },
            },
          };
        }),

      applyRoom: (roomId, room) =>
        set((s) => ({
          doc: { ...s.doc, rooms: { ...s.doc.rooms, [roomId]: room } },
          selectedItemId: null,
        })),

      takeSnapshot: () => {
        const { activeRoomId, doc } = get();
        if (!activeRoomId) return;
        set({ snapshot: { roomId: activeRoomId, room: structuredClone(doc.rooms[activeRoomId]) } });
      },

      setStyle: (style) => set({ style }),
      setGenerating: (generating) =>
        set({ generating, generationStartedAt: generating ? Date.now() : null }),
      setConcepts: (concepts) => set({ concepts }),
      openLightbox: (lightboxIndex) => set({ lightboxIndex }),

      toast: (t) => {
        const id = uid();
        set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
        if (t.kind !== "error") setTimeout(() => get().dismissToast(id), 5000);
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      save: () => {
        const doc = get().doc;
        writeLocal(doc);
        return doc;
      },

      loadDoc: (doc) => {
        const model = get().model;
        // Keep rooms the current model knows about; tolerate extras.
        if (model) for (const r of model.rooms) doc.rooms[r.id] ??= { items: [] };
        set({ doc, selectedItemId: null, activeRoomId: get().activeRoomId ?? Object.keys(doc.rooms)[0] ?? null });
        useScene.temporal.getState().clear();
      },

      reset: () => set({ doc: BLANK, model: null, activeRoomId: null, concepts: [], snapshot: null }),
    }),
    {
      limit: 100,
      // Only the design document participates in undo/redo.
      partialize: (s): TrackedState => ({ doc: s.doc }),
      equality: (a, b) => a.doc === b.doc,
    },
  ),
);

// ── persistence ────────────────────────────────────────────────────────────
const keyFor = (name: string) => `poc:design:${name}`;

export function writeLocal(doc: SceneDoc) {
  try {
    localStorage.setItem(keyFor(doc.source.name), JSON.stringify(doc));
  } catch {
    /* quota / private mode — saving is best-effort in a PoC */
  }
}

export function readLocal(name: string): SceneDoc | null {
  try {
    const raw = localStorage.getItem(keyFor(name));
    if (!raw) return null;
    const parsed = SceneDoc.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// ── undo/redo helpers used by the UI ───────────────────────────────────────
export const undo = () => useScene.temporal.getState().undo();
export const redo = () => useScene.temporal.getState().redo();

export function useHistory() {
  // `temporal` is a plain store, not a hook — subscribe to it explicitly.
  const canUndo = useStore(useScene.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useScene.temporal, (s) => s.futureStates.length > 0);
  return { canUndo, canRedo };
}

export function activeRoom(s: SceneStore) {
  return s.activeRoomId ? s.doc.rooms[s.activeRoomId] : undefined;
}

export function activeRoomInfo(s: SceneStore): RoomInfo | undefined {
  return s.model?.rooms.find((r) => r.id === s.activeRoomId);
}
