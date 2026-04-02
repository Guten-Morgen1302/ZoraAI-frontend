# Zora Frontend Architecture

This document explains the frontend system in depth, covering both runtime surfaces:

- `frontend/zora-ai`: the main web UI (Next.js App Router)
- `frontend/extension`: the Gmail browser extension (Manifest V3 content script)

The goal is to explain how the frontend is built, how data moves through it, and what each module is responsible for.

---

## 1) Frontend System Overview

Zora frontend is a dual-surface client layer over the same local backend (`http://localhost:8000` / `http://127.0.0.1:8000`):

- The **web app** provides full workflows for analysts:
  - Authentication and session handling
  - Module-specific threat analysis UIs (SMS, Email, URL, Attachment, Voice)
  - Unified portal orchestration (mixed input, multi-pipeline execution)
  - Historical investigation and detail review
  - API key lifecycle management
- The **Gmail extension** embeds fast phishing triage directly inside Gmail:
  - Extract sender/subject/body from opened emails
  - Trigger backend email analysis with optional LLM explanation
  - Render in-page result panel and contextual highlighting for phishing outcomes

Both surfaces share these architecture principles:

- Backend-first threat computation (frontend is orchestration and presentation layer)
- Cookie-based auth/session on web app (`credentials: include`)
- Progressive UI state transitions (idle -> loading -> result/errors)
- Per-module history retrieval + drill-down analysis detail
- Explainability-first output rendering (risk scores, rationale fields, engine details)

---

## 2) Technology Stack

### Web app (`zora-ai`)

- Framework: Next.js 16 App Router + React 19 + TypeScript
- Styling: Tailwind CSS v4 + global custom CSS utilities
- State: local React state for module pages, Zustand for portal workflow state
- Charts: Chart.js + `react-chartjs-2` for radar/bar/doughnut visualizations
- File ingestion UX: `react-dropzone`
- HTTP client:
  - `fetch` used directly in many pages
  - `axios` wrapper (`lib/api.ts`) for reusable API calls

### Extension (`extension`)

- Chrome Extension Manifest V3
- Gmail content script injection (`content.js`)
- In-page overlay panel and utility styles (`styles.css`)
- Host permission targeting local backend API

---

## 3) Project Layout and Responsibilities

## Root frontend

- `frontend/README.md`: this document
- `frontend/zora-ai`: web app codebase
- `frontend/extension`: browser extension codebase

## Web app (`zora-ai`) major layout

- `app/layout.tsx`: root HTML shell, font loading, metadata
- `app/globals.css`: global design tokens/utilities/animations/component classes
- `app/page.tsx`: marketing/landing entry
- `app/login/page.tsx`, `app/signup/page.tsx`: auth screens
- `app/home/layout.tsx`: authenticated shell (left nav + top bar + logout + user context)
- `app/home/page.tsx`: dashboard overview
- `app/home/sms/page.tsx`: SMS analysis UI
- `app/home/email/page.tsx`: email analysis UI
- `app/home/url/page.tsx`: URL analysis UI
- `app/home/attachments/page.tsx`: attachment sandbox UI
- `app/home/voice/page.tsx`: voice deepfake UI
- `app/home/portal/page.tsx`: multi-input orchestrated analysis chat portal
- `app/home/history/page.tsx`: cross-module analysis history explorer with details panel
- `app/home/profile/page.tsx`: account + API key management
- `lib/api.ts`: typed API helper wrappers with axios and credentials
- `lib/orchestrator.ts`: portal orchestration logic (primary pipelines + extracted URL secondary analysis + verdict aggregation)
- `lib/portalStore.ts`: Zustand store for portal pending jobs/messages/analysis transitions

## Extension (`extension`) major layout

- `manifest.json`: extension metadata, match rules, host permissions
- `content.js`: Gmail DOM extraction, API calls, panel rendering, mutation observer lifecycle
- `styles.css`: buttons, overlay, loader, phishing highlight styles

---

## 4) Runtime Architecture (Web App)

## 4.1 Root shell and typography

`app/layout.tsx` defines the global shell:

- Loads Inter + Space Grotesk through `next/font/google`
- Exposes fonts via CSS variables (`--font-inter`, `--font-space`)
- Declares app metadata for title/description
- Wraps full app in dark-themed baseline classes

