param(
    [string]$TargetUrl,
    [string]$TargetUrls,
    [switch]$UseEdgeProfile,
    [string]$EdgeUserDataDir,
    [string]$EdgeProfileDirectory = "Default",
    [string]$ImageName = "floor2plan-smoke-tests",
    [switch]$Rebuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if ([string]::IsNullOrWhiteSpace($EdgeUserDataDir)) {
    if (-not [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
        $EdgeUserDataDir = Join-Path $env:LOCALAPPDATA "Microsoft\Edge\User Data"
    } elseif (Test-Path -LiteralPath (Join-Path $HOME "Library/Application Support/Microsoft Edge")) {
        $EdgeUserDataDir = Join-Path $HOME "Library/Application Support/Microsoft Edge"
    } else {
        $EdgeUserDataDir = Join-Path $HOME ".config/microsoft-edge"
    }
}

if (-not (Get-Command podman -ErrorAction SilentlyContinue)) {
    throw "podman is required but was not found on PATH."
}

& podman image exists $ImageName *> $null
$imageExists = $LASTEXITCODE -eq 0

if ($Rebuild -or -not $imageExists) {
    & podman build -t $ImageName $scriptDir
    if ($LASTEXITCODE -ne 0) {
        throw "podman build failed with exit code $LASTEXITCODE."
    }
}

$envMap = [ordered]@{}

foreach ($name in @(
    "SMOKE_LOGIN_MODE",
    "SMOKE_SERVICE_USERNAME",
    "SMOKE_SERVICE_PASSWORD",
    "SMOKE_SERVICE_USERNAME_SELECTOR",
    "SMOKE_SERVICE_PASSWORD_SELECTOR",
    "SMOKE_SERVICE_SUBMIT_SELECTOR",
    "SMOKE_HOME_TILE_SELECTOR",
    "SMOKE_MIN_HOME_TILES",
    "SMOKE_TILE_CLICK_LIMIT",
    "SMOKE_MENU_CLICK_LIMIT",
    "SMOKE_MENU_BUTTON_SELECTOR",
    "SMOKE_MENU_ITEM_SELECTOR",
    "SMOKE_FAIL_ON_CONSOLE_ERROR",
    "SMOKE_VISUAL_SETTLE_MS",
    "CYPRESS_VIEWPORT_WIDTH",
    "CYPRESS_VIEWPORT_HEIGHT",
    "CYPRESS_PAGE_LOAD_TIMEOUT"
)) {
    $value = [Environment]::GetEnvironmentVariable($name)
    if (-not [string]::IsNullOrWhiteSpace($value)) {
        $envMap[$name] = $value
    }
}

if (-not [string]::IsNullOrWhiteSpace($TargetUrls)) {
    $envMap["TARGET_URLS"] = $TargetUrls
} elseif (-not [string]::IsNullOrWhiteSpace($TargetUrl)) {
    $envMap["TARGET_URL"] = $TargetUrl
} else {
    foreach ($name in @("TARGET_URLS", "TARGET_URL")) {
        $value = [Environment]::GetEnvironmentVariable($name)
        if (-not [string]::IsNullOrWhiteSpace($value)) {
            $envMap[$name] = $value
        }
    }
}

$runArgs = @("run", "--rm")

foreach ($entry in $envMap.GetEnumerator()) {
    $runArgs += @("-e", "$($entry.Key)=$($entry.Value)")
}

$containerCommand = @("--browser", "edge", "--headed", "--spec", "cypress/e2e/login_smoke.cy.js")

if ($UseEdgeProfile) {
    if (-not (Test-Path -LiteralPath $EdgeUserDataDir -PathType Container)) {
        throw "Edge user-data directory not found: $EdgeUserDataDir"
    }

    Write-Warning "Close Microsoft Edge before reusing this profile: $EdgeUserDataDir"
    $runArgs += @(
        "-e", "CYPRESS_EDGE_USER_DATA_DIR=/edge-profile",
        "-e", "CYPRESS_EDGE_PROFILE_DIRECTORY=$EdgeProfileDirectory",
        "-v", "${EdgeUserDataDir}:/edge-profile"
    )
}

& podman @runArgs $ImageName @containerCommand
if ($LASTEXITCODE -ne 0) {
    throw "podman run failed with exit code $LASTEXITCODE."
}
