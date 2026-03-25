# Design System Specification: The Intelligent Voyager

## 1. Overview & Creative North Star: "The Digital Concierge"
This design system moves away from the cluttered, "utility-first" look of traditional booking engines and moves toward a **High-End Editorial** experience. Our North Star is **The Digital Concierge**: an interface that feels authoritative yet invisible, using sophisticated whitespace and tonal layering to guide the traveler through complex itineraries without cognitive overload.

To break the "template" feel, we reject rigid, boxed grids. Instead, we utilize **intentional asymmetry**—offsetting high-contrast display typography against minimalist UI elements—and **overlapping surfaces** to create a sense of physical depth and curated luxury.

---

## 2. Colors & Surface Architecture
Our palette balances the authority of `primary` (Deep Navy) with the energy of `secondary` (Vibrant Teal), set against a sophisticated grayscale of `surface` tokens.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to define sections. Boundaries must be achieved through:
- **Background Color Shifts:** Placing a `surface-container-low` section against a `surface` background.
- **Tonal Transitions:** Using subtle shifts between `surface-container` tiers to denote hierarchy.

### Surface Hierarchy & Nesting
Treat the UI as a series of stacked, premium materials. Use the following tiers to define depth:
- **Base Level:** `surface` (#f8f9fa) for the main canvas.
- **Secondary Level:** `surface-container-low` (#f3f4f5) for large groupings or sidebar backgrounds.
- **Action Level:** `surface-container-lowest` (#ffffff) for the highest-priority cards and interactive modules.
- **Interaction Level:** `surface-container-high` (#e7e8e9) for hovered states or inset elements.

### The "Glass & Gradient" Rule
To evoke a "tech-forward" spirit, use **Glassmorphism** for floating navigation bars or map overlays. Apply `surface-container-lowest` with a 70% opacity and a `20px` backdrop-blur. 
- **Signature Texture:** For primary CTAs and Hero backgrounds, use a linear gradient from `primary` (#000514) to `primary-container` (#001e43) at a 135-degree angle to provide visual "soul."

---

## 3. Typography: Editorial Authority
We pair the geometric precision of **Plus Jakarta Sans** for headers with the high-legibility of **Inter** for dense data.

*   **Display (Plus Jakarta Sans):** Used for destination names and hero headers. `display-lg` (3.5rem) should use tight letter-spacing (-0.02em) to feel premium.
*   **Headline (Plus Jakarta Sans):** Use `headline-sm` (1.5rem) for section titles. These should never be boxed; let them float with ample `spacing-12` top margins.
*   **Body (Inter):** All itinerary details and descriptions use `body-md` (0.875rem). The high x-height of Inter ensures readability in dense "Day-at-a-glance" views.
*   **Labels (Inter):** `label-md` (0.75rem) in `secondary` (#00696b) is used for category tags (e.g., "Boutique Hotel," "Cultural Landmark").

---

## 4. Elevation & Depth: Tonal Layering
Traditional shadows are a last resort. We prioritize **Tonal Layering** to convey importance.

*   **The Layering Principle:** Place a `surface-container-lowest` (#ffffff) card on a `surface-container-low` (#f3f4f5) background. The 2-bit color shift creates a "natural lift" that feels more integrated than a shadow.
*   **Ambient Shadows:** For floating Map Markers or elevated Action Sheets, use a "Cloud Shadow": 
    - `Y: 8px, Blur: 24px, Spread: -4px`. 
    - Color: `on-surface` (#191c1d) at 6% opacity.
*   **The "Ghost Border" Fallback:** If accessibility requires a stroke (e.g., in high-contrast modes), use `outline-variant` (#c4c6cf) at **15% opacity**. Never use 100% opaque borders.

---

## 5. Signature Components

### Cards & Itinerary Modules
- **Rule:** Forbid divider lines. 
- **Style:** Use `spacing-6` (1.5rem) of vertical white space to separate itinerary items. Use a `surface-container-lowest` card with a `rounded-lg` (1rem) corner radius.
- **Visuals:** Use a `primary-fixed-dim` (#a9c7ff) background for small date badges to pop against the navy primary text.

### Buttons (The "Tech-Smart" Interaction)
- **Primary:** Gradient fill (`primary` to `primary-container`), `rounded-full`, white text.
- **Secondary:** `surface-container-high` fill with `secondary` text. No border.
- **Tertiary:** Text-only in `secondary`, using `spacing-2` horizontal padding for a subtle hover-state background shift.

### Polished Map Markers
- Custom SVG "Pill" shapes using `secondary` (#00696b) for the base.
- Active state: Scale up by 1.2x and add a `primary` outer glow using the Ambient Shadow spec.

### Selection Chips
- Use `rounded-md` (0.75rem).
- **Unselected:** `surface-container-highest` background, `on-surface-variant` text.
- **Selected:** `secondary` background, `on-secondary` (white) text.

---

## 6. Do’s and Don’ts

### Do:
- **Do** use asymmetrical layouts (e.g., a headline aligned left with a card offset to the right) to create an editorial feel.
- **Do** use `spacing-20` or `spacing-24` for section breaks to let the high-end photography "breathe."
- **Do** use `secondary-fixed` (#5af8fb) sparingly as a "highlighter" for key data points (e.g., flight prices).

### Don’t:
- **Don’t** use 1px dividers between list items; use background color shifts or empty space.
- **Don’t** use harsh #000000 shadows; always tint shadows with the `on-surface` color.
- **Don’t** use "Standard" blue for links; use the brand `secondary` (#00696b) or `primary` for a more "tech-smart" professional tone.
- **Don’t** crowd the interface. If an itinerary view feels dense, increase the `surface-container` nesting depth rather than adding more lines.