`app/globals.css` establishes:

- Tailwind import and token mapping
- Always-dark visual baseline (black background, white foreground)
- Reusable component classes (`auth-card`, `auth-input`, `glass-card`, etc.)
- Global animation utilities (`animate-fade-in-up`, pulse glow)
- Shared button styles used across landing/auth flows

## 4.2 Public funnel

- `app/page.tsx`: marketing landing page with hero, capabilities, architecture explanation, and CTA links
- `app/login/page.tsx` and `app/signup/page.tsx`:
  - Submit to backend auth endpoints
  - Use `credentials: include` for cookie sessions
  - Redirect to `/home` on success
  - Present inline failure messages on non-2xx responses

## 4.3 Authenticated shell

`app/home/layout.tsx` is the primary authenticated container:

- Loads profile data via `/auth/me`
- Renders static sidebar nav for all modules
- Shows active module context in top bar
- Handles logout by POST `/auth/logout`, then redirect to `/`
- Preserves shell stability during initial hydration to reduce mismatch issues

---

## 5) Feature Module Architecture

Each analyzer module follows a shared lifecycle pattern:

1. Capture user input
2. Trigger module-specific backend endpoint
3. Render result summary + deep technical fields
4. Refresh history list
5. Support history detail reload and deletion/clear operations

This gives consistent analyst ergonomics while preserving modality-specific depth.

## 5.1 SMS Analyzer (`app/home/sms/page.tsx`)

Core responsibilities:

- Submit text for analysis (`/text/sms/analyze`) with optional LLM explanation toggle
- Display scored outputs: `risk_score`, `fraud_type`, confidence and flags
- Visualize signal composition using:
  - Radar chart (NLP, stylometry, similarity)
  - Horizontal bar chart (NLP, stylometry, similarity, URL risk, urgency)
- Render LLM explanation when enabled and returned
- Manage history (`/text/sms/history`, detail, delete single, clear all)
- Capture analyst feedback to `/text/sms/feedback`

Important behavior:

- Keeps pending destructive actions in a confirmation state before delete/clear
- Opens feedback modal pre-filled from inferred prediction label class

## 5.2 Email Analyzer (`app/home/email/page.tsx`)

Core responsibilities:

- Collect sender, subject, body inputs
- Submit to `/text/email/analyze` with optional LLM explanation
- Display risk score, fraud type, confidence, email metadata, optional LLM fields
- Render radar + bar charts for NLP/stylometry/similarity signals
- Manage history with detail and destructive operations
- Submit human feedback payload for retraining path

Important behavior:

- Uses normalized model prediction extraction from `nlp_prediction` and fallback values
- Supports loading historical records back into result view for review and correction feedback

Note:

- The feedback submit endpoint currently appears as `/text/email/feeback` in code. If backend uses `/feedback`, this needs correction.

## 5.3 URL Scanner (`app/home/url/page.tsx`)

Core responsibilities:

- Submit URL to `/url/analyze` with optional LLM explanation
- Present layered URL intelligence:
  - `risk_score`, `phishing_probability`, `risk_level`
  - pipeline checks and component risk slices (URL/content/cookie/infra/behavior)
  - sandbox counters and derived feature families
- Render radar + bar charts over risk component composition
- Manage URL history lifecycle (`/url/history` detail/delete/clear)
- Submit URL model feedback to `/url/feedback`

Important behavior:

- Strongly typed coercion utilities (`asNumber`, `asString`, `asArray`) harden rendering against inconsistent payload shapes
- Maintains feedback form state with contextual defaults

## 5.4 Attachment Analyzer (`app/home/attachments/page.tsx`)

Core responsibilities:

- Accept drag-drop or file picker upload
- Send multipart payload to `/attachment/analyze` with optional LLM explanation flag
- Display final verdict + status + filename + size and engine-level outcomes
- Visualize:
  - per-engine normalized risk bars
  - flagged vs non-flagged donut
  - top numeric feature magnitudes from nested feature object flattening
- Manage history (`/attachment/history` detail/delete/clear)

Important behavior:

- Flattens nested feature object recursively to extract meaningful numeric telemetry
- Highlights engine signatures/hits and maps verdict style class set by threat level

## 5.5 Voice Analyzer (`app/home/voice/page.tsx`)

