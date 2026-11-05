# MathForge — Vibe96 Submission Pack

**Prepared:** 2026-11-05
**Submission status:** Technical package preparation in progress; final Vibe96 dashboard submission and listing review remain owner actions.

## Product listing

### Product name

MathForge

### Tagline

Create, explore, save, and export mathematical graphs in one offline-first workspace.

### Short description

MathForge is a browser-based mathematical visualization workspace with five graph generators: Coordinates, Equation, Ogive, Histogram, and Pie Chart. It combines graph inputs, shared visual settings, portable project files, and image export in a static application designed for offline-capable use.

### Long description

MathForge brings common classroom graphing workflows into one focused workspace. Plot coordinate points and explicitly selected connections, explore multiple supported equations on a shared plane, create ogives and histograms, or build pie and donut charts with calculation tables and manual drawing steps. Shared graph design controls keep visual preferences consistent, while each generator retains its own data as users switch between tools.

Projects can be saved locally in the browser or exported as portable `.mathforge` files. Graphs can be exported as PNG, with SVG available for supported tools. MathForge is a static web application with local runtime assets and an app-shell service worker for eligible hosted contexts.

## Intended users

- Teachers preparing mathematical examples and classroom visuals.
- Students learning coordinate graphs, equations, cumulative frequency, histograms, and pie-chart calculations.
- Tutors and educational-content authors who need exportable graph illustrations.

## Included tools

1. **Coordinates** — point plotting, labels, manually selected point connections, explicit closed shapes, and optional fill.
2. **Equation** — multiple supported equations and coordinate points on a common graph canvas.
3. **Ogive** — cumulative-frequency graphing.
4. **Histogram** — histogram and polygonal graphing.
5. **Pie Chart** — pie/donut charts, category legend, percentage/angle calculations, copyable table, and drawing steps.

## Technical profile

- Static HTML, CSS, and JavaScript; no application framework or runtime CDN dependency.
- No npm dependency installation is required for the current project.
- Project data uses the existing version-1 `.mathforge` JSON container and browser-local IndexedDB recovery.
- Local fonts and image assets are bundled with the project.
- Vercel and Netlify static deployment configuration is included.

## Requirements and access

Use a current desktop browser; recent Chrome or Edge is recommended for installation, file-handler, and save-picker capabilities. Modern browsers can run the workspace, with feature support varying by browser. HTTPS or localhost is required for service-worker/PWA features. Direct standalone HTML pages remain included for legacy access.

### Clean-machine setup

**For buyers using a hosted listing:** open the MathForge URL in a current browser; no installer, account, extension, Node.js, or npm package installation is required to use the hosted app. PWA installation is optional and browser-dependent.

**For a local source/package review:** extract the archive, open a terminal in its root, and serve it over localhost with Python 3 if already available:

```powershell
py -m http.server 8000
```

If the `py` launcher is unavailable but Python is installed, use `python -m http.server 8000`. Then visit `http://localhost:8000/`. The package includes a generated `dist/` directory for static hosting. The app can also be deployed using the included Vercel or Netlify configuration. Avoid running the build script in the source checkout when its existing `dist/` must be preserved: it deletes and recreates that directory. No `npm install` step is required.

## Persistence and privacy summary

Projects are saved in the current browser profile or exported by the user as `.mathforge` files. MathForge does not provide cloud synchronization. Local browser data can be cleared or evicted by the browser; portable project backups are recommended for long-term retention. The static app shell can be cached for offline use after an initial online visit in a supported secure context. Project contents are not added to the service-worker cache.

## Exports

PNG export is available for the graph tools. SVG availability and vector fidelity vary: Pie Chart exports native SVG, while some Cartesian/statistical SVG outputs wrap raster renderer output. Equation Plotter exports have a white background suitable for documents and printing.

## Deployment paths

### Vercel

- Build command: `node scripts/prepare-vercel.mjs`
- Output directory: `dist`
- Configuration: `vercel.json`

### Netlify

- Build command: `node scripts/prepare-vercel.mjs`
- Publish directory: `dist`
- Configuration: `netlify.toml`
- Includes the `/open-project` application rewrite and cache-sensitive headers for the service worker and web manifest.

The preparation script replaces `dist/`; production build validation should be performed in a staging copy. Verify current Vibe96 hosting requirements and supported archive format in the submission dashboard before upload.

