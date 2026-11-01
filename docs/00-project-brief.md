# 00 — Project Brief

## Vision

Customers see and design their future home before it is built. Engineers upload CAD/BIM drawings, the platform converts them into an interactive 3D model in the browser, customers design the interiors with AI assistance using **real products from the client's catalog**, a consultant reviews and approves, and the platform generates the bill of materials, quotation, and order — automatically, from the design itself.

**The commercial core is the quote-to-order funnel.** The 3D experience and AI features exist to feed it. Every design decision in this codebase should be tested against one question: *does this keep the design connected to real, priced, orderable products?*

## Users and roles

| Role | Who they are | What they do |
|---|---|---|
| `ENGINEER` | Client's architects/engineers | Upload CAD files, verify converted 3D models, publish projects |
| `CUSTOMER` | Home buyers / owners | Explore the 3D home, design interiors, compare versions, approve & pay |
| `CONSULTANT` | Client's interior design staff | Review submitted designs, adjust, comment, approve (triggers quotation) |
| `ADMIN` | Client's operations staff | Manage catalog, users, projects, orders; view all data |

## Core user journey (canonical)

```
Engineer uploads CAD ──▶ Conversion pipeline ──▶ 3D model published
        ──▶ Customer explores & designs (catalog items + AI style concepts)
        ──▶ Customer submits design version
        ──▶ Consultant reviews / adjusts / approves
        ──▶ BOM + quotation generated from the approved version
        ──▶ Customer approves & pays (Stripe)
        ──▶ Order handed to implementation team
```

## The two-track AI principle (non-negotiable)

- **Track A — AI Concept Studio**: generative images for inspiration. Output is a *picture*, never data. It must never be presented as something purchasable.
- **Track B — Buildable design**: 3D scene composed of catalog products (SKU + price + supplier). This is the only thing that can be quoted.

Any feature that lets an AI-generated image masquerade as a quotable design is a bug, no matter how good the demo looks.

## MVP scope

### In scope (Phases 1–3)

- Auth + four roles, org-scoped data
- CAD upload → conversion → browser 3D viewing (path decided in discovery, see [04](04-cad-3d-pipeline.md))
- Room navigation and walkthrough
- Catalog-based furniture/material placement with live running price
- Design versions: save, compare, submit
- AI style concept generation (Track A) + Claude design assistant
- Consultant dashboard: review, comment, edit, approve
- Automatic BOM + quotation (PDF + web), customer approval, Stripe payment
- Order record handed to implementation team
- Admin: catalog CRUD, user management, project overview

### Out of scope for MVP (roadmap)

- Automatic 2D floor plan → 3D reconstruction (research-grade; manual/guided modeling instead)
- Voice control, budget-constrained auto-redesign, full-room auto-styling
- AI-generated 3D assets (Meshy/Tripo), room-understanding models (SAM etc.)
- Photorealistic path-traced rendering, NVIDIA Omniverse
- Supplier marketplace, multi-tenancy beyond one client org

## Success criteria (MVP)

1. A real client CAD file goes from upload to explorable 3D with no engineer intervention (3D BIM inputs) or ≤ 1 working day of guided modeling (2D inputs).
2. A customer can produce a submitted design in one session; the live price total always matches the BOM engine's computation exactly.
3. Consultant approval produces a correct quotation in < 30 seconds, with zero manual price entry.
4. End-to-end funnel (upload → paid order) demonstrated with real catalog data.

## Glossary

| Term | Meaning |
|---|---|
| **APS** | Autodesk Platform Services (formerly Forge) — cloud APIs for CAD file translation and viewing |
| **BIM** | Building Information Model — 3D building data with semantics (walls, doors, levels) |
| **IFC** | Industry Foundation Classes — open BIM file format |
| **DWG/DXF** | AutoCAD formats; may contain 2D drawings or 3D models |
| **Revit (RVT)** | Autodesk BIM authoring tool/format |
| **SVF2** | APS's optimized viewing format produced by the Model Derivative API |
| **URN** | Base64 identifier for a translated model in APS |
| **glTF/GLB** | Standard runtime 3D format; GLB is the binary container. Our internal 3D interchange format |
| **DRACO / meshopt** | Mesh compression codecs for glTF |
| **KTX2** | GPU-compressed texture container |
| **R3F** | React Three Fiber — React renderer for Three.js |
| **Scene** | The JSON document describing a design version: placed items, materials, room states |
| **SKU** | Stock Keeping Unit — a purchasable catalog product variant |
| **BOM** | Bill of Materials — the priced list of all items in an approved design |
| **Design version** | Immutable snapshot of a scene; the unit of review, comparison, and quotation |
