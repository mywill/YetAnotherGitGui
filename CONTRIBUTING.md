# Contributing to Yet Another Git Gui

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/YetAnotherGitGui.git`
3. Install dependencies: `pnpm install`
4. Create a branch: `git checkout -b feature/your-feature`

## Development Setup

Prerequisites:
- Node.js 18+
- Rust 1.70+
- Platform-specific [Tauri dependencies](https://tauri.app/start/prerequisites/)

```bash
# Start development server
pnpm tauri dev

# Run tests
pnpm test
pnpm test:e2e
cd src-tauri && cargo test

# Lint code
pnpm lint
pnpm lint:rust
```

## Code Style

### TypeScript/React
- Use TypeScript strict mode
- Prefer functional components with hooks
- Use Zustand for state management
- Run `pnpm format` before committing

### Rust
- Follow standard Rust conventions
- Run `cargo fmt` before committing
- Ensure `cargo clippy` passes without warnings

### CSS / Styling
- Tailwind CSS v4 with CSS-based config (no `tailwind.config.js`)
- Custom theme tokens are defined in the `@theme` block in `src/styles/index.css`
- `prettier-plugin-tailwindcss` auto-sorts Tailwind classes
- When adding new colors, add them to the `@theme` block rather than using inline values

## Commit Messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/) for automated releases. Your commit messages determine whether a new version is released and what type of version bump occurs.

### Release-Triggering Commits

| Prefix | Description | Version Bump |
|--------|-------------|--------------|
| `fix:` | Bug fix | Patch (0.1.0 → 0.1.1) |
| `feat:` | New feature | Minor (0.1.0 → 0.2.0) |
| `feat!:` or `fix!:` | Breaking change | Major (0.1.0 → 1.0.0) |

### Non-Release Commits

These prefixes do not trigger a release:
- `chore:` - Maintenance tasks, dependency updates
- `docs:` - Documentation changes
- `style:` - Code formatting, no logic changes
- `refactor:` - Code restructuring without behavior changes
- `test:` - Adding or modifying tests
- `ci:` - CI/CD configuration changes

### Examples

```bash
# Bug fix → patch release
git commit -m "fix: resolve file staging issue when path contains spaces"

# New feature → minor release
git commit -m "feat: add dark mode toggle"

# Breaking change → major release
git commit -m "feat!: redesign commit graph API"

# No release
git commit -m "docs: update installation instructions"
git commit -m "test: add tests for BranchItem component"
git commit -m "refactor: simplify diff parsing logic"
```

### Breaking Changes

For breaking changes, you can either:
1. Add `!` after the type: `feat!: description`
2. Include `BREAKING CHANGE:` in the commit body:
   ```
   feat: redesign commit graph API

   BREAKING CHANGE: The graph rendering API has changed.
   ```

## Project Structure

- `src/components/` — React components organized by feature (graph, files, diff, commit, sidebar, etc.)
- `src/stores/` — Zustand state stores
- `src/services/` — Tauri IPC wrappers (git operations, clipboard, system)
- `src-tauri/src/commands/` — Tauri command handlers
- `src-tauri/src/git/` — Core git logic using git2
- `e2e/` — Playwright E2E tests with Tauri mocks

New components go in the appropriate feature subdirectory under `src/components/`. Tests are co-located (e.g., `MyComponent.test.tsx`).

See [TESTING.md](TESTING.md) for comprehensive testing documentation including patterns, coverage targets, and accessibility testing.

## Pull Request Process

1. Run `pnpm check` (runs all linters, type checks, and tests in one command)
2. Update documentation if needed
3. Create a pull request with a clear description
4. Link any related issues

## CI/CD

Pull requests run automated checks via GitHub Actions:
- **Commit linting** — PR commits are validated against conventional commit format
- **Frontend linting** — ESLint + Prettier
- **Rust linting** — `cargo fmt --check` + `cargo clippy -D warnings`
- **Frontend unit tests** and **E2E tests** (Playwright)
- **Rust tests**

Builds (Linux + macOS) run on main branch merges only. Releases are automated via semantic-release based on conventional commit prefixes.

## Reporting Bugs

When reporting bugs, please include:
- Operating system and version
- Steps to reproduce
- Expected vs actual behavior
- Any error messages or logs

## Feature Requests

Feature requests are welcome! Please:
- Check existing issues first
- Describe the use case
- Explain why this would be useful

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Questions?

Open an issue with the "question" label.
