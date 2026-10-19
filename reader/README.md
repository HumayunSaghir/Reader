# Reader

A book tracking and discovery app: shelves, reviews, reading streaks and yearly
challenges, live book clubs, swipe-to-discover, micro-trope tagging and AI
features (book chat, "should I read this?", review summaries).

- **backend/** — Node.js, Express 5, MongoDB (Mongoose)
- **frontend/** — React 19, Vite, React Router
- **mobile/** — Flutter app for Android and iOS. It uses the same backend, accounts and data. See [mobile/README.md](mobile/README.md).

## Progress

The goal is a modern alternative to Goodreads (see
[`goodreads_killer_roadmap.md`](../goodreads_killer_roadmap.md)).

| Roadmap phase | Feature | Status |
|---|---|---|
| 1 · AI companion | "Book Sommelier" chat on every book page | ✅ Done |
| | "Should I read this?" personal match score | ✅ Done |
| | AI summary of community reviews | ✅ Done |
| 2 · Social | Custom shelves | ✅ Done |
| | Community activity feed | ✅ Done |
| | Live book clubs (chapter progress, spoiler-tagged chat) | ✅ Done |
| 3 · Gamification | Reading streaks and heatmap | ✅ Done |
| | Yearly reading challenge and "Wrapped" recap | ✅ Done |
| | Progress updates by page number or percentage | ⏳ Not started |
| 4 · Discovery | Swipe-to-discover (right = Want to Read, left = skip, undo) | ✅ Done |
| | Micro-trope tagging with multi-trope filtering | ✅ Done |

### Recent work

**Phase 4: discovery**
- Swipe deck at `/discover`. You can drag, use the arrow keys, or press `Z` to undo. You can filter by genre or trope, and skipped books never come back.
- Trope tags on every book page, with voting and autocomplete. You can browse books that match several tropes at once at `/tags`.

**Book data and search**
- Search now finds books it used to miss, such as *Homo Deus*. It uses English edition titles and descriptions and ranks books by relevance and popularity. Summaries, workbooks and knock-offs are pushed down.
- Optional Google Books results can be added alongside Open Library.
- Real descriptions are fetched once per book. The generic placeholder text that was previously saved is cleaned up automatically.

**Performance**
- The home page shows books in about 0.3s instead of 6.2s.
- Book lists and searches are cached, and repeat requests take milliseconds.
- Covers are cached by the API (`/api/covers`). Loading them straight from Open Library took 5–20s each.
- A background job keeps popular lists and their covers ready.
- Pages load only when visited, and the first download shrank from 167KB to about 114KB (gzipped).

**AI cost controls**
- The model is configurable, and output length is capped.
- Less chat history and book context is sent per request.
- Recommendations and review summaries are reused until something relevant changes.
- Each user has an hourly AI limit.

**Production hardening**
- Security headers and rate limits on logins, searches, AI and the API overall.
- Input validation on every endpoint.
- Avatar uploads are size-limited, and SVGs are served safely.
- Errors are handled in one place.
- A health check, startup configuration checks and clean shutdown.
- Database indexes and one-time data migrations.

**UI**
- Redesigned home, search, book page and navbar.
- Cover-first book cards.
- Loading placeholders, empty and error states, and better accessibility.
- Page titles, a 404 page and a footer.
- Consistent mobile spacing across the app.

### Behavior changes
- Book clubs, the community feed and search are for signed-in users only. Browsing book lists and book pages stays public.
- Each user has one review per book; posting again edits it.
- Reading streaks can only be logged for the current day.
- New accounts need a password of at least 8 characters.
- In production, `JWT_SECRET` must be at least 32 characters.

**Mobile app (Android & iOS)**
- A new Flutter app in `mobile/` has the same features as the web app: browse, search, book pages with AI, swipe, tropes, book clubs, shelves, streaks and the yearly challenge.
- It uses the same API, so no backend changes were needed apart from an optional request log.
- Tested on an Android emulator: sign-in, swiping and undo, reviews, club progress and chat, reading log, and dark mode.
- iOS builds need macOS with Xcode. See the mobile README.

**Accounts and privacy**
- Sign in with Google in the mobile app. The backend verifies Google's token and links to an existing account with the same email. It's turned on by setting `GOOGLE_CLIENT_ID`.
- Book clubs and the community feed now require signing in, in the API, the web app and the mobile app. They show members' names, reviews and chat.
- The mobile app scrolls more smoothly. Covers are decoded at display size, card shadows are lighter, and covers load a screen ahead.

### Next up
- Page and percentage progress updates (the last open roadmap item).
- Bring Profile and Book Clubs up to the new design.
- Move from `@google/generative-ai` (deprecated) to `@google/genai`.
- Use a shared rate-limit store (such as Redis) for multi-instance deployments.
- Add an automated test suite and CI.
- Mobile store release: app icon and splash screen, a signing key, your own app ID, and an iOS build on a Mac.

## Local development

Requirements: Node.js 20+ and MongoDB 6+.

```bash
# API
cd backend
cp .env.example .env        # then set MONGO_URI and JWT_SECRET
npm install
npm run dev                 # http://localhost:5000

# Web app (second terminal)
cd frontend
cp .env.example .env
npm install
npm run dev                 # http://localhost:5173
```

Health check: `GET /api/health`.

## How book data works

- **Search and browse** use Open Library (free, no key). Results are re-ranked
  (provider relevance, edition count, title/author match, and penalties for
  summaries and knock-offs) and stored in MongoDB.
- **Google Books** is used too when `GOOGLE_BOOKS_API_KEY` is set. It
  improves descriptions and coverage of new releases.
- **Caching**: browse lists are cached for 6 hours and searches for 24 hours,
  in memory and in MongoDB. Stale entries are served instantly while they
  refresh in the background. A background job keeps the popular lists warm.
- **Covers**: Open Library covers take 5–20 seconds to load directly, so the
  API proxies them through `/api/covers/:id-:size.jpg`. Each cover is cached
  on disk and served with immutable cache headers.
- **Descriptions** are fetched once per book, on demand, and stored.

## Keeping AI costs down

- The model is configurable (`GEMINI_MODEL`), so a cheaper tier can be used.
- Output tokens are capped per feature, and chat history and book context are
  trimmed before sending.
- Recommendations are cached per user and book for 7 days, and recomputed only
  when the user's 5-star books change.
- Review summaries are cached until the reviews themselves change.
- Each user gets a fixed number of AI requests per hour (`AI_HOURLY_LIMIT`).

## Production deployment

1. Build the frontend: `cd frontend && npm ci && npm run build`.
2. Configure the backend environment (see `backend/.env.example`):
   - `NODE_ENV=production`
   - a strong `JWT_SECRET` (at least 32 characters)
   - `MONGO_URI` (e.g. MongoDB Atlas)
   - `TRUST_PROXY=1` behind a load balancer
3. Choose a hosting layout:
   - **Single service**: set `FRONTEND_DIST=../frontend/dist`, and the API
     serves the web app with long-lived caching for hashed assets. Leave
     `VITE_API_URL` empty at build time.
   - **Separate hosting**: deploy `frontend/dist` to any static host (with SPA
     fallback to `index.html`). Build with `VITE_API_URL=https://api.example.com`
     and set `CORS_ORIGIN=https://app.example.com` on the API.
4. Start with `npm start`. The server shuts down cleanly on SIGTERM.
5. Mount persistent storage for `backend/uploads` (avatars) and
   `COVER_CACHE_DIR`, or put a CDN in front of `/api/covers` and `/uploads`.

Rate limits apply per IP or per user: 300 API requests per minute, 20 failed
logins per 15 minutes, 40 external searches per minute, and AI requests per
hour. The limits are kept in memory. When running several instances, switch
to a shared store such as Redis.

### Security notes

- Security headers (CSP, HSTS and more) come from `helmet`, and every
  endpoint validates its input.
- Uploaded avatars are limited to 2 MB of image types. They're served with a
  sandboxing CSP so SVGs can't run scripts.
- Errors are logged on the server; clients only see a generic message for
  internal failures.
