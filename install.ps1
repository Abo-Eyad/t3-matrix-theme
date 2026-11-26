# T3 Code — Matrix Rain Animated Theme Installer (PowerShell)
param(
    [switch]$Remove,
    [switch]$Status,
    [switch]$Restart
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Installer = Join-Path $ScriptDir "install.mjs"

if ($Status) {
    node $Installer --status
    exit $LASTEXITCODE
}

$running = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -like "T3 Code*" }
$relaunchPath = $null

if ($running) {
    if (-not $Restart) {
        Write-Warning "T3 Code is currently running. Quit it completely and run again, or pass -Restart to close, patch, and relaunch automatically."
        exit 1
    }

    $relaunchPath = ($running | Where-Object { $_.Path } | Select-Object -First 1).Path
    if (-not $relaunchPath) {
        $fallbackExe = Join-Path $env:LOCALAPPDATA "Programs\t3code\T3 Code (Beta).exe"
        if (Test-Path $fallbackExe) { $relaunchPath = $fallbackExe }
    }

    Write-Host "Closing T3 Code..." -ForegroundColor Cyan
    foreach ($p in $running) {
        try { $null = $p.CloseMainWindow() } catch {}
    }

    $deadline = (Get-Date).AddSeconds(8)
    while ((Get-Date) -lt $deadline) {
        $still = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -like "T3 Code*" }
        if (-not $still) { break }
        Start-Sleep -Milliseconds 300
    }

    $still = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -like "T3 Code*" }
    if ($still) {
        $still | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 500
    }
}

if ($Remove) {
    node $Installer --remove
} else {
    node $Installer
}
$exitCode = $LASTEXITCODE

if ($Restart -and $relaunchPath -and (Test-Path $relaunchPath)) {
    Write-Host "Relaunching T3 Code..." -ForegroundColor Cyan
    Start-Process -FilePath $relaunchPath
}

exit $exitCode
