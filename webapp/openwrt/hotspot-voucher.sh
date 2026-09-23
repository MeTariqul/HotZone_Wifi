#!/bin/sh
# OpenWrt Hotspot Voucher Integration
# Save as: /usr/bin/hotspot-voucher
# Make executable: chmod +x /usr/bin/hotspot-voucher

API_BASE="https://hotzone-delta.vercel.app"
API_KEY=$(uci -q get hotspot.main.api_key)
if [ -z "$API_KEY" ]; then
  echo "ERROR: hotspot.main.api_key not set" >&2
  exit 1
fi

verify_voucher() {
    local code="$1"
    local response
    
    response=$(wget -qO- --timeout=5 \
        --header="Content-Type: application/json" \
        --post-data="{\"code\":\"$code\"}" \
        "$API_BASE/api/vouchers/verify")
    
    echo "$response"
}

sync_vouchers() {
    local since="$1"
    local response
    
    response=$(wget -qO- --timeout=10 \
        --header="x-api-key: $API_KEY" \
        "$API_BASE/api/vouchers/sync?since=$since")
    
    echo "$response"
}

apply_voucher() {
    local code="$1"
    local mac="$2"
    local ip="$3"
    
    local result=$(verify_voucher "$code")
    
    # Parse JSON (requires jsonfilter or jq)
    local valid=$(echo "$result" | jsonfilter -e '@.valid')
    
    if [ "$valid" = "true" ]; then
        local duration=$(echo "$result" | jsonfilter -e '@.duration')
        local download=$(echo "$result" | jsonfilter -e '@.download')
        local upload=$(echo "$result" | jsonfilter -e '@.upload')
        local plan=$(echo "$result" | jsonfilter -e '@.plan')
        
        echo "Voucher valid: $plan (${duration}s, ${download}k/${upload}k)"
        
        # Mark voucher as used in local cache
        echo "$code $mac $ip $(date +%s) $duration $download $upload" >> /tmp/voucher_active.log
        
        # Apply bandwidth limits via tc (traffic control)
        apply_qos "$ip" "$download" "$upload"
        
        # Schedule cleanup after duration
        (sleep "$duration"; cleanup_voucher "$code" "$ip") &
        
        return 0
    else
        local error=$(echo "$result" | jsonfilter -e '@.error')
        echo "Voucher invalid: $error"
        return 1
    fi
}

apply_qos() {
    local ip="$1"
    local dl_kbps="$2"
    local ul_kbps="$3"
    
    # Convert kbps to bytes for tc
    local dl_rate=$((dl_kbps * 125))  # kbps -> bytes/s
    local ul_rate=$((ul_kbps * 125))
    
    # Simple HTB qdisc on br-lan (adjust interface as needed)
    tc qdisc add dev br-lan root handle 1: htb default 10 2>/dev/null
    tc class add dev br-lan parent 1: classid 1:1 htb rate 1000mbit 2>/dev/null
    
    # Create class for this client
    local class_id="1:$(echo $ip | cut -d. -f4)"
    tc class add dev br-lan parent 1:1 classid $class_id htb rate ${ul_rate}kbit ceil ${ul_rate}kbit
    tc filter add dev br-lan protocol ip parent 1:0 prio 1 u32 match ip dst $ip flowid $class_id
    
    # For download, use IFB (Intermediate Functional Block)
    modprobe ifb numifbs=1 2>/dev/null
    ip link set dev ifb0 up 2>/dev/null
    tc qdisc add dev ifb0 root handle 1: htb default 10 2>/dev/null
    tc class add dev ifb0 parent 1: classid 1:1 htb rate 1000mbit 2>/dev/null
    tc class add dev ifb0 parent 1:1 classid $class_id htb rate ${dl_rate}kbit ceil ${dl_rate}kbit
    tc filter add dev ifb0 protocol ip parent 1:0 prio 1 u32 match ip src $ip flowid $class_id
    
    # Redirect ingress to ifb0
    tc qdisc add dev br-lan ingress 2>/dev/null
    tc filter add dev br-lan parent ffff: protocol ip u32 match ip dst $ip action mirred egress redirect dev ifb0
}

cleanup_voucher() {
    local code="$1"
    local ip="$2"
    
    # Remove tc rules
    local class_id="1:$(echo $ip | cut -d. -f4)"
    tc filter del dev br-lan protocol ip parent 1:0 prio 1 u32 match ip dst $ip 2>/dev/null
    tc class del dev br-lan parent 1:1 classid $class_id 2>/dev/null
    tc filter del dev ifb0 protocol ip parent 1:0 prio 1 u32 match ip src $ip 2>/dev/null
    tc class del dev ifb0 parent 1:1 classid $class_id 2>/dev/null
    
    # Remove from active log
    sed -i "/^$code /d" /tmp/voucher_active.log 2>/dev/null
    
    echo "Voucher $code expired, cleaned up"
}

# Main
case "$1" in
    verify)
        verify_voucher "$2"
        ;;
    apply)
        apply_voucher "$2" "$3" "$4"
        ;;
    sync)
        sync_vouchers "$2"
        ;;
    cleanup)
        cleanup_voucher "$2" "$3"
        ;;
    *)
        echo "Usage: $0 {verify|apply|sync|cleanup} [args...]"
        echo "  verify <code>                    - Check voucher validity"
        echo "  apply <code> <mac> <ip>          - Apply voucher to client"
        echo "  sync <since_timestamp>           - Sync vouchers from server"
        echo "  cleanup <code> <ip>              - Manual cleanup"
        exit 1
        ;;
esac