---
name: Studio PoC
colors:
  surface: '#111317'
  surface-dim: '#111317'
  surface-bright: '#37393e'
  surface-container-lowest: '#0c0e12'
  surface-container-low: '#1a1c20'
  surface-container: '#1e2024'
  surface-container-high: '#282a2e'
  surface-container-highest: '#333539'
  on-surface: '#e2e2e8'
  on-surface-variant: '#c2c6d6'
  inverse-surface: '#e2e2e8'
  inverse-on-surface: '#2f3035'
  outline: '#8c909f'
  outline-variant: '#424754'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e6a'
  primary-container: '#4d8eff'
  on-primary-container: '#00285d'
  inverse-primary: '#005ac2'
  secondary: '#c4c6d0'
  on-secondary: '#2d3038'
  secondary-container: '#44474f'
  on-secondary-container: '#b3b5be'
  tertiary: '#ffb786'
  on-tertiary: '#502400'
  tertiary-container: '#df7412'
  on-tertiary-container: '#461f00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#e0e2ec'
  secondary-fixed-dim: '#c4c6d0'
  on-secondary-fixed: '#191c23'
  on-secondary-fixed-variant: '#44474f'
  tertiary-fixed: '#ffdcc6'
  tertiary-fixed-dim: '#ffb786'
  on-tertiary-fixed: '#311400'
  on-tertiary-fixed-variant: '#723600'
  background: '#111317'
  on-background: '#e2e2e8'
  surface-variant: '#333539'
  viewport-bg: '#0B0D10'
  border-subtle: '#262B36'
  text-primary: '#E8EAF0'
  text-secondary: '#8A93A6'
  success: '#10B981'
  warning: '#F59E0B'
  danger: '#EF4444'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-base:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
  mono-label:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-margin: 1rem
  panel-gap: 1px
  gutter-md: 12px
  gutter-lg: 16px
  sidebar-left: 240px
  sidebar-right: 300px
  topbar-height: 56px
---

## Brand & Style

The design system is engineered for a professional 3D interior design environment, prioritizing focus, precision, and tool-grade reliability. It adopts a **Modern Corporate** aesthetic with influences from **Minimalism** to ensure the interface recedes, allowing the 3D workspace to remain the primary focal point.

The personality is calm and premium, avoiding the vibrant "app-like" energy of consumer software in favor of a technical, high-utility feel similar to industry-standard creative suites.

**Key visual principles:**
- **Chromaless UI:** Non-interactive elements stay within a monochromatic range to prevent visual noise.
- **Intentional Accents:** Color is used strictly for state, action, and selection.
- **Utility-First:** Information density is high but legible, utilizing thin borders rather than heavy shadows to define structure.

## Colors

The palette is optimized for long-session comfort in a dark environment. 

- **Surfaces:** The application uses a three-tier depth system. The `neutral` background (#0F1115) acts as the foundation, while `secondary` (#171A21) defines floating or docked panels. The `viewport-bg` provides a slightly darker void for 3D rendering.
- **Typography:** High-contrast `text-primary` for readability and mid-contrast `text-secondary` for metadata and labels.
- **Interactions:** The `primary` blue is reserved for active states, primary call-to-actions, and selection outlines. 
- **Borders:** A single, consistent border color (#262B36) is used for all panel divisions and component outlines to maintain a structured, technical grid.

## Typography

This design system uses **Inter** exclusively to maintain a clean, functional, and systematic appearance. 

- **Hierarchy:** Emphasis is placed on small-scale legibility. Panel headers use `label-caps` to differentiate structural navigation from content.
- **Data Display:** For 3D coordinates and technical values (FPS, numeric inputs), use the base Inter font but prioritize tabular lining if available to ensure numbers align vertically.
- **Spacing:** Letter spacing is tightened slightly for headlines and loosened for uppercase labels to improve scanability.

## Layout & Spacing

The layout follows a **Fixed-Fluid-Fixed** model suitable for complex dashboard tools.

- **Structure:** A fixed Top Bar (56px) spans the width. Below, a 240px Left Sidebar and a 300px Right Sidebar flank a fluid 3D Viewport.
- **Grid:** Layout relies on a "slot and panel" system rather than a traditional column grid. Panels are separated by 1px dividers (`border-subtle`) rather than large gaps.
- **Density:** Internal padding within panels should be `12px` for compact lists (e.g., Room list) and `16px` for more complex areas (e.g., Inspector or Catalog cards).
- **Responsive:** On smaller screens (tablets), the sidebars should transition to collapsible drawers to preserve viewport real estate.

## Elevation & Depth

Depth is communicated through **Tonal Layering** and **Low-Contrast Outlines**.

- **Surfaces:** Do not use soft ambient shadows. Instead, use the contrast between the App Background (#0F1115) and Panel Surface (#171A21) to indicate hierarchy.
- **Borders:** Every panel and interactive input must have a 1px solid border (#262B36).
- **Floating Elements:** Modals and floating toolbars over the 3D viewport should use a 60% background blur (Glassmorphism) with the Panel Surface color at 80% opacity to maintain context while ensuring legibility.
- **Active State:** Selection is indicated by a 1px solid Primary Blue border or a solid 2px left-accent bar for list items.

## Shapes

The shape language is refined and disciplined, using subtle rounding to soften the technical interface without appearing "playful."

- **Panels & Cards:** 8px (`rounded-lg`) for structural containers and catalog items.
- **Controls:** 6px (`rounded-md`) for buttons, input fields, and chips to create a distinct visual nested relationship within 8px panels.
- **Pills:** Floating toolbars and specific status chips (e.g., "AI Concept") use fully rounded/pill shapes to denote they are independent of the grid.

## Components

- **Buttons:** 
  - **Primary:** Solid Primary Blue background with white text.
  - **Secondary/Outlined:** Transparent background with 1px Border-Subtle.
  - **Ghost:** No border or background until hover.
- **Inputs:** 1px border-subtle, 6px radius. Focused state replaces border with Primary Blue. Labels sit above inputs in `label-sm` or `label-caps`.
- **Cards (Catalog):** 8px radius, subtle border. On hover, the border changes to Primary Blue. Thumbnails should be centered 3D renders with no background.
- **Chips/Badges:** Small, 11px text, 4px padding. Use semantic colors for status (e.g., IFC badge uses neutral-subtle, AI badge uses a subtle blue glow).
- **Toolbars:** Floating pill-shaped containers with 1px border and backdrop-blur. Icon buttons inside should be ghost-style, turning Primary Blue when active.
- **Lists:** Row height 32px-36px for high density. Active items use a Primary Blue left-border (2px) and a subtle background highlight.
- **Progress Bars:** Thin (4px-6px height), Primary Blue fill on a Border-Subtle background track.