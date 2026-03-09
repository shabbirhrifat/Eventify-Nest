from __future__ import annotations

import json
from pathlib import Path
from textwrap import dedent, wrap

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
DOCS_DIR = ROOT / "docs"
POSTMAN_DIR = DOCS_DIR / "postman"
ERD_DIR = DOCS_DIR / "erd"
IMAGES_DIR = ROOT / "images"


COLLECTION_LEVEL_PREREQUEST = dedent(
    r"""
    const traceId = pm.variables.replaceIn('{{$guid}}');
    pm.collectionVariables.set('requestId', traceId);
    pm.request.headers.upsert({ key: 'X-Request-Id', value: traceId });
    pm.request.headers.upsert({ key: 'Accept', value: 'application/json' });

    const requestUrl = pm.request.url.toString();
    const isRegistrationRequest =
      pm.request.method === 'POST' && /\/events\/[^/]+\/register$/.test(requestUrl);

    if (isRegistrationRequest) {
      const idempotencyKey = pm.variables.replaceIn('{{$guid}}');
      pm.collectionVariables.set('idempotencyKey', idempotencyKey);
      pm.request.headers.upsert({ key: 'Idempotency-Key', value: idempotencyKey });
    }
    """
).strip()


COLLECTION_LEVEL_TESTS = dedent(
    """
    pm.collectionVariables.set('lastStatusCode', String(pm.response.code));

    const contentType = pm.response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return;
    }

    try {
      const payload = pm.response.json();
      if (payload && payload.id) {
        pm.collectionVariables.set('lastEntityId', String(payload.id));
      }
    } catch (error) {
      console.log('Skipping JSON parsing for response cache:', error.message);
    }
    """
).strip()


def bearer_auth(token_variable: str) -> dict:
    return {
        "type": "bearer",
        "bearer": [
            {
                "key": "token",
                "value": f"{{{{{token_variable}}}}}",
                "type": "string",
            }
        ],
    }


def no_auth() -> dict:
    return {"type": "noauth"}


def script_event(listen: str, script: str) -> dict:
    return {
        "listen": listen,
        "script": {
            "type": "text/javascript",
            "exec": script.splitlines(),
        },
    }


def raw_json_body(payload: dict) -> dict:
    return {
        "mode": "raw",
        "raw": json.dumps(payload, indent=2),
        "options": {"raw": {"language": "json"}},
    }


def formdata_body(fields: list[dict]) -> dict:
    return {"mode": "formdata", "formdata": fields}


def build_request(
    name: str,
    method: str,
    path: str,
    *,
    description: str,
    auth: dict | None = None,
    query: list[tuple[str, str, str]] | None = None,
    headers: list[tuple[str, str, str]] | None = None,
    body: dict | None = None,
    prerequest: str | None = None,
    tests: str | None = None,
) -> dict:
    normalized_path = path.strip("/")
    segments = normalized_path.split("/") if normalized_path else []
    url = {
        "raw": "{{baseUrl}}" + (f"/{normalized_path}" if normalized_path else ""),
        "host": ["{{baseUrl}}"],
        "path": segments,
    }

    if query:
        url["query"] = [
            {"key": key, "value": value, "description": description}
            for key, value, description in query
        ]

    request = {
        "name": name,
        "request": {
            "method": method,
            "header": [
                {"key": key, "value": value, "description": description}
                for key, value, description in (headers or [])
            ],
            "description": description,
            "url": url,
        },
        "response": [],
    }

    if auth is not None:
        request["request"]["auth"] = auth

    if body is not None:
        request["request"]["body"] = body

    events = []
    if prerequest:
        events.append(script_event("prerequest", prerequest))
    if tests:
        events.append(script_event("test", tests))
    if events:
        request["event"] = events

    return request


PUBLIC_FEATURES = [
    {
        "feature": "Health and readiness",
        "endpoints": [
            {
                "method": "GET",
                "path": "/api/health",
                "auth": "Public",
                "payload": "None",
                "notes": "Liveness probe that returns service name, uptime, and timestamp.",
            },
            {
                "method": "GET",
                "path": "/api/health/ready",
                "auth": "Public",
                "payload": "None",
                "notes": "Readiness probe that checks PostgreSQL and Redis.",
            },
        ],
    },
    {
        "feature": "Event discovery",
        "endpoints": [
            {
                "method": "GET",
                "path": "/api/events",
                "auth": "Public",
                "payload": "Query: page, limit, search?, status?, startDateFrom?, startDateTo?, categorySlug?, sortBy?, sortOrder?",
                "notes": "Lists events with pagination, filtering, and sorting. Draft events are hidden unless status is explicitly requested.",
            },
            {
                "method": "GET",
                "path": "/api/events/:slug",
                "auth": "Public",
                "payload": "Path: slug",
                "notes": "Returns detailed event data, organizer profile summary, categories, and registration state flags.",
            },
        ],
    },
    {
        "feature": "Categories",
        "endpoints": [
            {
                "method": "GET",
                "path": "/api/categories",
                "auth": "Public",
                "payload": "None",
                "notes": "Returns the category tree used by event filtering and event creation.",
            }
        ],
    },
]


