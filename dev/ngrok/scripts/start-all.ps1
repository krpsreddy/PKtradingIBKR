#Requires -Version 5.1
$ErrorActionPreference = "Stop"
$NgrokDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ConfigFile = Join-Path $NgrokDir "ngrok.yml"

& (Join-Path $PSScriptRoot "generate-config.ps1")

Write-Host "Starting ngrok tunnels (frontend:4200, backend:8080)..."
Write-Host "Press Ctrl+C to stop."
ngrok start frontend backend --config $ConfigFile
