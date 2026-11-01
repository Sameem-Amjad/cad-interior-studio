"use client";

import * as React from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls, PointerLockControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useScene } from "../engine/scene/store";
import { LAYER, tagLayer, poseForRoom, walkPoseForRoom, type RoomInfo } from "../engine/ingest/types";
import { byId } from "../data/catalog";
import { instanceFor } from "../data/furniture";
import { clampToRoom, collides, snapPosition, snapRotation } from "../engine/editor/placement";
import { syncFinishes } from "../engine/editor/finishes";
import { capture, type CaptureOpts } from "../engine/render/screenshot";
import type { PlacedItem, Vec3 } from "../engine/scene/schema";

/**
 * The viewport. R3F renders *from* the store; three objects never own state.
 * Drag gestures mutate the object per frame and commit once on pointer-up, so
 * one gesture is one undo entry (poc/docs/03 § Scene store).
 */

// ── bridges out of the Canvas ──────────────────────────────────────────────
type Capturer = (opts?: CaptureOpts) => string;
let capturer: Capturer | null = null;
/** Grab the current frame as a data URL. Null before the canvas mounts. */
export const captureViewport = (opts?: CaptureOpts) => capturer?.(opts) ?? null;

const perf = { fps: 60, calls: 0, triangles: 0, programs: 0, camera: "" };
export const currentFps = () => perf.fps;
/** Live renderer counters, read by the ?debug=1 overlay. */
export const renderStats = () => perf;

/** Overlay geometry (rings, ghosts) must be invisible to every raycast. */
const NO_RAYCAST = () => null;

/** Pointer events only ever target tagged geometry — never glass or the site slab. */
const RAY_LAYERS = new THREE.Layers();
RAY_LAYERS.disableAll();
RAY_LAYERS.enable(LAYER.FLOOR);
RAY_LAYERS.enable(LAYER.WALL);
RAY_LAYERS.enable(LAYER.ITEM);

export default function Viewport() {
  return (
    <Canvas
      dpr={[1, 2]}
      shadows
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ fov: 45, near: 0.1, far: 400, position: [12, 9, 14] }}
      raycaster={{ layers: RAY_LAYERS }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        scene.background = new THREE.Color("#0b0d10");
        scene.fog = new THREE.Fog("#0b0d10", 45, 130);
      }}
      className="absolute inset-0"
    >
      <SceneContents />
    </Canvas>
  );
}

function SceneContents() {
  const model = useScene((s) => s.model);
  const mode = useScene((s) => s.mode);

  return (
    <>
      <Bridges />
      <Lighting />
      {model ? (
        <>
          <primitive object={model.shell} />
          <FinishSync />
          <Items />
          <PlacementGhost />
          <Cutaway />
          <ContactShadows position={[0, 0.012, 0]} scale={40} resolution={1024} opacity={0.45} blur={2.4} far={6} frames={1} />
        </>
      ) : null}
      <CameraRig />
      {mode === "walk" ? <Walkthrough /> : null}
    </>
  );
}

