#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');

const parseEnvLine = (line) => {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const separator = trimmed.indexOf('=');
  if (separator < 1) {
    return null;
  }

  const key = trimmed.slice(0, separator).trim();
  let value = trimmed.slice(separator + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return { key, value };
};

const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return;
  }

  fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map(parseEnvLine)
    .filter(Boolean)
    .forEach(({ key, value }) => {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    });
};

const normalizeArgsForPowerShell = (args) => {
  const converted = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    switch (arg) {
      case '--target-url':
        converted.push('-TargetUrl', args[++index]);
        break;
      case '--target-urls':
        converted.push('-TargetUrls', args[++index]);
        break;
      case '--use-edge-profile':
        converted.push('-UseEdgeProfile');
        break;
      case '--edge-user-data-dir':
        converted.push('-EdgeUserDataDir', args[++index]);
        break;
      case '--edge-profile':
        converted.push('-EdgeProfileDirectory', args[++index]);
        break;
      case '--image':
        converted.push('-ImageName', args[++index]);
        break;
      case '--rebuild':
        converted.push('-Rebuild');
        break;
      default:
        converted.push(arg);
        break;
    }
  }

  return converted;
};

const showHelp = () => {
  console.log(`Run the Floor2Plan smoke test through Podman.

Usage:
  npm run test:smoke
  npm run test:smoke:rebuild
  npm run test:smoke -- --target-url https://example.com/Account/Login
  npm run test:smoke -- --rebuild

Create .env.smoke.local next to package.json to avoid typing credentials:
  SMOKE_SERVICE_USERNAME=your-service-user
  SMOKE_SERVICE_PASSWORD=your-service-password

Extra arguments are forwarded to the Podman helper script.`);
};

const args = process.argv.slice(2);

if (args.includes('-h') || args.includes('--help')) {
  showHelp();
  process.exit(0);
}

loadEnvFile(path.join(root, '.env.smoke.local'));

const isWindows = process.platform === 'win32';
const command = isWindows ? 'powershell.exe' : path.join(root, 'run-smoke-podman.sh');
const commandArgs = isWindows
  ? [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    path.join(root, 'run-smoke-podman.ps1'),
    ...normalizeArgsForPowerShell(args),
  ]
  : args;

const result = spawnSync(command, commandArgs, {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
  shell: false,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