ROLE_SECTIONS = [
    {
        "role": "Guest",
        "purpose": "A guest discovers the platform, creates an account, verifies email, and logs in before becoming a participant.",
        "journey": [
            "Check service health and browse public events/categories.",
            "Create a participant account with `POST /api/auth/register`.",
            "Verify email with `GET /api/auth/verify-email/:token` unless the account is the very first user in the system.",
            "Log in with `POST /api/auth/login` to receive access and refresh tokens.",
            "Rotate tokens with `POST /api/auth/refresh` and revoke a session with `POST /api/auth/logout`.",
        ],
        "features": [
            {
                "feature": "Authentication",
                "endpoints": [
                    {
                        "method": "POST",
                        "path": "/api/auth/register",
                        "auth": "Public",
                        "payload": "Body: email, password, fullName, phone?, city?, organization?",
                        "notes": "Creates the user profile. The first registered user is auto-promoted to admin and auto-verified.",
                    },
                    {
                        "method": "POST",
                        "path": "/api/auth/login",
                        "auth": "Public",
                        "payload": "Body: email, password",
                        "notes": "Protected by LocalAuthGuard and a 5 attempts / 15 minutes throttle profile.",
                    },
                    {
                        "method": "POST",
                        "path": "/api/auth/refresh",
                        "auth": "Public",
                        "payload": "Body: refreshToken",
                        "notes": "Revokes the existing refresh token and issues a brand new access/refresh pair.",
                    },
                    {
                        "method": "POST",
                        "path": "/api/auth/logout",
                        "auth": "Public",
                        "payload": "Body: refreshToken",
                        "notes": "Revokes the provided refresh token.",
                    },
                    {
                        "method": "GET",
                        "path": "/api/auth/verify-email/:token",
                        "auth": "Public",
                        "payload": "Path: token",
                        "notes": "Marks the email as verified and clears the stored verification token.",
                    },
                ],
            }
        ],
    },
    {
        "role": "Participant",
        "purpose": "A participant manages their account, registers for published events, handles waitlist offers, and reviews their event history.",
        "journey": [
            "Log in and inspect the current session via `GET /api/auth/me`.",
            "Update profile data, avatar, or password from the user endpoints.",
            "Review a published event and register with an idempotent request.",
            "Monitor registration status, including pending, confirmed, waitlisted, cancelled, or attended.",
            "Claim a waitlist offer before it expires or cancel a registration before the event deadline.",
        ],
        "features": [
            {
                "feature": "Session and profile",
                "endpoints": [
                    {
                        "method": "GET",
                        "path": "/api/auth/me",
                        "auth": "JWT",
                        "payload": "None",
                        "notes": "Returns the authenticated user profile snapshot.",
                    },
                    {
                        "method": "GET",
                        "path": "/api/users/profile",
                        "auth": "JWT + active account",
                        "payload": "None",
                        "notes": "Returns the participant profile object including avatar metadata.",
                    },
                    {
                        "method": "PATCH",
                        "path": "/api/users/profile",
                        "auth": "JWT + active account",
                        "payload": "Body: email?, password?, fullName?, phone?, city?, organization?",
                        "notes": "Email changes reset verification and generate a new verification token.",
                    },
                    {
                        "method": "PATCH",
                        "path": "/api/users/password",
                        "auth": "JWT + active account",
                        "payload": "Body: currentPassword, newPassword",
                        "notes": "Requires the current password to match before hashing the new password.",
                    },
                    {
                        "method": "POST",
                        "path": "/api/users/avatar",
                        "auth": "JWT + active account",
                        "payload": "Multipart form-data: file",
                        "notes": "Accepts jpg/jpeg/png up to 5 MB and stores the public file under `/uploads/avatars`.",
                    },
                    {
                        "method": "DELETE",
                        "path": "/api/users/account",
                        "auth": "JWT + active account",
                        "payload": "None",
                        "notes": "Deletes the account and cascades related owned records defined by the database model.",
                    },
                ],
            },
            {
                "feature": "Registrations",
                "endpoints": [
                    {
                        "method": "POST",
                        "path": "/api/events/:eventId/register",
                        "auth": "JWT + active account",
                        "payload": "Header: Idempotency-Key. Body: selectedPriceOption?, paymentMethod?, metadata?",
                        "notes": "Creates confirmed, pending, or waitlisted registrations depending on capacity and pricing.",
                    },
                    {
                        "method": "GET",
                        "path": "/api/users/registrations",
                        "auth": "JWT + active account",
                        "payload": "None",
                        "notes": "Lists the caller's registrations ordered by newest first.",
                    },
                    {
                        "method": "POST",
                        "path": "/api/registrations/:id/claim",
                        "auth": "JWT + active account",
                        "payload": "Path: registration id",
                        "notes": "Claims a live waitlist offer and converts it to pending or confirmed based on payment amount.",
                    },
                    {
                        "method": "DELETE",
                        "path": "/api/registrations/:id",
                        "auth": "JWT + active account",
                        "payload": "Path: registration id",
                        "notes": "Cancels the participant's own registration and triggers waitlist promotion when capacity opens up.",
                    },
                ],
            },
        ],
    },
    {
        "role": "Organizer",
        "purpose": "An organizer logs in, creates and publishes events, reviews event registrations, exports CSV data, and checks attendees in on-site.",
        "journey": [
            "Log in as an organizer or admin-enabled organizer account.",
            "Create an event draft or published event with categories, pricing, and scheduling details.",
            "Upload an event image, then update the event as details change.",
            "Inspect registrations, export registration CSV data, and check attendees in.",
            "Delete the event only if it has no registrations; otherwise use status/cancellation workflows instead.",
        ],
        "features": [
            {
                "feature": "Event management",
                "endpoints": [
                    {
                        "method": "POST",
                        "path": "/api/events",
                        "auth": "JWT + active account + organizer/admin role",
                        "payload": "Body: title, description, startDate, endDate, registrationDeadline, location, maxAttendees?, status?, price?, priceOptions?, categoryIds?, metadata?, cancellationPolicy?",
                        "notes": "Creates the event, validates date ordering, generates a unique slug, and stores category links.",
                    },
                    {
                        "method": "POST",
                        "path": "/api/events/:id/image",
                        "auth": "JWT + active account + organizer/admin role",
                        "payload": "Multipart form-data: file",
                        "notes": "Accepts jpg/jpeg/png up to 8 MB and publishes the asset under `/uploads/events`.",
                    },
                    {
                        "method": "PATCH",
                        "path": "/api/events/:id",
                        "auth": "JWT + active account + organizer/admin role",
                        "payload": "Body: any subset of the create-event fields",
                        "notes": "Ownership is enforced for organizers. Non-draft updates notify registered participants.",
                    },
                    {
                        "method": "DELETE",
                        "path": "/api/events/:id",
                        "auth": "JWT + active account + organizer/admin role",
                        "payload": "Path: event id",
                        "notes": "Deletion is blocked when registrations already exist.",
                    },
                ],
            },
            {
                "feature": "Operations and exports",
                "endpoints": [
                    {
                        "method": "GET",
                        "path": "/api/events/:id/registrations",
                        "auth": "JWT + active account + organizer/admin role",
                        "payload": "Path: event id",
                        "notes": "Lists all registrations for an event after organizer ownership is validated.",
                    },
                    {
                        "method": "POST",
                        "path": "/api/events/:id/export",
                        "auth": "JWT + active account + organizer/admin role",
                        "payload": "Path: event id",
                        "notes": "Returns `{ fileName, content }` where `content` is CSV text, not a streamed file response.",
                    },
                    {
                        "method": "POST",
                        "path": "/api/events/:eventId/registrations/:id/check-in",
                        "auth": "JWT + active account + organizer/admin role",
                        "payload": "Path: eventId, registration id",
                        "notes": "Checks in confirmed registrations only. Authorization uses the registration's linked event organizer.",
                    },
                ],
            },
        ],
    },
    {
        "role": "Admin",
        "purpose": "An admin oversees platform analytics, user governance, registrations, system settings, categories, and notification templates.",
        "journey": [
            "Log in with an admin account and load the dashboard summary.",
            "Search users, assign roles, and suspend or reactivate accounts.",
            "Inspect all registrations or export an event's full registration CSV.",
            "Manage system settings, category taxonomy, and notification templates.",
        ],
        "features": [
            {
                "feature": "Dashboard and user administration",
                "endpoints": [
                    {
                        "method": "GET",
                        "path": "/api/admin/dashboard",
                        "auth": "JWT + active account + admin role",
                        "payload": "None",
                        "notes": "Returns totals, charts, recent registrations, and recent audit activity.",
                    },
                    {
                        "method": "GET",
                        "path": "/api/admin/users",
                        "auth": "JWT + active account + admin role",
                        "payload": "Query: page, limit, search?, email?, role?, status?",
                        "notes": "Returns paginated user data with optional email and role filters.",
                    },
                    {
                        "method": "PATCH",
                        "path": "/api/admin/users/:id/role",
                        "auth": "JWT + active account + admin role",
                        "payload": "Body: role",
                        "notes": "Prevents demoting the last remaining admin account.",
                    },
                    {
                        "method": "PATCH",
                        "path": "/api/admin/users/:id/status",
                        "auth": "JWT + active account + admin role",
                        "payload": "Body: status",
                        "notes": "Toggles user status between `active` and `suspended`.",
                    },
                ],
            },
            {
                "feature": "Registrations and exports",
                "endpoints": [
                    {
                        "method": "GET",
                        "path": "/api/admin/registrations",
                        "auth": "JWT + active account + admin role",
                        "payload": "Query: page, limit, search?, status?, paymentStatus?, eventId?",
                        "notes": "Searches across registration number, user email, and event title.",
                    },
                    {
                        "method": "POST",
                        "path": "/api/admin/events/:id/export",
                        "auth": "JWT + active account + admin role",
                        "payload": "Path: event id",
                        "notes": "Exports an event's registration rows as a JSON wrapper containing CSV text.",
                    },
                ],
            },
            {
                "feature": "Settings, categories, and templates",
                "endpoints": [
                    {
                        "method": "GET",
                        "path": "/api/admin/settings",
                        "auth": "JWT + active account + admin role",
                        "payload": "None",
                        "notes": "Returns all stored system settings.",
                    },
                    {
                        "method": "PUT",
                        "path": "/api/admin/settings",
                        "auth": "JWT + active account + admin role",
                        "payload": "Body: items[{ key, value, description? }]",
                        "notes": "Upserts system settings in batch form.",
                    },
                    {
                        "method": "GET",
                        "path": "/api/admin/notification-templates",
                        "auth": "JWT + active account + admin role",
                        "payload": "None",
                        "notes": "Lists all notification templates keyed by notification type.",
                    },
                    {
                        "method": "PATCH",
                        "path": "/api/admin/notification-templates/:type",
                        "auth": "JWT + active account + admin role",
                        "payload": "Body: subjectTemplate?, htmlTemplate?, textTemplate?, enabled?",
                        "notes": "Updates one notification template at a time.",
                    },
                    {
                        "method": "POST",
                        "path": "/api/categories",
                        "auth": "JWT + admin role",
                        "payload": "Body: name, parentId?",
                        "notes": "Creates a new category node for the public category tree.",
                    },
                    {
                        "method": "PATCH",
                        "path": "/api/categories/:id",
                        "auth": "JWT + admin role",
                        "payload": "Body: name?, parentId?",
                        "notes": "Updates category naming or hierarchy.",
                    },
                    {
                        "method": "DELETE",
                        "path": "/api/categories/:id",
                        "auth": "JWT + admin role",
                        "payload": "Path: category id",
                        "notes": "Deletes the chosen category.",
                    },
                ],
            },
        ],
    },
]


