# Install Kiro Proxy as a Windows Service
# Run this script as Administrator in PowerShell

$ServiceName = "KiroProxy"
$InstallDir = Split-Path -Parent $PSScriptRoot
$NodePath = (Get-Command node).Source
$ScriptPath = Join-Path $InstallDir "server.js"

Write-Host "Installing Kiro Proxy as Windows Service..." -ForegroundColor Green
Write-Host "Install directory: $InstallDir"
Write-Host "Node path: $NodePath"
Write-Host "Script path: $ScriptPath"

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator" -ForegroundColor Red
    exit 1
}

# Install node-windows if not present
Write-Host "Checking for node-windows package..."
$nodeWindowsPath = Join-Path $InstallDir "node_modules\node-windows"
if (-not (Test-Path $nodeWindowsPath)) {
    Write-Host "Installing node-windows..."
    Set-Location $InstallDir
    npm install node-windows --save-dev
}

# Create service installation script
$serviceScript = @"
const Service = require('node-windows').Service;

const svc = new Service({
  name: '$ServiceName',
  description: 'Kiro Lightweight Proxy - OpenAI-compatible proxy for Kiro AI',
  script: '$($ScriptPath -replace '\\', '\\')',
  nodeOptions: [],
  env: [
    {
      name: 'PORT',
      value: '3000'
    }
    // Uncomment to enable authentication
    // {
    //   name: 'PROXY_API_KEY',
    //   value: 'your-secret-key'
    // },
    // Uncomment to enable rate limiting
    // {
    //   name: 'RATE_LIMIT_ENABLED',
    //   value: 'true'
    // }
  ]
});

svc.on('install', () => {
  console.log('Service installed successfully!');
  svc.start();
});

svc.on('alreadyinstalled', () => {
  console.log('Service is already installed.');
});

svc.on('start', () => {
  console.log('Service started successfully!');
});

svc.install();
"@

$serviceScriptPath = Join-Path $InstallDir "install-service.js"
$serviceScript | Out-File -FilePath $serviceScriptPath -Encoding UTF8

# Run the service installation
Write-Host "Installing service..."
node $serviceScriptPath

# Clean up
Remove-Item $serviceScriptPath

Write-Host ""
Write-Host "✅ Service installed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Commands:"
Write-Host "  Start:   net start $ServiceName"
Write-Host "  Stop:    net stop $ServiceName"
Write-Host "  Restart: net stop $ServiceName && net start $ServiceName"
Write-Host "  Status:  sc query $ServiceName"
Write-Host ""
Write-Host "To uninstall, run: scripts\uninstall-windows.ps1"
Write-Host ""
Write-Host "Logs are available in Event Viewer under:"
Write-Host "  Applications and Services Logs > $ServiceName"
Write-Host ""
