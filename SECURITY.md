# Security policy

Do not report exploitable vulnerabilities through public GitHub issues.

Repository maintainers should use GitHub private vulnerability reporting or another private channel configured by the repository owner.

Never include credentials, private keys, seed phrases, OAuth tokens, access codes, player records, IP addresses, or production logs in a report, commit, issue, or pull request.

Before every release:

1. Run secret scanning against the complete Git history.
2. Review changes to authentication, authorization, wallet transactions, price calculations, randomness, and withdrawal limits.
3. Test contracts and the production build.
4. Require an independent smart-contract audit before unpausing production contracts.
