# OpenWrt Hotspot Voucher Integration

## Overview
This integrates your OpenWrt router with the HotZone web app voucher system.

## Files

| File | Destination | Purpose |
|------|-------------|---------|
| `hotspot-voucher.sh` | `/usr/bin/hotspot-voucher` | Main voucher verification & QoS script |
| `hotspot.config` | `/etc/config/hotspot` | UCI configuration |
| `hotspot.lua` | `/usr/lib/lua/luci/controller/hotspot.lua` | LuCI controller for splash page |
| `splash.htm` | `/usr/lib/lua/luci/view/hotspot/splash.htm` | Splash page template |
| `hotspot-sync-daemon` | `/usr/bin/hotspot-sync-daemon` | Background voucher sync service |
| `hotspot-sync.init` | `/etc/init.d/hotspot-sync` | Init script for sync daemon |

## Installation

```bash
# 1. Copy files
scp openwrt/* root@router:/tmp/

# 2. On router, install
ssh root@router << 'EOF'
# Main script
mv /tmp/hotspot-voucher.sh /usr/bin/hotspot-voucher
chmod +x /usr/bin/hotspot-voucher

# UCI config
mv /tmp/hotspot.config /etc/config/hotspot

# LuCI controller
mkdir -p /usr/lib/lua/luci/controller
mv /tmp/hotspot.lua /usr/lib/lua/luci/controller/hotspot.lua

# Splash page template
mkdir -p /usr/lib/lua/luci/view/hotspot
mv /tmp/splash.htm /usr/lib/lua/luci/view/hotspot/splash.htm

# Sync daemon
mv /tmp/hotspot-sync-daemon /usr/bin/hotspot-sync-daemon
chmod +x /usr/bin/hotspot-sync-daemon

# Init script
mv /tmp/hotspot-sync.init /etc/init.d/hotspot-sync
chmod +x /etc/init.d/hotspot-sync

# Install dependencies
opkg update
opkg install wget jsonfilter tc kmod-ifb iptables-mod-u32

# Configure
uci set hotspot.main.api_base="https://YOUR-VERCEL-APP.vercel.app"
uci set hotspot.main.api_key="your-sync-api-key"
uci set hotspot.main.sync_interval="300"
uci set hotspot.main.status_interval="15"
uci commit hotspot

# Enable services
/etc/init.d/hotspot-sync enable
/etc/init.d/hotspot-sync start

# Clear LuCI cache
rm -f /tmp/luci-*
EOF
```

## Firewall / Captive Portal Setup

```bash
# Redirect HTTP to splash page (port 80 -> 8080)
uci add firewall redirect
uci set firewall.@redirect[-1].name='Hotspot Portal'
uci set firewall.@redirect[-1].src='lan'
uci set firewall.@redirect[-1].src_dport='80'
uci set firewall.@redirect[-1].dest_port='8080'
uci set firewall.@redirect[-1].proto='tcp'
uci set firewall.@redirect[-1].target='DNAT'
uci set firewall.@redirect[-1].dest_ip='192.168.1.1'  # router LAN IP

# Allow access to API before auth
uci add firewall rule
uci set firewall.@rule[-1].name='Allow Hotspot API'
uci set firewall.@rule[-1].src='lan'
uci set firewall.@rule[-1].dest='wan'
uci set firewall.@rule[-1].dest_port='443'
uci set firewall.@rule[-1].proto='tcp'
uci set firewall.@rule[-1].target='ACCEPT'

# Allow DNS
uci add firewall rule
uci set firewall.@rule[-1].name='Allow DNS'
uci set firewall.@rule[-1].src='lan'
uci set firewall.@rule[-1].proto='udp'
uci set firewall.@rule[-1].dest_port='53'
uci set firewall.@rule[-1].target='ACCEPT'

uci commit firewall
/etc/init.d/firewall restart
```

## uhttpd Configuration (for splash page on port 8080)

```bash
uci set uhttpd.hotspot=uhttpd
uci set uhttpd.hotspot.listen_http='0.0.0.0:8080'
uci set uhttpd.hotspot.home='/www/hotspot'
uci set uhttpd.hotspot.lua_prefix='/cgi-bin/luci'
uci set uhttpd.hotspot.lua_handler='luci.dispatcher'
uci commit uhttpd
/etc/init.d/uhttpd restart
```

## Testing

```bash
# Test voucher verification
hotspot-voucher verify T-ABCD-EFGH

# Test applying voucher (replace with real client MAC/IP)
hotspot-voucher apply T-ABCD-EFGH aa:bb:cc:dd:ee:ff 192.168.1.100

# Manual sync
hotspot-voucher sync 0

# View active vouchers
cat /tmp/voucher_active.log

# Check sync daemon log
tail -f /var/log/hotspot.log
```

## How It Works

1. **Client connects** → Redirected to `http://router:8080/cgi-bin/luci/hotspot`
2. **Enters voucher** → POST to `/hotspot/login` → Calls web app `/api/vouchers/verify`
3. **On success** → Browser authorizes the router directly (`/cgi-bin/hotspot?authorize`); if that fails, `/api/vouchers/authorize` queues the command
4. **Background sync** → `hotspot-sync-daemon`:
   - Pulls new vouchers from `/api/vouchers/sync` every `sync_interval` (default 300s)
   - Pushes status/clients/active to `/api/router/sync` every `status_interval` (default 15s)
   - Receives queued admin commands (kick/block/unblock/authorize) and runs them locally
5. **Admin dashboard** → Reads the last snapshot from the DB (no inbound connection to the router)

Vercel does **not** need `ROUTER_URL` / `ROUTER_SECRET` for admin status. Splash still uses `ROUTER_SECRET` only as a Bearer value when the captive-portal browser talks to the router.

## Customization

Edit `/etc/config/hotspot`:
```bash
uci set hotspot.main.api_base="https://your-app.vercel.app"
uci set hotspot.qos.default_download="10240"
uci commit hotspot
```