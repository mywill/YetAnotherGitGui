# Yet Another Git Gui

A cross-platform Git GUI for macOS and Linux — built to complement the CLI, not replace it.

![YAGG](YAGG-Default.png)

This is a largely vibe-coded project for me to get the feel of vibe coding. I will be tightening up the code as time allows and welcome any additions. This was created from a desire for a Mac and Linux simple Git GUI that offers basic features that I like doing through a GUI, like looking at the commit graph and staging hunks, looking at diffs, etc.

This is not a full featured git tool and is intended for use along with the CLI which is the main driver and is not intended to do everything the git CLI offers.

## Features

- Commit graph visualization with branch and merge lines
- File staging with hunk-level and line-level control
- Branch, tag, and stash management
- Command palette for quick searches (hashes, branches, authors, commit messages) and navigation
- Full keyboard and/or mouse interactivity
- Revert commits and files from history
- Cross-platform: macOS and Linux

## Installation

### Linux

**Debian/Ubuntu (.deb):**
```bash
sudo dpkg -i Yet.Another.Git.Gui_*.deb 
```

**Fedora/RHEL (.rpm):**
```bash
sudo rpm -i Yet.Another.Git.Gui_*.rpm
```

**AppImage (any distro):**
```bash
chmod +x "Yet.Another.Git.Gui_*.AppImage"
./"Yet.Another.Git.Gui_*.AppImage"
```

After installing via .deb or .rpm, the `yagg` command is available system-wide:
```bash
yagg                  # Open current directory
yagg /path/to/repo    # Open specific repository
```

### macOS

1. Open the `.dmg` file
2. Drag **Yet Another Git Gui** to your Applications folder
3. Launch the app    
   a. If this will not launch see Troubleshooting section with options.  This may not be signed by an offical Apple cert and may require a work around.   
4. Click **"Install CLI Tool"** in the sidebar to enable terminal usage

After installing the CLI tool:
```bash
yagg                  # Open current directory
yagg /path/to/repo    # Open specific repository
```

### From Source

Prerequisites: Node.js 22+, Rust (latest stable), platform-specific [Tauri dependencies](https://tauri.app/start/prerequisites/)

```bash
# Clone the repository
git clone https://github.com/mywill/YetAnotherGitGui.git
cd YetAnotherGitGui

# Install dependencies
pnpm install

# Run in development mode
pnpm tauri dev

# Build for production
pnpm tauri build
```

## Development

### Commands

| Command | Description |
|---------|-------------|
| `pnpm tauri dev` | Start development server with hot reload |
| `pnpm tauri build` | Build production release |
| `pnpm test` | Run unit tests |
| `pnpm test:e2e` | Run E2E tests |
| `pnpm lint` | Lint code |
| `pnpm format` | Format code |
| `pnpm check` | Run all linters, type checks, and tests |

### Testing

```bash
# Frontend unit tests
pnpm test

# Frontend unit tests with coverage
pnpm test:coverage

# E2E tests (requires Playwright browsers)
pnpm test:e2e

# Rust tests
cd src-tauri && cargo test

# Rust tests with coverage (requires cargo-llvm-cov)
cd src-tauri && cargo llvm-cov --summary-only
```

See [TESTING.md](TESTING.md) for comprehensive testing documentation.

## Supply Chain Security

This project enforces a **7-day dependency cooldown** to reduce the risk of supply chain attacks. Newly published npm package versions cannot enter the dependency graph until they have been available on the registry for at least 7 days, giving the community time to detect and flag malicious releases.

### How It Works

pnpm's built-in [`minimumReleaseAge`](https://pnpm.io/settings#minimumreleaseage) setting in `pnpm-workspace.yaml` blocks resolution of any package version published less than 10,080 minutes (7 days) ago. This applies to both direct and transitive dependencies.

The cooldown is enforced at **resolution time** — when pnpm resolves new versions during `pnpm install`, `pnpm add`, or `pnpm update`. It is **not** re-checked during `--frozen-lockfile` installs (CI) or by Dependabot, which resolves versions using its own updater.

### Overriding the Cooldown

For urgent updates (e.g., a critical security patch published today), add the package to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml`:

```yaml
minimumReleaseAgeExclude:
  - 'package-name@1.2.3'    # exact version
  - '@scope/*'               # all packages from a scope
```

### Rust Dependencies

For Cargo/Rust dependencies, [`cargo-cooldown`](https://crates.io/crates/cargo-cooldown) provides equivalent functionality as a lightweight cargo wrapper. It is not currently configured in this project but can be added by installing the tool and creating a `cooldown.toml` in `src-tauri/`.

## Tech Stack

- **Frontend:** React 19, TypeScript, Zustand, Vite, Tailwind CSS 4, react-window, date-fns
- **Backend:** Rust, Tauri 2.0, git2
- **Testing:** Vitest, Playwright, axe-core, cargo test

## Troubleshooting

### Linux: "No display server" error
Ensure you're running in a graphical environment. If running via SSH, use X11 forwarding or VNC.

### macOS: "Cannot be opened because Apple cannot verify it"
Since the app is not signed with an Apple Developer certificate, macOS Gatekeeper will block it on first launch. To open the app, use one of these methods:

**Option A — Right-click to open (easiest):**
1. Right-click (or Control-click) the app in Finder
2. Select **Open** from the context menu
3. Click **Open** in the dialog that appears

You only need to do this once — subsequent launches will work normally.

**Option B — Remove the quarantine flag:**
```bash
xattr -cr /Applications/Yet\ Another\ Git\ Gui.app
```

### Build fails with missing dependencies
Check that you have all [Tauri prerequisites](https://tauri.app/start/prerequisites/) installed for your platform.

## Claude Code / YOLO Container

This project includes setup scripts for running [Claude Code](https://github.com/anthropics/claude-code) inside a [YOLO](https://github.com/mywill/yolo)-managed Podman container. YOLO provides an isolated, reproducible environment where Claude Code can develop and test without touching your host system.

The scripts live in `.yolo/`:

| Script | Runs as | Purpose |
|--------|---------|---------|
| `root-setup.sh` | root | Installs Tauri 2.0 system libraries and Playwright's Chromium runtime deps via `apt-get` |
| `user-setup.sh` | claude | Installs Rust (stable + clippy + rustfmt), cargo-llvm-cov, Node 22 via NVM, pnpm 10.33.0, and Playwright Chromium browsers |

After YOLO builds the container, all development and test commands work out of the box:

```bash
pnpm install && pnpm tauri dev   # run the app
pnpm test && pnpm test:e2e       # all tests
cd src-tauri && cargo test       # Rust tests
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Please note that this project is released with a [Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.

## License

MIT
