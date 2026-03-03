# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PS5 gaming equipment rental service for hostel students in Ghana, with MTN Mobile Money payments. The codebase is in `gaming-rental/` — a full-stack React Router v7 app with server-side MongoDB access (no separate backend).

## Development Commands

```bash
cd gaming-rental

# Install dependencies
npm install

# Run dev server (port 5173 by default)
npm run dev

# Production build & serve (port 3000)
npm run build
npm run start

# Type checking (generates React Router types first)
npm run typecheck

# E2E tests (requires dev server running on port 3000)
npx playwright test
npx playwright test tests/e2e/auth.spec.ts        # single file
npx playwright test --grep "login"                  # by test name

# Docker
docker-compose up                                   # app + MongoDB
```

## Architecture

### Stack
- **Framework**: React Router v7 (file-based routing with loaders/actions)
- **UI**: HeroUI v2 + Tailwind CSS v4 + Framer Motion
- **Database**: MongoDB via Mongoose (server-side only, `.server.ts` files)
- **Auth**: Cookie sessions via `createCookieSessionStorage`
- **Validation**: Zod schemas in `app/lib/validation.ts`
- **Charts**: Recharts (admin analytics)

### Server Initialization Chain
`entry.server.tsx` runs on module load: `connectDB()` → `seedDatabase()` → `startBackgroundWorker()`. The seed creates a default admin user and 2 PS5 equipment sets if none exist. The background worker runs every 30s to auto-complete expired sessions, cancel stale bookings, and clean up old notifications.

### Routing Convention
Routes use React Router v7 flat-file convention in `app/routes/`:
- Page routes: `bookings.tsx`, `bookings.$bookingId.tsx`, `admin.tsx` (layout), `admin._index.tsx`
- API routes: `api.bookings.session-time.ts`, `api.promo.validate.ts` (action/loader only, no UI)
- Auth: `auth.login.tsx`, `auth.register.tsx`, `auth.logout.tsx`
- Admin is a nested layout (`admin.tsx` wraps all `admin.*` routes) with `requireAdmin` guard

### Data Flow
- **Loaders** fetch data server-side via Mongoose models, return to components
- **Actions** handle form submissions, validate with Zod, mutate via Mongoose
- All DB access is in `.server.ts` files (never shipped to client)
- `requireUser(request)` / `requireAdmin(request)` in `session.server.ts` guard routes

### Models (`app/models/`)
Mongoose models with custom string IDs (e.g., `BK-20260303-A1B2`). Key models: User (with roles: customer/admin), Equipment, Booking (10-state status machine), Payment, Review, PromoCode, Notification, Waitlist, AuditLog.

### Booking Status Machine
Defined in `app/lib/constants.ts` as `VALID_TRANSITIONS`. Flow: `pending` → `payment_received` → `confirmed` → `delivered` → `in_use` → `completed`. Branches for cancellation, refunds, and extensions at various stages.

## Key Conventions

### Tailwind v4 + HeroUI
HeroUI component styles require scanning `node_modules`. This line in `app/styles/tailwind.css` is critical:
```css
@source "../../node_modules/@heroui/theme/dist/**/*.{js,mjs}";
```
Without it, HeroUI dynamic utility classes (e.g., `group-data-[filled-within=true]:scale-85`) won't generate and components will look broken.

### Dark Theme Styling
The app uses a dark gaming theme. Custom CSS theme tokens are defined in `tailwind.css` (`--color-surface-*`, `--color-primary-*`, `--color-accent-*`). Use the `.glass-card` and `.neon-glow-*` utility classes for consistent styling. HeroUI Inputs should use `variant="bordered"` with no placeholder.

### Path Alias
`~/*` maps to `./app/*` (configured in `tsconfig.json`). All imports use this alias.

### ID Generation
Custom ID generators in `app/lib/utils.server.ts` produce human-readable IDs like `BK-20260303-A1B2`, `PAY-20260303-X9Y8`. These are stored alongside MongoDB `_id`.

## Environment Variables

Required in `.env` (see `.env.example` in git history):
- `MONGODB_URL` — MongoDB connection string
- `DATABASE_NAME` — defaults to `gaming_rental`
- `SECRET_KEY` — cookie session signing key
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — seeded admin account (password must be 12+ chars)
- Business config: `HOURLY_RATE`, `MOMO_NUMBER`, `MOMO_NAME`
