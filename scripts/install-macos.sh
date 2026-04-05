#!/bin/bash
# Install Kiro Proxy as a LaunchAgent (macOS)

set -e

SERVICE_NAME="com.kiro.proxy"
PLIST_FILE="$HOME/Library/LaunchAgents/${SERVICE_NAME}.plist"
INSTALL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE_PATH="$(which node)"

echo "Installing Kiro Proxy as macOS LaunchAgent..."
echo "Install directory: $INSTALL_DIR"
echo "Node path: $NODE_PATH"

# Create LaunchAgents directory if it doesn't exist
mkdir -p "$HOME/Library/LaunchAgents"

# Create plist file
cat > "$PLIST_FILE" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${SERVICE_NAME}</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>${NODE_PATH}</string>
        <string>${INSTALL_DIR}/server.js</string>
    </array>
    
    <key>WorkingDirectory</key>
    <string>${INSTALL_DIR}</string>
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>KeepAlive</key>
    <true/>
    
    <key>StandardOutPath</key>
    <string>${HOME}/Library/Logs/kiro-proxy.log</string>
    
    <key>StandardErrorPath</key>
    <string>${HOME}/Library/Logs/kiro-proxy-error.log</string>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>PORT</key>
        <string>3000</string>
        <!-- Uncomment to enable authentication -->
        <!-- <key>PROXY_API_KEY</key>
        <string>your-secret-key</string> -->
        <!-- Uncomment to enable rate limiting -->
        <!-- <key>RATE_LIMIT_ENABLED</key>
        <string>true</string> -->
    </dict>
</dict>
</plist>
EOF

# Load the service
launchctl load "$PLIST_FILE"

echo ""
echo "✅ Service installed successfully!"
echo ""
echo "Commands:"
echo "  Start:   launchctl start $SERVICE_NAME"
echo "  Stop:    launchctl stop $SERVICE_NAME"
echo "  Restart: launchctl stop $SERVICE_NAME && launchctl start $SERVICE_NAME"
echo "  Unload:  launchctl unload $PLIST_FILE"
echo ""
echo "Logs:"
echo "  Output:  tail -f ~/Library/Logs/kiro-proxy.log"
echo "  Errors:  tail -f ~/Library/Logs/kiro-proxy-error.log"
echo ""
echo "To configure environment variables, edit:"
echo "  $PLIST_FILE"
echo ""
