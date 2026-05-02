# Election Assistant

**Author:** Abdul Qadir Bearingwala
**Competition:** PromptWars
**Live Demo:** https://election-assistant-770475137467.asia-south1.run.app/
**Vertical:** Civic Tech / Voter Education

---

## Overview

Election Assistant is a civic technology web application that helps Indian voters access accurate, location-specific election information through a conversational AI interface. The application is powered by Google Gemini and deployed on Google Cloud Run. It covers all Indian states, Union Territories, and major cities, providing voters with their polling booth location guidance, voter registration deadlines, accepted identity documents, and a visual election timeline, all through a single, accessible interface.

The core idea is simple: a voter types their state or city into a chat window, and the assistant immediately populates a structured dashboard with the information that voter needs to participate confidently in an election.

---

## Chosen Vertical

This project targets the Civic Tech vertical, specifically the sub-problem of voter information access. In India, election-related information is scattered across multiple government portals, regional offices, and help lines. First-time voters and rural voters in particular face difficulty understanding which polling booth they belong to, which documents to carry, and when deadlines fall. This application consolidates that information into one AI-powered interface that works in English, Hindi, Tamil, and Telugu.

---

## Approach and Logic

The application follows a structured request-response pattern with a clear separation between the AI reasoning layer and the UI presentation layer.

When a user sends a message, the Next.js frontend sends the full conversation history to a server-side API route. That route runs the conversation through Google Gemini with a carefully crafted system instruction that asks the model to respond both conversationally and in a structured JSON block embedded at the end of its response. The frontend then parses the JSON block, extracts the dashboard fields (polling location, deadlines, ID requirements, and timeline events), and renders them as structured cards. The conversational text, with the JSON block stripped out, is shown in the chat window.

This design means Gemini acts as both a reasoning engine and a data-extraction layer. The model interprets vague user inputs ("I am from UP", "Mumbai voter") and maps them to structured, renderable data without any separate NLP pipeline or database lookup.

The application uses a model fallback strategy: it tries gemini-2.0-flash first, then gemini-2.0-flash-lite, then gemini-2.5-flash. This ensures that temporary quota exhaustion on one model does not result in a failed user experience.

---

## How the Solution Works

### Architecture

The project is a Next.js 14 application using the App Router. It has two API routes and one primary page component.

- `app/page.tsx` is the entire frontend. It manages chat state, dashboard state, language selection, the voter readiness checklist, and the mobile tab layout using React hooks.
- `app/api/chat/route.ts` is the server-side Gemini integration. It validates inputs, applies rate limiting, formats the conversation history for the Gemini Chat API, and returns the model response.
- `app/api/maps-embed/route.ts` is a server-side proxy that generates a Google Maps Embed API iframe using a server-only API key. The key is never exposed to the browser.

### User Flow

1. The user opens the application and sees the chat assistant and a blank dashboard.
2. The user selects a language from the top banner (English, Hindi, Tamil, or Telugu). The interface text and checklist items update immediately.
3. The user types their Indian state or city into the chat input.
4. The assistant responds conversationally and appends a structured JSON block.
5. The frontend parses the JSON and populates the three dashboard cards (Polling Location, Key Deadlines, ID Requirements), the Election Timeline, and the Google Maps section showing the area.
6. On mobile, the interface automatically switches the active tab from the chat view to the dashboard view once data is loaded.
7. The user can tick items on the Voter Readiness Checklist. Progress is saved to localStorage so it persists across page reloads.
8. Once the dashboard is populated, the user can click the Print Summary button to generate a print-optimized, landscape-formatted voter summary.

### Key Features

- AI-powered conversational interface backed by Google Gemini 2.0 Flash
- Structured dashboard populated by parsing Gemini's JSON output
- Multi-language support covering English, Hindi, Tamil, and Telugu
- Interactive election timeline with past/upcoming event differentiation
- Google Maps Embed showing the user's polling area
- Voter readiness checklist with localStorage persistence
- Print-to-PDF summary export
- Responsive layout with a tabbed mobile interface
- Server-side rate limiting at 10 requests per minute per IP address

---

## Google Services Integration

This application integrates multiple Google services meaningfully across the stack.

### Google Gemini (Generative AI)

The primary AI engine powering the conversational assistant is Google Gemini, accessed via the `@google/generative-ai` Node.js SDK. The application uses a multi-model fallback chain of `gemini-2.0-flash`, `gemini-2.0-flash-lite`, and `gemini-2.5-flash` to maximize availability across free-tier quota limits. Each model is initialized via `GoogleGenerativeAI` and used through the Gemini Chat API, which supports multi-turn conversation history.

The system instruction passed to Gemini is structured to produce dual-format output: a natural language conversational response followed by a machine-readable JSON block. This structured generation approach allows the frontend to render rich, organized dashboard cards without a separate data pipeline.

