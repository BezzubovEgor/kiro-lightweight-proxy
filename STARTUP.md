# Startup Service Installation

Automatically start Kiro Proxy on system boot.

## macOS (LaunchAgent)

### Install

```bash
cd kiro-lightweight-proxy
./scripts/install-macos.sh
```

The service will start automatically on login.

### Commands

```bash
# Start
launchctl start com.kiro.proxy

# Stop
launchctl stop com.kiro.proxy

# Restart
launchctl stop com.kiro.proxy && launchctl start com.kiro.proxy

# View logs
tail -f ~/Library/Logs/kiro-proxy.log
tail -f ~/Library/Logs/kiro-proxy-error.log
```

### Uninstall

```bash
./scripts/uninstall-macos.sh
```

### Configuration

Edit `~/Library/LaunchAgents/com.kiro.proxy.plist` to change environment variables:

```xml
<key>EnvironmentVariables</key>
<dict>
    <key>PORT</key>
    <string>3000</string>
    <key>PROXY_API_KEY</key>
    <string>your-secret-key</string>
    <key>RATE_LIMIT_ENABLED</key>
    <string>true</string>
</dict>
```

After editing, reload:
```bash
launchctl unload ~/Library/LaunchAgents/com.kiro.proxy.plist
launchctl load ~/Library/LaunchAgents/com.kiro.proxy.plist
```

---

## Linux (systemd)

### Install

```bash
cd kiro-lightweight-proxy
./scripts/install-linux.sh
```

The service will start automatically on boot.

### Commands

```bash
# Start
sudo systemctl start kiro-proxy

# Stop
sudo systemctl stop kiro-proxy

# Status
sudo systemctl status kiro-proxy

# View logs
sudo journalctl -u kiro-proxy -f

# Restart
sudo systemctl restart kiro-proxy
```

### Uninstall

```bash
./scripts/uninstall-linux.sh
```

### Configuration

Edit `/etc/systemd/system/kiro-proxy.service` to change environment variables:

```ini
[Service]
Environment="PORT=3000"
Environment="PROXY_API_KEY=your-secret-key"
Environment="RATE_LIMIT_ENABLED=true"
```

After editing, reload:
```bash
sudo systemctl daemon-reload
sudo systemctl restart kiro-proxy
```

---

## Windows (Windows Service)

### Install

Run PowerShell as Administrator:

```powershell
cd kiro-lightweight-proxy
.\scripts\install-windows.ps1
```

The service will start automatically on boot.

### Commands

```powershell
# Start
net start KiroProxy

# Stop
net stop KiroProxy

# Restart
net stop KiroProxy; net start KiroProxy

# Status
sc query KiroProxy

# View logs (Event Viewer)
eventvwr.msc
# Navigate to: Applications and Services Logs > KiroProxy
```

### Uninstall

Run PowerShell as Administrator:

```powershell
.\scripts\uninstall-windows.ps1
```

### Configuration

Edit the service script before installation or reinstall with new settings.

To change environment variables:
1. Uninstall the service
2. Edit `scripts/install-windows.ps1`
3. Modify the `env` array:
```javascript
env: [
  {
    name: 'PORT',
    value: '3000'
  },
  {
    name: 'PROXY_API_KEY',
    value: 'your-secret-key'
  },
  {
    name: 'RATE_LIMIT_ENABLED',
    value: 'true'
  }
]
```
4. Reinstall the service

---

## Notes

### Authentication Required

Before installing as a service, you must authenticate:

```bash
node server.js --login
```

The token is stored in `~/.kiro-proxy/token.json` and will be used by the service.

### Token Refresh

The service automatically refreshes tokens 5 minutes before expiry. No manual intervention needed.

### Logs Location

- **macOS:** `~/Library/Logs/kiro-proxy.log`
- **Linux:** `journalctl -u kiro-proxy`
- **Windows:** Event Viewer > Applications and Services Logs > KiroProxy

### Port Configuration

Default port is 3000. Change via environment variable `PORT`.

### Security

If exposing the proxy to network:
- Set `PROXY_API_KEY` for authentication
- Enable `RATE_LIMIT_ENABLED=true`
- Use firewall rules to restrict access
