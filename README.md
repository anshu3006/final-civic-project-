# Micro-Task — Civic Issue Reporting Platform

A full-stack civic platform where residents report local issues and admins triage, manage, and resolve them.

This README is updated with the latest **Admin Issue List UI improvements** (image thumbnail, preview modal, stronger hover clarity, and high-severity highlighting).

---

## Table of Contents

- [What’s New (Admin UI Update)](#whats-new-admin-ui-update)
- [Core Features](#core-features)
- [Tech Stack](#tech-stack)
- [Architecture (High-Level)](#architecture-high-level)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Roles & Permissions](#roles--permissions)
- [Scripts](#scripts)

---

## What’s New (Admin UI Update)

### 1) Admin Issue List Item Redesign

Each issue item now uses a clean two-column layout:

- **Left:** image thumbnail (`~96x96`), rounded corners, `object-cover`.
- **Right:** title, description, and meta row (`Category | Department | Severity | Time`).

### 2) Hover Clarity Improvement

On issue-card hover:

- all issue text transitions to white (title, description, category, department, severity, timestamp),
- background darkens for strong contrast,
- smooth transitions (`transition-colors`, `duration-200/300`).

### 3) Click-to-Preview Image (New Modal)

Admins can click the issue thumbnail to open a larger preview:

- dark overlay backdrop,
- centered large image (`object-contain`, preserved aspect ratio),
- close button,
- click outside to close,
- Escape key to close,
- smooth fade/zoom-in animation.

Reusable component added:

- `frontend/components/admin/image-preview-modal.tsx` → `ImagePreviewModal`

### 4) High Severity Visual Priority

For issues where `severityScore > 8.5`:

- dark red gradient border wrapper,
- stronger hover treatment,
- hover text still turns white.

### Updated Components

- `frontend/components/admin/issue-list-item.tsx`
- `frontend/components/admin/image-preview-modal.tsx`
- `frontend/app/admin/issues/page.tsx` (passes `imageUrl` prop)

---

## Core Features

### Resident Features

- Report issues with title, description, image, and location.
- AI enrichment for category/department/severity workflow.
- Feed with upvotes and comments.
- Map view for reported issues.
- Resolution verification via proof upvotes.

### Admin Features

- Manage issue lifecycle (`reported` → `approved` → `in_progress` → `resolved`).
- Edit issue metadata (severity, department, status).
- Resolve issues with proof image upload.
- Admin map and analytics dashboards.
- Enhanced issue list UI (this update).

---

## Tech Stack

### Frontend

- Next.js (App Router)
- React + TypeScript
- Tailwind CSS
- Clerk (Auth)
- Lucide React (Icons)
- Leaflet (Map)

### Backend

- Node.js + Express
- MongoDB + Mongoose
- Clerk Express SDK
- Cloudinary (image hosting)
- n8n + ML service integration (issue enrichment)

---

## Architecture (High-Level)

1. Client submits/report issue.
2. Backend enriches data (AI + rules) and stores in MongoDB.
3. Admin reviews and updates issue status.
4. Admin can resolve with proof image.
5. Residents verify resolution.

---

## Project Structure

```text
Micro-Task/
├── backend/                  # Express API + models + controllers
├── frontend/                 # Next.js app
│   ├── app/                  # App Router pages
│   ├── components/           # Reusable UI components
│   │   └── admin/            # Admin-specific components
│   │       ├── issue-list-item.tsx
│   │       └── image-preview-modal.tsx
│   └── lib/                  # Helpers/utilities
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- MongoDB database
- Clerk keys
- Cloudinary credentials

### Backend

```bash
cd backend
npm install
npm run dev
```

Default backend URL: `http://localhost:5500`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Default frontend URL: `http://localhost:3000`

---

## Environment Variables

### Backend (`backend/.env`)

```env
PORT=5500
MONGO_URI=...
CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
CLOUDINARY_URL=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
N8N_WEBHOOK_URL=...
ML_SERVICE_URL=http://127.0.0.1:8000/analyze-severity
ML_CONFIDENCE_THRESHOLD=0.80
```

### Frontend (`frontend/.env`)

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/feed
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/feed
NEXT_PUBLIC_BACKEND_URL=http://localhost:5500
SARVAM_API_KEY=...
```

---

## API Reference

### Issues

- `POST /api/issues/preview` — AI-enriched preview.
- `POST /api/issues` — create issue.
- `GET /api/issues` — list issues.
- `PATCH /api/issues/:id` — admin update.
- `PATCH /api/issues/:id/resolve` — admin resolves with proof.
- `PATCH /api/issues/:id/upvote` — upvote toggle.
- `PATCH /api/issues/:id/verify-upvote` — verification upvote.
- `GET /api/issues/:id/comments` — comments list.
- `POST /api/issues/:id/comments` — add comment.

### Users

- `POST /api/users/sync`
- `GET /api/users/me`

### Events

- `GET /api/events`
- `POST /api/events`
- `PATCH /api/events/:id/interested`
- `PATCH /api/events/:id/participating`

---

## Roles & Permissions

- **Resident:** report, view, comment, upvote, verify.
- **Admin:** everything residents can do + edit/update/resolve issues + admin dashboards.

---

## Scripts

### Backend

```bash
npm run dev
npm start
```

### Frontend

```bash
npm run dev
npm run build
npm start
npm run lint
```

---

## Notes

- This update is UI-focused and does not change backend API contracts.
- For best admin UX, ensure issue records include valid `imageUrl`.
