# Clonyfy original design brief

Original design requirements retained for reference during future visual changes.

Context

I'm building the marketing website for Clonyfy, a SaaS product. This must NOT look like a stock Framer/Webflow template — it needs to feel custom-built, premium, and unforgettable, the kind of site that would place on Awwwards Site of the Day. The audience is founders and businesses evaluating our product for the first time; the one key action is getting them to click "Get Instant Access."

Before generating anything, fetch and read the real content, structure, and copy currently live at https://www.clonyfy.com — use its actual headlines, feature descriptions, pricing, and FAQ text as the real content for every section below. Do not invent placeholder copy; reuse what already exists on that live site, only adjusting wording where I explicitly note a copy change below.

Ask me any clarifying questions you need before building, especially anywhere this brief is ambiguous.

Design Direction (apply to every section)

Bold, cinematic, premium-tech aesthetic — not "clean SaaS minimalism," not a copy-paste template look. Support full light/dark mode toggle. Dark mode should be moody and high-contrast like a premium studio site, WITHOUT background grid patterns. Primary accent color across the site: white (replacing all current purple/orange accents). Typography should feel confident and oversized in hero moments, tightening into clean readable body copy elsewhere.

Animation stack to use throughout:

Lenis (or GSAP ScrollSmoother) for buttery smooth scrolling as the base layer.

GSAP + ScrollTrigger for scroll-driven reveals, fades, and parallax depth between sections.

GSAP SplitText or Splitting.js for character/word-level headline animations (hero headline and the stats counter both need this treatment).

Framer Motion for section and state transitions (menu open/close, modal, hover states).

Custom GSAP easing curves (elastic, back, cubic-bezier) — never default linear/ease transitions.

Micro-interactions (Rive or Lottie) on buttons, icons, and process-step illustrations for tactile feedback.

Optional: a subtle Three.js or Spline interactive 3D/WebGL accent somewhere in the hero or "6-buttons" section to make the site feel technically ahead of competitors.

Core Features / Sections (Priority Order)

Navbar — full logo image on the far left (not cropped into a frame, not typed as text), minimal link layout, glassmorphism-on-scroll effect, smooth mobile hamburger transition.

Hero — reuse the real Clonyfy hero copy fetched from the live site. Build animation and layout modeled on hanzo.framer.website's hero: staggered text reveal, trust-logo strip, light/dark toggle. No grid background in dark mode.

Stats bar ("14,600" metric) — animated count-up number, fully white text/graphics, triggered on scroll into view.

How It Works — keep existing 3-step layout and copy, all text in white, each step gets its own scroll-triggered reveal animation plus a small looping micro-animation/icon per step.

The Problem — keep existing copy exactly as-is; redesign only the icon set and card styling, inspired by landio.framer.website's icon/benefit-card treatment and button style.

Features — keep layout and copy, text in white, but rebuild each feature card with richer visuals and animation inspired by landerx.framer.website, synaphr.framer.ai (#our-features), and flowra.framer.ai (#features) — think animated illustrations or looping micro-interactions per feature, not static icons.

Freedom section — keep current design and copy, text color to white only.

Interactive "orbit" section (post-Freedom) — rebuild as a radial/orbit layout inspired by hanzo.framer.website: a central headline with 6 small, smooth, minimal pill-buttons animating around it. Make the buttons noticeably smaller and smoother than a typical CTA button, or alternatively collapse them into a single animated text treatment if that reads cleaner. Preserve the orbiting/floating animation regardless of which approach is used.

Next section: text color to white only, no other changes.

[Ask me which section to remove entirely here — brief called for a deletion but didn't specify which block.]

Social Proof — text color to white only.

Pricing — replace all purple accents with white; keep layout, copy, and structure identical.

FAQ — replace all purple accents with white; keep layout, copy, and structure identical.

Final CTA section — redesign to match sermo-ai.framer.website/customers' second-screen layout and animation. Replace orange accents with white. Swap copy: "Talk to us" → "Get Instant Access"; "Ready to hear what your support could sound like?" → "Stop thinking. Build what works." Keep the same button component, layout can shift slightly to match the reference.

Footer — rebuild to match sermo-ai.framer.website/customers' footer 100% (structure, spacing, motion). Remove the CTA button currently sitting above the footer. Replace orange accents with white. Style the "Clonyfy" wordmark the way the reference site treats its own brand name in the footer.

Login page — keep current layout untouched; only recolor the logo.

Register page — keep current layout untouched; recolor the logo and update all icons.

Technical Requirements

Fully responsive: mobile-first breakpoints, and every animation above must degrade gracefully on mobile (reduce parallax/3D complexity, keep text-split and micro-interactions).

Respect prefers-reduced-motion for accessibility.

Maintain fast load performance despite heavy animation — lazy-load below-the-fold animation libraries, compress any Lottie/Rive assets.

Both light and dark mode must be fully themed, not just inverted colors — dark mode needs its own considered contrast and glow treatment.

Safe-Guard Instructions

Do not introduce a generic default default component-library look — every section must carry a deliberate, opinionated visual choice from the direction above.

Do not touch backend, auth logic, or dashboard — this prompt is front-end marketing site only.

Keep all existing real copy from the live site unless a specific replacement is called out above.

Build and review one section at a time (Navbar → Hero → Stats → How It Works → Problem → Features → Freedom → Orbit section → Social Proof → Pricing → FAQ → Final CTA → Footer → Login → Register) rather than generating the whole page at once, so each can be checked against its reference before moving to the next.

Non-Negotiable

This must not read as an off-the-shelf Framer template swapped with our logo. Every section needs a genuinely custom animation or visual treatment strong enough that a client seeing it for the first time is visibly impressed — polished, premium, and clearly differentiated from typical SaaS landing pages.
