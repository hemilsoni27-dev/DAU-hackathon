# Security baseline

- Helmet security headers and explicit hardening headers are enabled.
- CORS is configured from `CORS_ORIGIN` and credentials are supported for the
  eventual Clerk session boundary.
- All request bodies and query parameters used by the API are parsed with
  generated Zod schemas.
- Request IDs are accepted from `x-request-id` or generated server-side and
  included in logs and errors.
- Write requests have a bounded in-process rate limiter; Redis is the intended
  shared limiter for multiple API instances.
- Errors use a stable `{ error: { code, message, details, requestId } }`
  envelope and do not expose stack traces.
- Passwords and local JWT authentication are not implemented. Production
  identity belongs to Clerk; the development-only demo session is explicit and
  should be removed when Clerk is enabled.
- Secrets belong in the environment or workspace secrets, never in source.