### Google Maps Embed API

Location context is made visual through the Google Maps Embed API. After the user provides their state or city, the application renders an interactive map of that region in the Polling Area Map section. To protect the API key, the Maps Embed URL is constructed server-side inside a Next.js API route (`/api/maps-embed`). The browser never receives the raw API key; it only receives a rendered HTML response containing an iframe. The Maps API key is stored exclusively in server-side environment variables with no `NEXT_PUBLIC_` prefix, ensuring it is never bundled into the client-side JavaScript.

### Google Cloud Run

The application is deployed on Google Cloud Run, a fully managed serverless container platform. Cloud Run handles automatic scaling, zero cold-start-after-warm behavior, and HTTPS termination. The deployment uses a containerized Next.js build image. The service is hosted in the `asia-south1` region (Mumbai) to minimize latency for Indian users, which is the primary target audience of this civic application.

Cloud Run's integration with Google Cloud's infrastructure also means the application inherits Google's DDoS protection and load balancing at the platform level, complementing the application-level rate limiting implemented in the API route.

### Google Cloud Secret Manager (Planned Integration)

Currently, environment variables for the Gemini API key and Maps API key are injected into Cloud Run at deploy time via Cloud Run's built-in environment variable support. The planned next step is to migrate these secrets to Google Cloud Secret Manager, which provides centralized secret versioning, fine-grained IAM access control, and audit logging. Cloud Run natively supports referencing Secret Manager secrets as environment variables with a single configuration line, making this a low-friction upgrade that would significantly improve the security posture of the key management strategy.

### Google Analytics (Planned Integration)

Google Analytics 4 integration is planned for the next release. The intended implementation would use the `gtag.js` script loaded via the Next.js Script component with the `afterInteractive` strategy to avoid blocking page rendering. Planned tracked events include language selection, state lookup, checklist completion, print action, and chat engagement depth. This telemetry would allow meaningful measurement of which states generate the most queries, which languages are most used, and what percentage of users complete the voter readiness checklist.

### Google Identity / Firebase Authentication (Planned Integration)

A future version of the application will introduce optional user accounts backed by Firebase Authentication. This would allow voters to save their state profile, retrieve their checklist state across devices, and receive push notifications for upcoming election deadlines via Firebase Cloud Messaging. Firebase's Google Sign-In provider would offer a frictionless one-tap authentication experience consistent with Google's identity ecosystem.

### Firebase Firestore (Planned Integration)

Alongside Firebase Authentication, Firebase Firestore is the planned persistence layer for storing user-specific election profiles. Each authenticated user document would store their selected state, checklist completion status, preferred language, and saved timeline events. Firestore's real-time listeners would allow the dashboard to update automatically if election schedule data were to change, without requiring a page refresh.

---

## Code Quality

The codebase is structured around a single-page architecture with clearly defined concerns:

- State management is handled entirely with React's built-in `useState` and `useEffect` hooks. There is no external state library, reducing the dependency surface.
- The API route (`route.ts`) is organized into distinct sections: environment validation, rate limiting, input validation, Gemini history formatting, model fallback loop, and error handling. Each section is commented to explain the intent, not just the mechanics.
- The frontend component (`page.tsx`) separates rendering logic into focused sub-components: `LoadingIndicator`, `TextBullets`, and `ChatContent`. Each handles one specific transformation (loading UI, dashboard card text, chat message text respectively).
- TypeScript is used throughout with explicit type annotations for all message types, dashboard data shapes, language unions, and timeline items.
- URL detection and linkification is handled by a `linkify` utility that sanitizes `javascript:` protocol URLs to prevent cross-site scripting from AI-generated content.
- All constants (welcome messages, checklist items, language codes) are defined at the module level as typed Record objects, making them easy to extend for new languages without touching component logic.

The project uses ESLint with the `eslint-config-next` configuration to enforce consistent code style. The build process runs the linter as part of `next build`.

---

## Security

Security was treated as a first-class concern throughout development, not as an afterthought.

**API key protection:** Neither the Gemini API key nor the Google Maps API key is exposed to the browser at any point. Both are stored as server-side environment variables. The Maps key is further protected by being used only inside a server-side API route proxy, so the key never appears in any client-side network request the user can inspect.

**Rate limiting:** The `/api/chat` route implements an in-memory sliding window rate limiter that allows a maximum of 10 requests per minute per IP address. The rate limit map is cleaned up every 5 minutes to prevent unbounded memory growth. This protects the Gemini API quota from being exhausted by a single abusive client.

**Input validation:** Every incoming request is validated before it reaches the Gemini SDK. Validation checks include: presence and type of the messages array, a maximum conversation length of 50 messages to prevent token abuse, per-message content type enforcement, and a 1000-character cap on the latest user message.

