# Phase 221 — PAPER runtime (port 8180, IB Gateway paper 4002)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root
New-Item -ItemType Directory -Force -Path logs | Out-Null

Write-Host "=== PK PAPER RUNTIME (8180 / IBKR 4002) ==="

Get-NetTCPConnection -LocalPort 8180 -ErrorAction SilentlyContinue |
    ForEach-Object {
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
Start-Sleep -Seconds 1

$env:SPRING_PROFILES_ACTIVE = "paper"
$env:PK_APP_VARIANT = "paper"
$env:IBKR_PORT = "4002"

$logFile = Join-Path $Root "logs\paper-runtime.log"
Start-Process -FilePath "mvn" -ArgumentList "-q", "compile", "spring-boot:run" `
    -WorkingDirectory $Root -RedirectStandardOutput $logFile -RedirectStandardError $logFile -NoNewWindow
Write-Host "Paper backend starting — log: logs\paper-runtime.log"
Write-Host "API: http://localhost:8180/api/runtime/profile"
