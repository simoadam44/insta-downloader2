# Security Hardening & Production Readiness Implementation Plan

## Security Threat Model

### Component Overview
SSSInstagram is a full-stack media extraction utility running on Node.js/Express with a React Vite frontend. It allows users to enter public Instagram URLs (posts, reels, carousels, videos), extracts direct media streams via Instagram SSR JSON/embed endpoints, and serves them to users via a streaming proxy (`/api/proxy-media`) to bypass client-side CORS and referrer restrictions.

### Entry Points and Untrusted Inputs
| Entry Point | Type | Trusted? | Validation |
|---|---|---|---|
| `/api/extract?url=...` | GET/POST Query & Body | No | Validated via `extractShortcode` regex. Requires Instagram domain or shortcode. |
| `/api/proxy-media?url=...&filename=...` | GET Query Params | No | Previously used flawed suffix match `endsWith()`. Now strictly validated against an approved hostname whitelist and safe URL protocols. `filename` strictly sanitized against CRLF header injection. |
| `/api/admin/login` | POST Body | No | Validates admin email & hashed password with IP rate-limiting to prevent brute force. |
| User URL Input in UI | Text input form | No | Client-side format detection with server-side validation. |
| Ad Custom HTML | Admin settings / localStorage | No | Sanitized to prevent stored DOM XSS. |

### Trust Boundaries and Auth Assumptions
- **Authentication**: Admin dashboard now authenticated via secure server-side endpoint (`/api/admin/login`) with cryptographic token session verification instead of hardcoded client-side credentials.
- **Proxy Boundary**: Server makes outbound HTTP requests to fetch media. Must strictly verify destination hosts and protocols to prevent SSRF against internal services (127.0.0.1, 169.254.169.254, RFC1918 private subnets).

### Sensitive Data Paths
| Data Type | Source | Destination | Protection |
|---|---|---|---|
| Admin Password / Secrets | Server Environment (`ADMIN_PASSWORD`) | Server Memory | Never exposed in client bundle; constant-time comparison / bcrypt. |
| Outbound Fetch URLs | User Input | Instagram CDN | Strict allowlist regex, disallow internal IP addresses. |
| Filename in Headers | Query parameter | HTTP Response Header | Strict regex whitelist `[a-zA-Z0-9._-]` max 80 chars. |

### Priority Review Areas
1. **SSRF Prevention**: Strict domain whitelist verification on `/api/proxy-media`.
2. **HTTP Header Injection**: Strict sanitization of `Content-Disposition` filename.
3. **Rate Limiting / DoS Defense**: In-memory rate limiting for API endpoints.
4. **Credential Security**: Elimination of hardcoded admin credentials and public leak in UI.
5. **No Fake / Mock Data**: Real-world extraction only, with transparent error feedback.
6. **XSS Prevention**: Safe rendering of custom ad HTML.

---

## Proposed Changes

### 1. Hardening Server (`server.ts`)
- **Strict SSRF Defense**: Replace flawed `endsWith(host)` with strict domain matching:
  - Allowed roots: `cdninstagram.com`, `fbcdn.net`, `instagram.com`.
  - Check: `hostname === host || hostname.endsWith('.' + host)`.
  - Block loopback, private ranges (`10.`, `172.16-31.`, `192.168.`, `127.`, `169.254.169.254`, `localhost`).
  - Block non-http/https protocols.
- **CRLF & Header Injection Fix**: Sanitize `filename` parameter strictly.
- **In-Memory Rate Limiting**:
  - `/api/extract`: Max 40 requests/min per IP.
  - `/api/proxy-media`: Max 120 requests/min per IP.
  - `/api/admin/login`: Max 5 attempts per 15 minutes per IP.
- **Security Headers Middleware**:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `X-XSS-Protection: 0`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- **Secure Server-Side Admin Authentication**:
  - Add `/api/admin/login` (checks password from `process.env.ADMIN_PASSWORD` or secure default, sets auth token).
  - Add `/api/admin/verify` (verifies session token).

### 2. Frontend Real-Data & Security Polish
- **`extractorService.ts`**:
  - Remove fake mock data fallbacks (`wanderlust.cinematics` / Alex Vance).
  - Return clear, real error descriptions when an Instagram post is private, deleted, or inaccessible.
  - Update `DEMO_URLS` with real verified public Instagram posts.
- **`HeroSection.tsx`**:
  - Fix paste handler: if clipboard permission is denied, prompt user cleanly rather than loading fake mock data.
- **`AdminDashboard.tsx`**:
  - Remove public "Demo Credentials: admin123" banner.
  - Connect login to secure `/api/admin/login` and `/api/admin/verify` API endpoints.
- **`AdBanner.tsx`**:
  - Sanitize any custom HTML to prevent script execution (Stored XSS).
- **Broken / Invalid Links**:
  - Inspect and fix all links in `Footer.tsx`, `Navbar.tsx`, `WhyChooseUs.tsx`, and modals.

---

## Verification Plan

### Security Verification
- **Security Scan**: Inspect all modified files for common CWE vulnerabilities (CWE-918 SSRF, CWE-113 Header Injection, CWE-79 XSS, CWE-798 Hardcoded Secrets, CWE-307 Brute Force).
- **Security Audit**: Audit the implementation against the threat model. Document all findings, dispositions, and remediations in `walkthrough.md` using the `generate-security-audit-report` skill.
- **Functional Testing**: Test real extraction with verified URLs, test SSRF payload rejection, test rate limiting, and verify build with `lint_applet` and `compile_applet`.
