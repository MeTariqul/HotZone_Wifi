#!/bin/sh
LOGFILE="/tmp/ndslog.log"
VOUCHER_DB="/etc/nodogsplash/vouchers.json"
API_BASE="https://hotzone-delta.vercel.app/api/vouchers/verify"

log_msg() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') binauth: $1" >> "$LOGFILE"
}

extract_json_int() {
    echo "$1" | grep -o "\"$2\":[ ]*[0-9]*" | grep -o '[0-9]*'
}

if [ "$1" = "auth_client" ]; then
    CLIENT_MAC="$2"
    CLIENT_IP="$3"
    PASSWORD="$4"
    VOUCHER_CODE=$(echo "$PASSWORD" | tr 'a-z' 'A-Z' | tr -d ' ')

    log_msg "Auth request from $CLIENT_MAC ($CLIENT_IP) voucher=$VOUCHER_CODE"

    if [ -z "$VOUCHER_CODE" ]; then
        log_msg "DENIED: Empty voucher"
        echo "0"
        exit 1
    fi
    # Validate code format before any grep/sed use: letters, digits, hyphen only
    case "$VOUCHER_CODE" in
        *[!A-Z0-9-]*)
            log_msg "DENIED: Malformed voucher input"
            echo "0"
            exit 1
            ;;
    esac

    DURATION=""
    DL=""
    UL=""
    PLAN=""

    # Check local cache first
    if [ -f "$VOUCHER_DB" ]; then
        VOUCHER_LINE=$(grep "\"$VOUCHER_CODE\"" "$VOUCHER_DB" 2>/dev/null)
        if [ -n "$VOUCHER_LINE" ]; then
            if ! echo "$VOUCHER_LINE" | grep -q '"used":true\|"used": true'; then
                DURATION=$(extract_json_int "$VOUCHER_LINE" "duration")
                DL=$(extract_json_int "$VOUCHER_LINE" "dl")
                UL=$(extract_json_int "$VOUCHER_LINE" "ul")
                log_msg "Found locally: duration=$DURATION dl=$DL ul=$UL"
            fi
        fi
    fi

    # Fallback: check Vercel API
    if [ -z "$DURATION" ]; then
        API_RESPONSE=$(wget -q -O - --timeout=10 --header="Content-Type: application/json" --post-data="{\"code\":\"$VOUCHER_CODE\"}" "$API_BASE" 2>/dev/null)
        if [ -n "$API_RESPONSE" ]; then
            if echo "$API_RESPONSE" | grep -q '"valid":true\|"valid": true'; then
                DURATION=$(extract_json_int "$API_RESPONSE" "duration")
                DL=$(extract_json_int "$API_RESPONSE" "download")
                UL=$(extract_json_int "$API_RESPONSE" "upload")
                PLAN=$(echo "$API_RESPONSE" | grep -o '"plan":"[^"]*"' | cut -d'"' -f4)
                log_msg "Found via Vercel API: plan=$PLAN duration=$DURATION dl=$DL ul=$UL"

                # Cache locally
                if [ ! -f "$VOUCHER_DB" ]; then
                    echo "{}" > "$VOUCHER_DB"
                fi
                sed -i '$ s/}/,/' "$VOUCHER_DB"
                echo "  \"$VOUCHER_CODE\": {\"plan\": \"$PLAN\", \"duration\": $DURATION, \"dl\": $DL, \"ul\": $UL, \"used\": false}" >> "$VOUCHER_DB"
                echo "}" >> "$VOUCHER_DB"
            else
                log_msg "Vercel says invalid: $API_RESPONSE"
            fi
        else
            log_msg "WARN: Vercel API unreachable"
        fi
    fi

    if [ -z "$DURATION" ]; then
        log_msg "DENIED: Invalid voucher $VOUCHER_CODE"
        echo "0"
        exit 1
    fi

    # Mark as used
    TIMESTAMP=$(date +%s)
    MAC_LOWER=$(echo "$CLIENT_MAC" | tr 'A-Z' 'a-z')
    if [ -f "$VOUCHER_DB" ]; then
        sed -i "s/\"$VOUCHER_CODE\".*\"used\": false/\"$VOUCHER_CODE\": {\"plan\": \"used\", \"duration\": $DURATION, \"dl\": $DL, \"ul\": $UL, \"used\": true, \"used_by\": \"$MAC_LOWER\", \"used_at\": $TIMESTAMP/" "$VOUCHER_DB" 2>/dev/null
    fi

    log_msg "ACCEPTED: $VOUCHER_CODE for $CLIENT_MAC duration=${DURATION}s dl=${DL}kbps ul=${UL}kbps"

    # Enforce plan bandwidth: shape this client to the voucher's dl/ul (tc via local CGI).
    # Internet is distributed only by the purchased plan — fail closed on error.
    SECRET=""
    [ -f /etc/hotspot.secret ] && \
        SECRET=$(grep '^ROUTER_SECRET=' /etc/hotspot.secret | head -n1 | cut -d= -f2- | tr -d '\r\n')
    if [ -n "$SECRET" ] && [ -n "$DL" ] && [ -n "$UL" ]; then
        body=$(printf '{"code":"%s","ip":"%s","mac":"%s","duration":%s,"download":%s,"upload":%s}' \
            "$VOUCHER_CODE" "$CLIENT_IP" "$CLIENT_MAC" "$DURATION" "$DL" "$UL")
        clen=$(printf '%s' "$body" | wc -c)
        clen=$(echo "$clen" | tr -d ' ')
        if printf '%s' "$body" | REQUEST_METHOD=POST QUERY_STRING='action=authorize' \
            CONTENT_LENGTH="$clen" HTTP_AUTHORIZATION="Bearer $SECRET" \
            sh /www/cgi-bin/hotspot 2>/dev/null | grep -q '"success":true'; then
            log_msg "QOS: plan limits applied for $CLIENT_IP dl=${DL} ul=${UL}"
        else
            log_msg "WARN: plan QoS apply failed for $CLIENT_IP"
        fi
    fi

    echo "$DURATION $UL $DL"
    exit 0
fi

if [ "$1" = "client_deauth" ] || [ "$1" = "idle_deauth" ] || [ "$1" = "timeout_deauth" ] || [ "$1" = "shutdown_deauth" ]; then
    log_msg "Deauth $1: $2 bytes_in=$3 bytes_out=$4"
    exit 0
fi

if [ "$1" = "ndsctl_auth" ] || [ "$1" = "ndsctl_deauth" ]; then
    log_msg "NDSCTL $1: $2"
    exit 0
fi

exit 0
