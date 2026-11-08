# Contributing

This repository is the public export of Beelli X UI. The exported repository builds and tests independently.

Use Node.js 24 and, on Windows, PowerShell 7. Run `npm ci --ignore-scripts`, `npm run build`, `npx playwright install chromium`, and `npm test`. Browser tests preserve Playwright defaults and disable the Windows blank-password probe through the included helper. Do not bypass that helper or change host security settings.

Keep the GUI, host adapter and configuration namespace independent from business plugins. Use DSH public APIs; do not patch the installed client or copy a third-party UI implementation. Changes must include focused regression coverage when behavior changes, and a description of the actual validation and its limits. Test the final archive on the stated native client before public release; browser fixtures are not native acceptance.

Do not commit credentials, sessions, user media, databases, environment backups or machine-specific paths. Third-party artwork and code must keep their sources and licenses. Contributions are MIT except assets explicitly licensed otherwise. The version is fixed at 0.1.1 until the maintainer approves a version change.

Publishing a repository, publishing npm, submitting a market entry and installing into a user environment are separate steps. Do not report a draft or local check as a live release.
