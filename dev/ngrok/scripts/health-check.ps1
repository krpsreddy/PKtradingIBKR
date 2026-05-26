#Requires -Version 5.1
$ErrorActionPreference = "Stop"
$NgrokDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$EnvFile = Join-Path $NgrokDir ".env"
$UrlsFile = Join-Path $NgrokDir ".ngrok-urls.env"
$WebAddr = if ($env:NGROK_WEB_ADDR) { $env:NGROK_WEB_ADDR } else { "127.0.0.1:4040" }

Get-Content $EnvFile | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
  $parts = $_ -split '=', 2
  if ($parts.Count -eq 2) { Set-Item -Path "env:$($parts[0].Trim())" -Value $parts[1].Trim() }
}

$pair = "${env:NGROK_BASIC_AUTH_USER}:${env:NGROK_BASIC_AUTH_PASS}"
$secPair = ConvertTo-SecureString $pair -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential("ngrok", $secPair)

Write-Host "=== Local services ==="
try { Invoke-WebRequest -Uri "http://localhost:4200/" -UseBasicParsing -TimeoutSec 5 | Out-Null; Write-Host "OK Angular :4200" } catch { Write-Host "FAIL Angular :4200" }
try { Invoke-WebRequest -Uri "http://localhost:8080/" -UseBasicParsing -TimeoutSec 5 | Out-Null; Write-Host "OK Spring :8080" } catch { Write-Host "FAIL Spring :8080" }

Write-Host "`n=== ngrok tunnels ==="
$tunnels = Invoke-RestMethod -Uri "http://${WebAddr}/api/tunnels" -UseBasicParsing
$frontend = ($tunnels.tunnels | Where-Object { $_.name -eq "frontend" }).public_url
$backend = ($tunnels.tunnels | Where-Object { $_.name -eq "backend" }).public_url

if ($frontend) {
  try {
    Invoke-WebRequest -Uri "$frontend/" -Credential $cred -UseBasicParsing -TimeoutSec 15 | Out-Null
    Write-Host "OK Frontend $frontend"
  } catch { Write-Host "FAIL Frontend $frontend — $($_.Exception.Message)" }
}

if ($backend) {
  try {
    Invoke-WebRequest -Uri "$backend/api/symbols" -Credential $cred -UseBasicParsing -TimeoutSec 15 | Out-Null
    Write-Host "OK Backend $backend"
  } catch {
    try {
      Invoke-WebRequest -Uri "$backend/" -Credential $cred -UseBasicParsing -TimeoutSec 15 | Out-Null
      Write-Host "OK Backend $backend (root)"
    } catch { Write-Host "FAIL Backend $backend" }
  }
}

if ($frontend -and $backend) {
@"
NGROK_FRONTEND_URL=$frontend
NGROK_BACKEND_URL=$backend
NGROK_BACKEND_API_URL=$backend/api
APP_CORS_EXTRA_ORIGIN_PATTERNS=$frontend
"@ | Set-Content $UrlsFile
  Write-Host "`nURLs written to $UrlsFile"
}
