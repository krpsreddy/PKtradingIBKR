# Phase 221 — LIVE runtime (port 8080, IB Gateway live 4001)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root
New-Item -ItemType Directory -Force -Path logs | Out-Null

Write-Host "=== PK LIVE RUNTIME (8080 / IBKR 4001) ==="

Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue |
    ForEach-Object {
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
Start-Sleep -Seconds 1

$env:SPRING_PROFILES_ACTIVE = "live"
$env:PK_APP_VARIANT = "live"
$env:IBKR_PORT = "4001"

$logFile = Join-Path $Root "logs\live-runtime.log"
Start-Process -FilePath "mvn" -ArgumentList "-q", "compile", "spring-boot:run" `
    -WorkingDirectory $Root -RedirectStandardOutput $logFile -RedirectStandardError $logFile -NoNewWindow
Write-Host "Live backend starting — log: logs\live-runtime.log"
Write-Host "API: http://localhost:8080/api/runtime/profile"
