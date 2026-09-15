#!/usr/bin/env bash
# LC Connect watchdog: every 5 min run the FULL login flow through the public URL
# (register-once → /authorize with PKCE → /token → /mcp initialize → whoami).
# On failure: restart the failing layer (ngrok if local is fine, node otherwise), alert via Pushover
# once per incident, alert again on recovery. Installed as user timer lc-watchdog.timer.
set -uo pipefail
APP=/home/bogdan/Desktop/Projects/laser_components/lc-connect
ENVF=$APP/deploy/watchdog.env; STATE=$APP/deploy/watchdog.state; LOG=$APP/deploy/watchdog.log
exec 9>"$APP/deploy/watchdog.lock"; flock -n 9 || exit 0
set -a; . "$ENVF"; set +a
RU="https://claude.ai/api/mcp/auth_callback"; RUENC=$(python3 -c "import urllib.parse;print(urllib.parse.quote('$RU',safe=''))")
log(){ echo "$(date -Is) $*" >>"$LOG"; }
push(){ curl -s -m 10 -F "token=$PUSHOVER_APP_TOKEN" -F "user=$PUSHOVER_USER_KEY" -F "title=LC Connect" -F "message=$1" -F "priority=${2:-0}" https://api.pushover.net/1/messages.json >/dev/null 2>&1 || true; }
fails=0; alerted=0; [ -f "$STATE" ] && . "$STATE"
save(){ printf 'fails=%s\nalerted=%s\n' "$fails" "$alerted" >"$STATE"; }
setcid(){ sed -i "s|^WATCHDOG_CLIENT_ID=.*|WATCHDOG_CLIENT_ID=$1|" "$ENVF"; WATCHDOG_CLIENT_ID=$1; }
register(){ curl -s -m 15 -X POST "$PUBLIC_URL/register" -H 'Content-Type: application/json' -d "{\"client_name\":\"lc-watchdog\",\"redirect_uris\":[\"$RU\"]}" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("client_id",""))' 2>/dev/null; }
flow(){  # prints the failing step name, or "ok"
  local h; h=$(curl -s -m 15 -o /dev/null -w '%{http_code}' "$PUBLIC_URL/health"); [ "$h" = 200 ] || { echo "public-health:$h"; return; }
  [ -n "${WATCHDOG_CLIENT_ID:-}" ] || setcid "$(register)"
  local a; a=$(curl -s -m 15 -o /dev/null -w '%{http_code}' "$PUBLIC_URL/authorize?response_type=code&client_id=$WATCHDOG_CLIENT_ID&redirect_uri=$RUENC&state=w")
  if [ "$a" = 400 ]; then setcid "$(register)"; a=$(curl -s -m 15 -o /dev/null -w '%{http_code}' "$PUBLIC_URL/authorize?response_type=code&client_id=$WATCHDOG_CLIENT_ID&redirect_uri=$RUENC&state=w"); fi
  [ "$a" = 200 ] || { echo "authorize-form:$a"; return; }
  eval "$(python3 -c "
import base64,hashlib,os
v=base64.urlsafe_b64encode(os.urandom(32)).rstrip(b'=').decode();c=base64.urlsafe_b64encode(hashlib.sha256(v.encode()).digest()).rstrip(b'=').decode()
print(f'V={v}');print(f'C={c}')")"
  local loc; loc=$(curl -s -m 20 -o /dev/null -w '%{http_code} %{redirect_url}' -X POST "$PUBLIC_URL/authorize" --data-urlencode "client_id=$WATCHDOG_CLIENT_ID" --data-urlencode "redirect_uri=$RU" --data-urlencode "state=w" --data-urlencode "code_challenge=$C" --data-urlencode "code_challenge_method=S256" --data-urlencode "email=$WATCHDOG_EMAIL" --data-urlencode "password=$WATCHDOG_PASSWORD")
  [ "${loc%% *}" = 302 ] || { echo "login:${loc%% *}"; return; }
  local code; code=$(python3 -c "import urllib.parse,sys;print(urllib.parse.parse_qs(urllib.parse.urlparse(sys.argv[1]).query).get('code',[''])[0])" "${loc#* }")
  local tok; tok=$(curl -s -m 15 -X POST "$PUBLIC_URL/token" -H 'Content-Type: application/x-www-form-urlencoded' --data-urlencode "grant_type=authorization_code" --data-urlencode "code=$code" --data-urlencode "client_id=$WATCHDOG_CLIENT_ID" --data-urlencode "redirect_uri=$RU" --data-urlencode "code_verifier=$V" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("access_token",""))' 2>/dev/null)
  [ -n "$tok" ] || { echo "token"; return; }
  local who; who=$(curl -s -m 20 -X POST "$PUBLIC_URL/mcp" -H "Authorization: Bearer $tok" -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"whoami","arguments":{}}}')
  echo "$who" | grep -q "$WATCHDOG_EMAIL" || { echo "whoami"; return; }
  echo ok
}
r=$(flow)
if [ "$r" = ok ]; then
  if [ "$fails" -gt 0 ]; then log "RECOVERED after $fails failure(s)"; [ "$alerted" = 1 ] && push "Recovered: full login flow OK again." 0; fi
  fails=0; alerted=0; save; exit 0
fi
fails=$((fails+1)); log "FAIL #$fails step=$r"
local_ok=$(curl -s -m 5 -o /dev/null -w '%{http_code}' "$LOCAL_URL/health")
if [ "$local_ok" = 200 ]; then action="restart ngrok"; sudo -n systemctl restart ngrok.service; else action="restart lc-connect"; systemctl --user restart lc-connect.service; fi
log "action: $action (local health=$local_ok)"
if [ "$alerted" = 0 ] && [ "$fails" -ge 2 ]; then push "DOWN: step '$r' failed ${fails}x. Did: $action. Local health=$local_ok." 1; alerted=1; fi
save
