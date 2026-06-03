---
trigger: always_on
---

# OWASP Security Baseline (2025/2023)

> **Important**: This repository uses the official **OWASP Top 10:2025** for web applications and **OWASP API Security Top 10:2023** for APIs as the security baseline. There is no official OWASP "Top 15" release; this document turns those official sources into a practical 15-point backend checklist.

## Mandatory security baseline

1. **Broken Access Control**
   - Deny by default.
   - Protect ownership checks and object access.
   - Never trust `id` values from the client without authorization.

2. **Broken Authentication / Authentication Failures**
   - Use strong authentication flows.
   - Support MFA where required.
   - Rotate refresh tokens and invalidate compromised sessions.

3. **Injection**
   - Validate every input with Zod.
   - Use parameterized queries only.
   - Never concatenate raw user input into SQL, shell commands, or templates.

4. **Cryptographic Failures**
   - Hash passwords with modern password hashing.
   - Use TLS everywhere.
   - Never store or log secrets in plaintext.

5. **Security Misconfiguration**
   - Set secure defaults.
   - Apply `helmet()` and sane CORS settings.
   - Validate environment variables at bootstrap.

6. **Software Supply Chain Failures**
   - Pin dependencies.
   - Review upgrades before merging.
   - Do not introduce untrusted packages or unchecked build tooling.

7. **Insecure Design**
   - Design for deny-by-default.
   - Threat model auth, file upload, external calls, and privileged flows.
   - Prefer simple flows over clever flows.

8. **Software or Data Integrity Failures**
   - Verify uploads, callbacks, and external payloads.
   - Sign or checksum critical artifacts when needed.
   - Do not trust data just because it arrived from an internal service.

9. **Logging & Alerting Failures**
   - Use structured logs.
   - Include trace context.
   - Alert on repeated failures, auth abuse, and suspicious access.

10. **Mishandling of Exceptional Conditions**
    - Return safe errors.
    - Never expose stack traces or secrets in production responses.
    - Handle retries, timeouts, and partial failures deliberately.

11. **Broken Object Level Authorization**
    - Enforce per-object ownership checks.
    - Validate access at the route or policy layer.
    - Never rely on client-side filtering.

12. **Broken Object Property Level Authorization**
    - Filter fields before returning data.
    - Prevent users from reading or writing forbidden attributes.
    - Use explicit allowlists for response shapes.

13. **Broken Function Level Authorization**
    - Restrict privileged actions explicitly.
    - Protect admin-only and sensitive operations with proper authorization.
    - Never hide authorization in controllers by accident.

14. **Unrestricted Resource Consumption**
    - Rate limit login and public endpoints.
    - Enforce pagination and size limits.
    - Add timeouts to expensive operations and external calls.

15. **Unsafe Consumption of APIs**
    - Use allowlists for outbound URLs.
    - Block SSRF patterns.
    - Validate all third-party responses before using them.

## Repository enforcement rules

- Always validate input with Zod v4.
- Always protect authenticated routes with the correct guards.
- Always log without secrets, tokens, or passwords.
- Always prefer secure defaults over convenience.
- Always treat external integrations as untrusted until validated.
- Always use safe error messages in production.
- Always review auth, upload, and external-call code with extra scrutiny.
