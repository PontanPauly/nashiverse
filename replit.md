# Nashiverse - Family Management Application

## Overview
Nashiverse is a family management application with a cosmic/space theme. It helps families organize their lives, plan trips, share moments, and stay connected.

## Architecture

### Backend (Express.js + PostgreSQL)
- **Server**: Express.js running on port 3001
- **Database**: PostgreSQL with 20 tables
- **Authentication**: Session-based using express-session and bcrypt
- **File Uploads**: Multer-based file upload to `/uploads` directory

### Frontend (React + Vite)
- **Framework**: React with Vite
- **UI Components**: Radix UI + Tailwind CSS
- **State Management**: TanStack React Query
- **Routing**: React Router DOM v6

### Key Features
1. **Family Galaxy** - 3D WebGL-powered family constellation with customizable stars
   - React Three Fiber + Three.js rendering
   - **Hierarchical navigation**: Galaxy level shows households as glowing nebula clusters, click to zoom into a household to see individual family members as stars
   - Force-directed organic layout using d3-force-3d for household positioning
   - HouseholdCluster component with simplified nebula effects (2-layer design with hover scaling)
   - 8,640+ unique star combinations (8 shapes × 12 colors × 6 glows × 5 animations × 3 sizes)
   - Smooth camera fly-through animations with OrbitControls
   - Navigation UI overlay: zoom +/-, reset view, back to galaxy button, breadcrumb navigation
   - Editable star profiles per family member
   - **Galaxy Visual Enhancements (Hubble-inspired)**:
     - SpiralArmParticles: 25,000 particles in 4 logarithmic spiral arms
     - Color gradient: Warm golden core (#FFB347) → cool blue edges (#1E90FF)
     - Enhanced starfield with diffraction spikes for bright stars
     - FogExp2 atmospheric depth effect
     - Gentle galaxy rotation animation
     - VolumetricDustLayers with FBM noise for cosmic clouds
2. **Trip Planning** - Full trip management with participants, rooms, meals, activities, budgets
3. **Love Notes** - Gratitude messages between family members
4. **Moments** - Photo/memory sharing
5. **Family Stories** - Story preservation
6. **Traditions/Rituals** - Family rituals tracking
7. **Calendar** - Family events and birthdays
8. **Messaging** - Family communication

## Database Schema
Key tables:
- `users` - Authentication and user accounts
- `people` - Family members
- `households` - Family households
- `relationships` - Relationships between people (parent/partner/sibling)
- `trips` - Trip planning
- `trip_participants`, `meals`, `rooms`, `activities`, `expenses` - Trip details
- `moments` - Photo memories
- `love_notes` - Gratitude messages
- `family_stories` - Family narratives
- `rituals` - Family traditions
- `conversations`, `messages` - Family messaging

## API Routes
- `/api/auth/*` - Authentication (register, login, logout, me)
- `/api/entities/:type` - Generic CRUD for all entity types
- `/api/upload` - File uploads

## Development Setup
1. Frontend runs on port 5000 (proxies API requests to backend)
2. Backend runs on port 3001
3. Database uses PostgreSQL via DATABASE_URL env var

## Recent Changes
- Migrated from Base44 backend-as-a-service to self-contained PostgreSQL + Express.js
- Implemented session-based authentication with login/register pages
- Created custom API client that preserves Base44 SDK patterns for minimal frontend changes
- Added 3D Galaxy View for family visualization using React Three Fiber
- Created star customization system with 8,640+ unique combinations
- Added StarEditor component for personalized star profiles
- Seeded database with 58-member Nash-Martinez extended family across 5 generations
- **Immersive 3D Nebula Volume** (Jan 2026):
  - **ImmersiveNebulaVolume**: True volumetric raymarching through a 120-radius sphere
  - Camera positioned INSIDE the volume for immersive experience
  - Ray-sphere intersection for proper depth sampling
  - Multi-scale noise: large clouds + ridged FBM for filaments + fine detail
  - Anisotropic stretching (0.6 Y-axis) for elongated cloud structures
  - Beer-Lambert attenuation for realistic light absorption
  - Warm core (orange/pink) → cool edges (blue/cyan/teal) color gradient
  - Jittered ray steps to reduce banding artifacts
  - **NebulaFilaments**: 2000-3000 soft glowing particles throughout volume
  - Tier-aware quality: High=32 steps, Medium=24, Low=16 (optimized for GPU stability)
  - Removed flat billboard layers in favor of true 3D volumetrics
- **Star & Nebula Visual Refinements** (Jan 2026):
  - Rebalanced nebula color palette: reduced cyan/teal saturation, deepened purples
  - 6 distinct star visual styles: Nebula, Classic, Plasma, Crystal, Pulse, Nova
  - Organic edge function for irregular star boundaries (no circular cutoffs)
  - Enlarged billboard geometry (0.9x sprite, 1.4x glow) with proper alpha fade
  - Reduced shader complexity (ray steps/octaves) to prevent WebGL context loss
  - Unified galaxy and household view backdrops for visual consistency
  - Smooth camera fly-through animation when clicking household nebulas (zooms to actual position)
- **Focus/Blur State Management** (Jan 2026):
  - CameraController uses consistent 1.6s easeInOutCubic for both zoom-in and zoom-out transitions
  - Added `effectiveFocusProgress` that computes 0→1 for zoom-in, 1→0 for zoom-out, and static values for idle state
  - Added `effectiveFocusedId` that preserves focus target during zoom-out transition for smooth fade restoration
  - CameraController fires `onProgressUpdate(1, 'idle')` when animation completes to properly reset state
  - Households now smoothly fade during zoom-in and fully restore brightness during zoom-out
  - Enlarged hitbox (12x scale) for easier household hover detection
