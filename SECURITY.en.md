# Security

[Français](SECURITY.md) | **English**

MyTeam runs exclusively locally (`127.0.0.1`), enforcing exact origin verification and session token authentication for all file reads and writes.

## Trust model

The token defends against **cross-site web** attacks (cross-site request forgery, DNS rebinding): a third-party site can neither read nor write. It does not defend against a **local process** on the same machine, which already has access to the project files anyway. The `GET /api/state` endpoint hands the token to the browser at startup (bootstrap); this is an assumed trust boundary, not a vulnerability.

## Updates

The update package is verified by a SHA-256 checksum published on the same channel. This checksum guarantees **integrity** (the file was not altered in transit), not **authenticity** of the publisher. Signed releases (for example `minisign` or `age`) are recommended to strengthen authenticity.

To report a vulnerability, please open a private report via the repository "Security" tab ("Report a vulnerability"). Do not include actionable details in public issues.
