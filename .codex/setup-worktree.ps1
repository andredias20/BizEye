param(
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $projectRoot

try {
    Write-Host "BizEye worktree setup"
    Write-Host "Project: $projectRoot"

    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw "Node.js was not found in PATH. Install Node.js 20.19+ or 22.12+."
    }

    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        throw "npm was not found in PATH. Install npm with Node.js."
    }

    $nodeVersion = (& node --version).TrimStart("v")
    $nodeParts = $nodeVersion.Split(".")
    $nodeMajor = [int]$nodeParts[0]
    $nodeMinor = [int]$nodeParts[1]

    $supportsVite = (
        ($nodeMajor -eq 20 -and $nodeMinor -ge 19) -or
        ($nodeMajor -eq 22 -and $nodeMinor -ge 12) -or
        ($nodeMajor -gt 22)
    )

    if (-not $supportsVite) {
        throw "Detected Node.js $nodeVersion. Vite 7 requires Node.js 20.19+ or 22.12+."
    }

    if (-not (Test-Path "package-lock.json")) {
        throw "package-lock.json was not found. This setup expects npm with a lockfile."
    }

    Write-Host "Node: $(& node --version)"
    Write-Host "npm:  $(& npm --version)"
    Write-Host "Installing dependencies with npm ci..."
    npm ci

    if (-not $SkipBuild) {
        Write-Host "Running initial build..."
        npm run build
    }

    Write-Host "BizEye worktree setup completed."
}
finally {
    Pop-Location
}
