# RF Games verify harness — shared tests + optional e2e
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "== build:shared ==" -ForegroundColor Cyan
npm run build:shared
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== unit tests ==" -ForegroundColor Cyan
npm test
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($env:RFGAMES_SKIP_E2E -eq "1") {
  Write-Host "Skipping e2e (RFGAMES_SKIP_E2E=1)" -ForegroundColor Yellow
  exit 0
}

Write-Host "== e2e ==" -ForegroundColor Cyan
npm run test:e2e
exit $LASTEXITCODE
