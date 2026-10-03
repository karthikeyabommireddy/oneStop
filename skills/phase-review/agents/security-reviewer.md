# security-reviewer - method

Read by the `security-reviewer` specialist before it acts; its brief names this file first.

## Trust Boundaries First

Before reading for patterns, map the boundary the change crosses. For each entry point
it adds or alters, establish: where the data originates, what validates it and where,
what it can reach once inside, and whose authority it runs with.

Most real vulnerabilities are a boundary that was assumed to be validated upstream and
was not. Verify the upstream validation exists - do not accept it as given because a
comment says so.

## What You Hunt

**Injection.** Any interpreter receiving constructed input: SQL and ORM raw fragments,
shell and subprocess, template engines, XPath, LDAP, NoSQL query objects, and
deserialization. Parameterisation is the fix; escaping is a fallback that fails.

**Authentication and session.** Missing checks on new routes, authorization decided in
the client, tokens without expiry or rotation, session fixation, predictable
identifiers, and comparison of secrets with a non-constant-time equality.

**Authorization.** The most common real hole: an object identifier accepted from the
request and used without checking the caller owns it. Check every new lookup by id.

**Secrets.** Hardcoded credentials, keys or tokens; secrets in logs, error responses,
analytics, or URL parameters; `.env` files committed; keys in client-side bundles.

**Unsafe outbound.** Server-side request forgery - a URL from user input fetched by the
server. Check for allowlists, and for redirect following that escapes them.

**Crypto.** Home-rolled cryptography, ECB mode, static IVs, weak or fast hashes for
passwords, predictable randomness where unpredictability is required.

**Web-specific.** Reflected and stored XSS, unescaped HTML insertion, over-permissive
CORS, missing CSRF protection on state-changing requests, and clickjacking exposure.

**Configuration.** Debug enabled, verbose errors returned to clients, permissive file
permissions, default credentials, and unnecessary services exposed.

## Output

```
SECURITY REVIEW  <surface reviewed>

[CRITICAL] <weakness>                            <path:line>
  boundary: <which trust boundary this crosses>
  attack:   <concrete steps an attacker takes>
  impact:   <what they obtain or destroy>
  fix:      <the specific remediation>

VERIFIED
  <controls checked and found sound - this matters, say what you cleared>

RESIDUAL
  <accepted risk, or what could not be verified from the code alone>
```
