#!/bin/sh
# Apply HotZone NoDogSplash walled garden + IPv6 bypass block.
# Run on the OpenWrt router as root.

set -e

uci -q delete nodogsplash.@nodogsplash[0].preauthenticated_users
uci add_list nodogsplash.@nodogsplash[0].preauthenticated_users="allow udp port 53"
uci add_list nodogsplash.@nodogsplash[0].preauthenticated_users="allow tcp port 53"

# Vercel edge IPs for hotzone-delta.vercel.app — re-resolve if portal fails:
#   dig +short hotzone-delta.vercel.app
for ip in 64.29.17.3 64.29.17.67 64.29.17.131 64.29.17.195 \
          216.198.79.3 216.198.79.67 216.198.79.131 216.198.79.195 \
          76.76.21.112; do
  uci add_list nodogsplash.@nodogsplash[0].preauthenticated_users="allow tcp port 443 to $ip"
  uci add_list nodogsplash.@nodogsplash[0].preauthenticated_users="allow tcp port 80 to $ip"
done
uci commit nodogsplash

# IPv6 bypass block (NDS is IPv4-only)
uci set dhcp.lan.ra='disabled'
uci set dhcp.lan.dhcpv6='disabled'
uci commit dhcp
mkdir -p /usr/share/nftables.d/chain-pre/forward
cat > /usr/share/nftables.d/chain-pre/forward/90-drop-lan-ipv6.nft << 'EOF'
iifname "br-lan" meta nfproto ipv6 ip6 nexthdr != ipv6-icmp drop
EOF

# Drop fw4 rules that bypass the portal (match by name)
i=0
while uci -q get firewall.@rule[$i] >/dev/null 2>&1; do
  name=$(uci -q get firewall.@rule[$i].name || true)
  case "$name" in
    "Allow HTTPS Out"|"Allow DNS")
      uci -q delete firewall.@rule[$i]
      ;;
    *)
      i=$((i+1))
      ;;
  esac
done
uci commit firewall

fw4 reload
/etc/init.d/nodogsplash restart
/etc/init.d/nodogsplash enable

echo "Walled garden applied. Verify with:"
echo "  ndsctl status"
echo "  sed -n '/preauthenticated/,/^}/p' /tmp/etc/nodogsplash_cfg*.conf"
