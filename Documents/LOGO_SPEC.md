# JUNOHUB Logo Specification

Simple, minimalist logo spec aligned with product and existing site branding. Use this for asset production (PNG, SVG) and design handoff.

---

## 1. Product context

- **Product name:** JUNOHUB  
- **Tagline:** “The Unified Supply Chain Hub” / “Modern Commerce Infrastructure”  
- **Use:** Vendor and supplier portal, dropshipping, encrypted commerce (Gmail, Shopify, etc.).  
- **Tone:** Modern, high-performance, trustworthy, minimal.

---

## 2. Logo description (for designers / AI)

**Overall:**  
A minimal logo for a B2B supply-chain and commerce platform. Clean, geometric, no decorative detail. No tagline inside the logo.

**Icon (mark) — product-based recommendation:**  
- **Concept:** The icon should reflect **JUNOHUB as a hub** — the single place where vendors, suppliers, and stores connect. Prefer a **hub / connectivity** idea over a generic symbol.  
- **Recommended direction:** A **central node with connections** — e.g. one central dot or shape with two or three short lines or smaller nodes linking to it (suggesting “unified” and “supply chain hub”). Keep it geometric and minimal: no literal boxes, trucks, or globes.  
- **Alternative:** **Connected nodes** — e.g. three small circles or diamonds in a tight network (one central, two flanking), implying vendors and suppliers meeting at one platform.  
- Simple, bold strokes; must read clearly at 24×24px.  
- Placed inside a **rounded square** (soft corners, not a circle).  
- Icon is the only graphic element; no extra decorative shapes.  

*Note: The app currently uses a lightning bolt (Zap) as a placeholder; the above is the recommended product-aligned mark for the FYP / final branding.*

**Wordmark:**  
- The word **“JUNOHUB”** in all caps.  
- Sans-serif, heavy weight (e.g. Black or Extra Bold).  
- Tight letter-spacing (slightly negative tracking).  
- No underline, no gradient on the wordmark in the primary lockup.

**Lockup:**  
- Icon and wordmark sit side by side with a small, fixed gap.  
- Icon left, wordmark right.  
- Can be used as icon-only (e.g. favicon, app icon) or icon + wordmark (navbar, footer, docs).

**Style:**  
- Flat, no 3D or skeuomorphism.  
- No gradients in the icon for the primary version (solid fill).  
- Optional: a secondary version with a subtle top-left to bottom-right indigo gradient for the icon only, to match the website’s gradient treatment.

---

## 3. Color scheme (match the website)

Use these exact values so the logo matches the app and marketing site.

| Role            | Hex       | Usage                                      |
|-----------------|-----------|--------------------------------------------|
| **Primary**     | `#4F46E5`| Icon background (primary logo)             |
| **Primary alt** | `#6366F1`| Optional gradient end (indigo-500)         |
| **Lighter**     | `#818CF8`| Optional gradient end (indigo-400)         |
| **Icon/on-dark**| `#FFFFFF`| Symbol and wordmark on dark UI             |
| **On light**    | `#020617`| Wordmark on light backgrounds (light mode) |
| **Background**  | `#0A0E1A`| App background (dark); use for contrast     |

**Primary logo (dark backgrounds):**  
- Icon: rounded square fill `#4F46E5`, symbol (hub mark) `#FFFFFF`.  
- Wordmark: `#FFFFFF`.

**Light / alternate (light backgrounds):**  
- Icon: rounded square fill `#4F46E5` (or very light indigo `#EEF2FF` with symbol `#4F46E5`).  
- Wordmark: `#020617`.

Keep the logo color scheme limited to this indigo + white/dark set; no extra accent colors in the mark or wordmark.

---

## 4. Dimensions and resolution

### Icon (mark only)

| Asset            | Size (px) | Format | Use case                          |
|------------------|-----------|--------|-----------------------------------|
| Favicon          | 32 × 32   | PNG/SVG| Browser tab, bookmarks             |
| PWA icon         | 192 × 192 | PNG    | Android / PWA (manifest)          |
| PWA icon         | 512 × 512 | PNG    | High-res PWA, splash               |
| Apple touch      | 180 × 180 | PNG    | iOS home screen (manifest)        |
| Navbar/sidebar   | 40 × 40   | —      | In-app (can be SVG or 2x PNG 80×80)|
| Marketing        | 48 × 48+  | SVG/PNG| Landing, footer, social, docs      |

**Recommended:**  
- Export SVG for icon (scalable).  
- Export PNG at **1x and 2x** for 32, 192, 512, and 180 where needed.  
- Minimum clear space: ~1/4 of icon height on all sides.

### Full logo (icon + wordmark)

| Context   | Icon size | Notes                          |
|-----------|-----------|---------------------------------|
| Navbar    | 40 × 40   | Icon + “JUNOHUB” wordmark       |
| Footer    | 40 × 40   | Same lockup                     |
| Marketing | 48 × 48+  | Scale wordmark with icon ratio  |

**Aspect ratio:**  
- Icon: 1∶1.  
- Lockup: define one preferred width (e.g. icon 40px) and keep proportion for “JUNOHUB” (e.g. ~20–24px cap height).

### Resolution rules

- **Raster (PNG):** 72 ppi for web; 144 ppi acceptable for 2x assets.  
- **Minimum size:** Icon should read clearly down to 24×24px; avoid thin strokes below 2px.  
- **Safe zone:** Do not crop into the rounded square; keep padding so the shape is fully visible.

---

## 5. File naming (reference)

- `icon.svg` — Icon only, scalable.  
- `icon-192.png` — 192×192 PWA.  
- `icon-512.png` — 512×512 PWA.  
- `apple-icon.png` — 180×180 Apple touch.  
- `logo.svg` — Full lockup (icon + wordmark).  
- `logo-dark-bg.svg` / `logo-light-bg.svg` — Optional light/dark variants.

---

## 6. Do not

- Add gradients to the wordmark.  
- Use more than one accent color in the mark.  
- Use a generic symbol (e.g. lightning, star) that does not relate to hub / supply chain / connectivity.  
- Use thin or script type for “JUNOHUB”.  
- Stretch or alter the rounded-square proportion (keep 1∶1).

---

*Aligned with JUNOHUB app and landing (navbar, sidebar, footer, manifest, `globals.css`).*
