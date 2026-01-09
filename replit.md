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
1. **Family Constellation** - Interactive family tree visualization
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