function Lighting() {
  return (
    <>
      <hemisphereLight args={["#c8d6f0", "#1a1c20", 1.1]} />
      <directionalLight
        position={[9, 14, 7]}
        intensity={2.1}
        color="#fff4e6"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-bias={-0.0006}
      />
      <directionalLight position={[-8, 6, -6]} intensity={0.5} color="#8fb4ff" />
      {/* Local lightformer rig instead of a preset HDRI — no network fetch, so
          the demo works offline (poc/docs/01 § Demo-day risk kit). */}
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={2.4} color="#ffffff" position={[0, 8, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[24, 24, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#a8c5ff" position={[-12, 4, 6]} rotation={[0, Math.PI / 2, 0]} scale={[14, 8, 1]} />
        <Lightformer form="rect" intensity={0.8} color="#ffd6a8" position={[12, 3, -6]} rotation={[0, -Math.PI / 2, 0]} scale={[14, 8, 1]} />
      </Environment>
    </>
  );
}

function Bridges() {
  const { gl, scene, camera } = useThree();
  React.useEffect(() => {
    capturer = (opts) => capture(gl, scene, camera, opts);
    return () => {
      capturer = null;
    };
  }, [gl, scene, camera]);

  const acc = React.useRef({ frames: 0, t: 0 });
  useFrame((_, delta) => {
    const a = acc.current;
    a.frames++;
    a.t += delta;
    if (a.t >= 0.5) {
      perf.fps = Math.round(a.frames / a.t);
      perf.calls = gl.info.render.calls;
      perf.triangles = gl.info.render.triangles;
      perf.programs = gl.info.programs?.length ?? 0;
      const p = camera.position;
      perf.camera = `${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}`;
      a.frames = 0;
      a.t = 0;
    }
  });
  return null;
}

/** Keeps shell materials in step with the document, including after undo. */
function FinishSync() {
  const model = useScene((s) => s.model);
  const rooms = useScene((s) => s.doc.rooms);
  React.useEffect(() => {
    if (model) syncFinishes(model, rooms);
  }, [model, rooms]);
  return null;
}

// ── camera ────────────────────────────────────────────────────────────────

/** Set by the sidebar when a room is clicked; consumed by the rig next frame. */
let flyRequest: { room: RoomInfo; walk: boolean } | null = null;
export const requestFlyTo = (room: RoomInfo, walk = false) => {
  flyRequest = { room, walk };
};

let orbitRef: OrbitControlsImpl | null = null;
export const setOrbitEnabled = (v: boolean) => {
  if (orbitRef) orbitRef.enabled = v;
};
export const dollyBy = (factor: number) => {
  if (!orbitRef) return;
  const cam = orbitRef.object;
  const target = orbitRef.target;
  const dir = cam.position.clone().sub(target);
  dir.multiplyScalar(factor);
  const len = dir.length();
  if (len > 1.2 && len < 220) cam.position.copy(target.clone().add(dir));
  orbitRef.update();
};

function CameraRig() {
  const controls = React.useRef<OrbitControlsImpl>(null);
  const model = useScene((s) => s.model);
  const mode = useScene((s) => s.mode);
  const buildingCenter = React.useRef<THREE.Vector3 | undefined>(undefined);
  const tween = React.useRef<{ from: THREE.Vector3; to: THREE.Vector3; fromT: THREE.Vector3; toT: THREE.Vector3; t: number } | null>(null);

  React.useEffect(() => {
    orbitRef = controls.current;
    return () => {
      orbitRef = null;
    };
  });

  // Frame the building whenever a new model arrives.
  //
  // When the file declares real rooms, frame those: they are the surface the
  // user came to design, and a real IFC can scatter incidental geometry tens of
  // metres away, which would shrink the rooms to nothing. Otherwise frame all
  // *tagged* geometry — floors and walls — which excludes decoration such as
  // the sample building's 30 m site slab.
  React.useEffect(() => {
    if (!model || !controls.current) return;
    model.shell.updateMatrixWorld(true);
    const box = new THREE.Box3();

    if (model.stats.realRooms) {
      for (const room of model.rooms) box.union(room.box);
    } else {
      model.shell.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        if (!mesh.layers.isEnabled(LAYER.FLOOR) && !mesh.layers.isEnabled(LAYER.WALL)) return;
        if (mesh.userData.part === "floor-proxy") return;
        const geometry = mesh.geometry as THREE.BufferGeometry;
        if (!geometry.boundingBox) geometry.computeBoundingBox();
        box.union(geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld));
      });
    }
    if (box.isEmpty()) box.setFromObject(model.shell);
    // Room volumes stop at the inside face; the walls and roof around them are
    // what you actually see, so give the framing box a metre of margin.
    box.expandByScalar(1.2);

    const center = box.getCenter(new THREE.Vector3());
    buildingCenter.current = center.clone();
    const size = box.getSize(new THREE.Vector3());
    const span = Math.max(size.x, size.z, 4);
    controls.current.object.position.set(center.x + span * 0.85, center.y + span * 0.8, center.z + span * 0.95);
    controls.current.target.set(center.x, box.min.y + 0.8, center.z);
    controls.current.update();
  }, [model]);

  useFrame((state, delta) => {
    if (flyRequest && controls.current) {
      const { room, walk } = flyRequest;
      flyRequest = null;
      const pose = walk ? walkPoseForRoom(room) : poseForRoom(room, buildingCenter.current);
      tween.current = {
        from: state.camera.position.clone(),
        to: pose.position,
        fromT: controls.current.target.clone(),
        toT: pose.target,
        t: 0,
      };
    }

    const tw = tween.current;
    if (tw && controls.current) {
      tw.t = Math.min(1, tw.t + delta * 1.6);
      const e = tw.t < 0.5 ? 4 * tw.t ** 3 : 1 - (-2 * tw.t + 2) ** 3 / 2; // easeInOutCubic
      state.camera.position.lerpVectors(tw.from, tw.to, e);
      controls.current.target.lerpVectors(tw.fromT, tw.toT, e);
      controls.current.update();
      if (tw.t >= 1) tween.current = null;
    }
  });

  return (
    <OrbitControls
      ref={controls}
      enabled={mode === "orbit"}
      enableDamping
      dampingFactor={0.08}
      maxPolarAngle={Math.PI / 2.02}
      minDistance={1.5}
      maxDistance={200}
      makeDefault
    />
  );
}

