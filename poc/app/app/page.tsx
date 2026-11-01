"use client";

import dynamic from "next/dynamic";

// Landing owns file parsing (web-ifc WASM, GLTFLoader) — nothing to prerender.
const Landing = dynamic(() => import("../components/Landing"), { ssr: false });

export default function Page() {
  return <Landing />;
}
