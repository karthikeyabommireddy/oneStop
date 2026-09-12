# Concern: Security

Loaded when a stack is security-sensitive by default. The `security-reviewer` owns the
full review; this pack is what every agent applies while writing code.

- Validate external input at the boundary, with a schema. Type annotations prove nothing
  at runtime.
- Parameterise every query. String interpolation into any interpreter is injection.
- Check ownership on every lookup by id. Authentication is not authorization, and this
  is the most common real hole.
- Secrets come from the environment. Never hardcoded, never logged, never in a URL, never
  in a client bundle. A committed secret must be rotated, not just deleted.
- Compare secrets in constant time.
- Escape on output. Never insert user content as raw HTML.
- State-changing requests need CSRF protection; CORS is an allowlist, never a wildcard
  with credentials.
- Use the platform crypto. Never invent a scheme, never a fast hash for passwords.
- Fail closed. An error in an authorisation check denies access.
- Do not return internal errors or stack traces to clients.
