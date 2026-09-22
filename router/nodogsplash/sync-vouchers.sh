#!/bin/sh
# Voucher sync script - fetches vouchers from web portal API
# Run via cron every 5 minutes

API_URL="http://192.168.1.121:3000/api/vouchers/sync"
API_KEY="tarif-hotspot-2024"
VOUCHER_DB="/etc/nodogsplash/vouchers.json"
LOGFILE="/tmp/ndslog.log"
LOCKFILE="/tmp/voucher_sync.lock"
STATE_FILE="/tmp/voucher_sync_ts"

log_msg() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') sync: $1" >> "$LOGFILE"
}

# Prevent concurrent runs
if [ -f "$LOCKFILE" ]; then
    LOCK_PID=$(cat "$LOCKFILE" 2>/dev/null)
    if [ -n "$LOCK_PID" ] && kill -0 "$LOCK_PID" 2>/dev/null; then
        exit 0
    fi
fi
echo $$ > "$LOCKFILE"
trap "rm -f $LOCKFILE" EXIT

# Create empty database if missing
if [ ! -f "$VOUCHER_DB" ]; then
    echo "{}" > "$VOUCHER_DB"
fi

# Get last sync timestamp
SINCE=0
if [ -f "$STATE_FILE" ]; then
    SINCE=$(cat "$STATE_FILE" 2>/dev/null)
fi

# Fetch new vouchers from API
RESPONSE=$(wget -q -O - --timeout=10 "${API_URL}?key=${API_KEY}&since=${SINCE}" 2>/dev/null)

if [ -z "$RESPONSE" ]; then
    log_msg "WARN: No response from API"
    exit 0
fi

# Check if response contains vouchers
echo "$RESPONSE" | grep -q '"code"'
if [ $? -ne 0 ]; then
    log_msg "WARN: No new vouchers or invalid response"
    # Save the timestamp even if no new vouchers
    NEW_TS=$(echo "$RESPONSE" | grep -o '"timestamp": [0-9]*' | grep -o '[0-9]*')
    if [ -n "$NEW_TS" ]; then
        echo "$NEW_TS" > "$STATE_FILE"
    fi
    exit 0
fi

# Extract new timestamp
NEW_TS=$(echo "$RESPONSE" | grep -o '"timestamp": [0-9]*' | grep -o '[0-9]*')

# Save current vouchers to temp file, add new ones, replace original
TMPFILE="/tmp/vouchers_new.json"

# Start with existing vouchers (without closing brace)
head -n -1 "$VOUCHER_DB" > "$TMPFILE"

# Count existing vouchers to determine if we need a comma
EXISTING=$(grep -c '"plan"' "$VOUCHER_DB" 2>/dev/null)
if [ "$EXISTING" -eq 0 ]; then
    EXISTING=0
fi

# Extract and add each voucher from response
# Parse vouchers array - find each voucher block
ADDED=0
echo "$RESPONSE" | grep -o '{[^}]*}' | while read -r VOUCHER_BLOCK; do
    CODE=$(echo "$VOUCHER_BLOCK" | grep -o '"code": "[^"]*"' | cut -d'"' -f4)
    PLAN=$(echo "$VOUCHER_BLOCK" | grep -o '"plan": "[^"]*"' | cut -d'"' -f4)
    DURATION=$(echo "$VOUCHER_BLOCK" | grep -o '"duration": [0-9]*' | grep -o '[0-9]*')
    DL=$(echo "$VOUCHER_BLOCK" | grep -o '"dl": [0-9]*' | grep -o '[0-9]*')
    UL=$(echo "$VOUCHER_BLOCK" | grep -o '"ul": [0-9]*' | grep -o '[0-9]*')

    if [ -n "$CODE" ] && [ -n "$DURATION" ]; then
        # Check if already exists in the original database
        grep -q "\"$CODE\"" "$VOUCHER_DB" 2>/dev/null
        if [ $? -ne 0 ]; then
            # Add comma if needed
            if [ "$EXISTING" -gt 0 ] || [ "$ADDED" -gt 0 ]; then
                echo "," >> "$TMPFILE"
            fi
            echo "  \"$CODE\": {\"plan\": \"$PLAN\", \"duration\": $DURATION, \"dl\": $DL, \"ul\": $UL, \"used\": false}" >> "$TMPFILE"
            ADDED=$((ADDED + 1))
        fi
    fi
done

# Close JSON
echo "" >> "$TMPFILE"
echo "}" >> "$TMPFILE"

# Replace original if we added something
if [ "$ADDED" -gt 0 ]; then
    mv "$TMPFILE" "$VOUCHER_DB"
    log_msg "Synced $ADDED new vouchers"
else
    rm -f "$TMPFILE"
fi

# Save sync timestamp
if [ -n "$NEW_TS" ]; then
    echo "$NEW_TS" > "$STATE_FILE"
fi
