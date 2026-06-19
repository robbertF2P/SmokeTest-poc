# Floor2Plan smoke test harness

This harness runs a Cypress smoke test against one or more Floor2Plan login URLs. The test logs in with service credentials, verifies the home page renders tiles, opens tile pages, opens upper-left menu pages, and reports browser console errors.

## Prerequisites

- Node.js ≥ 18 and `npm`
- .NET 8 SDK (for the xUnit wrapper only)
- Podman or Docker (for the containerised runners)

## Quick start

Copy the example credentials file and fill in your service account details:

```sh
cp .env.smoke.example .env.smoke.local
```

Edit `.env.smoke.local` and set:

```text
SMOKE_SERVICE_USERNAME=your-service-username
SMOKE_SERVICE_PASSWORD=your-service-password
```

The `.env.smoke.local` file is listed in `.gitignore` and will not be committed.

## Run with npm (Cypress directly)

```sh
npm ci
npm run test:smoke:cypress
```

To run against a specific target URL:

```sh
npm run test:smoke:cypress -- --env TARGET_URL=https://your-environment.floor2plan.com/Account/Login
```

## Run with an existing Edge Microsoft session

Cypress normally launches browsers with a clean profile. To use transparent Microsoft login from Edge, close Edge first, then point Cypress at the Edge user-data directory and profile that already has an active session.

```sh
CYPRESS_EDGE_USER_DATA_DIR="$HOME/.config/microsoft-edge" \
CYPRESS_EDGE_PROFILE_DIRECTORY="Default" \
npm run test:smoke:edge
```

On Windows, run the same script from PowerShell with your Edge user-data directory:

```powershell
$env:CYPRESS_EDGE_USER_DATA_DIR="$env:LOCALAPPDATA\Microsoft\Edge\User Data"
$env:CYPRESS_EDGE_PROFILE_DIRECTORY="Default"
npm run test:smoke:edge
```

Use the profile name shown in `edge://version` if your Microsoft account is not in `Default`.

## Run with xUnit

The xUnit wrapper launches the same Cypress spec via `dotnet test` and fails when Cypress fails.

```sh
npm ci
npm run test:xunit
```

Or directly with the .NET CLI:

```sh
dotnet test Floor2PlanSmokeTests.csproj
```

Set `TARGET_URL` or `TARGET_URLS` as environment variables before running to override the default target.

## Run with npm and Podman

Create a local credentials file:

```sh
cp .env.smoke.example .env.smoke.local
```

Edit `.env.smoke.local` and set:

```text
SMOKE_SERVICE_USERNAME=your-service-username
SMOKE_SERVICE_PASSWORD=your-service-password
```

Run the smoke test:

```sh
npm run test:smoke
```

This runs Cypress in headed Microsoft Edge so the browser remains visible while the smoke test moves through the application.

Force a fresh image build:

```sh
npm run test:smoke:rebuild
```

Run against a specific target:

```sh
npm run test:smoke -- --target-url https://example.com/Account/Login
```

The npm script runs the Podman helper for your OS and forwards `SMOKE_*`, `TARGET_URL`, `TARGET_URLS`, and viewport settings.

## Run with Podman helper scripts

The helper scripts build the local image when it is missing, forward the smoke-test environment variables, and run the Cypress test inside Podman.

Linux/macOS:

```sh
export SMOKE_SERVICE_USERNAME="your-service-username"
export SMOKE_SERVICE_PASSWORD="your-service-password"
./run-smoke-podman.sh
./run-smoke-podman.sh --target-url https://example.com/Account/Login
```

Windows PowerShell:

```powershell
$env:SMOKE_SERVICE_USERNAME="your-service-username"
$env:SMOKE_SERVICE_PASSWORD="your-service-password"
.\run-smoke-podman.ps1
.\run-smoke-podman.ps1 -TargetUrl https://example.com/Account/Login
```

Use `--rebuild` or `-Rebuild` to force a fresh image build.

## Run with Docker

Build the container:

```sh
docker build -t floor2plan-smoke-tests .
```

The image installs Microsoft Edge Stable so `npm run test:smoke:edge` can run inside the container.

Run against the default target:

```sh
docker run --rm floor2plan-smoke-tests
```

Run against a specific target:

```sh
docker run --rm -e TARGET_URL=https://example.com/Account/Login floor2plan-smoke-tests
```

Run against multiple targets:

```sh
docker run --rm -e TARGET_URLS="https://one.example.com/Account/Login,https://two.example.com/Account/Login" floor2plan-smoke-tests
```

Run in Docker with a mounted Edge profile:

```sh
docker run --rm \
  -e CYPRESS_EDGE_USER_DATA_DIR=/edge-profile \
  -e CYPRESS_EDGE_PROFILE_DIRECTORY=Default \
  -v "$HOME/.config/microsoft-edge:/edge-profile" \
  floor2plan-smoke-tests npm run test:smoke:edge
```

Host Edge profile reuse in Docker can be limited by OS keychain encryption and profile locks. Close Edge before running, and prefer running `npm run test:smoke:edge` on the same desktop user session.

## Environment variables

- `TARGET_URLS`: comma-separated login URLs. Takes precedence over `TARGET_URL`.
- `TARGET_URL`: single login URL.
- `SMOKE_LOGIN_MODE`: `service` for username/password login. Defaults to `service`.
- `SMOKE_SERVICE_USERNAME`: service-login username. Required when `SMOKE_LOGIN_MODE=service`.
- `SMOKE_SERVICE_PASSWORD`: service-login password. Required when `SMOKE_LOGIN_MODE=service`.
- `SMOKE_SERVICE_USERNAME_SELECTOR`: optional username field selector. Defaults to `#userName`.
- `SMOKE_SERVICE_PASSWORD_SELECTOR`: optional password field selector. Defaults to `#password`.
- `SMOKE_SERVICE_SUBMIT_SELECTOR`: optional login submit selector. Defaults to `form.login button[type="submit"], button[type="submit"]`.
- `CYPRESS_EDGE_USER_DATA_DIR`: Edge user-data directory to reuse for Microsoft SSO.
- `CYPRESS_EDGE_PROFILE_DIRECTORY`: Edge profile directory, for example `Default` or `Profile 1`.
- `SMOKE_HOME_TILE_SELECTOR`: optional CSS selector for home-page tiles. Defaults to common tile selectors.
- `SMOKE_MIN_HOME_TILES`: minimum visible tiles expected on the home page. Defaults to `2`.
- `SMOKE_TILE_CLICK_LIMIT`: maximum number of visible home tile slots to test. Defaults to `20`.
- `SMOKE_MENU_CLICK_LIMIT`: maximum number of discovered upper-left menu pages to test. Defaults to `40`.
- `SMOKE_MENU_BUTTON_SELECTOR`: optional CSS selector for the upper-left menu button. Defaults to common menu button selectors.
- `SMOKE_MENU_ITEM_SELECTOR`: optional CSS selector for menu page links. Defaults to common menu link selectors.
- `SMOKE_FAIL_ON_CONSOLE_ERROR`: set to `false` to record browser console errors without failing the smoke test. Defaults to failing on console errors.
- `SMOKE_VISUAL_SETTLE_MS`: optional wait after the smoke assertion for video capture. Defaults to `0`.
- `CYPRESS_VIEWPORT_WIDTH`: viewport width. Defaults to `1280`.
- `CYPRESS_VIEWPORT_HEIGHT`: viewport height. Defaults to `720`.

Console warnings and errors are written to `artifacts/console/*.json`. Opened and missing tile/menu targets are written to `artifacts/navigation/*.json`.
