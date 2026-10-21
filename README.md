# R2 Cloud Storage Client

A self-hosted, personal cloud storage client for Cloudflare R2 designed with the Kurzagin cyber-editorial aesthetic, powered by Next.js, React 19, SQLite, and Progressive Web App (PWA) architecture.

## Overview

This project provides a Google Drive-like interface for managing files and folders stored in Cloudflare R2 buckets, backed by an embedded SQLite database for directory hierarchies, metadata, starred items, and soft-delete trash recovery.

## Features

- Cloudflare R2 Direct Uploads: Files stream directly from the browser to Cloudflare R2 via presigned PUT URLs, preventing server bandwidth bottlenecks.
- Embedded SQLite Metadata Engine: Fast, zero-configuration local database using SQLite for managing folder structures, search index, and tags.
- Folder Hierarchy and Breadcrumbs: Create, color-code, and organize folders with breadcrumb navigation.
- Grid and List Views: Toggle between a visual thumbnail grid and a compact file list displaying file sizes, MIME types, and update timestamps.
- Kurzagin Visual Design: Clean cyber-editorial dark terminal theme with custom design tokens, IBM Plex Mono typography, frosted glass headers, and corner bracket indicators.
- In-App File Previews: Native modal preview for images, video, audio playback, code files, and documents.
- Mobile First and PWA: Installable progressive web app with a fixed bottom navigation bar, touch-friendly grid targets, slide-out drawer, and mobile floating action button.
- Starred Items and Trash Bin: Quick filters to pin important assets and recover or permanently purge deleted items.

## Tech Stack

- Framework: Next.js (App Router)
- UI Library: React 19
- Styling: Kurzagin Design System and CSS Tokens
- Database: Embedded SQLite
- Cloud Storage: Cloudflare R2 via AWS SDK for JavaScript v3 (S3 Client)
- Icons: Lucide React
- PWA: Web App Manifest and Service Worker

## Getting Started

### 1. Prerequisites

- Node.js 20+ or Bun 1.2+

### 2. Installation

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd r2-cloud-storage-client
bun install
# or: npm install
```

### 3. Environment Variables

Create a `.env.local` file in the root directory based on `.env.example`:

```bash
cp .env.example .env.local
```

Fill in your Cloudflare R2 credentials:

```env
R2_ACCOUNT_ID="your_cloudflare_account_id"
R2_ACCESS_KEY_ID="your_r2_access_key_id"
R2_SECRET_ACCESS_KEY="your_r2_secret_access_key"
R2_BUCKET_NAME="your_r2_bucket_name"
R2_PUBLIC_URL="https://your-custom-cdn-or-r2-public-url.com"

DATABASE_URL="file:./storage.db"
```

### 4. Running the Application

Development mode:

```bash
bun run dev
# or: npm run dev
```

Production build:

```bash
bun run build
bun run start
# or: npm run build && npm run start
```

Access the client at `http://localhost:3000`.

## Architecture

- `src/app/DriveClient.tsx`: Main client-side Google Drive-like workspace component.
- `src/app/globals.css`: Kurzagin design tokens, responsive breakpoints, and animations.
- `src/lib/r2.ts`: Cloudflare R2 client setup and presigned URL generators.
- `src/lib/db.ts`: SQLite client and schema initialization.
- `src/app/api/items/`: API route for fetching files, folders, breadcrumbs, and stats.
- `src/app/api/files/`: API route for issuing upload presigns, recording files, and deleting objects.
- `src/app/api/folders/`: API route for directory CRUD operations.
- `public/manifest.json`: Web app manifest for PWA installation.
- `public/sw.js`: Service worker for offline asset caching.

## License

This project is licensed under the Apache License, Version 2.0. See the LICENSE file for details.
