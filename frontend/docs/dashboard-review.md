# Dashboard review and demo workspace

The dashboard is an interactive frontend demo. It does not fetch source websites, run an AI model, connect external services, invite real members, or process payments. Sample content and local changes are identified in the interface.

## Reference coverage

| Reference area                  | Clonyfy implementation                                                                                                            |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard / overall information | Overview with capture totals and pending tasks                                                                                    |
| Weekly and monthly progress     | Colored weekly chart and task completion ring                                                                                     |
| Month goals and task cards      | Shared tasks with completion, pinning, editing and archive                                                                        |
| Calendar                        | Month navigation, selected-day agenda, task labels and drag-to-reschedule; due-date editing works on mobile and with the keyboard |
| My Tasks                        | Search, status filters, add/edit, complete, pin, archive, restore and delete                                                      |
| Statistics                      | Analytics with sage, champagne and slate series; three sample reporting periods and a data table                                  |
| Documents                       | Downloadable capture CSV, standalone sample HTML and a launch checklist                                                           |
| Integrations                    | GitHub, Figma, Slack and Notion demo toggles and sample events                                                                    |
| Teams                           | Design and Development groups; local sample member management                                                                     |
| Last projects                   | Working sort/view controls and capture details                                                                                    |
| Settings                        | Editable General and Notifications preferences; dedicated Billing, Members and Integrations destinations                          |

Clonyfy also has its product-specific Clone, Library, Activity and Subscription sections.

## Capture flow

1. Enter a URL or select a sample. Validate page/depth limits.
2. Simulate connection, page exploration, asset collection, component reconstruction and workspace preparation.
3. Watch a GSAP globe feed a reconstruction core and a scrolling sample browser. Pause, resume or cancel the simulation.
4. Customize the sample headline and accent; compare desktop and mobile previews.
5. Download standalone HTML, a React wrapper, or an editable SVG for Figma. Copy HTML or open the GitHub/deployment guide.
6. Inspect the completed run in Library and Activity. Export a CSV of the filtered capture list.

The React sample intentionally wraps the HTML concept in an isolated iframe; it is not a full reconstruction of the source site's component tree. The Figma download is a sample editable SVG. No source-code ZIP, published preview or external repository is invented.

## Data and rendering

- `DashboardWorkspace` shares capture and task state. Up to 30 newly completed sample captures persist in browser storage alongside the seeded records.
- Tasks, sample profile preferences, demo integration toggles and team members persist locally. Billing interactions are session-only simulations.
- Library, Activity and Analytics use one fixed-layout capture table. Numerical columns align across every row. On narrow screens, compact cards show the domain, status, pages, assets and time together.
- Radix dialogs and sheets provide focus trapping, Escape dismissal and focus restoration. Shared Radix selects provide dark popups and rotating chevrons.
- Dashboard cards render their content immediately. Decorative GSAP scenes pause offscreen and respect reduced motion. Status spinners and chart animation also respect reduced motion.
- Dashboard-specific CSS is isolated from the marketing layouts. The existing Node production entry remains `.output/server/index.mjs`.

## Verification

Browser checks cover the complete clone workflow, escaped preview copy, actual file contents, capture persistence, column alignment, filtering, tasks/calendar sharing, settings, integrations, members and mobile navigation. Layout review covers all 12 dashboard routes at 320, 390, 768, 1024 and 1440 pixels. Screenshots and detailed execution reports are stored in the local `clonyfy-site-review` temporary artifact directory.
