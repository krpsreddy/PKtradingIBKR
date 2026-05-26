#Requires -Version 5.1
$ErrorActionPreference = "Stop"
$NgrokDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$EnvFile = Join-Path $NgrokDir ".env"
$ConfigFile = Join-Path $NgrokDir "ngrok.yml"

if (-not (Test-Path $EnvFile)) {
  Write-Error "Missing $EnvFile — copy .env.example to .env"
}

Get-Content $EnvFile | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
  $parts = $_ -split '=', 2
  if ($parts.Count -eq 2) {
    Set-Item -Path "env:$($parts[0].Trim())" -Value $parts[1].Trim()
  }
}

foreach ($key in @("NGROK_AUTHTOKEN", "NGROK_BASIC_AUTH_USER", "NGROK_BASIC_AUTH_PASS")) {
  if (-not (Get-Item "env:$key" -ErrorAction SilentlyContinue).Value) {
    Write-Error "$key is required in .env"
  }
}

$webAddr = if ($env:NGROK_WEB_ADDR) { $env:NGROK_WEB_ADDR } else { "127.0.0.1:4040" }

$yaml = @"
# AUTO-GENERATED — $(Get-Date -Format o)
version: "3"

agent:
  authtoken: $($env:NGROK_AUTHTOKEN)
  web_addr: $webAddr

tunnels:
  frontend:
    proto: http
    addr: 4200
    schemes:
      - https
    basic_auth:
      - "$($env:NGROK_BASIC_AUTH_USER):$($env:NGROK_BASIC_AUTH_PASS)"
"@

if ($env:NGROK_FRONTEND_DOMAIN) { $yaml += "`n    hostname: $($env:NGROK_FRONTEND_DOMAIN)" }

$yaml += @"

  backend:
    proto: http
    addr: 8080
    schemes:
      - https
    inspect: false
    basic_auth:
      - "$($env:NGROK_BASIC_AUTH_USER):$($env:NGROK_BASIC_AUTH_PASS)"
"@

if ($env:NGROK_BACKEND_DOMAIN) { $yaml += "`n    hostname: $($env:NGROK_BACKEND_DOMAIN)" }

if ($env:NGROK_IP_ALLOWLIST) {
  $yaml += "`n    ip_restriction:`n      allow_cidrs:"
  foreach ($cidr in ($env:NGROK_IP_ALLOWLIST -split ',')) {
    $cidr = $cidr.Trim()
    if ($cidr) { $yaml += "`n        - $cidr" }
  }
}

Set-Content -Path $ConfigFile -Value $yaml
Write-Host "Generated $ConfigFile"
