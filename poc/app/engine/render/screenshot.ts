import * as THREE from "three";

/**
 * Screenshot capture. R3F canvases are created without preserveDrawingBuffer
 * (it costs frame time), so we re-render explicitly and read the buffer in the
 * same tick — the only reliable way to grab a frame without paying for it all
 * the time.
 */

export type CaptureOpts = {
  /** Longest edge of the output, in px. 1024 for AI input, 2× canvas for export. */
  width?: number;
  mime?: "image/png" | "image/jpeg";
  quality?: number;
};

export function capture(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  opts: CaptureOpts = {},
): string {
  const { mime = "image/png", quality = 0.92 } = opts;
  const size = gl.getSize(new THREE.Vector2());
  const pixelRatio = gl.getPixelRatio();
  const target = opts.width ?? size.x;
  const scale = target / size.x;

  gl.setPixelRatio(pixelRatio * scale);
  gl.setSize(size.x, size.y, false);
  gl.render(scene, camera);
  const url = gl.domElement.toDataURL(mime, quality);

  gl.setPixelRatio(pixelRatio);
  gl.setSize(size.x, size.y, false);
  gl.render(scene, camera);
  return url;
}

export function download(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  download(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