**Content Security Policy:** The `next.config.mjs` file sets a `Content-Security-Policy: frame-ancestors 'self'` header on all routes to prevent the application from being embedded in third-party iframes (clickjacking protection). Additional headers include `X-Content-Type-Options: nosniff` to prevent MIME-type sniffing attacks, `Referrer-Policy: strict-origin-when-cross-origin` to limit referrer information sent to external sites, and `Permissions-Policy` to explicitly disable geolocation, microphone, and camera access, which this application does not need.

**XSS prevention:** The `linkify` function that converts URLs in AI responses to clickable links explicitly checks for and neutralizes `javascript:` protocol URLs by replacing them with `#`, preventing a scenario where a hallucinated malicious URL in the AI output could execute arbitrary JavaScript.

**Error message sanitization:** All internal error messages (Gemini SDK errors, timeout errors, model names) are logged server-side only. The client receives only a generic, friendly message. This prevents leaking implementation details such as model names, SDK versions, or stack traces to the browser.

---

## Performance

The application is optimized for fast perceived and actual load times.

**Minimal dependency footprint:** The production dependency list is intentionally small: `next`, `react`, `react-dom`, `@google/generative-ai`, `lucide-react`, `clsx`, and `tailwind-merge`. There is no heavy UI framework, no state management library, and no animation library. Smaller bundles mean faster First Contentful Paint and Time to Interactive.

**No unnecessary re-renders:** The checklist state uses a functional updater pattern to avoid stale closures. The scroll-to-bottom behavior is gated behind a `useRef` flag so it does not fire on initial mount. The language switcher short-circuits with an early return if the user selects the already-active language.

**Server-side API proxy for Maps:** The Maps iframe is served from a local API route, which means the browser's initial page render is not blocked by an external Maps JavaScript SDK bundle. The map loads lazily inside an iframe only when the user has provided their location.

**Model timeout guardrail:** Each Gemini model call is raced against a 15-second timeout using `Promise.race`. If a model hangs without producing an error (an observed behavior during high Gemini API traffic), the timeout ensures the fallback chain continues rather than leaving the user waiting indefinitely.

**Cloud Run regional deployment:** The service is deployed in `asia-south1` (Mumbai), the Google Cloud region geographically closest to the primary user base in India, minimizing network round-trip time for API calls from the frontend to the backend.

---

## Accessibility

Accessibility was considered at both the semantic and interaction design levels.

**Semantic HTML structure:** The page uses a single `h1` element for the primary application title, `h2` for section headings (dashboard, chat sidebar), and `h3` for card-level headings. This heading hierarchy is consistent and navigable by screen reader users.

**ARIA attributes:** The language switcher buttons include `aria-label` and `aria-pressed` attributes so that screen readers can announce both the action and the current state of each language button. The send button in the chat form includes an `aria-label` because it contains only an icon with no visible text label.

**Keyboard navigation:** All interactive elements, including language buttons, checklist items, the send button, the print button, the home breadcrumb, and the mobile tab buttons, are standard HTML button and input elements. This means they are natively focusable and operable with a keyboard without custom JavaScript focus management.

**Focus management:** The `focus:ring-2 focus:ring-primary` Tailwind class is applied to the chat input, ensuring a visible focus indicator that meets WCAG 2.1 AA contrast requirements for focus visibility.

**Language and direction:** When the user switches language, the `document.documentElement.lang` attribute is updated programmatically using a `useEffect` hook. This allows screen readers and browser translation tools to correctly identify the language of the page content.

**Color contrast:** The primary color scheme uses dark text on light backgrounds throughout the dashboard and card sections. Interactive states (hover, active) are communicated through both color and underline where applicable, avoiding sole reliance on color as a means of conveying state.

**Responsive and touch-friendly layout:** On mobile, the dashboard and chat are separated into tabs to avoid forcing the user to scroll across a cramped two-column layout on a small screen. Tab buttons are large enough to meet touch target size recommendations.

**Planned accessibility improvements:** Future work includes adding `role="status"` or `aria-live="polite"` to the loading indicator and dashboard sections so that screen reader users are informed when new content is loaded. A skip-to-main-content link is also planned to improve keyboard navigation for users who rely on it exclusively.

---

## Testing

**Manual testing:** The application was tested manually across the following scenarios:

- Valid Indian state names (e.g., Maharashtra, Tamil Nadu, Uttar Pradesh)
- Valid city names (e.g., Mumbai, Chennai, Hyderabad, Delhi)
- Ambiguous inputs (e.g., "UP", "TN") to verify that the assistant correctly infers the state
- All four supported languages with a state query to verify translated responses and correct JSON key structure
- Rapid successive submissions to trigger and verify the rate limiter response
- A very long message (over 1000 characters) to verify the input length guard
- A simulated missing API key (empty environment variable) to verify the configuration error guard
- Mobile layout at 375px and 390px viewport widths to verify tab switching and responsive card layout

