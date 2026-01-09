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
   - HouseholdCluster component with particle cloud nebula effects (8 unique color palettes)
   - 8,640+ unique star combinations (8 shapes × 12 colors × 6 glows × 5 animations × 3 sizes)
   - Smooth camera fly-through animations with OrbitControls
   - Navigation UI overlay: zoom +/-, reset view, back to galaxy button, breadcrumb navigation
   - Editable star profiles per family member
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