ERD_CODE = dedent(
    """
    title Competition and Event Registration ERD
    colorMode pastel
    styleMode plain
    typeface clean
    notation crows-feet

    users [icon: user, color: blue] {
      id uuid pk
      email varchar unique
      password varchar
      role enum
      status enum
      emailVerified boolean
      emailVerificationToken varchar nullable
      emailVerifiedAt timestamptz nullable
      createdAt timestamptz
      updatedAt timestamptz
    }

    profiles [icon: id-card, color: teal] {
      id uuid pk
      userId uuid unique fk
      fullName varchar
      phone varchar nullable
      city varchar nullable
      organization varchar nullable
      bio text nullable
      avatarUrl varchar nullable
      createdAt timestamptz
      updatedAt timestamptz
    }

    events [icon: calendar, color: orange] {
      id uuid pk
      organizerId uuid fk
      title varchar
      description text
      slug varchar unique
      startDate timestamptz
      endDate timestamptz
      registrationDeadline timestamptz
      location varchar
      maxAttendees int
      currentRegistrations int
      status enum
      price decimal
      priceOptions jsonb nullable
      imageUrl varchar nullable
      metadata jsonb nullable
      cancellationPolicy jsonb nullable
      version int
      createdAt timestamptz
      updatedAt timestamptz
    }

    registrations [icon: clipboard, color: red] {
      id uuid pk
      eventId uuid fk
      userId uuid fk
      registrationNumber varchar unique
      status enum
      cancellationDate timestamptz nullable
      paymentStatus enum
      paymentAmount decimal
      paymentMethod varchar nullable
      selectedPriceOption jsonb nullable
      checkInTime timestamptz nullable
      metadata jsonb nullable
      qrCodeDataUrl text nullable
      waitlistPromotedAt timestamptz nullable
      waitlistOfferExpiresAt timestamptz nullable
      createdAt timestamptz
      updatedAt timestamptz
    }

    categories [icon: tag, color: green] {
      id uuid pk
      parentId uuid nullable
      name varchar unique
      slug varchar unique
      createdAt timestamptz
      updatedAt timestamptz
    }

    event_categories [icon: layers, color: green] {
      eventId uuid pk
      categoryId uuid pk
    }

    refresh_tokens [icon: key, color: purple] {
      id uuid pk
      userId uuid fk
      tokenId varchar unique
      hashedToken varchar
      revoked boolean
      expiresAt timestamptz
      createdAt timestamptz
      updatedAt timestamptz
    }

    notification_templates [icon: mail, color: yellow] {
      id uuid pk
      type enum unique
      subjectTemplate varchar
      htmlTemplate text
      textTemplate text
      enabled boolean
      createdAt timestamptz
      updatedAt timestamptz
    }

    notification_deliveries [icon: send, color: yellow] {
      id uuid pk
      type enum
      recipientEmail varchar
      subject varchar
      htmlBody text
      textBody text
      status varchar
      sentAt timestamptz nullable
      failedAt timestamptz nullable
      failureReason text nullable
      payload jsonb nullable
      createdAt timestamptz
      updatedAt timestamptz
    }

    system_settings [icon: settings, color: gray] {
      id uuid pk
      key varchar unique
      value jsonb
      description text nullable
      createdAt timestamptz
      updatedAt timestamptz
    }

    idempotency_keys [icon: shield, color: gray] {
      id uuid pk
      key varchar
      scope varchar
      userId uuid nullable
      requestHash varchar
      responseBody jsonb nullable
      statusCode int nullable
      completed boolean
      expiresAt timestamptz
      createdAt timestamptz
      updatedAt timestamptz
    }

    audit_logs [icon: search, color: gray] {
      id uuid pk
      action varchar
      entity varchar
      actorUserId uuid nullable
      metadata jsonb nullable
      createdAt timestamptz
      updatedAt timestamptz
    }

    profiles.userId - users.id
    events.organizerId > users.id
    registrations.userId > users.id
    registrations.eventId > events.id
    refresh_tokens.userId > users.id
    categories.parentId > categories.id
    event_categories.eventId > events.id
    event_categories.categoryId > categories.id
    idempotency_keys.userId > users.id
    audit_logs.actorUserId > users.id
    """
).strip() + "\n"