/**
 * Dollhouse cutaway: hide the wall pieces standing between the camera and the
 * room being looked at. Without it, orbiting a real floor plan means staring at
 * the outside of a box — the single biggest readability win in the viewport.
 *
 * Two things this has to get right, both learned the hard way on a real IFC:
 *  - Use each mesh's *geometry* centre in world space, not its object origin.
 *    Ingest bakes transforms into merged geometry, so every merged mesh sits at
 *    the model origin and a naive origin test hides the entire building.
 *  - Never hide a mesh that spans most of the model. The IFC lane merges the
 *    shell by colour, so one mesh can be half the building; cutting it away
 *    removes the whole storey instead of one wall.
 */
function Cutaway() {
  const model = useScene((s) => s.model);
  const activeRoomId = useScene((s) => s.activeRoomId);
  const mode = useScene((s) => s.mode);

  const { walls, ceilings } = React.useMemo(() => {
    const walls: { mesh: THREE.Mesh; center: THREE.Vector3 }[] = [];
    const ceilings: THREE.Mesh[] = [];
    if (!model) return { walls, ceilings };
    model.shell.updateMatrixWorld(true);

    const modelBox = new THREE.Box3().setFromObject(model.shell);
    const modelSpan = Math.max(modelBox.getSize(new THREE.Vector3()).length(), 1);

    const candidates: { mesh: THREE.Mesh; center: THREE.Vector3; span: number }[] = [];
    model.shell.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (mesh.userData.part === "ceiling") {
        ceilings.push(mesh);
        return;
      }
      if (!mesh.layers.isEnabled(LAYER.WALL)) return;
      const geometry = mesh.geometry as THREE.BufferGeometry;
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      const worldBox = geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
      candidates.push({
        mesh,
        center: worldBox.getCenter(new THREE.Vector3()),
        span: worldBox.getSize(new THREE.Vector3()).length(),
      });
    });

    for (const c of candidates) {
      // A mesh covering most of the model is a merged shell, not a wall piece.
      if (c.span < modelSpan * 0.6) walls.push({ mesh: c.mesh, center: c.center });
      else c.mesh.visible = true;
    }
    return { walls, ceilings };
  }, [model]);

  // Walkthrough restores the full envelope: every wall back, ceilings on.
  React.useEffect(() => {
    const walking = mode === "walk";
    if (walking) for (const w of walls) w.mesh.visible = true;
    for (const c of ceilings) c.visible = walking;
  }, [mode, walls, ceilings]);

  const target = React.useMemo(() => new THREE.Vector3(), []);
  const tick = React.useRef(0);

  useFrame(({ camera }) => {
    if (mode === "walk" || walls.length === 0) return;
    // Visibility only has to keep up with the eye, not the frame rate.
    if (++tick.current % 5 !== 0) return;
    const room = model?.rooms.find((r) => r.id === activeRoomId) ?? model?.rooms[0];
    if (!room) return;
    room.box.getCenter(target);
    const reach = camera.position.distanceTo(target) - 0.5;
    for (const w of walls) w.mesh.visible = camera.position.distanceTo(w.center) >= reach;
  });

  return null;
}

