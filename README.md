# QuickNotes REST API Design

## 1. Purpose and conventions

This document describes the production QuickNotes API the backend team should build. It is separate from the browser demonstration, which uses JSONPlaceholder.

- Base URL: `https://api.quicknotes.example/v1`
- Format: JSON (`application/json`)
- Authentication: bearer access token in the `Authorization` header
- Resource names are plural nouns.
- IDs are opaque strings (UUIDs); clients must not assume they are sequential.
- Timestamps are UTC ISO 8601 strings.
- A user can access only their own notes and folders.

Example request headers:

```http
Authorization: Bearer <access-token>
Accept: application/json
Content-Type: application/json
```

## 2. Resource model

A note belongs to one user and may optionally belong to a folder. Notes have a title, body, timestamps and an archive state. The API returns the folder ID rather than embedding a full folder object in every response.

## 3. Endpoint summary

| Method | Endpoint | Purpose | Success |
|---|---|---|---|
| GET | `/notes` | List the authenticated user's notes | `200 OK` |
| POST | `/notes` | Create a note | `201 Created` |
| GET | `/notes/{noteId}` | Retrieve one note | `200 OK` |
| PATCH | `/notes/{noteId}` | Partially update a note | `200 OK` |
| DELETE | `/notes/{noteId}` | Delete a note | `204 No Content` |
| GET | `/folders` | List the user's folders | `200 OK` |
| POST | `/folders` | Create a folder | `201 Created` |

## 4. Request and response examples

### List notes

```http
GET /v1/notes?limit=20&cursor=eyJpZCI6...
Authorization: Bearer <access-token>
```

```json
{
  "data": [
    {
      "id": "note_8f31",
      "title": "Project ideas",
      "body": "Explore a campus study planner.",
      "folderId": "folder_12ab",
      "isArchived": false,
      "createdAt": "2026-10-30T08:30:00Z",
      "updatedAt": "2026-10-30T08:30:00Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "nextCursor": "eyJpZCI6..."
  }
}
```

`limit` defaults to 20 and has a maximum of 100. The cursor is omitted on the first request. The server returns only notes owned by the authenticated user.

### Create a note

```http
POST /v1/notes
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "title": "Meeting notes",
  "body": "Discuss the project timeline.",
  "folderId": "folder_12ab"
}
```

Response: `201 Created`

```http
Location: /v1/notes/note_91cd
```

```json
{
  "id": "note_91cd",
  "title": "Meeting notes",
  "body": "Discuss the project timeline.",
  "folderId": "folder_12ab",
  "isArchived": false,
  "createdAt": "2026-10-30T09:00:00Z",
  "updatedAt": "2026-10-30T09:00:00Z"
}
```

The server generates the ID and timestamps. The client must not supply them.

### Retrieve one note

```http
GET /v1/notes/note_91cd
Authorization: Bearer <access-token>
```

Response: `200 OK`, with the note representation shown above.

### Update a note

```http
PATCH /v1/notes/note_91cd
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "title": "Updated meeting notes",
  "isArchived": true
}
```

Response: `200 OK`, with the complete updated note. Only supplied, permitted fields are changed. An empty update body is rejected.

### Delete a note

```http
DELETE /v1/notes/note_91cd
Authorization: Bearer <access-token>
```

Response: `204 No Content` with an empty response body. Repeating a delete for a note that no longer exists returns `404 Not Found`.

### Create a folder

```http
POST /v1/folders
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "name": "University"
}
```

Response: `201 Created`

```json
{
  "id": "folder_12ab",
  "name": "University",
  "createdAt": "2026-10-30T09:15:00Z"
}
```

## 5. Error response format

All errors use a consistent JSON structure. Sensitive implementation details and stack traces are never returned to clients.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid fields.",
    "details": [
      {
        "field": "title",
        "issue": "Title is required and must be 1–100 characters."
      }
    ],
    "requestId": "req_7c91"
  }
}
```

## 6. HTTP status codes

| Status | Meaning | Example |
|---|---|---|
| `200 OK` | Request succeeded and returns data | List, retrieve or update notes |
| `201 Created` | Resource created | Note or folder created |
| `204 No Content` | Request succeeded with no response body | Note deleted |
| `400 Bad Request` | Malformed JSON or invalid query parameter | Invalid `limit` value |
| `401 Unauthorized` | Missing, invalid or expired token | No bearer token |
| `403 Forbidden` | Authenticated user lacks permission | Access to another user's resource |
| `404 Not Found` | Resource does not exist or is not visible to user | Unknown note ID |
| `409 Conflict` | Request conflicts with current resource state | Duplicate folder name |
| `413 Content Too Large` | Request exceeds configured body limit | Oversized note body |
| `415 Unsupported Media Type` | Unsupported content type | Sending XML instead of JSON |
| `422 Unprocessable Content` | Valid JSON but field validation fails | Blank or overlong title |
| `429 Too Many Requests` | Rate limit exceeded | Too many requests in a short period |
| `500 Internal Server Error` | Unexpected server error | Unhandled application failure |
| `503 Service Unavailable` | Service temporarily unavailable | Database maintenance |

## 7. Validation and operational rules

- `title` is required, trimmed, and 1–100 characters.
- `body` is optional, with a proposed maximum of 20,000 characters.
- A supplied `folderId` must identify a folder owned by the same user.
- Unknown fields are rejected rather than silently accepted.
- List endpoints use cursor pagination and enforce a maximum page size.
- Rate limits are applied per authenticated user and IP address.
- The API uses HTTPS only, validates tokens on every protected request, and checks resource ownership on every read, update and delete.
- The server logs request IDs and operational errors but does not log access tokens or full private note bodies.
