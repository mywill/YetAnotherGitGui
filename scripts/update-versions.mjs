#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const version = process.argv[2];
if (!version) {
  console.error('Usage: node update-versions.mjs <version>');
  process.exit(1);
}

// Update package.json
const packagePath = join(rootDir, 'package.json');
const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
packageJson.version = version;
writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
console.log(`Updated package.json to ${version}`);

// Update Cargo.toml
const cargoPath = join(rootDir, 'src-tauri', 'Cargo.toml');
let cargoToml = readFileSync(cargoPath, 'utf8');
cargoToml = cargoToml.replace(/^version = ".*"$/m, `version = "${version}"`);
writeFileSync(cargoPath, cargoToml);
console.log(`Updated Cargo.toml to ${version}`);

// Update tauri.conf.json
const tauriPath = join(rootDir, 'src-tauri', 'tauri.conf.json');
const tauriConf = JSON.parse(readFileSync(tauriPath, 'utf8'));
tauriConf.version = version;
writeFileSync(tauriPath, JSON.stringify(tauriConf, null, 2) + '\n');
console.log(`Updated tauri.conf.json to ${version}`);

console.log(`All versions updated to ${version}`);
