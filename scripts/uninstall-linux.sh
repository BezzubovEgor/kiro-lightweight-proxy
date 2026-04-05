#!/bin/bash
# Uninstall Kiro Proxy systemd service (Linux)

set -e

SERVICE_NAME="kiro-proxy"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

echo "Uninstalling Kiro Proxy systemd service..."

# Stop service
sudo systemctl stop "$SERVICE_NAME" 2>/dev/null || true

# Disable service
sudo systemctl disable "$SERVICE_NAME" 2>/dev/null || true

# Remove service file
sudo rm -f "$SERVICE_FILE"

# Reload systemd
sudo systemctl daemon-reload

echo ""
echo "✅ Service uninstalled successfully!"
echo ""
