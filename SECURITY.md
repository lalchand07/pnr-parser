# Security policy

## Supported versions

Security fixes are released for the latest minor version on npm.

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Use GitHub's
[private vulnerability reporting](https://github.com/lalchand07/pnr-parser/security/advisories/new)
for this repository instead. You should get a reply within 7 days.

Relevant issues include:

- input that makes `parsePnr` throw, hang or use excessive CPU/memory
  (for example a regular expression with catastrophic backtracking);
- CSV output that a spreadsheet would execute as a formula;
- the playground sending data anywhere, or a way around its
  Content-Security-Policy;
- anything in the published package that is not built from this repository.

## Personal data

pnr-parser processes text that usually contains personal data. It makes no
network requests and stores nothing, but results contain the original text of
every line. **Never include real passenger data in a report**: follow the
[anonymization checklist](CONTRIBUTING.md#anonymization-checklist).
