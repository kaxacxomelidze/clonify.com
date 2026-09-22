# Clonyfy site review and implementation

Reviewed September 5, 2026. The repository, homepage, shared navigation, account layouts and existing live-site content were reviewed before the redesign. The hero and interactive process section established the visual direction; the rest of the homepage now follows it.

## Product and story

Clonyfy turns a public website URL into an editable starting point: React and Tailwind code, visual editing, Figma export, and code or deployment destinations. Its audience includes founders, freelancers, developers and agencies who want to shorten the distance between a useful reference and a shipped project.

The design follows that story: see a reference, understand its structure, make it yours, and take ownership of the output. The original 13 homepage sections and existing routes remain in place. Product illustrations are custom HTML and SVG demonstrations; they do not call the cloning backend.

## Implemented design

- Stable editorial hero with two browser layers, a continuously rotating vector sculpture, capture indicators, pointer tilt and playback control.
- Four selectable process stages with a working visual-edit example and an export view.
- Stronger comparison graphic showing a winding rebuild path and a direct Clonyfy path.
- Seven custom feature graphics with consistent frames, aligned captions and correctly nested SVG transforms. Bars grow from a shared baseline; connected nodes remain attached to their paths.
- Export diagram, orbital illustration, audience rows, customer-quote navigation, FAQ and a decisive closing section.
- Restrained word entrances from the left and right. The time comparison becomes readable before a line draws across “7 days.”
- Replaying metric count on viewport re-entry, including upward scrolling. Pricing illumination follows hover, keyboard focus and selection; the selected plan persists after the pointer leaves.
- Dark mode only, as requested in the final refinement. Removed the toggle and theme provider. The server-rendered document and default CSS tokens are dark, regardless of OS preference or a previously stored light preference.
- Compact three-column mobile footer. At 390px it is 417px tall, down from 995px, with all nine links retained and 44px link targets.

## Responsive and motion refinements

The hero result window participates in normal layout so the caption cannot overlap it at narrow widths. The checked gap between preview and caption is 21–34px at 320, 390, 768, 1024 and 1440px. All seven feature graphics share the same frame height and caption position within each grid row.

GSAP and Lenis share one animation clock. Touch scrolling stays native. Small mobile browser-height changes do not refresh scroll positions mid-gesture; font loading and orientation changes are accounted for. Decorative scenes pause outside the viewport and when the document is hidden.

Reduced-motion preferences provide readable static content, final metric values, a completed time comparison and no continuous decorative motion. Changing that preference while the page is open also stops the active scenes.

## Branding and build

Removed the editor runtime reporter and vendor build wrapper. The application now uses direct Vite, TanStack Start, React, Tailwind and Nitro configuration. After the deployment logs identified a Node host, the production preset was corrected to `node-server`, emitting `.output/server/index.mjs` and `.output/public`. Both `npm start` and `npm run preview` run the Node server. The earlier Cloudflare worker output was incompatible with the host's start command.

Added Clonyfy SVG, PNG and ICO favicons, an Apple touch icon, vector brand components and a social preview. Shared metadata references the existing public domain. The production bundle scan contains no vendor branding, editor attributes or error-reporting hooks.

Repository integration instructions and published history remain intact. These internal records are separate from the public site. The updated assets and metadata become public when this working tree is deployed.

## Validation

- Production build and TypeScript checks pass. ESLint passes for the changed TypeScript files; existing formatting debt outside this change remains.
- Production home, login and registration return 200; the missing-page route returns 404. Browser checks report no uncaught errors or console warnings.
- No horizontal overflow at 320, 390, 768, 1024 or 1440px. Dark appearance holds for both OS color preferences and a previously stored light preference.
- Process editing/export views, monthly/yearly pricing, moving pricing illumination, FAQ, testimonials, mobile navigation, hero rotation/tilt/playback and counter replay were exercised.
- On desktop and mobile, the strike starts at scale 0 while the equation enters, then completes at scale 1. Reduced motion displays the finished comparison immediately.
- Screenshots were captured for the hero, process, comparison, all seven feature cards, gain, pricing and footer, including the narrowest mobile layout.
- Native touch gestures, mobile counter replay, browser-toolbar resizing and portrait/landscape changes pass. No page jump occurred during the simulated toolbar resize; the offscreen hero paused and live reduced-motion changes restored the static view.

## Measured performance

Three cold production-preview runs used Chrome at 390 × 844, 4× CPU slowdown, 100ms latency and 1.6Mbps download bandwidth. The baseline used the original layout after the branding cleanup. These measurements used the earlier local worker preview, before the deployment target was corrected to Node.

| Metric                     | Baseline median | Redesigned median |
| -------------------------- | --------------: | ----------------: |
| Largest contentful paint   |           5.03s |             1.90s |
| Load event                 |           2.75s |             2.41s |
| Measured resource transfer |           427KB |             254KB |
| Cumulative layout shift    |          0.0021 |                 0 |

The same local test shows about 62% faster largest-contentful paint and 40% less measured resource transfer. These are lab measurements, not deployed real-user metrics.

## Existing integration gaps

The local login/register forms remain account-page layouts without authentication handlers. Marketing calls to action continue to use the existing live signup destination. Footer Privacy and Terms links still point to placeholders.

Existing user-count, testimonial and certification claims need business-source verification. No new certification claims were introduced. The conflicting $10 mention and annual discount wording were removed; pricing retains the existing tier prices and clearly displays annual billing totals.
