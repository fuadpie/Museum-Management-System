# Implementation Audit

Date: 2026-10-01

## Scope

This audit compares the current Museum & Art Gallery Visitor Portal with the supplied project instructions. The repository does not currently contain `PROJECT_SPEC.md`, so error codes and any requirements not present in the supplied instructions remain assumptions until that file is added.

## Existing foundation

- React 19 and Vite frontend.
- Express 5 backend with Oracle `oracledb`.
- JWT authentication and bcrypt password hashing.
- Oracle object output format is already enabled.
- Connections are generally released in `finally` blocks.
- Existing routes are preserved.
- Museum ownership is currently represented by `MUSEUMS.OWNER_USER_ID`.

## Compatibility decisions

- Existing `MUSEUM_MANAGER` remains supported as the backward-compatible equivalent of the requested `MUSEUM` role.
- Existing route paths remain unchanged.
- The current schema remains the source of truth until `PROJECT_SPEC.md` is available.

## Foundation fixes

- Moved the artwork image-column change out of server startup code into an idempotent migration under `backend/sql/migrations/`.
- Added a migration runner invoked during backend startup.
- Added Zod to the backend dependency manifest for incremental endpoint validation.

## Known gaps for the next phases

- `PROJECT_SPEC.md` is missing.
- A central error handler and standard response envelope are not yet wired.
- Role-derived `req.museumId` is not yet available on the authentication request.
- Booking/payment/cancellation/check-in logic is not yet implemented in an Oracle `PKG_BOOKING` package.
- Existing booking routes still contain business logic in JavaScript.
- Automated backend tests are not present.
- Password reset tokens are currently in memory and are not delivered by email.
- Museum manager profile now persists phone, email, and website fields and supports safe ACTIVE/INACTIVE status changes through migration `002_add_museum_contact_fields.sql`.
- Added museum-scoped ticket management with server-side filtering, pagination, KPIs, CSV export, and ticket detail view. Check-in/USED is not exposed because the current Oracle schema has no check-in field or workflow.

## Validation

The foundation changes must be validated with backend syntax checks, frontend lint/build, and an Oracle-backed startup check before the next phase is merged.