def feature_table(feature: dict) -> str:
    rows = [
        "| Method | Path | Auth | Request shape | Notes |",
        "| --- | --- | --- | --- | --- |",
    ]
    for endpoint in feature["endpoints"]:
        rows.append(
            "| {method} | `{path}` | {auth} | {payload} | {notes} |".format(**endpoint)
        )
    return "\n".join(rows)


def build_api_summary() -> str:
    lines = [
        "# API Summary",
        "",
        "This document maps the currently implemented API surface in the NestJS backend. It is organized in two ways:",
        "",
        "- by the order a real user would normally move through the product",
        "- by persona so each role can quickly find the endpoints it can use",
        "",
        "## Base conventions",
        "",
        "- Default base URL: `http://localhost:3000/api`",
        "- Default auth style: `Authorization: Bearer <accessToken>` on protected routes",
        "- Registration writes require an `Idempotency-Key` header and the backend replays successful duplicates safely",
        "- File uploads use multipart form-data and are served from `/uploads/...`",
        "- Event registration exports return JSON with `fileName` and CSV `content`, not a streamed download",
        "",
        "## Recommended journey order",
        "",
        "1. Public checks and discovery: `GET /api/health`, `GET /api/health/ready`, `GET /api/categories`, `GET /api/events`, `GET /api/events/:slug`",
        "2. Guest onboarding: `POST /api/auth/register`, `GET /api/auth/verify-email/:token`, `POST /api/auth/login`",
        "3. Participant self-service: `GET /api/auth/me`, `GET/PATCH /api/users/profile`, `PATCH /api/users/password`, `POST /api/users/avatar`",
        "4. Participant event booking: `POST /api/events/:eventId/register`, `GET /api/users/registrations`, `POST /api/registrations/:id/claim`, `DELETE /api/registrations/:id`",
        "5. Organizer operations: `POST /api/events`, `POST /api/events/:id/image`, `PATCH /api/events/:id`, `GET /api/events/:id/registrations`, `POST /api/events/:id/export`, `POST /api/events/:eventId/registrations/:id/check-in`",
        "6. Admin governance: `GET /api/admin/dashboard`, `GET /api/admin/users`, `PATCH /api/admin/users/:id/role`, `PATCH /api/admin/users/:id/status`, `GET /api/admin/registrations`, `PUT /api/admin/settings`, `PATCH /api/admin/notification-templates/:type`, category management routes",
        "",
        "## Public and platform APIs",
        "",
    ]

    for feature in PUBLIC_FEATURES:
        lines.extend([f"### {feature['feature']}", "", feature_table(feature), ""])

    for section in ROLE_SECTIONS:
        lines.extend(
            [
                f"## {section['role']} APIs",
                "",
                section["purpose"],
                "",
                "### Typical flow",
                "",
            ]
        )
        lines.extend([f"1. {step}" for step in section["journey"]])
        lines.append("")

        for feature in section["features"]:
            lines.extend([f"### {feature['feature']}", "", feature_table(feature), ""])

    lines.extend(
        [
            "## Workflow notes",
            "",
            "- First user bootstrap: the very first registered user becomes `admin`, is immediately email-verified, and can use admin routes without a separate role-assignment step.",
            "- Email verification: non-admin users must verify email before login succeeds.",
            "- Registration outcomes: free registrations become `confirmed`, paid registrations become `pending`, and full events create `waitlisted` registrations.",
            "- Waitlist handling: cancelled seats trigger waitlist promotion; claimed offers expire after 24 hours if not accepted.",
            "- Check-in rule: only organizers who own the event, or admins, can check in attendees, and only `confirmed` registrations can be checked in.",
            "- Health readiness: `/api/health/ready` checks both the database and Redis dependencies before reporting success.",
            "",
            "## Artifacts generated with this summary",
            "",
            "- Postman collection: `docs/postman/event-registration-api.postman_collection.json`",
            "- Eraser diagram-as-code: `docs/erd/event-registration.eraser`",
            "- ERD image: `images/event-registration-erd.png`",
            "",
            "## ERD preview",
            "",
            "![Event registration ERD](../images/event-registration-erd.png)",
            "",
        ]
    )

    return "\n".join(lines)


def login_test_script(prefix: str) -> str:
    return dedent(
        f"""
        pm.test('Login succeeds', function () {{
          pm.expect(pm.response.code).to.be.oneOf([200, 201]);
        }});

        const payload = pm.response.json();
        pm.collectionVariables.set('{prefix}AccessToken', payload.accessToken);
        pm.collectionVariables.set('{prefix}RefreshToken', payload.refreshToken);
        pm.collectionVariables.set('{prefix}UserId', payload.user.id);
        pm.collectionVariables.set('{prefix}Email', payload.user.email);
        pm.collectionVariables.set('lastAuthenticatedRole', payload.user.role);
        """
    ).strip()


def refresh_test_script(prefix: str) -> str:
    return dedent(
        f"""
        pm.test('Refresh succeeds', function () {{
          pm.expect(pm.response.code).to.be.oneOf([200, 201]);
        }});

        const payload = pm.response.json();
        pm.collectionVariables.set('{prefix}AccessToken', payload.accessToken);
        pm.collectionVariables.set('{prefix}RefreshToken', payload.refreshToken);
        """
    ).strip()