/** WASD at 1.6 m eye height with raycast collision — no physics engine. */
function Walkthrough() {
  const { camera, scene } = useThree();
  const keys = React.useRef<Record<string, boolean>>({});
  const model = useScene((s) => s.model);
  const activeRoomId = useScene((s) => s.activeRoomId);
  const ray = React.useMemo(() => {
    const r = new THREE.Raycaster();
    r.layers.set(LAYER.WALL);
    r.far = 0.55;
    return r;
  }, []);

  React.useEffect(() => {
    const room = model?.rooms.find((r) => r.id === activeRoomId) ?? model?.rooms[0];
    if (room) {
      const pose = walkPoseForRoom(room);
      camera.position.copy(pose.position);
      camera.lookAt(pose.target);
    }
    const down = (e: KeyboardEvent) => (keys.current[e.code] = true);
    const up = (e: KeyboardEvent) => (keys.current[e.code] = false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      keys.current = {};
    };
    // Entering walk mode should place the walker once, not on every room hover.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const forward = React.useMemo(() => new THREE.Vector3(), []);
  const right = React.useMemo(() => new THREE.Vector3(), []);
  const step = React.useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const k = keys.current;
    const speed = (k.ShiftLeft || k.ShiftRight ? 4.2 : 2.1) * Math.min(delta, 0.05);
    let fw = 0;
    let sd = 0;
    if (k.KeyW || k.ArrowUp) fw += 1;
    if (k.KeyS || k.ArrowDown) fw -= 1;
    if (k.KeyD || k.ArrowRight) sd += 1;
    if (k.KeyA || k.ArrowLeft) sd -= 1;
    if (fw === 0 && sd === 0) return;

    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, camera.up).normalize();
    step.set(0, 0, 0).addScaledVector(forward, fw).addScaledVector(right, sd).normalize().multiplyScalar(speed);

    // Test each axis separately so a wall slides you along it instead of stopping you dead.
    for (const axis of ["x", "z"] as const) {
      const delta2 = step[axis];
      if (Math.abs(delta2) < 1e-5) continue;
      const dir = new THREE.Vector3();
      dir[axis] = Math.sign(delta2);
      ray.set(camera.position, dir);
      if (ray.intersectObjects(scene.children, true).length === 0) camera.position[axis] += delta2;
    }
    camera.position.y = (model?.rooms[0]?.floorY ?? 0) + 1.6;
  });

  return <PointerLockControls makeDefault />;
}

// ── items ─────────────────────────────────────────────────────────────────

function Items() {
  const allRooms = useScene((s) => s.doc.rooms);
  const activeRoomId = useScene((s) => s.activeRoomId);

  return (
    <>
      {Object.entries(allRooms).flatMap(([roomId, room]) =>
        room.items.map((item) => <Item key={item.id} item={item} interactive={roomId === activeRoomId} />),
      )}
    </>
  );
}

const floorRay = new THREE.Raycaster();
floorRay.layers.set(LAYER.FLOOR);

