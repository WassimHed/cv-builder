# CV Builder

A backend-first portfolio project: a NestJS API for building ATS-compliant CVs and tailored motivation letters, with AI-assisted content suggestions and async PDF generation.

The frontend (planned in Next.js/React) hasn't been started yet — current focus is backend feature depth and architecture.

## Stack

- **Framework:** NestJS
- **Auth:** JWT access tokens + rotating refresh tokens (family-based reuse detection), rate limiting, account lockout, email verification, forgot/reset password, session management, account deletion
- **Relational data (auth/identity):** MySQL + TypeORM — `User`, `Profile`, `RefreshToken`
- **Document data (CVs/letters):** MongoDB + Mongoose
- **Async jobs:** Redis + BullMQ — PDF generation, AI suggestion/draft jobs, transactional email
- **File storage:** MinIO, with automatic local-disk fallback
- **AI:** Google Gemini (`gemini-2.5-flash`) for CV section suggestions and motivation letter drafting
- **PDF generation:** Puppeteer, async via BullMQ with job status polling
- **Image processing:** Sharp (avatar resize/normalize to WebP)
- **Email:** Nodemailer + MJML templates, Mailhog for local dev
- **Testing:** Jest (unit + e2e), GitHub Actions CI with MySQL/MongoDB/Redis/Mailhog service containers
- **Planned frontend:** Next.js / React (not yet started)

## Features

- **Auth:** register/login/logout, JWT + rotating refresh tokens with reuse detection, multi-device session listing and per-session revocation, rate limiting, account lockout, email verification, forgot/reset password, change password, account deletion with full cascade cleanup
- **Profiles:** bio, headline, contact/location fields, social/portfolio links, avatar upload (auto-resized, EXIF-stripped, normalized to WebP)
- **CVs:** structured sections (personal info, experience, education, skills, projects, certifications, languages), AI-assisted suggestions per section, async ATS-compliant PDF generation
- **Motivation letters:** AI-drafted letters grounded in CV content, async PDF generation

## Explicitly out of scope

Deliberate scope decisions, not oversights:
- **OAuth / 2FA / Magic-link login** — descoped as unnecessary complexity for this project's shape (single-user tool, no social graph)
- **Account deactivation / soft-delete** — deletion is immediate and irreversible by design, rather than adding a deactivation/grace-period layer

## Setup

See [`cv-builder-api/README.md`](./cv-builder-api/README.md) for backend setup instructions.

## Status

Backend is under active development. Auth, sessions, profiles, avatars, and account deletion are built and tested (Phases 0–20 of the internal roadmap). More backend work is planned before frontend work begins.