# API conventions

The REST API is versioned under `/api/v1`. Contracts are authored in
`lib/api-spec/openapi.yaml`, then generated into the typed React Query client
and server-side Zod schemas.

## Success responses

Success responses return the resource or array directly. Dates are ISO 8601
date-time values over HTTP.

## Error responses

```json
{
  "error": {
    "code": "INVALID_LISTING",
    "message": "availableUntil must be after availableFrom",
    "details": {},
    "requestId": "..."
  }
}
```

## Ownership

The server derives identity from the auth context. Clients never choose the
seller or owner. Listing creation verifies that the solar system belongs to
the current user before publishing energy.