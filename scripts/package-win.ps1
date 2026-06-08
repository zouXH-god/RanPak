param(
    [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$webDir = Join-Path $root "web"
$appDir = Join-Path $root "app"
$webDist = Join-Path $webDir "dist"
$bundledDist = Join-Path $appDir "web-dist"
$releaseDir = Join-Path $root "release"
$npmCache = Join-Path $root ".npm-cache"

function Remove-Live2dDataPackages {
    param([string]$Live2dRoot)
    if (-not (Test-Path $Live2dRoot)) {
        return
    }
    $resolvedRoot = (Resolve-Path -LiteralPath $Live2dRoot).Path
    $targets = Get-ChildItem -LiteralPath $resolvedRoot -Force | Where-Object {
        $_.Name -eq "covers" -or
        $_.Name -eq "default-models" -or
        $_.Name -eq "model-catalog.json" -or
        $_.Name -like "live2d-widget-model-*"
    }
    foreach ($target in $targets) {
        $resolvedTarget = (Resolve-Path -LiteralPath $target.FullName).Path
        if (-not $resolvedTarget.StartsWith($resolvedRoot)) {
            throw "Refusing to remove path outside Live2D root: $resolvedTarget"
        }
        Remove-Item -LiteralPath $resolvedTarget -Recurse -Force
    }
}

if (-not $SkipInstall) {
    Write-Host "==> Installing dependencies"
    Push-Location $webDir
    npm install --cache $npmCache
    Pop-Location

    Push-Location $appDir
    npm install --cache $npmCache
    Pop-Location
} else {
    Write-Host "==> Skipping dependency install"
}

Write-Host "==> Building web"
Push-Location $webDir
npm run build
Pop-Location

Write-Host "==> Copying web dist into Electron app"
if (Test-Path $bundledDist) {
    Remove-Item -LiteralPath $bundledDist -Recurse -Force
}
Copy-Item -LiteralPath $webDist -Destination $bundledDist -Recurse
Remove-Live2dDataPackages (Join-Path $bundledDist "vendor\live2d-widget")

Write-Host "==> Packaging Windows exe"
if (Test-Path $releaseDir) {
    Remove-Item -LiteralPath $releaseDir -Recurse -Force
}
Push-Location $appDir
npm run dist:win
Pop-Location

Write-Host "==> Done. Output: $releaseDir"
