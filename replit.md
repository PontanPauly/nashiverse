# Nashiverse - Family Management Application

## Overview
Nashiverse is a family management application with a cosmic/space theme. It helps families organize their lives, plan trips, share moments, and stay connected.

## Architecture

### Backend (Express.js + PostgreSQL)
- **Server**: Express.js running on port 3001 (dev) / port 5000 (production)
- **Database**: PostgreSQL with 21 tables (including calendar_events and session)
- **Authentication**: Session-based using express-session + connect-pg-simple (PostgreSQL session store) + bcrypt
- **File Uploads**: Multer-based file upload to `/uploads` directory
- **Security**: Column whitelisting per entity, CORS restrictions, security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection), SameSite cookies, CSRF Origin check (production), rate limiting on auth endpoints (10 req/10min), uploads gated behind auth, SESSION_SECRET fail-fast in production, admin-only DELETE on people/households/relationships/trips, admin-only family_settings writes, destructive functions require confirm string
- **Migrations**: Auto-run on startup via `server/db/migrate.js` (CREATE TABLE IF NOT EXISTS for all 22 tables + ALTER TABLE ADD COLUMN IF NOT EXISTS for incremental additions)
- **Seed Data**: Auto-seeds Nash family data on first startup via `server/db/seed.js` (42 people, 17 households, 156 relationships). Skips if data exists. Can be force-reseeded via admin function `seedFamilyData`.

### Frontend (React + Vite)
- **Framework**: React with Vite
- **UI Components**: Radix UI + Tailwind CSS
- **State Management**: TanStack React Query
- **Routing**: React Router DOM v6

### Key Features
1. **Family Galaxy** - 3D WebGL-powered family constellation inspired by No Man's Sky galaxy map
   - React Three Fiber + Three.js rendering
   - **NMS-Style Star Points**: Layered Gaussian shader composition — blazing pinpoint center (k=2500-4000, overexposed HDR), hot core, inner corona, outer corona, atmospheric envelope; 6 distinct shader styles (classic, nebula, plasma, crystal, pulse, nova); JS-side animation system with 5 brightness modes (steady, gentle, twinkle/scintillation, breathing, dancing); glowStyle maps control falloff shape and radius; atmospheric haze always visible; diffraction spikes for bright stars
   - **Star Classification System**: Households color-coded by member count (F=Yellow 1-2, K=Red 3-4, E=Green 5-7, O=Blue 8+)
   - **Rich Ambient Nebula Backdrop**: Subtle, muted multi-layered nebula atmosphere — NebulaBackground (FBM shader sphere with 6 muted color zones), NebulaFilaments (faint glowing particle wisps), NebulaGasCloud (very subtle atmospheric particles). Background is primarily dark space with faint color hints. ImmersiveNebulaVolume (ray-marched volumetric 3D gas clouds) exists but is disabled by default for performance
   - **Adaptive Quality System**: GPU-aware 4-tier quality (ultra/high/medium/low) with auto-detection via WEBGL_debug_renderer_info, runtime FPS monitoring with auto-downgrade, manual quality selector in filter panel, localStorage persistence
   - **System Breathing**: Each household system gently pulses in scale (±3%) with per-system phase offset, making the galaxy feel alive
   - **Galaxy Auto-Rotation**: Slow automatic orbit rotation (speed 0.2) when idle in galaxy view; pauses on hover/interaction
   - **Generational Layout**: Parent-relative 3D branching — gen-0 near center (radius 6-14), child households branch 32-42 units from parent in random 3D directions with outward bias; compact spread visible from initial camera position [75,140,105]
   - **System Nebula Clouds**: Each household has a class-based localized particle cloud (F=50, K=70, E=90, O=120 particles) with dual-color mixing (household + classification glow), class-scaled radius (4-7 units), and per-particle flicker animation; brightens on hover
   - **Floating Labels**: drei Html-based household name labels below each system, controlled by LABELS toggle; monospace uppercase with household-colored text and glow; labels hide on hover (tooltip replaces them)
   - **Connection Lines**: Mesh-based thick quad lines (4px screen-space width) with GLSL shader-based energy pulse animation; household-colored; child endpoint connects directly to the child's star position (computed as groupPos + localStarPos × scale), parent endpoint stops at GalaxyOutlineRing perimeter (GALAXY_RING_RADIUS × scale); both endpoints track dynamically with hover animations (scale/position changes); node glow dots at both endpoints; faintly visible at rest (hlVal 0.05 → alpha ~0.06), full brightness on hover (hlVal 1.0 → alpha 0.9); intra-household edges filtered out; edge data includes childPersonId/fromPersonId from computeHouseholdEdges; cached _lineColor for per-frame reuse; ID type coercion for robust Map lookups
   - **Couple Rings**: CoupleRing drawn around married/partner pairs in system view only (XY plane geometry with billboard rotation); GalaxyOutlineRing (subtle always-visible billboard ring, radius 2.0) + HoverSphere (translucent pulsing sphere on hover) at galaxy scale; billboard orientation uses safe-up fallback (switches to X-up when camera near vertical); CoupleRing has multi-layer concentric ring lines (4 layers at 0.96x-1.1x radius), inner fill disc, pulse ring, and 8 orbiting sparkle sprites with flickering; organic breathing animation (dual sine wave)
   - **Hover Focus Dimming**: Hovering a system highlights it and connected neighbors (opacity 0.9), dimming unconnected systems to 20%
   - **Background Star Field**: 2000-5000 tiny twinkling background stars (quality-tier dependent) with per-star phase-offset sine wave opacity
   - **Ambient Particle Drift**: 300-800 slow-moving warm-colored particles with additive blending drifting across scene
   - **Glass-morphism Hover Tooltip**: Shows household name, member count, and member first names with backdrop blur and household-colored accents
   - **Motion Trail Effect**: Subtle visual trails during camera movement
   - **Warm Amber HUD**: Top bar with coordinate readout, filter toggles (LINES, LABELS, quality selector) — all using warm amber/gold accents; corner-bracket framed panels with subtle warm borders; FKEO star class buttons removed for simplicity
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
- `people` - Family members (with star_profile JSONB, about, medical_notes, household_status)
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
- `/api/functions/:functionName` - Backend functions (exportFamilyData, makeAdmin, cleanupTestData, getFamilyInsights, seedFamilyData, transferAdmin)
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
- CSRF Origin check on mutating requests (production only)
- Rate limiting: 10 requests per 10 minutes on /api/auth/login and /api/auth/register
- Uploads require authentication (gated behind requireAuth middleware)
- SESSION_SECRET fail-fast: production refuses to start without it
- Admin-only DELETE on people, households, relationships, trips
- Admin-only POST/PATCH on family_settings
- Destructive functions (cleanupTestData, seedFamilyData) require confirm string and admin role

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
