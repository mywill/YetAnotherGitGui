# Security Policy

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

1. **Do not** open a public GitHub issue for security vulnerabilities
2. Email the maintainers directly or use GitHub's private vulnerability reporting feature
3. Include as much detail as possible:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Scope

This security policy applies to:
- The Yet Another Git Gui application

### Out of Scope

- Vulnerabilities in dependencies (please report to the respective projects)
- Issues that require physical access to a user's machine
- Social engineering attacks

## Security Best Practices

When using Yet Another Git Gui:
- Keep the application updated to the latest version
- Only open repositories from trusted sources

## Dependency Cooldown

This project enforces a **7-day dependency cooldown** to reduce the risk of supply-chain attacks. Newly published npm package versions cannot enter the dependency graph until they have been available on the registry for at least 7 days, giving the community time to detect and flag malicious releases.

### How it works

pnpm's built-in [`minimumReleaseAge`](https://pnpm.io/settings#minimumreleaseage) setting in `pnpm-workspace.yaml` blocks resolution of any package version published less than 10,080 minutes (7 days) ago. This applies to both direct and transitive dependencies.

The cooldown is enforced at **resolution time** — when pnpm resolves new versions during `pnpm install`, `pnpm add`, or `pnpm update`. It is **not** re-checked during `--frozen-lockfile` installs (CI) or by Dependabot, which resolves versions using its own updater.

### Overriding the cooldown

For urgent updates (e.g., a critical security patch published today), add the package to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml`:

```yaml
minimumReleaseAgeExclude:
  - 'package-name@1.2.3'    # exact version
  - '@scope/*'               # all packages from a scope
```

### Rust dependencies

For Cargo/Rust dependencies, [`cargo-cooldown`](https://crates.io/crates/cargo-cooldown) provides equivalent functionality as a lightweight cargo wrapper. It is not currently configured in this project but can be added by installing the tool and creating a `cooldown.toml` in `src-tauri/`.
