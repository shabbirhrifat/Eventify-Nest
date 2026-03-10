# Competition/Event Registration Backend

NestJS blueprint backend for a production-style competition and event registration system. The project is built as a feature-complete learning reference for authentication, role-based access, event management, concurrency-safe registration, waitlists, idempotency, background jobs, scheduled jobs, caching, admin APIs, and operational readiness.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Stack](#stack)
3. [Implemented PRD Coverage](#implemented-prd-coverage)
4. [Getting Started](#getting-started)
5. [Environment Variables](#environment-variables)
6. [Scripts](#scripts)
7. [Architecture](#architecture)
8. [Feature Walkthrough](#feature-walkthrough)
9. [API Endpoints](#api-endpoints)
10. [Folder Structure](#folder-structure)
11. [Testing](#testing)
12. [Official Documentation References](#official-documentation-references)

## Project Overview

This backend models a real registration platform with four main personas:

- `Guest`: can browse public events and register an account
- `Participant`: can manage their profile and registrations
- `Organizer`: can create and operate events they own
- `Admin`: can manage users, registrations, settings, templates, and dashboard APIs

The codebase is designed to be copied into future NestJS projects as a reusable backend foundation and as a living reference for common NestJS patterns.

## Stack

- NestJS 11
- TypeScript
- PostgreSQL + TypeORM
- JWT + Passport (`passport-local`, `passport-jwt`)
- Validation with `class-validator` and `class-transformer`
- BullMQ + Redis for queues
- Nest Schedule for cron jobs
- Throttler for rate limiting
- Terminus for health/readiness checks
- Multer for uploads
- Nodemailer for SMTP/email processing

## Implemented PRD Coverage

Implemented in code:

- User registration, login, refresh tokens, logout, email verification, profile updates, password changes, avatar upload, account deletion
- First user auto-promoted to admin; admin role assignment and user suspension APIs
- Event creation, update, delete guardrails, image upload, slug generation, validation, filtering, pagination, organizer-scoped management, CSV export
- Category hierarchy management
- Registration workflow with duplicate protection, pessimistic row locking, optimistic version checks on capacity updates, idempotency keys, waitlist promotion, cancellation flow, QR check-in support
- Notification templates, queued email delivery, delivery tracking, retry/backoff, event reminder cron jobs, event change notifications, waitlist notifications
- Admin dashboard statistics, user management, registration search, settings APIs, notification-template APIs
- Redis-backed caching for event lists and category lists
- Request correlation IDs, structured request logging, global exception formatting, health and readiness probes
- Migration tooling scripts and TypeORM data source configuration

Advanced PRD items intentionally left as next-step extensions:

- External payment gateway/webhook integration (Stripe/PayPal)
- Multi-tenant organizations
- WebSocket real-time updates
- GraphQL layer
- External analytics/webhooks

Those are not blocked by the current architecture; the project already includes payment state fields, idempotency patterns, queue infrastructure, and audit logging needed to extend into them cleanly.

## Getting Started

1. Install dependencies.
2. Copy `.env.example` to `.env`.
3. Start PostgreSQL and Redis.
4. Create the database schema.
5. Run the app in development mode.

```bash
npm install
cp .env.example .env
npm run migration:run
npm run start:dev
```

Default API base URL:

```text
http://localhost:3000/api
```

Useful first checks:

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/health/ready
```

## Environment Variables

Defined in `.env.example` and validated in `src/config/env.validation.ts`.

| Variable                      | Purpose                                |
| ----------------------------- | -------------------------------------- |
| `APP_NAME`                    | App name returned by health endpoints  |
| `PORT`                        | HTTP server port                       |
| `GLOBAL_PREFIX`               | API route prefix                       |
| `DB_*`                        | PostgreSQL connection settings         |
| `DB_SYNCHRONIZE`              | Dev-only schema sync                   |
| `DB_LOGGING`                  | SQL logging toggle                     |
| `JWT_SECRET`                  | Access token signing secret            |
| `JWT_REFRESH_SECRET`          | Refresh token signing secret           |
| `JWT_EXPIRES_IN`              | Access token TTL                       |
| `JWT_REFRESH_EXPIRES_IN`      | Refresh token TTL                      |
| `REDIS_*`                     | Redis connection settings              |
| `SMTP_*`                      | Mail transport settings                |
| `UPLOADS_ROOT_PATH`           | Static upload root                     |
| `IDEMPOTENCY_TTL_HOURS`       | Stored idempotency record TTL          |
| `EMAIL_QUEUE_ATTEMPTS`        | BullMQ retry count for emails          |
| `REGISTRATION_QUEUE_ATTEMPTS` | Reserved for registration queue tuning |

Development tip: set `SMTP_HOST=log` to use Nodemailer's JSON transport instead of a real SMTP server.

If you hit errors like `relation "events" does not exist` or `relation "users" does not exist`, the app is connected to PostgreSQL but the schema has not been created yet. Run `npm run migration:run` against that database before starting the server.

## Scripts

```bash
npm run start:dev
npm run build
npm run lint
npm run test
npm run test:e2e
npm run migration:generate
npm run migration:run
npm run migration:revert
```

## Architecture

Feature modules:

- `src/auth` - registration, login, refresh tokens, verification
- `src/users` - profile management, role/status workflows, avatar upload
- `src/categories` - hierarchical categories
- `src/events` - event CRUD, organizer views, exports, lifecycle scheduler
- `src/registrations` - registration core, waitlist, check-in, cancellation, concurrency control
- `src/notifications` - templates, delivery records, BullMQ processor, reminder scheduler
- `src/admin` - dashboard and admin-only management APIs
- `src/settings` - system configuration storage
- `src/audit-logs` - sensitive activity tracking
- `src/cache` - Redis access and cache invalidation helpers
- `src/idempotency` - duplicate request protection
- `src/health` - liveness and readiness probes

Cross-cutting infrastructure:

- `src/main.ts` configures validation, CORS, static assets, filters
- `src/common/filters/http-exception.filter.ts` normalizes error responses
- `src/common/middleware/request-logger.middleware.ts` adds correlation IDs and JSON-like request logs
- `src/common/guards/*` holds JWT, role, account status, and idempotency guards
- `src/config/*` contains typed config factories

## Feature Walkthrough

### Authentication and Authorization

Goal: secure the system with short-lived access tokens, refresh token rotation, and RBAC.

Key files:

- `src/auth/auth.service.ts`
- `src/auth/strategies/local.strategy.ts`
- `src/auth/strategies/jwt.strategy.ts`
- `src/common/guards/jwt-auth.guard.ts`
- `src/common/decorators/roles.decorator.ts`
- `src/common/guards/roles.guard.ts`

Highlights:

- bcrypt hashing for passwords
- refresh tokens stored hashed in `refresh_tokens`
- email verification enforced for non-admin participants
- first registered user becomes `admin`
- role guard supports `admin`, `organizer`, `participant`
- login endpoints throttled to 5 attempts / 15 minutes

Relevant docs:

- https://docs.nestjs.com/security/authentication
- https://docs.nestjs.com/security/authorization
- https://docs.nestjs.com/security/rate-limiting

### Validation and Input Safety

Goal: reject malformed or dangerous input at the API boundary.

Key files:

- `src/main.ts`
- `src/common/interceptors/sanitize-body.interceptor.ts`
- `src/**/dto/*.ts`

Highlights:

- global `ValidationPipe` with `whitelist`, `forbidNonWhitelisted`, and transform support
- DTO validation on every public and protected write endpoint
- simple HTML character stripping interceptor to reduce XSS-prone payloads

Relevant docs:

- https://docs.nestjs.com/techniques/validation
- https://docs.nestjs.com/interceptors

### Database and Schema Modeling

Goal: model users, events, registrations, categories, settings, notifications, and tokens with strong relational integrity.

Key files:

- `src/users/entities/user.entity.ts`
- `src/events/entities/event.entity.ts`
- `src/registrations/entities/registration.entity.ts`
- `src/categories/entities/category.entity.ts`
- `src/auth/entities/refresh-token.entity.ts`
- `src/database/data-source.ts`

Highlights:

- PostgreSQL relations with indexes and unique constraints
- event version column used for optimistic capacity updates
- unique constraints on user email, event slug, registration number, and `(event,user)` registration pair
- migration scripts configured for TypeORM CLI

Relevant docs:

- https://docs.nestjs.com/techniques/sql
- https://typeorm.io/

### Event Management

Goal: let organizers and admins manage the full event lifecycle.

Key files:

- `src/events/events.controller.ts`
- `src/events/events.service.ts`
- `src/events/events.scheduler.ts`

Highlights:

- automatic unique slug generation
- business validation for event dates and registration deadlines
- event image uploads served from `/uploads/events/*`
- filtered and paginated public listing
- organizer-scoped registration export
- scheduled status transitions from `published -> ongoing -> completed`

Relevant docs:

- https://docs.nestjs.com/controllers
- https://docs.nestjs.com/techniques/file-upload
- https://docs.nestjs.com/techniques/task-scheduling

### Registration, Capacity, Concurrency, and Waitlist

Goal: prevent overselling and handle real registration pressure correctly.

Key files:

- `src/registrations/registrations.service.ts`
- `src/idempotency/idempotency.service.ts`
- `src/common/guards/idempotency.guard.ts`

Highlights:

- required `Idempotency-Key` header on registration requests
- pessimistic lock on the event row during registration/cancellation
- optimistic version check when incrementing/decrementing event capacity
- duplicate registration protection with unique constraint and service validation
- automatic waitlisting when full
- waitlist promotion + 24-hour offer window
- QR code generation for confirmed registrations
- organizer/admin check-in endpoint

Relevant docs:

- https://docs.nestjs.com/techniques/database
- https://typeorm.io/transactions

### Notifications, Queues, and Scheduling

Goal: keep user-visible messaging asynchronous and reliable.

Key files:

- `src/notifications/notifications.service.ts`
- `src/notifications/processors/email.processor.ts`
- `src/notifications/notifications.scheduler.ts`

Highlights:

- BullMQ email queue with retry and exponential backoff
- persisted notification templates and delivery records
- event reminder cron job
- queued notifications for registration, waitlist, cancellation, and event changes

Relevant docs:

- https://docs.nestjs.com/techniques/queues
- https://docs.nestjs.com/techniques/task-scheduling

### Caching, Health, and Logging

Goal: improve performance and operational visibility.

Key files:

- `src/cache/redis.service.ts`
- `src/health/health.service.ts`
- `src/common/middleware/request-logger.middleware.ts`
- `src/common/filters/http-exception.filter.ts`

Highlights:

- Redis-backed caching for event lists and category lists
- liveness endpoint at `/api/health`
- readiness endpoint at `/api/health/ready` with database and Redis checks
- correlation IDs via `x-request-id`
- consistent JSON error payloads
- audit log persistence for sensitive actions

Relevant docs:

- https://docs.nestjs.com/recipes/terminus
- https://docs.nestjs.com/techniques/logger
- https://docs.nestjs.com/exception-filters

## API Endpoints

Base prefix: `/api`

### Public

- `GET /api/health`
- `GET /api/health/ready`
- `GET /api/events`
- `GET /api/events/:slug`
- `GET /api/categories`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/verify-email/:token`

### Authenticated User

- `GET /api/auth/me`
- `GET /api/users/profile`
- `PATCH /api/users/profile`
- `PATCH /api/users/password`
- `POST /api/users/avatar`
- `DELETE /api/users/account`
- `GET /api/users/registrations`
- `POST /api/events/:eventId/register`
- `DELETE /api/registrations/:id`
- `POST /api/registrations/:id/claim`

### Organizer/Admin

- `POST /api/events`
- `POST /api/events/:id/image`
- `PATCH /api/events/:id`
- `DELETE /api/events/:id`
- `GET /api/events/:id/registrations`
- `POST /api/events/:id/export`
- `POST /api/events/:eventId/registrations/:id/check-in`

### Admin

- `GET /api/admin/dashboard`
- `GET /api/admin/users`
- `PATCH /api/admin/users/:id/role`
- `PATCH /api/admin/users/:id/status`
- `GET /api/admin/registrations`
- `POST /api/admin/events/:id/export`
- `GET /api/admin/settings`
- `PUT /api/admin/settings`
- `GET /api/admin/notification-templates`
- `PATCH /api/admin/notification-templates/:type`
- `POST /api/categories`
- `PATCH /api/categories/:id`
- `DELETE /api/categories/:id`

### Example: Register for an Event

```http
POST /api/events/{eventId}/register
Authorization: Bearer <access-token>
Idempotency-Key: 7a4d045c-d9e1-4d7f-b4e5-f0d4298d469d
Content-Type: application/json

{
  "paymentMethod": "credit_card",
  "selectedPriceOption": {
    "label": "Early Bird",
    "amount": 49.99
  },
  "metadata": {
    "teamName": "Alpha"
  }
}
```

### Example Error Shape

```json
{
  "statusCode": 400,
  "timestamp": "2026-03-10T10:00:00.000Z",
  "path": "/api/events/123/register",
  "method": "POST",
  "requestId": "2d2da2d7-bf99-4ca0-a0ef-d3d5f8bb5a2f",
  "error": "BadRequestException",
  "message": "Registration deadline has passed."
}
```

## Folder Structure

```text
src/
|-- admin/
|-- audit-logs/
|-- auth/
|-- cache/
|-- categories/
|-- common/
|-- config/
|-- database/
|-- events/
|-- health/
|-- idempotency/
|-- notifications/
|-- registrations/
|-- settings/
`-- users/
```

Purpose by folder:

- `admin` - admin-only orchestration endpoints
- `audit-logs` - security and mutation audit history
- `auth` - token lifecycle and credential validation
- `cache` - Redis integration and cache helpers
- `categories` - event taxonomy
- `common` - reusable decorators, guards, middleware, filters, utils
- `config` - typed environment config
- `database` - TypeORM data source and migration folder
- `events` - event lifecycle and organizer features
- `health` - liveness and readiness probes
- `idempotency` - duplicate request prevention
- `notifications` - templating, queueing, and delivery
- `registrations` - registration core, waitlists, check-in
- `settings` - global system settings persistence
- `users` - user accounts and profiles

## Testing

Current automated coverage includes:

- `src/health/health.service.spec.ts`
- `src/auth/auth.service.spec.ts`
- `src/registrations/registrations.service.spec.ts`
- `test/app.e2e-spec.ts`

Run all verification:

```bash
npm run build
npm run lint
npm run test
npm run test:e2e
```

## Official Documentation References

- NestJS overview: https://docs.nestjs.com
- Validation: https://docs.nestjs.com/techniques/validation
- Authentication: https://docs.nestjs.com/security/authentication
- Authorization: https://docs.nestjs.com/security/authorization
- SQL/TypeORM: https://docs.nestjs.com/techniques/sql
- Queues: https://docs.nestjs.com/techniques/queues
- Scheduling: https://docs.nestjs.com/techniques/task-scheduling
- File upload: https://docs.nestjs.com/techniques/file-upload
- Terminus: https://docs.nestjs.com/recipes/terminus
- Exception filters: https://docs.nestjs.com/exception-filters
- Logger: https://docs.nestjs.com/techniques/logger

For a quick implementation audit, see `docs/IMPLEMENTATION_SUMMARY.md`.
