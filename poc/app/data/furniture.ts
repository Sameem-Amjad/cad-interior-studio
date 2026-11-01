import * as THREE from "three";
import { PALETTE, rugTexture } from "./materials";

/**
 * Parametric furniture builders. Each returns a Group whose origin is at the
 * centre of its floor footprint, Y-up, meters — the contract the placement code
 * in engine/editor assumes.
 */

type Build = () => THREE.Group;

const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

const cyl = (r: number, h: number, m: THREE.Material, x = 0, y = 0, z = 0, seg = 16) => {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
};

/** Slightly rounded slab — reads as upholstery rather than a crate. */
const cushion = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) => {
  const g = new THREE.BoxGeometry(w, h, d, 2, 2, 2);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // pull corners in a touch
    v.x *= 1 - 0.06 * Math.abs(v.y / (h / 2)) * Math.abs(v.z / (d / 2));
    v.z *= 1 - 0.06 * Math.abs(v.y / (h / 2)) * Math.abs(v.x / (w / 2));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

function legs(g: THREE.Group, w: number, d: number, h: number, m: THREE.Material, r = 0.03) {
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) g.add(cyl(r, h, m, (sx * w) / 2, h / 2, (sz * d) / 2, 8));
}

const sofa = (w: number, fabric: () => THREE.Material, wood: () => THREE.Material): Build => () => {
  const g = new THREE.Group();
  const f = fabric();
  const d = 0.9;
  g.add(cushion(w, 0.22, d, f, 0, 0.42, 0)); // seat base
  g.add(cushion(w, 0.42, 0.2, f, 0, 0.74, -d / 2 + 0.1)); // back
  for (const s of [-1, 1]) g.add(cushion(0.18, 0.34, d - 0.12, f, (s * (w - 0.18)) / 2, 0.66, 0.03)); // arms
  const seats = Math.max(2, Math.round(w / 0.85));
  for (let i = 0; i < seats; i++)
    g.add(cushion((w - 0.4) / seats - 0.04, 0.14, d - 0.28, f, -((w - 0.4) / 2) + 0.2 + ((i + 0.5) * (w - 0.4)) / seats, 0.6, 0.06));
  legs(g, w - 0.3, d - 0.25, 0.31, wood(), 0.025);
  return g;
};

const armchair = (fabric: () => THREE.Material, wood: () => THREE.Material): Build => () => {
  const g = new THREE.Group();
  const f = fabric();
  g.add(cushion(0.72, 0.2, 0.72, f, 0, 0.42, 0));
  g.add(cushion(0.72, 0.5, 0.16, f, 0, 0.74, -0.3));
  for (const s of [-1, 1]) g.add(cushion(0.12, 0.26, 0.6, f, s * 0.3, 0.62, 0.04));
  legs(g, 0.5, 0.5, 0.32, wood(), 0.022);
  return g;
};