/** Screen point → floor point, in the active room. */
function pointOnFloor(
  event: { clientX: number; clientY: number },
  gl: THREE.WebGLRenderer,
  camera: THREE.Camera,
  floors: THREE.Object3D[],
): THREE.Vector3 | null {
  const rect = gl.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  floorRay.setFromCamera(ndc, camera);
  const hit = floorRay.intersectObjects(floors, true)[0];
  return hit ? hit.point : null;
}

function useFloorMeshes() {
  const model = useScene((s) => s.model);
  return React.useMemo(() => {
    if (!model) return [];
    const out: THREE.Object3D[] = [];
    model.shell.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.layers.isEnabled(LAYER.FLOOR)) out.push(mesh);
    });
    return out;
  }, [model]);
}

function Item({ item, interactive }: { item: PlacedItem; interactive: boolean }) {
  const group = React.useRef<THREE.Group>(null);
  const { gl, camera } = useThree();
  const floors = useFloorMeshes();
  const selected = useScene((s) => s.selectedItemId === item.id);
  const placing = useScene((s) => s.placingCatalogId !== null);
  const mode = useScene((s) => s.mode);
  const drag = React.useRef<{ offset: THREE.Vector3; moved: boolean; position: Vec3 } | null>(null);

  const object = React.useMemo(() => {
    const o = instanceFor(item.catalogId);
    tagLayer(o, LAYER.ITEM);
    return o;
  }, [item.catalogId]);

  const spec = byId.get(item.catalogId);

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive || placing || mode !== "orbit") return;
    e.stopPropagation();
    useScene.getState().select(item.id);
    const hit = pointOnFloor(e, gl, camera, floors);
    if (!hit) return;
    drag.current = {
      offset: new THREE.Vector3(item.position[0] - hit.x, 0, item.position[2] - hit.z),
      moved: false,
      position: item.position,
    };
    setOrbitEnabled(false);
    (e.target as Element)?.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    if (!d || !group.current) return;
    e.stopPropagation();
    const hit = pointOnFloor(e, gl, camera, floors);
    if (!hit || !spec) return;
    const state = useScene.getState();
    const room = state.model?.rooms.find((r) => r.id === state.activeRoomId);
    if (!room) return;
    let next: Vec3 = [hit.x + d.offset.x, room.floorY, hit.z + d.offset.z];
    next = clampToRoom(spec, next, item.rotationY, room);
    next = snapPosition(next, state.snapEnabled);
    d.position = next;
    d.moved = true;
    group.current.position.set(next[0], next[1], next[2]);
  };

  const endDrag = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    drag.current = null;
    setOrbitEnabled(true);
    (e.target as Element)?.releasePointerCapture?.(e.pointerId);
    // One store commit per gesture — one undo entry, not one per frame.
    if (d?.moved) useScene.getState().moveItem(item.id, d.position);
  };

  // The store is the source of truth whenever we're not mid-drag (undo, AI, inspector).
  React.useEffect(() => {
    if (!drag.current && group.current) group.current.position.set(...item.position);
  }, [item.position]);

  return (
    <group
      ref={group}
      position={item.position}
      rotation={[0, item.rotationY, 0]}
      scale={item.scale}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <primitive object={object} />
      {selected && spec ? <SelectionRing item={spec} /> : null}
    </group>
  );
}

function SelectionRing({ item }: { item: { footprint: { w: number; d: number }; height: number } }) {
  const r = Math.max(item.footprint.w, item.footprint.d) / 2 + 0.14;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} raycast={NO_RAYCAST} renderOrder={2}>
        <ringGeometry args={[r - 0.035, r, 48]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.85} depthTest={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} raycast={NO_RAYCAST} renderOrder={1}>
        <circleGeometry args={[r, 48]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.1} depthTest={false} />
      </mesh>
    </group>
  );
}

