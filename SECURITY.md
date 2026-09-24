# Security Policy

## Reporting a vulnerability

Please do not report security vulnerabilities in public issues or discussions. Use GitHub's private vulnerability reporting for this repository when available. If private reporting is unavailable, contact the repository owner privately before sharing technical details.

Do not include live API keys, OAuth secrets, session cookies, or personal conversation data in a report.

## Automated checks

GitHub Actions runs the test/build checks, CodeQL, and a full-history Gitleaks scan. `.gitleaksignore` contains one exact fingerprint for a synthetic API-key-shaped test value in an older commit; the current test uses a non-secret placeholder. It is not a live credential.
