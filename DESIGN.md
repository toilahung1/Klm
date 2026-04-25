# Design System Document

## 1. Overview & Creative North Star: "The Curated Atmosphere"
This design system rejects the "boxed-in" nature of traditional web grids. Our Creative North Star is **The Curated Atmosphere**—a philosophy that treats the browser window as an open, architectural gallery. 

Instead of rigid lines and heavy borders, we define space through **tonal transitions, intentional asymmetry, and hyper-generous negative space**. We are moving away from "standard UI" toward a premium editorial experience that feels breathable, expensive, and calm. This is achieved by shifting from structural containment (boxes) to environmental containment (layers of light and depth).

---

## 2. Colors & Surface Architecture

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning or containment. 
Boundaries must be defined through:
1.  **Background Color Shifts:** Moving from `surface` (#f8f9fb) to `surface_container_low` (#f2f4f6).
2.  **Tonal Transitions:** Using subtle shifts in the neutral scale to signal a change in context.
3.  **Negative Space:** Using the 80px–120px padding scale to create "invisible containers."

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of semi-translucent materials. 
*   **Base Layer:** `background` (#f8f9fb)
*   **Section Layer:** `surface_container_low` (#f2f4f6) or `surface_container_lowest` (#ffffff)
*   **Interactive Layer:** `surface_bright` (#f8f9fb)

### The "Glass & Gradient" Rule
To achieve a "signature" feel, floating navigation elements and foreground cards should utilize **Glassmorphism**. Use `surface_container_lowest` at 80% opacity with a `20px` backdrop-blur. 

**Signature Texture:** For primary CTAs and Hero backgrounds, avoid flat hex codes. Apply a linear gradient from `primary` (#004ac6) to `primary_container` (#2563eb) at a 135° angle to add "visual soul" and depth.

---

## 3. Typography: Editorial Authority
We utilize a dual-sans-serif approach to create a sophisticated hierarchy between brand-led headers and functional content.

*   **Display & Headlines (Manrope):** Chosen for its geometric precision and modern warmth. Use `display-lg` (3.5rem) with `-0.04em` letter-spacing to create a "locked-in" editorial look.
*   **Body & UI (Inter):** Chosen for its clinical legibility. Use `body-lg` (1rem) with a generous `1.6` line-height to ensure the "Apple-like" breathing room.
*   **The Tonal Rule:** Secondary information should never be smaller than `label-md` (0.75rem); instead of shrinking text, reduce its emphasis by using `on_surface_variant` (#434655).

---

## 4. Elevation & Depth

### The Layering Principle
Do not use shadows to create hierarchy; use **Tonal Layering**. 
*   Place a `surface_container_lowest` (Pure White) card on a `surface_container_low` (Light Gray) section. The contrast alone provides a soft, natural lift that feels integrated rather than "pasted on."

### Ambient Shadows
When an element must float (e.g., a primary CTA or a floating Modal), use an **Ambient Shadow**:
*   **Blur:** 40px–60px
*   **Opacity:** 4%–6%
*   **Color:** Use a tinted version of `on_surface` (a deep navy-grey) rather than pure black to mimic natural light dispersion.

### The "Ghost Border" Fallback
If accessibility requirements demand a container edge, use a **Ghost Border**: `outline_variant` (#c3c6d7) at **15% opacity**. It should be felt, not seen.

---

## 5. Components

### Hero Sections
*   **Layout:** Intentional asymmetry. Align text to the left with a 60% width, allowing the background `surface_variant` to bleed into the 120px padding.
*   **Padding:** Top/Bottom: 120px; Left/Right: 80px.

### High-End Cards
*   **Radius:** `xl` (3rem) for large feature cards; `lg` (2rem) for standard cards.
*   **Rule:** **No Dividers.** Separate card headers from body text using `24px` of vertical white space or a subtle background shift to `surface_container_high` for the footer area.
*   **Interactive State:** On hover, the card should transition from `surface_container_lowest` to `surface_bright` with a subtle `1.02x` scale.

### Buttons (The Interaction Anchor)
*   **Primary:** Gradient of `primary` to `primary_container`. Radius: `full` (9999px).
*   **Secondary:** Ghost style. No background, `Ghost Border` (15% opacity outline), text in `primary`.
*   **Sizing:** Min-height 56px for a premium, touch-ready feel.

### Forms & Inputs
*   **Input Fields:** Use `surface_container_highest` (#e1e2e4) with a `16px` (DEFAULT) radius. 
*   **Focus State:** Shift background to `surface_container_lowest` and apply a 2px `primary` "Ghost Border" (20% opacity).
*   **Spacing:** Group related fields with 32px of vertical gap; use 80px spacing between form sections.

---

## 6. Do's and Don'ts

### Do
*   **Do** use overlapping elements. Let a card "break the bleed" of a section transition to create depth.
*   **Do** use `on_surface_variant` for helper text to maintain a soft visual contrast.
*   **Do** prioritize vertical rhythm. If a section feels "busy," add 40px of padding before adding a line.

### Don't
*   **Don't** use 1px solid borders. It shatters the "Apple-like" premium illusion.
*   **Don't** use pure black (#000000) for text. Use `on_surface` (#191c1e) for a softer, more professional finish.
*   **Don't** cram content. If three cards don't fit comfortably with 40px gaps, move to a horizontal scroll or a stacked layout.