Core responsibilities:

- Accept audio upload through drag-drop or picker (`audio/*`)
- Submit to `/voice/analyse` (multipart)
- Render:
  - voice verdict and deepfake confidence
  - fraud score (`/10`) and boolean fraud status
  - transcript and LLM/system fraud logic narrative
  - red flag chips
- Manage history (`/voice/history` detail/delete/clear)

Important behavior:

- Treats deepfake result as derived from `voice_analysis.pred_label`
- Keeps transcript-first analyst experience for interpretation and auditability

---

## 6) Portal: Unified Multi-Input Orchestration

`app/home/portal/page.tsx` + `lib/orchestrator.ts` + `lib/portalStore.ts` provide the advanced workflow surface.

## 6.1 UX model

Portal accepts mixed inputs in one session:

- Manual text interpreted as URL/email/SMS
- File and voice uploads
- Explicit add modes through attachment picker

Conversation uses message roles:

- `user`: submitted analysis jobs
- `thinking`: dynamic progress state
- `result`: aggregated multi-pipeline output

## 6.2 Store model (`portalStore.ts`)

Zustand state stores:

- `messages`
- `pendingJobs`
- `isAnalyzing`

Actions include:

- job queue modifications (`addJob`, `removeJob`, `clearJobs`)
- message insertion/replacement
- thinking message updates
- replace thinking with final aggregated result

## 6.3 Orchestration algorithm (`orchestrator.ts`)

Pipeline flow:

1. Split voice jobs from other primary jobs
2. Run all primary and voice pipelines concurrently
3. Parse results for embedded URLs from:
   - email body payload
   - SMS payload
   - attachment analysis output (JSON string scan)
4. Deduplicate URLs and run secondary URL analyses
5. Merge primary + extracted + voice results
6. Compute overall verdict (`SAFE` / `SUSPICIOUS` / `DANGEROUS`) by max threat logic

Threat mapping logic:

- URL: `max(risk_score, phishing_probability)`
- SMS/Email: `risk_score`
- Attachment: mapped by `final_verdict`
- Voice: mapped by `pred_label`

## 6.4 Portal persistence

Portal chat sessions are persisted by backend endpoints:

- list/create/get/update/delete chat
- local message serialization strips file objects before save
- chat title is auto-derived from first user intent text and updated with debounce

This provides a lightweight analyst case timeline without implementing local-only chat memory.

---

## 7) History and Investigative Workflow

There are two complementary history surfaces:

- **Module-local side panels** in each analyzer page:
  - quick access to recently analyzed artifacts
  - in-context detail load
  - delete / clear operations with confirmation
- **Centralized history page** (`app/home/history/page.tsx`):
  - tabbed cross-module index (SMS/Email/URL/Attachment/Voice)
  - compact table with verdict + score + timestamps
  - expandable detail side panel
  - engine and signature rendering for attachment investigations

This dual model supports both rapid iteration and cross-domain retrospective review.

---

## 8) Profile and API Key Management

`app/home/profile/page.tsx` handles account and API credential UX:

- Reads user profile from `/auth/me`
- Lists API keys from `/api-keys`
- Requests new key via `/api-keys/request`
- Reveals key value on demand via `/api-keys/{key_id}/reveal`
- Computes active key count using expiry and status
- Displays reveal modal with explicit copy-to-clipboard affordance

This page is the bridge between UI operators and external API/SDK clients.

---

## 9) API Client Layer

`lib/api.ts` provides reusable wrappers with a configured axios instance:

- Base URL hardcoded to `http://localhost:8000`
- `withCredentials: true` enabled globally
- JSON defaults for standard requests and multipart override for files

Coverage groups:

- auth
- analyzer endpoints
- per-module history and detail
- portal chat CRUD

Not all pages consume this abstraction yet (many still call `fetch` directly), but it defines the intended central API client layer.

---

## 10) Browser Extension Architecture (Gmail)

## 10.1 Manifest and permissions

`extension/manifest.json` configures:

- Manifest V3 extension
- content script injection on Gmail message pages
- host permission for backend API calls

## 10.2 DOM integration lifecycle (`content.js`)

Main flow:

1. Watch DOM mutation events on Gmail with a debounced observer
2. Detect opened email view using Gmail selectors (`h2.hP` etc.)
3. Inject action buttons under subject line:
   - `Analyze Mail`
   - `Analyze + Explain`