def build_postman_collection() -> dict:
    public_folder = {
        "name": "00 Public and Guest",
        "auth": no_auth(),
        "item": [
            {
                "name": "Health",
                "item": [
                    build_request(
                        "Liveness",
                        "GET",
                        "/health",
                        description="Check whether the service process is up.",
                    ),
                    build_request(
                        "Readiness",
                        "GET",
                        "/health/ready",
                        description="Check whether PostgreSQL and Redis are ready.",
                    ),
                ],
            },
            {
                "name": "Event Discovery",
                "item": [
                    build_request(
                        "List Events",
                        "GET",
                        "/events",
                        description="Browse public events with filters and pagination.",
                        query=[
                            ("page", "1", "Page number"),
                            ("limit", "10", "Items per page"),
                            ("search", "tech", "Optional title/description search"),
                            ("sortBy", "startDate", "Sort by startDate or popularity"),
                            ("sortOrder", "ASC", "Sort direction"),
                        ],
                    ),
                    build_request(
                        "Get Event by Slug",
                        "GET",
                        "/events/{{publicEventSlug}}",
                        description="Fetch full public event details using the event slug.",
                    ),
                ],
            },
            {
                "name": "Categories",
                "item": [
                    build_request(
                        "List Categories",
                        "GET",
                        "/categories",
                        description="Fetch the public category tree.",
                    )
                ],
            },
            {
                "name": "Authentication",
                "item": [
                    build_request(
                        "Register Participant",
                        "POST",
                        "/auth/register",
                        description="Register a new participant account.",
                        body=raw_json_body(
                            {
                                "email": "{{participantEmail}}",
                                "password": "{{participantPassword}}",
                                "fullName": "{{participantFullName}}",
                                "phone": "+15551234567",
                                "city": "Dhaka",
                                "organization": "OpenCode Labs",
                            }
                        ),
                        tests=dedent(
                            """
                            pm.test('Register request succeeds', function () {
                              pm.expect(pm.response.code).to.be.oneOf([200, 201]);
                            });

                            const payload = pm.response.json();
                            if (payload.user && payload.user.id) {
                              pm.collectionVariables.set('participantUserId', payload.user.id);
                            }
                            if (payload.verificationRequired !== undefined) {
                              pm.collectionVariables.set('participantVerificationRequired', String(payload.verificationRequired));
                            }
                            """
                        ).strip(),
                    ),
                    build_request(
                        "Verify Email",
                        "GET",
                        "/auth/verify-email/{{verificationToken}}",
                        description="Verify a user's email with the stored verification token.",
                    ),
                    build_request(
                        "Login Participant",
                        "POST",
                        "/auth/login",
                        description="Log in as a participant and store tokens for participant folders.",
                        body=raw_json_body(
                            {
                                "email": "{{participantEmail}}",
                                "password": "{{participantPassword}}",
                            }
                        ),
                        tests=login_test_script("participant"),
                    ),
                    build_request(
                        "Refresh Participant Token",
                        "POST",
                        "/auth/refresh",
                        description="Rotate the participant refresh token.",
                        body=raw_json_body({"refreshToken": "{{participantRefreshToken}}"}),
                        tests=refresh_test_script("participant"),
                    ),
                    build_request(
                        "Logout Participant",
                        "POST",
                        "/auth/logout",
                        description="Revoke the participant refresh token.",
                        body=raw_json_body({"refreshToken": "{{participantRefreshToken}}"}),
                    ),
                ],
            },
        ],
    }

    participant_folder = {
        "name": "01 Participant",
        "auth": bearer_auth("participantAccessToken"),
        "item": [
            {
                "name": "Session",
                "item": [
                    build_request(
                        "Current User",
                        "GET",
                        "/auth/me",
                        description="Inspect the currently authenticated participant session.",
                    )
                ],
            },
            {
                "name": "Profile",
                "item": [
                    build_request(
                        "Get Profile",
                        "GET",
                        "/users/profile",
                        description="Fetch the participant profile document.",
                    ),
                    build_request(
                        "Update Profile",
                        "PATCH",
                        "/users/profile",
                        description="Update email or profile metadata for the participant.",
                        body=raw_json_body(
                            {
                                "fullName": "{{participantFullName}}",
                                "phone": "+15551230000",
                                "city": "Chattogram",
                                "organization": "OpenCode Labs",
                            }
                        ),
                    ),
                    build_request(
                        "Change Password",
                        "PATCH",
                        "/users/password",
                        description="Change the participant password.",
                        body=raw_json_body(
                            {
                                "currentPassword": "{{participantPassword}}",
                                "newPassword": "{{participantNextPassword}}",
                            }
                        ),
                    ),
                    build_request(
                        "Upload Avatar",
                        "POST",
                        "/users/avatar",
                        description="Upload a participant avatar image.",
                        body=formdata_body(
                            [
                                {
                                    "key": "file",
                                    "type": "file",
                                    "src": "",
                                    "description": "Attach a jpg/jpeg/png file up to 5 MB.",
                                }
                            ]
                        ),
                    ),
                    build_request(
                        "Delete Account",
                        "DELETE",
                        "/users/account",
                        description="Delete the participant account and related profile data.",
                    ),
                ],
            },
            {
                "name": "Registrations",
                "item": [
                    build_request(
                        "Register for Event",
                        "POST",
                        "/events/{{publicEventId}}/register",
                        description="Create an idempotent registration for a published event.",
                        body=raw_json_body(
                            {
                                "selectedPriceOption": {
                                    "label": "General",
                                    "amount": 0,
                                },
                                "paymentMethod": "manual",
                                "metadata": {
                                    "source": "postman",
                                    "note": "sample registration request",
                                },
                            }
                        ),
                        tests=dedent(
                            """
                            pm.test('Registration request succeeds', function () {
                              pm.expect(pm.response.code).to.be.oneOf([200, 201]);
                            });

                            const payload = pm.response.json();
                            if (payload.id) {
                              pm.collectionVariables.set('participantRegistrationId', payload.id);
                              pm.collectionVariables.set('organizerRegistrationId', payload.id);
                            }
                            if (payload.registrationNumber) {
                              pm.collectionVariables.set('participantRegistrationNumber', payload.registrationNumber);
                            }
                            """
                        ).strip(),
                    ),
                    build_request(
                        "List My Registrations",
                        "GET",
                        "/users/registrations",
                        description="List registrations that belong to the participant.",
                    ),
                    build_request(
                        "Claim Waitlist Offer",
                        "POST",
                        "/registrations/{{participantRegistrationId}}/claim",
                        description="Claim an active waitlist offer for the participant.",
                    ),
                    build_request(
                        "Cancel Registration",
                        "DELETE",
                        "/registrations/{{participantRegistrationId}}",
                        description="Cancel a participant registration before the deadline.",
                    ),
                ],
            },
        ],
    }

    organizer_folder = {
        "name": "02 Organizer",
        "auth": bearer_auth("organizerAccessToken"),
        "item": [
            {
                "name": "Auth Bootstrap",
                "auth": no_auth(),
                "item": [
                    build_request(
                        "Login Organizer",
                        "POST",
                        "/auth/login",
                        description="Log in as an organizer and store organizer tokens.",
                        auth=no_auth(),
                        body=raw_json_body(
                            {
                                "email": "{{organizerEmail}}",
                                "password": "{{organizerPassword}}",
                            }
                        ),
                        tests=login_test_script("organizer"),
                    ),
                    build_request(
                        "Refresh Organizer Token",
                        "POST",
                        "/auth/refresh",
                        description="Rotate the organizer refresh token.",
                        auth=no_auth(),
                        body=raw_json_body({"refreshToken": "{{organizerRefreshToken}}"}),
                        tests=refresh_test_script("organizer"),
                    ),
                    build_request(
                        "Logout Organizer",
                        "POST",
                        "/auth/logout",
                        description="Revoke the organizer refresh token.",
                        auth=no_auth(),
                        body=raw_json_body({"refreshToken": "{{organizerRefreshToken}}"}),
                    ),
                ],
            },
            {
                "name": "Events",
                "item": [
                    build_request(
                        "Create Event",
                        "POST",
                        "/events",
                        description="Create a new event as the organizer.",
                        body=raw_json_body(
                            {
                                "title": "OpenCode Tech Expo 2026",
                                "description": "A sample organizer event used to exercise the API collection.",
                                "startDate": "2026-08-20T09:00:00.000Z",
                                "endDate": "2026-08-20T17:00:00.000Z",
                                "registrationDeadline": "2026-08-15T23:59:00.000Z",
                                "location": "Dhaka Convention Center",
                                "maxAttendees": 300,
                                "status": "published",
                                "price": 0,
                                "priceOptions": [
                                    {
                                        "label": "General",
                                        "amount": 0,
                                        "description": "Free admission",
                                    }
                                ],
                                "categoryIds": [],
                                "metadata": {
                                    "theme": "innovation"
                                },
                                "cancellationPolicy": {
                                    "refundWindow": "before-deadline"
                                },
                            }
                        ),
                        tests=dedent(
                            """
                            pm.test('Event creation succeeds', function () {
                              pm.expect(pm.response.code).to.be.oneOf([200, 201]);
                            });

                            const payload = pm.response.json();
                            if (payload.id) {
                              pm.collectionVariables.set('organizerEventId', payload.id);
                              pm.collectionVariables.set('publicEventId', payload.id);
                            }
                            if (payload.slug) {
                              pm.collectionVariables.set('publicEventSlug', payload.slug);
                            }
                            """
                        ).strip(),
                    ),
                    build_request(
                        "Upload Event Image",
                        "POST",
                        "/events/{{organizerEventId}}/image",
                        description="Upload the organizer event hero image.",
                        body=formdata_body(
                            [
                                {
                                    "key": "file",
                                    "type": "file",
                                    "src": "",
                                    "description": "Attach a jpg/jpeg/png file up to 8 MB.",
                                }
                            ]
                        ),
                    ),
                    build_request(
                        "Update Event",
                        "PATCH",
                        "/events/{{organizerEventId}}",
                        description="Update event metadata, status, or scheduling details.",
                        body=raw_json_body(
                            {
                                "location": "Dhaka Convention Center Hall B",
                                "maxAttendees": 320,
                                "metadata": {
                                    "theme": "innovation",
                                    "updatedBy": "postman"
                                },
                            }
                        ),
                    ),
                    build_request(
                        "Delete Event",
                        "DELETE",
                        "/events/{{organizerEventId}}",
                        description="Delete an event that has no registrations.",
                    ),
                ],
            },
            {
                "name": "Operations",
                "item": [
                    build_request(
                        "List Event Registrations",
                        "GET",
                        "/events/{{organizerEventId}}/registrations",
                        description="List registrations for the organizer-owned event.",
                    ),
                    build_request(
                        "Export Event Registrations",
                        "POST",
                        "/events/{{organizerEventId}}/export",
                        description="Export organizer event registrations as CSV content wrapped in JSON.",
                    ),
                    build_request(
                        "Check In Registration",
                        "POST",
                        "/events/{{organizerEventId}}/registrations/{{organizerRegistrationId}}/check-in",
                        description="Check in a confirmed event registration.",
                    ),
                ],
            },
        ],
    }

    admin_folder = {
        "name": "03 Admin",
        "auth": bearer_auth("adminAccessToken"),
        "item": [
            {
                "name": "Auth Bootstrap",
                "auth": no_auth(),
                "item": [
                    build_request(
                        "Login Admin",
                        "POST",
                        "/auth/login",
                        description="Log in as an admin and store admin tokens.",
                        auth=no_auth(),
                        body=raw_json_body(
                            {
                                "email": "{{adminEmail}}",
                                "password": "{{adminPassword}}",
                            }
                        ),
                        tests=login_test_script("admin"),
                    ),
                    build_request(
                        "Refresh Admin Token",
                        "POST",
                        "/auth/refresh",
                        description="Rotate the admin refresh token.",
                        auth=no_auth(),
                        body=raw_json_body({"refreshToken": "{{adminRefreshToken}}"}),
                        tests=refresh_test_script("admin"),
                    ),
                    build_request(
                        "Logout Admin",
                        "POST",
                        "/auth/logout",
                        description="Revoke the admin refresh token.",
                        auth=no_auth(),
                        body=raw_json_body({"refreshToken": "{{adminRefreshToken}}"}),
                    ),
                ],
            },
            {
                "name": "Dashboard",
                "item": [
                    build_request(
                        "Get Dashboard",
                        "GET",
                        "/admin/dashboard",
                        description="Fetch high-level totals, charts, recent registrations, and recent activity.",
                    )
                ],
            },
            {
                "name": "Users",
                "item": [
                    build_request(
                        "List Users",
                        "GET",
                        "/admin/users",
                        description="List users with pagination and admin filters.",
                        query=[
                            ("page", "1", "Page number"),
                            ("limit", "10", "Items per page"),
                            ("search", "admin", "Optional free-text search"),
                            ("role", "participant", "Optional role filter"),
                            ("status", "active", "Optional status filter"),
                        ],
                    ),
                    build_request(
                        "Change User Role",
                        "PATCH",
                        "/admin/users/{{adminManagedUserId}}/role",
                        description="Promote or demote a user role.",
                        body=raw_json_body({"role": "organizer"}),
                    ),
                    build_request(
                        "Update User Status",
                        "PATCH",
                        "/admin/users/{{adminManagedUserId}}/status",
                        description="Suspend or reactivate a user.",
                        body=raw_json_body({"status": "suspended"}),
                    ),
                ],
            },
            {
                "name": "Registrations",
                "item": [
                    build_request(
                        "List Registrations",
                        "GET",
                        "/admin/registrations",
                        description="Search registrations across users and events.",
                        query=[
                            ("page", "1", "Page number"),
                            ("limit", "10", "Items per page"),
                            ("search", "EVT", "Search registration number, email, or event title"),
                            ("status", "confirmed", "Optional registration status filter"),
                            ("paymentStatus", "paid", "Optional payment status filter"),
                            ("eventId", "{{organizerEventId}}", "Optional event filter"),
                        ],
                    ),
                    build_request(
                        "Export Event Registrations",
                        "POST",
                        "/admin/events/{{organizerEventId}}/export",
                        description="Export registration rows for any event as CSV content wrapped in JSON.",
                    ),
                ],
            },
            {
                "name": "Settings",
                "item": [
                    build_request(
                        "Get Settings",
                        "GET",
                        "/admin/settings",
                        description="Fetch all system settings.",
                    ),
                    build_request(
                        "Update Settings",
                        "PUT",
                        "/admin/settings",
                        description="Upsert batch system settings.",
                        body=raw_json_body(
                            {
                                "items": [
                                    {
                                        "key": "registration",
                                        "value": {
                                            "waitlistOfferHours": 24,
                                            "supportEmail": "ops@example.com"
                                        },
                                        "description": "Registration workflow configuration"
                                    }
                                ]
                            }
                        ),
                    ),
                ],
            },
            {
                "name": "Categories",
                "item": [
                    build_request(
                        "Create Category",
                        "POST",
                        "/categories",
                        description="Create a new category node.",
                        body=raw_json_body({"name": "Hackathons"}),
                    ),
                    build_request(
                        "Update Category",
                        "PATCH",
                        "/categories/{{categoryId}}",
                        description="Rename or re-parent an existing category.",
                        body=raw_json_body({"name": "Community Hackathons"}),
                    ),
                    build_request(
                        "Delete Category",
                        "DELETE",
                        "/categories/{{categoryId}}",
                        description="Delete a category node.",
                    ),
                ],
            },
            {
                "name": "Notification Templates",
                "item": [
                    build_request(
                        "List Notification Templates",
                        "GET",
                        "/admin/notification-templates",
                        description="Fetch all notification templates.",
                    ),
                    build_request(
                        "Update Notification Template",
                        "PATCH",
                        "/admin/notification-templates/{{notificationType}}",
                        description="Update a notification template for one notification type.",
                        body=raw_json_body(
                            {
                                "subjectTemplate": "Registration update for {{eventName}}",
                                "textTemplate": "Hello {{name}}, your registration status changed.",
                                "enabled": True,
                            }
                        ),
                    ),
                ],
            },
        ],
    }

    return {
        "info": {
            "name": "Competition and Event Registration API",
            "description": "Role-based collection for the NestJS competition and event registration backend.",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
        },
        "auth": no_auth(),
        "event": [
            script_event("prerequest", COLLECTION_LEVEL_PREREQUEST),
            script_event("test", COLLECTION_LEVEL_TESTS),
        ],
        "variable": [
            {"key": "baseUrl", "value": "http://localhost:3000/api", "type": "string"},
            {"key": "participantEmail", "value": "participant@example.com", "type": "string"},
            {"key": "participantPassword", "value": "Participant123!", "type": "string"},
            {"key": "participantNextPassword", "value": "Participant456!", "type": "string"},
            {"key": "participantFullName", "value": "Sample Participant", "type": "string"},
            {"key": "participantAccessToken", "value": "", "type": "string"},
            {"key": "participantRefreshToken", "value": "", "type": "string"},
            {"key": "participantUserId", "value": "", "type": "string"},
            {"key": "participantRegistrationId", "value": "", "type": "string"},
            {"key": "participantRegistrationNumber", "value": "", "type": "string"},
            {"key": "organizerEmail", "value": "organizer@example.com", "type": "string"},
            {"key": "organizerPassword", "value": "Organizer123!", "type": "string"},
            {"key": "organizerAccessToken", "value": "", "type": "string"},
            {"key": "organizerRefreshToken", "value": "", "type": "string"},
            {"key": "organizerUserId", "value": "", "type": "string"},
            {"key": "organizerEventId", "value": "", "type": "string"},
            {"key": "organizerRegistrationId", "value": "", "type": "string"},
            {"key": "adminEmail", "value": "admin@example.com", "type": "string"},
            {"key": "adminPassword", "value": "Admin123!", "type": "string"},
            {"key": "adminAccessToken", "value": "", "type": "string"},
            {"key": "adminRefreshToken", "value": "", "type": "string"},
            {"key": "adminUserId", "value": "", "type": "string"},
            {"key": "adminManagedUserId", "value": "", "type": "string"},
            {"key": "publicEventId", "value": "", "type": "string"},
            {"key": "publicEventSlug", "value": "sample-event-slug", "type": "string"},
            {"key": "verificationToken", "value": "", "type": "string"},
            {"key": "categoryId", "value": "", "type": "string"},
            {"key": "notificationType", "value": "registration_confirmation", "type": "string"},
            {"key": "idempotencyKey", "value": "", "type": "string"},
            {"key": "requestId", "value": "", "type": "string"},
            {"key": "lastStatusCode", "value": "", "type": "string"},
            {"key": "lastEntityId", "value": "", "type": "string"},
        ],
        "item": [public_folder, participant_folder, organizer_folder, admin_folder],
    }


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    font_candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
    ]
    for candidate in font_candidates:
        path = Path(candidate)
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def draw_wrapped_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    position: tuple[int, int],
    font: object,
    fill: str,
    width: int,
    line_spacing: int = 4,
) -> int:
    x, y = position
    lines = wrap(text, width=width)
    for line in lines:
        draw.text((x, y), line, font=font, fill=fill)
        bbox = draw.textbbox((x, y), line, font=font)
        y = bbox[3] + line_spacing
    return y


