# Security Policy

## Architecture Overview

TelosTax is a browser-first tax preparation application. The core tax engine (`@telostax/engine`) is a pure computation library with no I/O, no network calls, and no filesystem access. The client stores all tax data locally in the browser. An optional Express server provides AI features (chat, document extraction, expense scanning) but stores no user data.

## Data Storage

### Client-Side (Browser Only)

All tax return data lives in the browser and never reaches a server:

- **localStorage** — encrypted tax returns, encrypted chat history, AI settings
- **IndexedDB** — encrypted privacy audit log entries
- **Encryption** — AES-256-GCM via the Web Crypto API
- **Key derivation** — PBKDF2 with 600,000 iterations + SHA-256 from user passphrase
- **Salt** — 16 random bytes, generated once on first setup
- **IV** — random 12-byte IV per encryption operation
- **Passphrase** — never stored; derived key held in memory only while vault is unlocked, cleared on lock/timeout
- **AAD** — AES-GCM additional authenticated data (`telostax-v1`) binds ciphertext to the app context
- **Versioned payloads** — encrypted blobs include a version field for forward compatibility
- **Unlock throttling** — 30-second lockout after 5 failed passphrase attempts (UX guard; PBKDF2 iteration count is the primary brute-force defense)

### Server-Side

The server stores **no user data**. The only server-side persistence is a SQLite `rate_limits` table tracking IP + endpoint + timestamp for rate limiting. Tax returns, chat history, and API keys are never stored or logged on the server.

## PII Handling

### SSN and Sensitive Data

Social Security Numbers are collected only at the review step, encrypted with AES-256-GCM at rest in the browser, and never transmitted to any server. The calculation engine does not process or require SSNs.

### Outbound PII Scanning (Two-Layer Defense)

When AI features are used in BYOK mode, outbound messages pass through two independent PII scanners:

**Layer 1 — Client-side (`scanForPII`):**
The primary gate. Detects 14 PII categories before any data leaves the browser:
- SSN, EIN, email, phone, street address, ZIP code
- Date of birth, bank account/routing numbers, credit card (Luhn-validated)
- IRS Identity Protection PIN, driver's license
- Input is Unicode-normalized (NFKC) and zero-width characters are stripped before scanning to prevent bypass via fullwidth digits or invisible characters

If PII is detected, the message is blocked and the user is shown what was found.

**Layer 2 — Server-side (`stripPII` + `stripContext`):**
Defense-in-depth. The server re-scans all incoming messages and applies allowlist-based context filtering. Only aggregate, non-identifying context fields (filing status, step name, income type counts, etc.) are forwarded to the LLM. All other fields are silently dropped.

### Privacy Audit Log

Every outbound AI request is logged to an encrypted IndexedDB store showing:
- Which feature made the request (chat, expense scanner, document extraction)
- The redacted message (post-PII-stripping, max 2,000 chars)
- Which PII types were blocked (counts only — never actual values)
- Which context fields were sent
- A truncated AI response (first 200 chars)

Users can review the audit log at any time to verify exactly what left their device.

## AI Modes

### Private Mode (Default)

No data leaves the device. All features that require AI are disabled. The tax engine, wizard, form filling, PDF export, and all deterministic tools work fully offline.

### BYOK Mode (Bring Your Own Key)

Users provide their own Anthropic API key to enable AI features (chat, document extraction, expense scanning, merchant classification).

**API key security:**
- Encrypted at rest with AES-256-GCM (same vault passphrase)
- Held in memory only while the vault is unlocked
- Transmitted in the request body (not headers) to avoid access logs
- Used once per request by the server, then immediately discarded
- Never stored, logged, or cached on the server
- Error messages are scrubbed of API keys before logging

## Server Security

### Rate Limiting

Per-IP, per-endpoint rate limiting with configurable windows. Uses SQLite transactions to prevent TOCTOU race conditions. Returns `429` with `Retry-After` header when exceeded.

### Error Sanitization

LLM errors are classified into 9 categories and mapped to safe, actionable messages. Raw error details, API keys, and bearer tokens are never returned to the client. Server-side logs redact all key material before writing.

### No Authentication

The server contains no authentication or authorization logic. It is a stateless proxy for BYOK API calls. Access control is the responsibility of the deployment environment.

## Test Data

All example data used in tests is entirely fictional. Any SSNs, names, or addresses appearing in test fixtures are fabricated and do not correspond to real individuals. No real taxpayer data is included in this repository.

## Dependency Supply Chain

The project uses `package-lock.json` for deterministic dependency resolution. The Syncfusion PDF Viewer (proprietary, Community License) is the only non-standard dependency; its WASM binary is vendored in `client/public/ej2-pdfviewer-lib/`.

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly:

- **Email:** security@telostax.dev
- **GitHub:** Use [GitHub Security Advisories](https://docs.github.com/en/code-security/security-advisories) to submit a private report on this repository

Please do **not** open a public GitHub issue for security vulnerabilities. We will acknowledge your report within 48 hours and aim to triage it within 7 days. Fix timelines depend on severity and complexity.

## Known Security Limitations

These are inherent limitations of the browser-based, local-first architecture. They are not bugs — they are documented trade-offs.

### Offline passphrase brute-force

If an attacker obtains your browser's localStorage data (via physical access, malware, browser profile theft, or XSS), they can attempt offline brute-force against your passphrase. The encryption uses PBKDF2 with 600,000 iterations, which slows each attempt to ~0.3 seconds on modern hardware. **Use a strong passphrase (16+ characters) to mitigate this risk.** If your device is compromised, encryption cannot fully protect against a determined attacker with unlimited offline time.

### XSS is the primary threat

Because all data lives in the browser, a cross-site scripting (XSS) vulnerability would allow an attacker to read decrypted data while the vault is unlocked. Mitigations include React's built-in output escaping, strict Content Security Policy headers on the server, and avoidance of `dangerouslySetInnerHTML`. If absolute privacy is your requirement and you don't trust the browser environment, use Private Mode on a device you control.

### PII scanner limitations

The outbound PII scanner uses regex pattern matching and cannot catch all forms of personally identifiable information. Specifically:

- **Names** are not reliably detected (too many false positives)
- **Addresses** without leading street numbers may pass through
- **Dates of birth** without context words ("born", "DOB") are not flagged
- **Bank/routing numbers** without banking keywords are not flagged

The server-side allowlist (`stripContext`) provides a second layer by only forwarding pre-approved metadata fields, but the raw chat message text relies on regex. Avoid typing names, full addresses, or other free-text identifiers directly into the AI chat — use the form fields instead.

## Scope

The primary security concerns for this project are:

- **Data confidentiality** — ensuring tax data stays encrypted in the browser and PII is never leaked to AI providers
- **Correctness** — incorrect calculations could cause financial harm (see [DISCLAIMER.md](DISCLAIMER.md))
- **Dependency supply chain** — malicious or compromised dependencies
- **API key handling** — ensuring BYOK keys are never persisted or logged server-side
- **Test data leakage** — ensuring no real PII enters the repository

If you identify an issue in any of these areas, please report it using the channels above.
