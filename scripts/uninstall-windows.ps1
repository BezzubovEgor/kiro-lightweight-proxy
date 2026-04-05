# Uninstall Kiro Proxy Windows Service
# Run this script as Administrator in PowerShell

$ServiceName = "KiroProxy"
$InstallDir = Split-Path -Parent $PSScriptRoot

Write-Host "Uninstalling Kiro Proxy Windows Service..." -ForegroundColor Green

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator" -ForegroundColor Red
    exit 1
}

# Create service uninstallation script
$serviceScript = @"
const Service = require('node-windows').Service;

const svc = new Service({
  name: '$ServiceName',
  script: require('path').join('$($InstallDir -replace '\\', '\\')', 'server.js')
});

svc.on('uninstall', () => {
  console.log('Service uninstalled successfully!');
});

svc.uninstall();
"@

$serviceScriptPath = Join-Path $InstallDir "uninstall-service.js"
$serviceScript | Out-File -FilePath $serviceScriptPath -Encoding UTF8

# Run the service uninstallation
Write-Host "Uninstalling service..."
node $serviceScriptPath

# Clean up
Start-Sleep -Seconds 2
Remove-Item $serviceScriptPath

Write-Host ""
Write-Host "✅ Service uninstalled successfully!" -ForegroundColor Green
Write-Host ""
