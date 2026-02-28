---
name: api-contract-from-ui
description: Drafts API contracts from UI requirements. Produces endpoint list, request/response JSON schemas, example payloads, error codes, and caching notes. Use when the user pastes a UI requirement and asks for an API contract, API design, or backend contract for a screen or flow.
---

# API Contract from UI Requirement

When the user provides a UI requirement (e.g. in `<<< ... >>>` or a pasted description), draft a complete API contract. Do not implement code; deliver a **contract document** the frontend and backend can implement against.

## Input

- Treat the content between `<<<` and `>>>` (or the user’s clear description) as the **UI requirement**.
- Infer **entities**, **actions**, **lists**, **filters**, and **user identity** from the UI (screens, buttons, tables, forms, error messages).

## Output Structure

Return exactly these five sections. Use the templates below; fill and extend as needed for the requirement.

### 1. Endpoint list

Table format:

| Method | Path | Purpose |
|--------|------|--------|
| GET | `/resource` | List/filter |
| GET | `/resource/:id` | Get one |
| POST | `/resource` | Create |
| PATCH | `/resource/:id` | Update |
| DELETE | `/resource/:id` | Delete |

- Use REST-style paths; avoid verbs in URLs.
- Include query params in **Purpose** (e.g. “List with ?status=active&page=1”).
- Add auth note if endpoints require auth (e.g. “Requires auth”).

### 2. Request / Response JSON schema

For each endpoint that has a body or meaningful response, define:

- **Request**: Content-Type `application/json`; list required and optional fields, types, and constraints.
- **Response**: Same; include envelope if you use one (e.g. `{ "data": ..., "meta": { "total": number } }`).

Use concise JSON Schema–style notation:

```json
// POST /resource — Request
{
  "fieldName": "string (required, max 255)",
  "count": "number (optional, integer, >= 0)",
  "tags": "string[] (optional)"
}

// GET /resource — Response
{
  "data": "Resource[]",
  "meta": { "total": "number", "page": "number", "pageSize": "number" }
}
```

Define shared types once and reference them (e.g. `Resource`, `ResourceSummary`).

### 3. Example payloads

One request and one response per endpoint that has a body or important response. Keep examples minimal but valid.

```json
// Example: POST /resource
Request:
{ "fieldName": "Example", "count": 10 }

Response (201):
{ "data": { "id": "uuid", "fieldName": "Example", "count": 10, "createdAt": "ISO8601" } }
```

### 4. Error codes

Table of HTTP status and application-level codes:

| HTTP | Code | When |
|------|------|------|
| 400 | `VALIDATION_ERROR` | Invalid body or query params |
| 401 | `UNAUTHORIZED` | Missing or invalid auth |
| 403 | `FORBIDDEN` | No permission for resource |
| 404 | `NOT_FOUND` | Resource or ID missing |
| 409 | `CONFLICT` | Duplicate or business rule violation |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |

Response shape for errors:

```json
{
  "error": { "code": "CODE", "message": "Human-readable message", "details": {} }
}
```

Add any domain-specific codes (e.g. `SCENARIO_ALREADY_COMPLETED`) under the same table.

### 5. Caching notes

- **Cacheable GETs**: Which GET endpoints can be cached (e.g. public list, static config); suggest `Cache-Control` (e.g. `max-age=60`, `private`).
- **Invalidation**: Which mutations (POST/PATCH/DELETE) must invalidate which caches or keys.
- **Auth**: Note if responses are user-specific (`private`) or public (`public`).
- **Optional**: ETag/If-None-Match for large or rarely changing resources.

## Workflow

1. **Parse** the UI requirement: screens, actions, data shown, filters, errors.
2. **Map** to resources and operations (CRUD, custom actions).
3. **Draft** endpoints, then schemas, then examples, then errors, then caching.
4. **Return** the five sections in order; use clear headings so the document is easy to cut into tickets or specs.

## Optional Conventions

- Prefer **plural** resource names in paths: `/users`, `/orders`.
- Use **UUID** or **ulid** for `id` in responses.
- Use **ISO 8601** for dates/times.
- Paginate list endpoints with `page` and `pageSize` (or `limit`/`offset`); return `total` in `meta` when possible.

## Summary checklist

Before returning the contract, ensure:

- [ ] Every UI action has a matching endpoint or is covered by an existing one.
- [ ] Request/response schemas match the examples.
- [ ] Error codes cover validation, auth, not-found, and conflict cases.
- [ ] Caching notes specify what can be cached and what invalidates it.