## Support and update commitments

The repository does not currently publish a support email, response-time target, maintenance window, or guaranteed update period. Before listing, the owner should add the chosen support contact and set realistic response and maintenance expectations in the Vibe96 fields. Updates are delivered by publishing a new static app build; the service worker uses versioned app-shell caches and clients receive updates when they revisit online. No update cadence or long-term support guarantee is currently stated.

## Submission assets checklist

- [x] Capture a clean desktop workspace with the five-tool toolbar and readable graphs. Genuine 1920×1080 captures are included in `submission-screenshots/` in the staged archive.
- [x] Capture Coordinates, Equation, Ogive, Histogram, and Pie Chart examples.
- [ ] Inspect and approve the screenshots for final marketing use; the captures are technical evidence and show the app's current test data.
- [ ] Capture responsive layout on a narrow screen if mobile support is described in the listing.
- [ ] Record a short demo: select a tool, enter data, adjust design settings, switch tools, save/open a project, and export a graph.
- [ ] Include screenshots/video only after visually checking that no personal project data or browser profile information is exposed.
- [ ] Confirm all asset and font redistribution rights, include required license files, and retain third-party notices.
- [ ] Review the listing text against actual browser acceptance and known limitations.
- [ ] Confirm final package contents and upload only through the owner-controlled Vibe96 dashboard.

Captured files (each verified at 1920×1080):

- `submission-screenshots/01-pie-chart-1920x1080.jpg`
- `submission-screenshots/02-coordinates-workspace-1920x1080.jpg` (empty coordinates plane; not marketing-approved)
- `submission-screenshots/03-equation-plotter-1920x1080.jpg`
- `submission-screenshots/04-ogive-1920x1080.jpg`
- `submission-screenshots/05-histogram-1920x1080.jpg`

Screenshot review: the Coordinates capture is a clean but empty coordinate plane, so it is accurate as a workspace view but is not approved as a graph example. Capture and owner-approve a populated Coordinates connections/shapes screenshot before using the set for marketing. The other four captures were visually reviewed as representative test data; owner marketing approval remains required.

## Seller readiness — owner actions required

| Item | Current status |
|---|---|
| Live public HTTPS demo URL | Not supplied; owner must publish and test one. |
| Five approved screenshots | Five technical captures exist; Coordinates is blank and not approved. Owner must replace/approve it and approve the remaining captures. |
| Product description, stack, requirements, and price | Product/stack/requirements are drafted in this pack; owner must set the final price and approve listing copy. |
| Vibe96 Seller Agreement version and owner signature | Not reviewed or signed. Owner must review the current version and complete any required signature. |
| 12-month defect/security updates and 30-day support with two-business-day response | These are requested seller commitments, not commitments MathForge currently makes. Owner must confirm capacity and explicitly accept before listing. |
| Dashboard fields and audit submission | Not verified; owner must check the current dashboard and complete required fields/audit. |
| Demo uptime responsibility | Not assigned; owner must accept responsibility for hosting and availability of the public demo. |

## Listing fields to confirm in Vibe96

The Vibe96 dashboard is the final authority for its current metadata and package requirements. The owner should confirm category, supported platform labels, screenshots/video formats, package/archive format, pricing, licensing, privacy/support links, and any certification or review fields. This document intentionally does not invent prices, customer counts, endorsements, certifications, or a public demo URL.

## Known limitations to disclose accurately

- Equation support is numerical and limited to the expression forms covered by its parser/renderer; it is not general symbolic algebra.
- Some SVG outputs are raster-backed.
- PWA installation, file association, offline lifecycle, file pickers, and storage limits depend on browser/OS support.
- Bengali graph labels use locally bundled Noto Sans Bengali from the official Google Fonts repository, with the upstream OFL 1.1 text and attribution included under `assets/fonts/`. The source path, variable axes, copyright metadata and SHA-256 are recorded in `assets/fonts/README.md`. No external font request is required. Legacy Kalpurush files remain in the source tree but are excluded from generated `dist/` output; previously created release ZIPs still contain their earlier font assets and must be rebuilt before distribution.
- Final Vibe96 package upload, listing preview, and buyer-facing browser acceptance have not been completed as part of this preparation.
