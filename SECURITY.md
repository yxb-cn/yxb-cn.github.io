# Security Policy

## Supported version

Security fixes are made on the latest version of the `main` branch. Older
copies and customized forks should update or apply the relevant fix locally.

## Reporting a vulnerability

Please do not publish vulnerability details in a public issue.

Use GitHub's **Security → Report a vulnerability** option when private
vulnerability reporting is enabled. If that option is unavailable, open a
minimal issue asking the maintainer for a private reporting channel without
including exploit details or sensitive data.

Include:

- the affected route or feature;
- the conditions required to reproduce the problem;
- the expected security impact;
- a minimal reproduction, if it can be shared safely.

## Security model

The deployed homepage is a static site. Its content JSON, photos, documents,
analytics configuration, and hidden items are public by design.

The editor's write and upload endpoints exist only in the local development
server and reject non-local requests. Never add passwords, API keys, access
tokens, unpublished documents, or confidential information to the content file
or `public/` folders.