4. Extract sender/subject/body from Gmail DOM nodes
5. POST payload to `/text/email/analyze/extension`
6. Render floating result panel with:
   - prediction
   - confidence
   - explanation (collapsible if long)
7. Highlight body region when prediction indicates phishing

Safety and resilience features:

- HTML escaping before panel rendering
- panel replacement logic to avoid duplicates
- fallback error panel for extraction/API failures
- cleanup of injected controls when message view disappears

## 10.3 Extension styling (`styles.css`)

Defines:

- red CTA button system for fast analyst action
- fixed top-right result panel with high `z-index`
- loader indicator and compact explanation collapse behavior
- phishing body highlight style

---

## 11) Data and State Flow

## 11.1 Web app flow

- User input enters page-local state
- Submit handler builds backend payload
- Backend response mapped into typed result object
- UI updates split into:
  - summary cards
  - visual chart components
  - deep detail panes
- History list is refreshed after successful analysis

## 11.2 Portal flow

- Jobs stored in Zustand pending queue
- Submit converts queue + detected text into job batch
- Orchestrator emits progress updates to thinking message
- Final aggregated result replaces thinking message atomically
- Chat persisted with debounced update and auto-title derivation

## 11.3 Extension flow

- Content script scrapes current Gmail message
- Sends one-shot analysis request to backend
- Renders overlay and optional phishing highlight directly in page DOM

---

## 12) Authentication and Session Behavior

Web app auth strategy:

- Backend cookie session based
- Nearly all protected calls pass `credentials: include`
- `home/layout.tsx` probes `/auth/me` for user context
- Logout endpoint clears server session and UI returns to public entry

Extension auth behavior:

- Uses direct backend call from content script without web app shell
- Relies on extension-host permissions and API availability
- Not coupled to Next.js auth UI state

---

## 13) Configuration and Build Notes

`zora-ai/package.json` scripts:

- `npm run dev`: Next.js dev server with Turbopack
- `npm run build`: production build
- `npm run start`: production server
- `npm run lint`: lint checks

TypeScript configuration (`tsconfig.json`):

- strict mode enabled
- path alias `@/*` mapped to project root
- no emit (Next.js managed output)

Next config (`next.config.ts`):

- currently minimal/default export

---

## 14) Operational Assumptions

The current frontend assumes:

- backend API is available locally at port 8000
- cookies are correctly set and accepted by browser
- long-running analyses return JSON payloads with the documented fields
- charting payloads contain finite numeric fields

Because endpoints are mostly hardcoded, environment-driven deployment is not yet centralized.

---

## 15) Current Gaps and Improvement Opportunities

1. Centralize backend base URL in environment variables (`NEXT_PUBLIC_API_BASE`) and consume uniformly in both `fetch` and axios helpers.
2. Standardize API access through `lib/api.ts` to reduce repeated inline endpoint strings and drift.
3. Fix potential endpoint typo in email feedback path (`/text/email/feeback` -> verify expected backend route).
4. Add shared error boundary/toast system for consistent operator feedback.
5. Move shared history CRUD patterns into reusable hooks/components to reduce page duplication.
6. Add stronger runtime schema validation (for example via zod) before chart rendering.
7. Add extension-to-web shared contract docs for analyzer payload/response stability.

---

## 16) Quick Start

## Web app

1. Start backend at `http://localhost:8000`.
2. In `frontend/zora-ai`:
   - `npm install`
   - `npm run dev`
3. Open `http://localhost:3000`.

## Extension

1. Build/prepare extension directory as-is (`frontend/extension`).
2. In Chrome, open extensions page and enable Developer Mode.
3. Load unpacked extension from `frontend/extension`.
4. Open Gmail, open an email thread, and use injected Zora buttons.

---

## 17) Summary

The frontend is not just a visual shell. It is an analyst-facing orchestration layer that:

- Converts diverse evidence inputs into pipeline requests
- Surfaces risk intelligence with explainable, multi-view output
- Maintains case history and feedback loops for model improvement
- Extends detection directly into user workflow surfaces (Gmail)

As implemented, it already supports end-to-end threat triage workflows across web and extension channels with strong modular separation by analysis domain.
