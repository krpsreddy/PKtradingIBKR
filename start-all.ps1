# Phase 221 — paper + live backends
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root
Write-Host "=== PK DUAL RUNTIME (paper 8180 + live 8080) ==="
& (Join-Path $Root "start-paper.ps1")
Start-Sleep -Seconds 4
& (Join-Path $Root "start-live.ps1")
Write-Host ""
Write-Host "Paper: http://localhost:8180/api/runtime/profile"
Write-Host "Live:  http://localhost:8080/api/runtime/profile"
Write-Host "Logs:  logs\paper-runtime.log  logs\live-runtime.log"
