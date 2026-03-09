# Backend PRD: Competition/Event Registration System

## 1. Overview & Learning Objectives

This document outlines the complete backend requirements for a Competition/Event Registration System. By implementing these features, you will master the core NestJS concepts that employers expect:

| Learning Area | Why It Matters |
|---------------|----------------|
| **Modular Architecture** | NestJS enforces modular thinking; you'll learn to organize code into feature modules, shared modules, and core modules |
| **Authentication & Authorization** | Implement JWT strategies, guards, and role-based access control (Admin vs. Organizer vs. Participant) |
| **Concurrency Control** | Learn to prevent race conditions during high-traffic registration using database locks or Redis |
| **Background Processing** | Master queues for email notifications and async tasks using BullMQ |
| **Scheduled Jobs** | Implement cron jobs for automated tasks like closing registrations or sending reminders |
| **Database Design** | Design complex relationships with proper indexing and data integrity |
| **API Design** | Build RESTful endpoints with proper validation, transformation, and error handling |
| **Scalability Patterns** | Implement caching, rate limiting, and idempotency for production readiness |

---

## 2. User Roles & Permissions

### 2.1 Role Definitions

| Role | Description | Permissions |
|------|-------------|-------------|
| **Guest** | Unauthenticated user | View public events, register account |
| **Participant** | Registered user | View events, register for events, view own registrations, cancel own registrations |
| **Organizer** | Event creator | Create events, manage own events, view registrations for own events, export participant data |
| **Admin** | System administrator | Manage all users, assign roles, manage all events, system configuration |

### 2.2 User Management Features

#### FR-1: User Registration & Authentication

- Users shall register with email, password, name, and contact information
- Email verification required before participant privileges (double opt-in)
- Passwords must be hashed using bcrypt
- JWT tokens issued upon login with refresh token rotation
- Rate limiting on login attempts (5 attempts per 15 minutes)

#### FR-2: Profile Management

- Users can update profile information
- Users can change password (requires current password)
- Users can view registration history
- Users can delete account (with cascading rules for registrations)

#### FR-3: Role Assignment

- First registered user automatically becomes Admin
- Admins can assign Organizer role to users
- Users default to Participant role

---

## 3. Event Management Module

### 3.1 Event Data Model

| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| title | String | Event name | Required, 3-100 chars |
| description | Text | Detailed description | Required |
| slug | String | URL-friendly identifier | Unique, auto-generated from title |
| startDate | DateTime | Event start | Required, future date |
| endDate | DateTime | Event end | Required, after startDate |
| registrationDeadline | DateTime | Last registration date | Required, before startDate |
| location | String | Venue/location | Required |
| maxAttendees | Integer | Capacity limit | Optional (0 = unlimited) |
| currentRegistrations | Integer | Running count | Auto-updated, cannot exceed maxAttendees |
| status | Enum | draft, published, ongoing, completed, cancelled | Default: draft |
| category | Relation | Event category | Optional |
| organizerId | Relation | User who created event | Required |
| price | Decimal | Registration fee | Optional, 0 for free |
| priceOptions | JSON | Multiple pricing tiers | Optional |
| imageUrl | String | Event banner | Optional |
| metadata | JSON | Custom fields | Flexible for different event types |

### 3.2 Event Management Features

#### FR-4: Event Creation (Organizer/Admin)

- Organizers can create events with all fields above
- Auto-generate slug from title (ensure uniqueness)
- Set registration deadline validation (must be before start date)
- Upload event images (store in cloud storage, save URL)

#### FR-5: Event Update/Delete

- Organizers can edit their own events
- Admins can edit any event
- Delete events only if no registrations exist (or handle gracefully)
- Status changes trigger notifications to registered participants

#### FR-6: Event Listing & Filtering

- List published events with pagination
- Filter by: date range, category, status, search query
- Sort by: start date, popularity, registration count
- Include registration status for logged-in users (already registered? capacity full?)

#### FR-7: Event Detail

- Complete event information
- Current registration count and availability
- List of price options with descriptions
- Registration button (enabled/disabled based on deadline and capacity)

#### FR-8: Category Management

- Hierarchical categories (e.g., Technology > Web Development)
- Categories can be assigned to multiple events
- Admin only: create, update, delete categories

---

## 4. Registration Module (The Heart of the System)

