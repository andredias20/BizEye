param(
    [int]$Port = 5173
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $projectRoot

try {
    npm run dev -- --host 127.0.0.1 --port $Port
}
finally {
    Pop-Location
}
