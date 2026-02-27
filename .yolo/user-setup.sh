#!/bin/bash
set -e

# --- Rust ---
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
source "$HOME/.cargo/env"
rustup component add clippy rustfmt

# cargo-llvm-cov: required by CLAUDE.md for coverage reporting
cargo install cargo-llvm-cov

# --- Node.js via NVM ---
export NVM_DIR="$HOME/.nvm"
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
. "$NVM_DIR/nvm.sh"

nvm install 22
nvm alias default 22

# --- pnpm (locked to version in package.json) ---
corepack enable
corepack prepare pnpm@9.15.4 --activate

# --- Playwright browsers ---
# Install browsers to a stable, explicit path so the same location is used
# whether claude runs `install` or `test`. Using npx avoids needing project
# node_modules at container build time.
export PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright"
npx playwright@1.58.2 install chromium webkit

# --- Persist paths in shell configs ---
{
  echo 'source "$HOME/.cargo/env"'
  echo 'export NVM_DIR="$HOME/.nvm"'
  echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"'
  echo 'export PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright"'
} >> ~/.zshrc

{
  echo 'source "$HOME/.cargo/env"'
  echo 'export NVM_DIR="$HOME/.nvm"'
  echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"'
  echo 'export PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright"'
} >> ~/.bashrc
