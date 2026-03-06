# Nashiverse - Family Management Application

## Overview
Nashiverse is a family management application with a cosmic/space theme. It helps families organize their lives, plan trips, share moments, and stay connected.

## Architecture

### Backend (Express.js + PostgreSQL)
- **Server**: Express.js running on port 3001 (dev) / port 5000 (production)
- **Database**: PostgreSQL with 21 tables (including calendar_events and session)
- **Authentication**: Session-based using express-session + connect-pg-simple (PostgreSQL session store) + bcrypt
- **File Uploads**: Multer-based file upload to `/uploads` directory
- **Security**: Column whitelisting per entity, CORS restrictions, security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection), SameSite cookies
- **Migrations**: Auto-run on startup via `server/db/migrate.js` (ALTER TABLE ADD COLUMN IF NOT EXISTS)
- **Seed Data**: Auto-seeds Nash family data on first startup via `server/db/seed.js` (23 people, 8 households, 94 relationships). Skips if data exists. Can be force-reseeded via admin function `seedFamilyData`.

### Frontend (React + Vite)
- **Framework**: React with Vite
- **UI Components**: Radix UI + Tailwind CSS
- **State Management**: TanStack React Query
- **Routing**: React Router DOM v6

### Key Features
1. **Family Galaxy** - 3D WebGL-powered family constellation inspired by No Man's Sky galaxy map
   - React Three Fiber + Three.js rendering
   - **NMS-Style Star Points**: Three-layer star composition (translucent breathing core, asymmetric rotating flares, cooler-toned pulsing halo)
   - **Star Classification System**: Households color-coded by member count (F=Yellow 1-2, K=Red 3-4, E=Green 5-7, O=Blue 8+)
   - **Rich Ambient Nebula Backdrop**: Multi-layered NMS-style nebula atmosphere — NebulaBackground (FBM shader sphere with 6 color zones: gold, emerald, purple, blue, amber, rose), NebulaFilaments (glowing particle wisps in 8 colors), NebulaGasCloud (atmospheric particles with colored tints). ImmersiveNebulaVolume (ray-marched volumetric 3D gas clouds) exists but is disabled by default for performance
   - **Adaptive Quality System**: GPU-aware 4-tier quality (ultra/high/medium/low) with auto-detection via WEBGL_debug_renderer_info, runtime FPS monitoring with auto-downgrade, manual quality selector in filter panel, localStorage persistence
   - **System Breathing**: Each household system gently pulses in scale (±3%) with per-system phase offset, making the galaxy feel alive
   - **Galaxy Auto-Rotation**: Slow automatic orbit rotation (speed 0.2) when idle in galaxy view; pauses on hover/interaction
   - **Generational Layout**: Grandparents at center, children in middle ring, grandchildren in outer ring — family tree radiating outward
   - **Connection Lines**: Mesh-based thick quad lines (4px screen-space width) between households with GLSL shader-based energy pulse animation; household-colored; lines originate from parent couple ring edge and target specific child star positions; intra-household lines filtered at galaxy scale (shown via ConstellationLines when zoomed in); faint base visibility (alpha 0.06, highlight 0.15) with full brightness on hover; ID type coercion for robust Map lookups
   - **Couple Rings**: CoupleRing drawn around married/partner pairs in both galaxy and system views; parent stars positioned ON the ring at radius 1.2 matching parentOrbitRadius; no tilt rotation (ring stays in XZ plane with parent stars); multi-layer concentric ring lines (4 layers at 0.96x-1.1x radius), inner fill disc, pulse ring, and 8 orbiting sparkle sprites with flickering; organic breathing animation (dual sine wave); lines from ring edge to child stars
   - **Hover Focus Dimming**: Hovering a system highlights it and connected neighbors (opacity 0.9), dimming unconnected systems to 20%
   - **Floating Labels**: drei Html-based household name labels appear on hover with household-colored styling
   - **Background Star Field**: 2000-5000 tiny twinkling background stars (quality-tier dependent) with per-star phase-offset sine wave opacity
   - **Ambient Particle Drift**: 300-800 slow-moving warm-colored particles with additive blending drifting across scene
   - **Glass-morphism Hover Tooltip**: Shows generation label, member names, star class with backdrop blur and household-colored accents
   - **Motion Trail Effect**: Subtle visual trails during camera movement
   - **Warm Amber HUD**: Top bar with coordinate readout, filter toggles, minimap — all using warm amber/gold accents instead of cyan; corner-bracket framed panels with subtle warm borders
   - **Warp Transitions**: Visual warp streaks when zooming into a household system
   - 8,640+ unique star combinations (8 shapes × 12 colors × 6 glows × 5 animations × 3 sizes)
   - Smooth camera fly-through animations with OrbitControls
   - Editable star profiles per family member
   - **System Dust Cloud**: Localized drifting dust particles in household color when zoomed into a system
   - **System Atmosphere Glow**: Soft ambient sprite glow around each household cluster at galaxy scale
   - **Enhanced Nebula**: Boosted nebula saturation/brightness (1.3x), warm vignette overlay, fog fading to warm dark purple (#0a0812)
   - **Login Starfield**: Animated canvas-based twinkling starfield with shooting stars on login page
   - Solar system family layout: parents orbit at center, children orbit around them
2. **Trip Planning** - Full trip management with participants, rooms, meals, activities, budgets
3. **Love Notes** - Gratitude messages between family members
4. **Moments** - Photo/memory sharing
5. **Family Stories** - Story preservation
6. **Traditions/Rituals** - Family rituals tracking
7. **Calendar** - Family events and birthdays (CalendarEvent entity)
8. **Messaging** - Family communication

## Database Schema
Key tables:
- `users` - Authentication and user accounts (with role column)
- `people` - Family members (with star_profile JSONB, about, medical_notes)
- `households` - Family households (with description)
- `relationships` - Relationships between people (parent/partner/sibling) with subtype (biological/step/adoptive)
- `trips` - Trip planning (with visibility, status)
- `trip_participants`, `meals`, `rooms`, `activities`, `expenses` - Trip details
- `calendar_events` - Calendar events with date, event_type, person_ids, is_recurring, color
- `moments` - Photo memories
- `love_notes` - Gratitude messages
- `family_stories` - Family narratives
- `family_settings` - App configuration (with tagline, admin_emails, planner_emails)
- `join_requests` - Family join requests (with reviewed_by_email)
- `rituals` - Family traditions
- `conversations`, `messages` - Family messaging
- `session` - PostgreSQL session store for connect-pg-simple

## API Routes
- `/api/auth/*` - Authentication (register, login, logout, me)
- `/api/entities/:type` - Secured CRUD with column whitelisting (no users table access)
- `/api/functions/:functionName` - Backend functions (exportFamilyData, makeAdmin, cleanupTestData, getFamilyInsights, seedFamilyData)
- `/api/upload` - File uploads
- `/api/health` - Health check endpoint

## Security
- Entity type whitelist (unknown types return 403)
- Column whitelist per entity (prevents SQL injection via column names)
- Users table excluded from generic CRUD
- Sessions stored in PostgreSQL (survives restarts/scaling)
- cleanupTestData gated behind NODE_ENV !== 'production'
- Security headers: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection
- SameSite cookies (strict in production, lax in development)

## Development Setup
1. Frontend runs on port 5000 (proxies API requests to backend)
2. Backend runs on port 3001
3. Database uses PostgreSQL via DATABASE_URL env var
4. Migrations run automatically on server startup

## Key Files
- `server/index.js` - Express server setup with security, sessions, routes
- `server/db/migrate.js` - Auto-migration script (runs on startup)
- `server/db/seed.js` - Nash family seed data (auto-runs on first startup)
- `server/routes/entities.js` - Secured generic CRUD with column whitelisting
- `server/routes/functions.js` - Backend function handlers
- `src/api/base44Client.js` - Frontend API client
- `src/lib/starClassification.js` - NMS-style star classification + household edge computation
- `src/components/constellation/GalaxyView.jsx` - Main 3D galaxy scene
- `src/components/constellation/HouseholdCluster.jsx` - Household visuals (nebula + star map modes)
- `src/components/constellation/Star.jsx` - Individual star rendering with 6 shader styles
