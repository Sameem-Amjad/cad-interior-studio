import * as THREE from "three";
import { instanceFor } from "../../data/furniture";

/**
 * Catalog card thumbnails, rendered once from the same geometry the viewport
 * uses. Keeps the card and the placed object honest with each other, and means
 * a catalog change never needs a re-shot image.
 */

const cache = new Map<string, string>();
let renderer: THREE.WebGLRenderer | null = null;

function getRenderer() {
  if (renderer) return renderer;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(256, 256, false);
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  return renderer;
}

export function thumbnailFor(catalogId: string): string {
  const hit = cache.get(catalogId);
  if (hit) return hit;

  const gl = getRenderer();
  const scene = new THREE.Scene();
  const object = instanceFor(catalogId);
  // Point lights inside furniture (lamps) blow out a 256px thumbnail.
  object.traverse((o) => {
    if ((o as THREE.PointLight).isPointLight) (o as THREE.PointLight).intensity = 0.6;
  });
  scene.add(object);

  scene.add(new THREE.HemisphereLight("#dfe6f2", "#26282e", 2.1));
  const key = new THREE.DirectionalLight("#ffffff", 2.4);
  key.position.set(2.5, 4, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight("#8fb4ff", 1.1);
  rim.position.set(-3, 2, -2.5);
  scene.add(rim);

  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.length() / 2, 0.35);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 100);
  const dist = radius / Math.sin((camera.fov * Math.PI) / 360) / 1.28;
  camera.position.set(center.x + dist * 0.72, center.y + dist * 0.52, center.z + dist * 0.85);
  camera.lookAt(center);

  gl.render(scene, camera);
  const url = gl.domElement.toDataURL("image/webp", 0.85);
  cache.set(catalogId, url);

  scene.clear();
  return url;
}
