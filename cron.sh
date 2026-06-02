#!/bin/bash
# Bezar Daily Yield Cron Trigger
# This script securely pings the Next.js API to process the daily affiliate yields.
# It should be configured in your crontab to run at exactly 00:00:00 UTC every day.
#
# To install:
# 1. chmod +x cron.sh
# 2. crontab -e
# 3. Add: 0 0 * * * /path/to/bezar/cron.sh >> /var/log/bezar-cron.log 2>&1

API_URL="http://localhost:3000/api/cron/daily-yield"
CRON_SECRET="SUPER_SECRET_CRON_KEY_123" # Replace with your actual BEZAR_CRON_SECRET environment variable

echo "----------------------------------------"
echo "Starting Daily Yield Process: $(date -u)"
echo "----------------------------------------"

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$API_URL" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json")

HTTP_STATUS=$(echo "$RESPONSE" | tr -d '\n' | sed -e 's/.*HTTP_STATUS://')
BODY=$(echo "$RESPONSE" | sed -e 's/HTTP_STATUS\:.*//g')

if [ "$HTTP_STATUS" -eq 200 ]; then
  echo "SUCCESS: $BODY"
else
  echo "ERROR (Status $HTTP_STATUS): $BODY"
fi

echo "Finished at $(date -u)"
echo "----------------------------------------"