**Edge case coverage:** The following edge cases were specifically validated:

- A message with only whitespace, which is blocked by the `trim()` guard before sending
- A Gemini response that does not contain a JSON block (the frontend gracefully shows only the conversational text)
- A malformed JSON block in the Gemini response (caught by a try-catch around `JSON.parse`, logged, and ignored gracefully)
- A `javascript:` URL in the AI response (neutralized by the `linkify` sanitizer)
- A timeline item with an empty or unparseable date string (the `fmtDate` function returns the raw string or "To be announced" rather than crashing)

**Integration flow testing:** The full end-to-end flow from user input to dashboard population was tested across all three Gemini models in the fallback chain by temporarily setting environment variables to invalid values to force fallback behavior.

**Planned testing improvements:** The current test suite is manual. The planned next step is to add Jest unit tests for the `isRateLimited`, `linkify`, `fmtDate`, and `isPast` utility functions, and to add Playwright end-to-end tests for the core user flows (state lookup, language switch, checklist persistence, and print trigger). API route unit tests using mock `Request` objects are also planned to cover all validation branches in the chat route.

---

## Assumptions Made

- The application targets Indian voters specifically. The Gemini system instruction is scoped to Indian states, Union Territories, cities, and the Election Commission of India's document framework.
- Election data (dates, deadlines) returned by Gemini is based on the model's training data and best-estimate reasoning. It is not pulled from a live ECI API. Users are always directed to the official ECI portal (voters.eci.gov.in) and Voter Helpline 1950 for authoritative confirmation.
- The in-memory rate limiter resets when the server restarts. This is acceptable for a competition deployment where the server instance count is low. A production deployment would replace this with a Redis-backed rate limiter shared across all Cloud Run instances.
- The checklist state is persisted to `localStorage` in the browser. This means checklist progress is tied to a specific browser and device. A future version with Firebase Authentication would move this to server-side persistence.
- All four supported languages (English, Hindi, Tamil, Telugu) rely on Gemini's multilingual capability for generating responses. The UI labels are hardcoded strings; the AI-generated conversational content adapts to the selected language based on the system instruction.

---

## Project Structure

```
election-assistant/
  app/
    api/
      chat/
        route.ts          # Gemini API integration, rate limiting, input validation
      maps-embed/
        route.ts          # Google Maps Embed API proxy (server-side key protection)
    globals.css           # Global styles and CSS custom properties
    icon.svg              # Application favicon
    layout.tsx            # Root layout with metadata and font imports
    page.tsx              # Main application page (chat, dashboard, checklist, map)
  next.config.mjs         # Security headers (CSP, X-Content-Type-Options, Referrer-Policy)
  tailwind.config.ts      # Tailwind CSS configuration
  tsconfig.json           # TypeScript configuration
  package.json            # Dependencies and scripts
```

---

## Running Locally

**Prerequisites:** Node.js 18 or later, a Google Gemini API key, and a Google Maps API key (optional; the map section degrades gracefully without it).

**Setup:**

```bash
git clone <repository-url>
cd election-assistant
npm install
```

Create a `.env.local` file in the project root with the following content:

```
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_MAPS_API_KEY=your_maps_api_key_here
```

**Start the development server:**

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

**Build for production:**

```bash
npm run build
npm run start
```

---

## Deployment

The application is deployed to Google Cloud Run using a containerized Next.js build. The Cloud Run service is configured with:

- Region: `asia-south1` (Mumbai, India)
- Environment variables: `GEMINI_API_KEY` and `GOOGLE_MAPS_API_KEY` injected at service level
- Automatic HTTPS and managed TLS via Cloud Run
- Auto-scaling from 0 to N instances based on incoming traffic

Live URL: https://election-assistant-770475137467.asia-south1.run.app/

---

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| AI Engine | Google Gemini 2.0 Flash (with fallback chain) |
| Maps | Google Maps Embed API |
| Deployment | Google Cloud Run |
| Icons | Lucide React |
| Runtime | Node.js 18 |

---

## Future Roadmap

- Migration of API key storage to Google Cloud Secret Manager for centralized secret versioning and IAM-controlled access
- Firebase Authentication with Google Sign-In for optional user accounts
- Firebase Firestore for persisting user state profiles, checklist progress, and saved timelines across devices
- Google Analytics 4 integration for tracking language preferences, state lookup frequency, and checklist completion rates
- Firebase Cloud Messaging for browser push notifications reminding voters of upcoming election deadlines
- Google Translate API integration as a fallback for languages beyond the four currently supported
- Jest and Playwright automated test suites for unit coverage and end-to-end validation
- ARIA live region announcements for dynamic dashboard content updates
- Skip-to-content navigation link for keyboard-only users