def render_erd_image(output_path: Path) -> None:
    width, height = 2400, 1600
    image = Image.new("RGB", (width, height))
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, width, height), fill="#f4f7fb")

    title_font = load_font(34, bold=True)
    heading_font = load_font(22, bold=True)
    body_font = load_font(16)
    relation_font = load_font(15, bold=True)

    draw.rounded_rectangle((40, 40, width - 40, height - 40), radius=32, outline="#d5deea", width=3, fill="#fbfdff")
    draw.text((70, 70), "Competition and Event Registration ERD", font=title_font, fill="#16324f")
    draw.text((70, 116), "Core domain entities plus operational support tables", font=body_font, fill="#4c6278")

    boxes = {
        "users": {
            "xy": (80, 190, 500, 520),
            "color": "#d8ebff",
            "border": "#5b8bd9",
            "title": "users",
            "lines": [
                "id (PK)",
                "email",
                "password",
                "role",
                "status",
                "emailVerified",
                "emailVerificationToken",
                "emailVerifiedAt",
                "createdAt / updatedAt",
            ],
        },
        "profiles": {
            "xy": (80, 590, 500, 870),
            "color": "#d6f5ef",
            "border": "#2e8c7d",
            "title": "profiles",
            "lines": [
                "id (PK)",
                "userId (FK, unique)",
                "fullName",
                "phone",
                "city",
                "organization",
                "bio",
                "avatarUrl",
            ],
        },
        "refresh_tokens": {
            "xy": (80, 940, 500, 1220),
            "color": "#efe0ff",
            "border": "#7f56b3",
            "title": "refresh_tokens",
            "lines": [
                "id (PK)",
                "userId (FK)",
                "tokenId",
                "hashedToken",
                "revoked",
                "expiresAt",
                "createdAt / updatedAt",
            ],
        },
        "categories": {
            "xy": (620, 190, 1040, 430),
            "color": "#dff4dc",
            "border": "#4d9b4b",
            "title": "categories",
            "lines": [
                "id (PK)",
                "parentId (FK, nullable)",
                "name",
                "slug",
                "createdAt / updatedAt",
            ],
        },
        "events": {
            "xy": (620, 480, 1040, 940),
            "color": "#ffe7d7",
            "border": "#d9822b",
            "title": "events",
            "lines": [
                "id (PK)",
                "organizerId (FK)",
                "title / description / slug",
                "startDate / endDate",
                "registrationDeadline",
                "location",
                "maxAttendees / currentRegistrations",
                "status / price / version",
                "priceOptions / imageUrl",
                "metadata / cancellationPolicy",
                "createdAt / updatedAt",
            ],
        },
        "event_categories": {
            "xy": (620, 1000, 1040, 1190),
            "color": "#e6f6e3",
            "border": "#6da969",
            "title": "event_categories",
            "lines": [
                "eventId (PK, FK)",
                "categoryId (PK, FK)",
            ],
        },
        "registrations": {
            "xy": (1140, 420, 1590, 980),
            "color": "#ffe0e4",
            "border": "#c65a67",
            "title": "registrations",
            "lines": [
                "id (PK)",
                "eventId (FK)",
                "userId (FK)",
                "registrationNumber",
                "status / cancellationDate",
                "paymentStatus / paymentAmount",
                "paymentMethod / selectedPriceOption",
                "checkInTime",
                "metadata / qrCodeDataUrl",
                "waitlistPromotedAt",
                "waitlistOfferExpiresAt",
                "createdAt / updatedAt",
            ],
        },
        "notification_templates": {
            "xy": (1710, 190, 2260, 430),
            "color": "#fff4bf",
            "border": "#b38b00",
            "title": "notification_templates",
            "lines": [
                "id (PK)",
                "type",
                "subjectTemplate",
                "htmlTemplate",
                "textTemplate",
                "enabled",
                "createdAt / updatedAt",
            ],
        },
        "notification_deliveries": {
            "xy": (1710, 470, 2260, 790),
            "color": "#fff7d9",
            "border": "#c69a1f",
            "title": "notification_deliveries",
            "lines": [
                "id (PK)",
                "type / recipientEmail",
                "subject",
                "htmlBody / textBody",
                "status",
                "sentAt / failedAt",
                "failureReason / payload",
                "createdAt / updatedAt",
            ],
        },
        "system_settings": {
            "xy": (1710, 840, 2260, 1035),
            "color": "#ebeff5",
            "border": "#78889b",
            "title": "system_settings",
            "lines": [
                "id (PK)",
                "key",
                "value",
                "description",
                "createdAt / updatedAt",
            ],
        },
        "idempotency_keys": {
            "xy": (1710, 1085, 2260, 1315),
            "color": "#e6ebf2",
            "border": "#637488",
            "title": "idempotency_keys",
            "lines": [
                "id (PK)",
                "key / scope",
                "userId",
                "requestHash",
                "responseBody / statusCode",
                "completed / expiresAt",
                "createdAt / updatedAt",
            ],
        },
        "audit_logs": {
            "xy": (1710, 1360, 2260, 1520),
            "color": "#edf1f5",
            "border": "#6f7e8d",
            "title": "audit_logs",
            "lines": [
                "id (PK)",
                "action / entity",
                "actorUserId",
                "metadata",
                "createdAt / updatedAt",
            ],
        },
    }

    for box in boxes.values():
        x1, y1, x2, y2 = box["xy"]
        draw.rounded_rectangle((x1, y1, x2, y2), radius=20, fill=box["color"], outline=box["border"], width=3)
        draw.rectangle((x1, y1, x2, y1 + 46), fill=box["border"])
        draw.text((x1 + 18, y1 + 10), box["title"], font=heading_font, fill="#ffffff")
        current_y = y1 + 64
        for line in box["lines"]:
            current_y = draw_wrapped_text(draw, f"- {line}", (x1 + 18, current_y), body_font, "#23384d", 34)

    def center_right(name: str) -> tuple[int, int]:
        x1, y1, x2, y2 = boxes[name]["xy"]
        return x2, (y1 + y2) // 2

    def center_left(name: str) -> tuple[int, int]:
        x1, y1, x2, y2 = boxes[name]["xy"]
        return x1, (y1 + y2) // 2

    def center_bottom(name: str) -> tuple[int, int]:
        x1, y1, x2, y2 = boxes[name]["xy"]
        return (x1 + x2) // 2, y2

    def center_top(name: str) -> tuple[int, int]:
        x1, y1, x2, y2 = boxes[name]["xy"]
        return (x1 + x2) // 2, y1

    def draw_arrow(start: tuple[int, int], end: tuple[int, int], label: str, color: str) -> None:
        draw.line((start, end), fill=color, width=4)
        ex, ey = end
        sx, sy = start
        if abs(ex - sx) >= abs(ey - sy):
            direction = 1 if ex > sx else -1
            points = [(ex, ey), (ex - 14 * direction, ey - 8), (ex - 14 * direction, ey + 8)]
            label_pos = ((sx + ex) // 2 - 18, (sy + ey) // 2 - 24)
        else:
            direction = 1 if ey > sy else -1
            points = [(ex, ey), (ex - 8, ey - 14 * direction), (ex + 8, ey - 14 * direction)]
            label_pos = ((sx + ex) // 2 + 10, (sy + ey) // 2 - 10)
        draw.polygon(points, fill=color)
        draw.rounded_rectangle((label_pos[0] - 8, label_pos[1] - 6, label_pos[0] + 38, label_pos[1] + 18), radius=8, fill="#ffffff", outline=color, width=2)
        draw.text(label_pos, label, font=relation_font, fill=color)

    draw_arrow(center_bottom("users"), center_top("profiles"), "1:1", "#2e8c7d")
    draw_arrow(center_right("users"), center_left("events"), "1:N", "#d9822b")
    draw_arrow(center_right("users"), center_left("registrations"), "1:N", "#c65a67")
    draw_arrow(center_right("users"), center_left("refresh_tokens"), "1:N", "#7f56b3")
    draw_arrow(center_bottom("categories"), center_top("events"), "N:M", "#4d9b4b")
    draw_arrow(center_bottom("events"), center_top("event_categories"), "1:N", "#6da969")
    draw_arrow(center_right("event_categories"), center_left("registrations"), "map", "#6da969")
    draw_arrow(center_right("events"), center_left("registrations"), "1:N", "#c65a67")
    draw_arrow(center_right("users"), center_left("idempotency_keys"), "0:N", "#637488")
    draw_arrow(center_right("users"), center_left("audit_logs"), "0:N", "#6f7e8d")

    legend_x, legend_y = 1120, 1100
    draw.rounded_rectangle((legend_x, legend_y, 1600, 1490), radius=22, fill="#ffffff", outline="#ccd6e2", width=2)
    draw.text((legend_x + 24, legend_y + 20), "Legend and modeling notes", font=heading_font, fill="#16324f")
    legend_lines = [
        "- All concrete tables inherit uuid id plus createdAt/updatedAt from BaseEntity.",
        "- profiles owns the one-to-one join column back to users.",
        "- event_categories is the join table for the Event <-> Category many-to-many relation.",
        "- registrations enforces one row per (event, user) pair in the real database schema.",
        "- notification, settings, idempotency, and audit tables are operational support tables.",
    ]
    text_y = legend_y + 66
    for line in legend_lines:
        text_y = draw_wrapped_text(draw, line, (legend_x + 24, text_y), body_font, "#30485f", 50, line_spacing=8)

    image.save(output_path)


def main() -> None:
    POSTMAN_DIR.mkdir(parents=True, exist_ok=True)
    ERD_DIR.mkdir(parents=True, exist_ok=True)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    (DOCS_DIR / "api_summary.md").write_text(build_api_summary(), encoding="utf-8")
    (POSTMAN_DIR / "event-registration-api.postman_collection.json").write_text(
        json.dumps(build_postman_collection(), indent=2) + "\n",
        encoding="utf-8",
    )
    (ERD_DIR / "event-registration.eraser").write_text(ERD_CODE, encoding="utf-8")
    render_erd_image(IMAGES_DIR / "event-registration-erd.png")


if __name__ == "__main__":
    main()
