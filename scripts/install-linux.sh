#!/bin/bash
# Install Kiro Proxy as a systemd service (Linux)

set -e

SERVICE_NAME="kiro-proxy"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
INSTALL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE_PATH="$(which node)"
USER="$(whoami)"

echo "Installing Kiro Proxy as systemd service..."
echo "Install directory: $INSTALL_DIR"
echo "Node path: $NODE_PATH"
echo "Running as user: $USER"

# Create systemd service file
sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=Kiro Lightweight Proxy
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR
ExecStart=$NODE_PATH $INSTALL_DIR/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=kiro-proxy

# Environment variables (optional)
# Environment="PORT=3000"
# Environment="PROXY_API_KEY=your-secret-key"
# Environment="RATE_LIMIT_ENABLED=true"

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
sudo systemctl daemon-reload

# Enable service
sudo systemctl enable "$SERVICE_NAME"

echo ""
echo "✅ Service installed successfully!"
echo ""
echo "Commands:"
echo "  Start:   sudo systemctl start $SERVICE_NAME"
echo "  Stop:    sudo systemctl stop $SERVICE_NAME"
echo "  Status:  sudo systemctl status $SERVICE_NAME"
echo "  Logs:    sudo journalctl -u $SERVICE_NAME -f"
echo "  Restart: sudo systemctl restart $SERVICE_NAME"
echo ""
echo "To configure environment variables, edit:"
echo "  $SERVICE_FILE"
echo ""
