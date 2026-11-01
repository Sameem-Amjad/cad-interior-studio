"use client";

import dynamic from "next/dynamic";

// The whole studio is client-only: WebGL, WASM and localStorage all the way down.
const Studio = dynamic(() => import("../../components/Studio"), {
  ssr: false,
  loading: () => (
    <div className="grid h-screen w-screen place-items-center text-[13px] text-text-secondary">Loading studio…</div>
  ),
});

export default function Page() {
  return <Studio />;
}