export const BUILDERS: Record<string, Build> = {
  "oslo-sofa": sofa(2.2, PALETTE.fabricCream, PALETTE.oak),
  "milan-sofa": sofa(2.6, PALETTE.velvet, PALETTE.brass),
  "kyoto-lounge": () => {
    // Low Japandi lounge chair: slatted back, wide oak frame.
    const g = new THREE.Group();
    const w = PALETTE.oak();
    g.add(cushion(0.74, 0.16, 0.7, PALETTE.fabricSage(), 0, 0.34, 0));
    for (let i = 0; i < 5; i++) g.add(box(0.06, 0.5, 0.05, w, -0.28 + i * 0.14, 0.6, -0.31));
    g.add(box(0.78, 0.06, 0.06, w, 0, 0.86, -0.31));
    for (const s of [-1, 1]) g.add(box(0.06, 0.36, 0.74, w, s * 0.38, 0.24, 0));
    return g;
  },
  "aalto-armchair": armchair(PALETTE.fabricGrey, PALETTE.oak),
  "dining-chair": () => {
    const g = new THREE.Group();
    const w = PALETTE.walnut();
    g.add(box(0.44, 0.05, 0.44, PALETTE.fabricCream(), 0, 0.45, 0));
    g.add(box(0.42, 0.46, 0.05, w, 0, 0.7, -0.2));
    legs(g, 0.36, 0.36, 0.45, w, 0.02);
    return g;
  },
  "nora-table": () => {
    // Round oak coffee table.
    const g = new THREE.Group();
    const w = PALETTE.oak();
    g.add(cyl(0.45, 0.05, w, 0, 0.38, 0, 32));
    g.add(cyl(0.06, 0.36, w, 0, 0.18, 0, 12));
    g.add(cyl(0.28, 0.03, w, 0, 0.015, 0, 24));
    return g;
  },
  "bruno-dining": () => {
    const g = new THREE.Group();
    const w = PALETTE.walnut();
    g.add(box(1.8, 0.06, 0.9, w, 0, 0.74, 0));
    for (const s of [-1, 1]) {
      g.add(box(0.06, 0.7, 0.8, PALETTE.blackMetal(), s * 0.75, 0.36, 0));
      g.add(box(0.1, 0.04, 0.86, PALETTE.blackMetal(), s * 0.75, 0.02, 0));
    }
    return g;
  },
  "sideboard": () => {
    const g = new THREE.Group();
    const w = PALETTE.oak();
    g.add(box(1.6, 0.62, 0.42, w, 0, 0.51, 0));
    for (const s of [-1, 1]) g.add(box(0.36, 0.02, 0.01, PALETTE.brass(), s * 0.36, 0.51, 0.215));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(cyl(0.02, 0.2, PALETTE.blackMetal(), sx * 0.68, 0.1, sz * 0.16, 8));
    return g;
  },
  "arc-lamp": () => {
    const g = new THREE.Group();
    const m = PALETTE.blackMetal();
    g.add(cyl(0.18, 0.04, m, 0, 0.02, 0, 24));
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.04, 0),
      new THREE.Vector3(0.1, 1.3, 0),
      new THREE.Vector3(0.5, 1.95, 0),
      new THREE.Vector3(1.05, 1.85, 0),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.018, 8), m));
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.24, 20, 1, true), PALETTE.paper());
    shade.position.set(1.05, 1.72, 0);
    shade.rotation.x = Math.PI;
    g.add(shade);
    const bulb = new THREE.PointLight("#ffd9a0", 4, 5, 2);
    bulb.position.set(1.05, 1.6, 0);
    g.add(bulb);
    return g;
  },
  "lantern-lamp": () => {
    const g = new THREE.Group();
    const w = PALETTE.oak();
    for (const s of [-1, 1]) {
      g.add(cyl(0.015, 1.1, w, s * 0.12, 0.55, 0.12, 6));
      g.add(cyl(0.015, 1.1, w, s * 0.12, 0.55, -0.12, 6));
    }
    const shade = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 14), PALETTE.paper());
    shade.scale.y = 0.8;
    shade.position.y = 1.12;
    g.add(shade);
    const bulb = new THREE.PointLight("#ffe6bd", 3, 4.5, 2);
    bulb.position.y = 1.12;
    g.add(bulb);
    return g;
  },
  "beni-rug": () => {
    const g = new THREE.Group();
    const tex = rugTexture("#cfc6b6", "#3a3a3a");
    tex.repeat.set(2, 1.2);
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 1 });
    const mesh = box(2.4, 0.02, 1.6, m, 0, 0.011, 0);
    mesh.castShadow = false;
    g.add(mesh);
    return g;
  },
  "monstera": () => {
    const g = new THREE.Group();
    g.add(cyl(0.17, 0.3, PALETTE.ceramic(), 0, 0.15, 0, 20));
    const leaf = PALETTE.leaf();
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const h = 0.55 + (i % 3) * 0.22;
      const stem = cyl(0.012, h, leaf, Math.cos(a) * 0.05, 0.3 + h / 2, Math.sin(a) * 0.05, 6);
      stem.rotation.z = Math.cos(a) * 0.35;
      stem.rotation.x = -Math.sin(a) * 0.35;
      g.add(stem);
      const blade = new THREE.Mesh(new THREE.CircleGeometry(0.17, 7), leaf);
      blade.position.set(Math.cos(a) * (0.1 + h * 0.35), 0.3 + h, Math.sin(a) * (0.1 + h * 0.35));
      blade.rotation.set(-Math.PI / 2.4, a, 0);
      blade.castShadow = true;
      g.add(blade);
    }
    return g;
  },
  "ottoman": () => {
    const g = new THREE.Group();
    g.add(cushion(0.62, 0.28, 0.62, PALETTE.velvet(), 0, 0.28, 0));
    legs(g, 0.44, 0.44, 0.14, PALETTE.brass(), 0.018);
    return g;
  },
};

const instanceCache = new Map<string, THREE.Group>();

/** Shared prototype per catalog id; callers clone. Keeps geometry/material reuse high. */
export function prototypeFor(catalogId: string): THREE.Group {
  let proto = instanceCache.get(catalogId);
  if (!proto) {
    const build = BUILDERS[catalogId];
    if (!build) {
      const g = new THREE.Group();
      g.add(box(0.6, 0.6, 0.6, PALETTE.fabricGrey(), 0, 0.3, 0));
      proto = g;
    } else {
      proto = build();
    }
    instanceCache.set(catalogId, proto);
  }
  return proto;
}

export function instanceFor(catalogId: string): THREE.Group {
  return prototypeFor(catalogId).clone(true);
}
