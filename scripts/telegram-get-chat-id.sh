#!/usr/bin/env bash
# Find your Telegram chat_id after you send /start to your bot in Telegram.
set -euo pipefail

PROPS="${1:-src/main/resources/application-local.properties}"
TOKEN=$(grep 'telegram.bot.token' "$PROPS" | cut -d= -f2- | tr -d '\r')

if [[ -z "${TOKEN}" ]]; then
  echo "Set telegram.bot.token in ${PROPS}"
  exit 1
fi

echo "1. Open Telegram and send /start to your bot"
echo "2. Press Enter here after you have sent /start"
read -r _

curl -s "https://api.telegram.org/bot${TOKEN}/getUpdates" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if not d.get('ok'):
    print(d)
    sys.exit(1)
results = d.get('result', [])
if not results:
    print('No messages yet. Send /start to your bot and run again.')
    sys.exit(1)
for u in results:
    msg = u.get('message') or u.get('edited_message') or {}
    chat = msg.get('chat', {})
    if chat.get('id'):
        print('chat_id=', chat['id'], '  #', chat.get('type'), chat.get('username') or chat.get('first_name',''))
"