### 4.1 Registration Data Model

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| eventId | Relation | Event being registered for |
| userId | Relation | User registering |
| registrationNumber | String | Unique human-readable ID (e.g., REG-2025-0001) |
| status | Enum | pending, confirmed, cancelled, attended, waitlisted |
| registrationDate | DateTime | When registered |
| cancellationDate | DateTime | If cancelled |
| paymentStatus | Enum | pending, paid, refunded, failed |
| paymentAmount | Decimal | Amount paid |
| paymentMethod | String | credit_card, bank_transfer, etc. |
| selectedPriceOption | JSON | Which price option was chosen |
| checkInTime | DateTime | For event day check-in |
| metadata | JSON | Additional registration-specific data |

### 4.2 Registration Features (Concurrency Critical)

#### FR-9: Registration Process

- Users can register for published events with available capacity
- Prevent duplicate registration: unique constraint on (eventId, userId)
- Registration number generation: format like EVT{eventId}-{timestamp}-{random}

#### FR-10: Concurrency Control (CRITICAL)

This is where you'll learn advanced backend patterns. Implement at least two of these strategies:

| Strategy | Implementation | Use Case |
|----------|---------------|----------|
| **Database Locking** | `SELECT ... FOR UPDATE` on event row before registration | Simple, prevents overselling |
| **Optimistic Locking** | Version field on event, check during update | Low contention scenarios |
| **Redis Distributed Lock** | Redlock pattern with Redis | High-scale, distributed deployments |
| **Queue-based Processing** | Push registration requests to queue, process sequentially | Peak load handling |

#### FR-11: Capacity Management

- Check availability before processing registration
- Atomically increment registration count
- Reject registration if capacity reached
- Show real-time availability to users

#### FR-12: Waitlist Feature

- If event full, users can join waitlist
- Automatic promotion when confirmed registration cancelled
- Notify waitlisted users when spots open
- Time-limited offer for promoted users (e.g., 24 hours to claim)

#### FR-13: Cancellation

- Users can cancel their registrations before deadline
- Organizers can set cancellation policy (free, fee, deadline)
- Upon cancellation:
  - Free up capacity
  - Trigger waitlist promotion
  - Send confirmation email
  - Process refund if applicable

#### FR-14: Check-in System

- Generate unique QR code for confirmed registrations
- Organizers can check in attendees via mobile/web
- Prevent duplicate check-in
- Track check-in time for attendance reporting

---

## 5. Payment Integration (Optional but Recommended)

### FR-15: Payment Processing

- Integrate with Stripe/PayPal for paid events
- Support multiple payment methods
- Handle payment webhooks securely
- Update registration status only after payment confirmation
- Implement idempotency keys to prevent duplicate charges

### FR-16: Refund Processing

- Organizers can issue refunds based on policy
- Partial refunds support
- Refund triggers status update and notification

---

## 6. Notification Module

### 6.1 Email Notifications (Background Processing)

#### FR-17: Automated Emails

Use BullMQ with Redis for reliable background processing:

| Notification Type | Trigger | Timing |
|-------------------|---------|--------|
| **Registration confirmation** | Successful registration | Immediate |
| **Payment confirmation** | Payment success | Immediate |
| **Event reminder** | 24 hours before event | Scheduled |
| **Waitlist confirmation** | Joined waitlist | Immediate |
| **Spot available** | Promoted from waitlist | Immediate |
| **Cancellation confirmation** | Registration cancelled | Immediate |
| **Event changes** | Event update | Immediate |

#### FR-18: Email Templates

- Configurable templates per notification type
- Support for dynamic variables (event name, date, etc.)
- HTML and plain text versions
- Attachment support (e.g., iCal for calendar)

#### FR-19: Queue Implementation

- Registration emails queued, not sent synchronously
- Retry logic with exponential backoff
- Dead letter queue for failed emails
- Email delivery status tracking

---

## 7. Admin Module

### FR-20: Admin Dashboard APIs

- System statistics dashboard: total users, events, registrations
- Real-time registration graphs
- Recent activity feed

### FR-21: User Management (Admin Only)

- List all users with filtering and pagination
- View user details and registration history
- Assign/revoke roles
- Suspend/activate users

### FR-22: Registration Management

- View all registrations across events
- Search by registration number, user email, event
- Export registrations to CSV/Excel
- Manual registration override (admin only)

### FR-23: System Configuration

- Configure email settings (SMTP)
- Set global registration rules
- Manage notification templates

---

## 8. Technical Requirements

### 8.1 API Design

#### FR-24: RESTful Endpoints

