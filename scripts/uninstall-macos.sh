#!/bin/bash
# Uninstall Kiro Proxy LaunchAgent (macOS)

set -e

SERVICE_NAME="com.kiro.proxy"
PLIST_FILE="$HOME/Library/LaunchAgents/${SERVICE_NAME}.plist"

echo "Uninstalling Kiro Proxy LaunchAgent..."

# Unload service
launchctl unload "$PLIST_FILE" 2>/dev/null || true

# Remove plist file
rm -f "$PLIST_FILE"

echo ""
echo "✅ Service uninstalled successfully!"
echo ""
