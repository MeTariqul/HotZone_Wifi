#!/bin/sh
# Nodogsplash BinAuth script for voucher authentication
# Checks local DB first, then falls back to web API via GET

LOGFILE="/tmp/ndslog.log"
VOUCHER_DB="/etc/nodogsplash/vouchers.json"
API_BASE="http://192.168.1.121:3000/api/vouchers/verify"

log_msg() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') binauth: $1" >> "$LOGFILE"
}

extract_json_int() {
    echo "$1" | grep -o "\"$2\":[ ]*[0-9]*" | grep -o '[0-9]*'
}

if [ "$1" = "auth_client" ]; then
    CLIENT_MAC="$2"
    PASSWORD="$4"
    VOUCHER_CODE=$(echo "$PASSWORD" | tr 'a-z' 'A-Z' | tr -d ' ')

    log_msg "Auth request from $CLIENT_MAC voucher=$VOUCHER_CODE"

    if [ -z "$VOUCHER_CODE" ]; then
        log_msg "DENIED: Empty voucher"
        echo "0"
        exit 1
    fi

    DURATION=""
    DL=""
    UL=""

    # Check local database first
    if [ -f "$VOUCHER_DB" ]; then
        VOUCHER_LINE=$(grep "\"$VOUCHER_CODE\"" "$VOUCHER_DB" 2>/dev/null)
        if [ -n "$VOUCHER_LINE" ]; then
            echo "$VOUCHER_LINE" | grep -q '"used":true\|"used": true'
            if [ $? -ne 0 ]; then
                DURATION=$(extract_json_int "$VOUCHER_LINE" "duration")
                DL=$(extract_json_int "$VOUCHER_LINE" "dl")
                UL=$(extract_json_int "$VOUCHER_LINE" "ul")
                log_msg "Found locally: duration=$DURATION"
            fi
        fi
    fi

    # Fallback: check web API via GET if not found locally
    if [ -z "$DURATION" ]; then
        API_RESPONSE=$(wget -q -O - --timeout=5 "${API_BASE}?code=${VOUCHER_CODE}" 2>/dev/null)
        if [ -n "$API_RESPONSE" ]; then
            echo "$API_RESPONSE" | grep -q '"valid":true\|"valid": true'
            if [ $? -eq 0 ]; then
                DURATION=$(extract_json_int "$API_RESPONSE" "duration")
                DL=$(extract_json_int "$API_RESPONSE" "download")
                UL=$(extract_json_int "$API_RESPONSE" "upload")
                log_msg "Found via API: duration=$DURATION dl=$DL ul=$UL"

                # Cache in local database
                if [ -f "$VOUCHER_DB" ]; then
                    sed -i '$ s/}/,/' "$VOUCHER_DB"
                    echo "  \"$VOUCHER_CODE\": {\"plan\": \"synced\", \"duration\": $DURATION, \"dl\": $DL, \"ul\": $UL, \"used\": false}" >> "$VOUCHER_DB"
                    echo "}" >> "$VOUCHER_DB"
                fi
            else
                log_msg "API says invalid: $API_RESPONSE"
            fi
        else
            log_msg "WARN: API unreachable"
        fi
    fi

    # Deny if no valid voucher found
    if [ -z "$DURATION" ]; then
        log_msg "DENIED: Invalid voucher $VOUCHER_CODE"
        echo "0"
        exit 1
    fi

    # Mark as used in local database
    TIMESTAMP=$(date +%s)
    MAC_LOWER=$(echo "$CLIENT_MAC" | tr 'A-Z' 'a-z')
    if [ -f "$VOUCHER_DB" ]; then
        sed -i "s/\"$VOUCHER_CODE\".*\"used\": false/\"$VOUCHER_CODE\": {\"plan\": \"used\", \"duration\": $DURATION, \"dl\": $DL, \"ul\": $UL, \"used\": true, \"used_by\": \"$MAC_LOWER\", \"used_at\": $TIMESTAMP/" "$VOUCHER_DB" 2>/dev/null
    fi

    log_msg "ACCEPTED: $VOUCHER_CODE for $CLIENT_MAC duration=${DURATION}s dl=${DL}kbps ul=${UL}kbps"
    echo "$DURATION $UL $DL"
    exit 0
fi

# Handle deauth events - log only
if [ "$1" = "client_deauth" ] || [ "$1" = "idle_deauth" ] || [ "$1" = "timeout_deauth" ] || [ "$1" = "shutdown_deauth" ]; then
    log_msg "Deauth $1: $2 bytes_in=$3 bytes_out=$4"
    exit 0
fi

if [ "$1" = "ndsctl_auth" ] || [ "$1" = "ndsctl_deauth" ]; then
    log_msg "NDSCTL $1: $2"
    exit 0
fi

exit 0