```text
# Public endpoints
GET    /api/events              # List events
GET    /api/events/:slug        # Event details
GET    /api/categories          # List categories
POST   /api/auth/register       # User registration
POST   /api/auth/login          # User login
POST   /api/auth/refresh        # Refresh token
POST   /api/auth/logout         # Logout

# Protected endpoints (require authentication)
GET    /api/users/profile       # Get profile
PATCH  /api/users/profile       # Update profile
GET    /api/users/registrations # My registrations
POST   /api/events/:eventId/register  # Register for event
DELETE /api/registrations/:id   # Cancel registration

# Organizer endpoints (require ORGANIZER role)
POST   /api/events              # Create event
PUT    /api/events/:id          # Update event
DELETE /api/events/:id          # Delete event
GET    /api/events/:id/registrations  # View event registrations
POST   /api/events/:id/export   # Export registrations

# Admin endpoints (require ADMIN role)
GET    /api/admin/users         # List users
PATCH  /api/admin/users/:id/role  # Change user role
GET    /api/admin/registrations  # All registrations
PUT    /api/admin/settings      # System settings
```

#### FR-25: Input Validation

- Use class-validator with DTOs for all endpoints
- Sanitize user input to prevent XSS
- Validate business rules (dates, capacity, etc.)

#### FR-26: Error Handling

- Consistent error response format
- HTTP status codes appropriate to error
- Detailed validation error messages
- Global exception filter

### 8.2 Database Requirements

#### FR-27: Schema Design

- Use PostgreSQL for relational data
- Proper foreign key constraints
- Indexes on frequently queried fields (email, eventId, userId, dates)
- Unique constraints where applicable (email, slug, registration number)

#### FR-28: Migrations

- Use TypeORM or Prisma migrations
- All schema changes version controlled
- Rollback capability

### 8.3 Security Requirements

#### FR-29: Authentication & Authorization

- JWT tokens with short expiration (15 min) + refresh tokens
- Role-based guards on all protected endpoints
- Row-level security: users can only access their own data
- Organizers can only access their own events

#### FR-30: Data Protection

- All passwords hashed with bcrypt (10+ rounds)
- HTTPS only in production
- CORS properly configured
- Rate limiting on public endpoints
- SQL injection prevention via ORM

#### FR-31: Idempotency

- Idempotency keys for registration and payment endpoints
- Prevent duplicate registrations on network retries
- Store idempotency records with expiration

### 8.4 Performance & Scalability

#### FR-32: Caching Strategy

- Cache event lists with Redis (TTL based on update frequency)
- Invalidate cache on event updates
- Cache category lists (rarely changes)

#### FR-33: Database Optimization

- Pagination for all list endpoints
- N+1 query prevention
- Query optimization for registration counts

#### FR-34: Background Processing

- BullMQ with Redis for queues
- Separate queue for different job types (email, notifications, exports)
- Job retry with backoff
- Job monitoring dashboard

#### FR-35: Rate Limiting

- Configurable rate limits per endpoint type
- Stricter limits on auth endpoints
- Different limits for authenticated vs public

### 8.5 Monitoring & Logging

#### FR-36: Logging

- Structured logging (JSON format)
- Request logging with correlation IDs
- Error logging with stack traces
- Audit log for sensitive operations (role changes, deletions)

#### FR-37: Health Checks

- `/health` endpoint for liveness probe
- `/health/ready` for readiness probe
- Database connection check
- Redis connection check

---

## 9. Advanced Features (For Mastery)

Once you've implemented the core features, add these to become truly industry-ready:

### FR-38: Multi-tenant Support

- Support multiple organizations with isolated data
- Organization-specific branding and settings

### FR-39: Webhooks

- Allow external systems to subscribe to events
- Webhook delivery with retry logic
- Event signatures for verification

### FR-40: GraphQL API

- Optional GraphQL layer alongside REST
- Resolvers for complex queries
- DataLoader for N+1 prevention

### FR-41: Real-time Updates

- WebSocket connections for live registration counts
- Notify organizers of new registrations in real-time

### FR-42: Analytics Events

- Track user behavior for analytics
- Export analytics data for business intelligence

---

## 10. Testing Requirements

### FR-43: Unit Tests

- Service layer tests with mocks
- Guard and interceptor tests
- Utility function tests

### FR-44: Integration Tests

- Database operations with test containers
- API endpoint tests with supertest
- Authentication flow tests

### FR-45: E2E Tests

- Critical paths: registration flow, payment flow
- Concurrency tests with multiple simultaneous requests
- Load tests for registration endpoints