/** Ghost item that follows the floor while a catalog card is armed. */
function PlacementGhost() {
  const catalogId = useScene((s) => s.placingCatalogId);
  const snapEnabled = useScene((s) => s.snapEnabled);
  const { gl, camera } = useThree();
  const floors = useFloorMeshes();
  const group = React.useRef<THREE.Group>(null);
  const [valid, setValid] = React.useState(true);
  const [visible, setVisible] = React.useState(false);
  const pose = React.useRef<{ position: Vec3; rotationY: number }>({ position: [0, 0, 0], rotationY: 0 });
  const pressed = React.useRef<{ x: number; y: number } | null>(null);

  const spec = catalogId ? byId.get(catalogId) : undefined;

  const object = React.useMemo(() => {
    if (!catalogId) return null;
    const o = instanceFor(catalogId);
    o.traverse((c) => {
      const mesh = c as THREE.Mesh;
      if (!mesh.isMesh) return;
      // No semantic layer: the ghost must never block its own placement ray.
      mesh.castShadow = false;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mesh.material = mats.map((m) => {
        const c2 = (m as THREE.MeshStandardMaterial).clone();
        c2.transparent = true;
        c2.opacity = 0.55;
        c2.depthWrite = false;
        return c2;
      })[0];
    });
    return o;
  }, [catalogId]);

  React.useEffect(() => {
    if (!catalogId) {
      setVisible(false);
      return;
    }
    const el = gl.domElement;

    /** Where the item would land under this pointer, or null off the active room's floor. */
    const poseAt = (e: PointerEvent): Vec3 | null => {
      const hit = pointOnFloor(e, gl, camera, floors);
      const state = useScene.getState();
      const room = state.model?.rooms.find((r) => r.id === state.activeRoomId);
      if (!hit || !room || !spec) return null;
      return snapPosition(clampToRoom(spec, [hit.x, room.floorY, hit.z], 0, room), snapEnabled);
    };

    const move = (e: PointerEvent) => {
      const position = poseAt(e);
      if (!position || !spec) {
        setVisible(false);
        return;
      }
      pose.current = { position, rotationY: 0 };
      group.current?.position.set(...position);
      setVisible(true);
      const state = useScene.getState();
      const placed = state.doc.rooms[state.activeRoomId ?? ""]?.items ?? [];
      setValid(!collides({ item: spec, position, rotationY: 0 }, placed, (id) => byId.get(id)));
    };

    const press = (e: PointerEvent) => {
      pressed.current = { x: e.clientX, y: e.clientY };
    };

    const commit = (e: PointerEvent) => {
      const start = pressed.current;
      pressed.current = null;
      if (e.button !== 0 || !start) return;
      // An orbit drag also ends in a pointerup — only a near-stationary one places.
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 5) return;
      // Taken from this event, not the hover ghost: a touch tap never hovers first.
      const position = poseAt(e);
      if (!position) return;
      const state = useScene.getState();
      state.placeItem(catalogId, position, pose.current.rotationY);
      // Shift keeps the card armed for rapid repeat placement.
      if (!e.shiftKey) state.setPlacing(null);
    };

    const leave = () => setVisible(false);

    el.addEventListener("pointerdown", press);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", commit);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointerdown", press);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", commit);
      el.removeEventListener("pointerleave", leave);
    };
  }, [catalogId, gl, camera, floors, spec, snapEnabled]);

  if (!object || !spec) return null;
  const r = Math.max(spec.footprint.w, spec.footprint.d) / 2 + 0.1;

  return (
    <group ref={group} visible={visible}>
      <primitive object={object} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} raycast={NO_RAYCAST} renderOrder={2}>
        <ringGeometry args={[r - 0.03, r, 48]} />
        <meshBasicMaterial color={valid ? "#3b82f6" : "#ef4444"} transparent opacity={0.9} depthTest={false} />
      </mesh>
    </group>
  );
}

/** Deselect when the click lands on nothing. Wired from the Studio shell. */
export function useDeselectOnMiss() {
  return React.useCallback(() => {
    const s = useScene.getState();
    if (s.placingCatalogId) return;
    s.select(null);
  }, []);
}

export { snapRotation };
