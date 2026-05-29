# Stop PK backends on ports 8180 and 8080
foreach ($port in 8180, 8080) {
    Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
        ForEach-Object {
            $p = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
            if ($p -and $p.ProcessName -match "java") {
                Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
                Write-Host "Stopped process on port $port (PID $($_.OwningProcess))"
            }
        }
}
Get-CimInstance Win32_Process -Filter "Name='java.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match "TradingBotApplication|spring-boot:run|pktradingIBKR" } |
    ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        Write-Host "Stopped java PID $($_.ProcessId)"
    }
