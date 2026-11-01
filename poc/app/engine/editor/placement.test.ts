import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import { GRID, ROT_STEP, clampToRoom, collides, footprintBox, snapPosition, snapRotation, suggestPlacement } from "./placement";
import type { RoomInfo } from "../ingest/types";
import { byId, CATALOG } from "../../data/catalog";
import type { PlacedItem, Vec3 } from "../scene/schema";

/**
 * Placement maths only — the part of the editor that is pure and therefore
 * worth testing (poc/docs/04 D7). Interaction is covered by the demo script.
 */

const room: RoomInfo = {
  id: "living",
  name: "Living Room",
  level: 0,
  box: new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(6, 2.75, 5)),
  floorY: 0,
  pseudo: false,
};

const sofa = byId.get("oslo-sofa")!;
const table = byId.get("nora-table")!;
const rug = byId.get("beni-rug")!;

test("snapping quantises to the 5 cm grid and 15° steps", () => {
  const snapped = snapPosition([1.234, 0, -0.717], true);
  assert.ok(Math.abs(snapped[0] - 1.25) < 1e-9 && Math.abs(snapped[2] - -0.7) < 1e-9, `got ${snapped.join()}`);
  assert.deepEqual(snapPosition([1.234, 0, -0.717], false), [1.234, 0, -0.717]);
  assert.equal(snapRotation(0.3, true), ROT_STEP * Math.round(0.3 / ROT_STEP));
  assert.equal(snapRotation(0.3, false), 0.3);
  assert.equal(GRID, 0.05);
});

test("a rotated footprint swaps its extents at 90°", () => {
  const flat = footprintBox(sofa, [0, 0, 0], 0);
  const turned = footprintBox(sofa, [0, 0, 0], Math.PI / 2);
  assert.ok(Math.abs(flat.max.x - flat.min.x - sofa.footprint.w) < 1e-6);
  assert.ok(Math.abs(turned.max.y - turned.min.y - sofa.footprint.w) < 1e-6);
});

test("clampToRoom keeps the whole footprint inside the room", () => {
  const outside = clampToRoom(sofa, [-10, 0, 99], 0, room);
  const box = footprintBox(sofa, outside, 0);
  assert.ok(box.min.x >= room.box.min.x, "west edge");
  assert.ok(box.max.x <= room.box.max.x, "east edge");
  assert.ok(box.min.y >= room.box.min.z, "north edge");
  assert.ok(box.max.y <= room.box.max.z, "south edge");
  assert.equal(outside[1], room.floorY);
});

test("clampToRoom centres an item too large for the room instead of inverting", () => {
  const closet: RoomInfo = { ...room, box: new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 2.4, 1)) };
  const at = clampToRoom(sofa, [0.2, 0, 0.9], 0, closet);
  assert.deepEqual(at, [0.5, 0, 0.5]);
});

test("collision detects overlap but ignores rugs", () => {
  const lookup = (id: string) => byId.get(id);
  const placedSofa: PlacedItem = { id: "a", catalogId: "oslo-sofa", position: [3, 0, 2], rotationY: 0, scale: 1 };
  const placedRug: PlacedItem = { id: "b", catalogId: "beni-rug", position: [3, 0, 2], rotationY: 0, scale: 1 };

  assert.equal(collides({ item: table, position: [3, 0, 2], rotationY: 0 }, [placedSofa], lookup), true);
  assert.equal(collides({ item: table, position: [5.5, 0, 4.5], rotationY: 0 }, [placedSofa], lookup), false);
  // A rug is walked on, not collided with — from either side.
  assert.equal(collides({ item: table, position: [3, 0, 2], rotationY: 0 }, [placedRug], lookup), false);
  assert.equal(collides({ item: rug, position: [3, 0, 2], rotationY: 0 }, [placedSofa], lookup), false);
  // Ignoring an item by id lets it be dragged over its own former footprint.
  assert.equal(collides({ item: table, position: [3, 0, 2], rotationY: 0 }, [placedSofa], lookup, "a"), false);
});

test("suggestPlacement never overlaps and never leaves the room", () => {
  const placed: { item: (typeof CATALOG)[number]; position: Vec3; rotationY: number }[] = [];
  for (const item of CATALOG.slice(0, 8)) {
    const { position, rotationY } = suggestPlacement(item, room, placed, placed.length);
    const box = footprintBox(item, position, rotationY);
    assert.ok(box.min.x >= room.box.min.x - 1e-6 && box.max.x <= room.box.max.x + 1e-6, `${item.id} inside x`);
    assert.ok(box.min.y >= room.box.min.z - 1e-6 && box.max.y <= room.box.max.z + 1e-6, `${item.id} inside z`);
    assert.equal(
      collides(
        { item, position, rotationY },
        placed.map((p, i) => ({ id: String(i), catalogId: p.item.id, position: p.position, rotationY: p.rotationY, scale: 1 })),
        (id) => byId.get(id),
      ),
      false,
      `${item.id} does not overlap`,
    );
    placed.push({ item, position, rotationY });
  }
});

test("suggestPlacement is deterministic", () => {
  const a = suggestPlacement(sofa, room, [], 0);
  const b = suggestPlacement(sofa, room, [], 0);
  assert.deepEqual(a, b);
});

test("wall-hugging items land against a wall", () => {
  const { position } = suggestPlacement(sofa, room, [], 0);
  const nearWall =
    Math.min(
      position[0] - room.box.min.x,
      room.box.max.x - position[0],
      position[2] - room.box.min.z,
      room.box.max.z - position[2],
    ) < 1.0;
  assert.ok(sofa.wallHugging && nearWall, "sofa should hug a wall");
});
