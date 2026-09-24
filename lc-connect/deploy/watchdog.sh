#!/usr/bin/env bash
# LC Connect watchdog — driven by lc-watchdog.timer every 5 min. Two checks, two cadences:
#  a) LOCAL full login flow every run against $LOCAL_URL (register-once → /authorize with PKCE → /token →
#     /mcp whoami). Zero ngrok requests. Fail → restart lc-connect.service (≤1 per 30 min);
#     Pushover after 2 consecutive failures (once per incident) + recovery message.
#  c) OAUTH REJECTIONS every run: count `oauth-rejected` lines in server.log from the last 10 min with
#     reason unknown_client|redirect_mismatch (a connector locked out). >0 → Pushover, max once per hour.
#     Reads the local log only — no requests.
#  b) PUBLIC probe every 30 min: ONE GET $PUBLIC_URL/health (≤1,500 ngrok requests/month).
#     200 ok | 403 (ERR_NGROK_xxxx = account limit/billing) → alert only, never restart |
#     000/502/404 with local healthy → restart ngrok.service (≤1 per 30 min, ≤3 per 6 h, then alert only) |
#     other 5xx / anything else → alert only. Recovery alert on return to 200.
# Flags: --dry-run (print decisions; no restarts, no alerts, no state writes)
#        --public-now (force the public probe this run). See README-watchdog.md.
set -uo pipefail
APP=/home/bogdan/Desktop/Projects/laser_components/lc-connect
D=$APP/deploy
ENVF=$D/watchdog.env; STATE=$D/watchdog.state; LOG=$D/watchdog.log
TS_PUBLIC=$D/watchdog.public_probe.ts      # last public probe (epoch)
TS_LOCAL_RESTART=$D/watchdog.local_restart.ts  # last lc-connect restart (epoch)
TS_NGROK_RESTART=$D/watchdog.ngrok_restart.ts  # last ngrok restart (epoch)
NGROK_RESTARTS=$D/watchdog.ngrok_restarts  # one epoch per ngrok restart (6-h cap counter)
PUBLIC_EVERY=1740        # 30 min minus timer jitter slack
RESTART_GAP=1800         # min seconds between restarts of the same layer
NGROK_CAP=3; NGROK_WINDOW=21600
SERVER_LOG=$APP/server.log
TS_REJ_ALERT=$D/watchdog.rejections_alert.ts  # last oauth-rejection alert (epoch)
REJ_WINDOW=600; REJ_ALERT_GAP=3600

DRY=0; PUBLIC_NOW=0
for a in "$@"; do case "$a" in
  --dry-run) DRY=1;; --public-now) PUBLIC_NOW=1;;
  *) echo "usage: $0 [--dry-run] [--public-now]" >&2; exit 2;; esac; done

exec 9>"$D/watchdog.lock"; flock -n 9 || { [ "$DRY" = 1 ] && echo "another watchdog run holds the lock"; exit 0; }
set -a; . "$ENVF"; set +a
RU="https://claude.ai/api/mcp/auth_callback"; RUENC=$(python3 -c "import urllib.parse;print(urllib.parse.quote('$RU',safe=''))")
NOW=$(date +%s)

log(){ if [ "$DRY" = 1 ]; then echo "$(date -Is) [dry-run] $*"; else echo "$(date -Is) $*" >>"$LOG"; fi; }
push(){  # push <message> [priority]
  if [ "$DRY" = 1 ]; then echo "$(date -Is) [dry-run] would Pushover (priority ${2:-0}): $1"; return; fi
  curl -s -m 10 -F "token=$PUSHOVER_APP_TOKEN" -F "user=$PUSHOVER_USER_KEY" -F "title=LC Connect" -F "message=$1" -F "priority=${2:-0}" https://api.pushover.net/1/messages.json >/dev/null 2>&1 || true
  log "pushover sent (priority ${2:-0}): $1"; }
rd(){ [ -f "$1" ] && head -c 32 "$1" | tr -dc 0-9 || true; }   # read epoch file ("" if none)
wr(){ [ "$DRY" = 1 ] || echo "$2" >"$1"; }

# --- state (local: fails/alerted; public: pub_*) ---
fails=0; alerted=0; pub_fails=0; pub_alerted=0; pub_key=""
if [ -f "$STATE" ]; then
  . "$STATE"
  # Migrate pre-split state: old counters came from the public-URL flow; move them to the public side and
  # clear pub_key so the first run sends one correctly-worded alert.
  grep -q '^pub_alerted=' "$STATE" || { pub_fails=$fails; pub_alerted=$alerted; pub_key=""; fails=0; alerted=0; }
fi
save(){ [ "$DRY" = 1 ] || printf 'fails=%s\nalerted=%s\npub_fails=%s\npub_alerted=%s\npub_key=%s\n' \
  "$fails" "$alerted" "$pub_fails" "$pub_alerted" "$pub_key" >"$STATE"; }

# --- a) local full flow ---
setcid(){ sed -i "s|^WATCHDOG_CLIENT_ID=.*|WATCHDOG_CLIENT_ID=$1|" "$ENVF"; WATCHDOG_CLIENT_ID=$1; }
register(){ curl -s -m 15 -X POST "$LOCAL_URL/register" -H 'Content-Type: application/json' -d "{\"client_name\":\"lc-watchdog\",\"redirect_uris\":[\"$RU\"]}" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("client_id",""))' 2>/dev/null; }
flow(){  # prints the failing step name, or "ok"
  local B=$LOCAL_URL h a loc code tok who
  h=$(curl -s -m 15 -o /dev/null -w '%{http_code}' "$B/health"); [ "$h" = 200 ] || { echo "local-health:$h"; return; }
  [ -n "${WATCHDOG_CLIENT_ID:-}" ] || setcid "$(register)"
  a=$(curl -s -m 15 -o /dev/null -w '%{http_code}' "$B/authorize?response_type=code&client_id=$WATCHDOG_CLIENT_ID&redirect_uri=$RUENC&state=w")
  if [ "$a" = 400 ]; then setcid "$(register)"; a=$(curl -s -m 15 -o /dev/null -w '%{http_code}' "$B/authorize?response_type=code&client_id=$WATCHDOG_CLIENT_ID&redirect_uri=$RUENC&state=w"); fi
  [ "$a" = 200 ] || { echo "authorize-form:$a"; return; }
  eval "$(python3 -c "
import base64,hashlib,os
v=base64.urlsafe_b64encode(os.urandom(32)).rstrip(b'=').decode();c=base64.urlsafe_b64encode(hashlib.sha256(v.encode()).digest()).rstrip(b'=').decode()
print(f'V={v}');print(f'C={c}')")"
  loc=$(curl -s -m 20 -o /dev/null -w '%{http_code} %{redirect_url}' -X POST "$B/authorize" --data-urlencode "client_id=$WATCHDOG_CLIENT_ID" --data-urlencode "redirect_uri=$RU" --data-urlencode "state=w" --data-urlencode "code_challenge=$C" --data-urlencode "code_challenge_method=S256" --data-urlencode "email=$WATCHDOG_EMAIL" --data-urlencode "password=$WATCHDOG_PASSWORD")
  [ "${loc%% *}" = 302 ] || { echo "login:${loc%% *}"; return; }
  code=$(python3 -c "import urllib.parse,sys;print(urllib.parse.parse_qs(urllib.parse.urlparse(sys.argv[1]).query).get('code',[''])[0])" "${loc#* }")
  tok=$(curl -s -m 15 -X POST "$B/token" -H 'Content-Type: application/x-www-form-urlencoded' --data-urlencode "grant_type=authorization_code" --data-urlencode "code=$code" --data-urlencode "client_id=$WATCHDOG_CLIENT_ID" --data-urlencode "redirect_uri=$RU" --data-urlencode "code_verifier=$V" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("access_token",""))' 2>/dev/null)
  [ -n "$tok" ] || { echo "token"; return; }
  who=$(curl -s -m 20 -X POST "$B/mcp" -H "Authorization: Bearer $tok" -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"whoami","arguments":{}}}')
  echo "$who" | grep -q "$WATCHDOG_EMAIL" || { echo "whoami"; return; }
  echo ok
}

r=$(flow); local_ok=0
if [ "$r" = ok ]; then
  local_ok=1; log "local flow OK"
  if [ "$fails" -gt 0 ]; then log "local RECOVERED after $fails failure(s)"; [ "$alerted" = 1 ] && push "Recovered: local login flow OK again." 0; fi
  fails=0; alerted=0
else
  fails=$((fails+1)); log "local FAIL #$fails step=$r"
  last=$(rd "$TS_LOCAL_RESTART"); last=${last:-0}
  if [ $((NOW-last)) -ge $RESTART_GAP ]; then
    action="restart lc-connect"
    if [ "$DRY" = 1 ]; then log "would restart lc-connect.service"
    else systemctl --user restart lc-connect.service; wr "$TS_LOCAL_RESTART" "$NOW"; log "action: restarted lc-connect.service"; fi
  else action="none (lc-connect restarted $(( (NOW-last)/60 )) min ago, limit 1/30 min)"; log "action: $action"; fi
  if [ "$alerted" = 0 ] && [ "$fails" -ge 2 ]; then push "DOWN (local): step '$r' failed ${fails}x. Did: $action." 1; [ "$DRY" = 1 ] || alerted=1; fi
fi

# --- c) OAuth rejections that lock a connector out (server.log, last 10 min) ---
# Scans only the log tail (≤5 MB); pino time is ISO UTC. Prints "<count> <endpoint:reason xN, ...>".
rej=$(python3 - "$SERVER_LOG" "$REJ_WINDOW" <<'PY' 2>/dev/null
import sys, json, time, datetime, collections
path, win = sys.argv[1], int(sys.argv[2]); cutoff = time.time() - win; cnt = collections.Counter()
try:
    with open(path, "rb") as f:
        f.seek(0, 2); f.seek(max(0, f.tell() - 5_000_000)); data = f.read().decode("utf-8", "replace")
except OSError:
    data = ""
for line in data.splitlines():
    if '"oauth-rejected"' not in line: continue
    try: o = json.loads(line)
    except ValueError: continue
    if o.get("evt") != "oauth-rejected" or o.get("reason") not in ("unknown_client", "redirect_mismatch"): continue
    try: t = datetime.datetime.fromisoformat(str(o.get("time", "")).replace("Z", "+00:00")).timestamp()
    except ValueError: continue
    if t >= cutoff: cnt[f"{o.get('endpoint', '?')}:{o['reason']}"] += 1
print(sum(cnt.values()), ", ".join(f"{k} x{v}" for k, v in cnt.most_common()))
PY
); rej=${rej:-0}
rej_n=${rej%% *}; rej_why=${rej#* }
if [ "${rej_n:-0}" -gt 0 ] 2>/dev/null; then
  log "oauth rejections (last 10 min): $rej_n — $rej_why"
  lastr=$(rd "$TS_REJ_ALERT"); lastr=${lastr:-0}
  if [ $((NOW-lastr)) -ge $REJ_ALERT_GAP ]; then
    push "OAuth rejections in last 10 min: $rej_n ($rej_why). A connector may be locked out — check server.log for evt oauth-rejected." 0
    wr "$TS_REJ_ALERT" "$NOW"
  else log "oauth rejection alert suppressed (last alert $(( (NOW-lastr)/60 )) min ago, max 1/h)"; fi
fi

# --- b) public probe (every 30 min) ---
lastp=$(rd "$TS_PUBLIC"); lastp=${lastp:-0}
if [ "$PUBLIC_NOW" = 1 ] || [ $((NOW-lastp)) -ge $PUBLIC_EVERY ]; then
  wr "$TS_PUBLIC" "$NOW"
  body=$(mktemp); trap 'rm -f "$body"' EXIT
  st=$(curl -s -m 15 -o "$body" -w '%{http_code}' "$PUBLIC_URL/health"); st=${st:-000}
  ecode=$(grep -aoE 'ERR_NGROK_[0-9]+' "$body" | head -1 || true)
  desc="HTTP $st${ecode:+ $ecode}"
  if [ "$st" = 200 ]; then
    log "public probe OK (200)"
    if [ "$pub_fails" -gt 0 ]; then log "public RECOVERED after $pub_fails failed probe(s)"; [ "$pub_alerted" = 1 ] && push "Recovered: public URL $PUBLIC_URL/health returns 200 again." 0; fi
    pub_fails=0; pub_alerted=0; pub_key=""
  else
    pub_fails=$((pub_fails+1)); log "public probe FAIL #$pub_fails: $desc"
    alert_now=0; msg=""
    case "$st" in
      403)
        # Tunnel check (item 2): agent up + our tunnel listed ⇒ account issue, not an agent issue.
        tun=$(curl -s -m 5 http://127.0.0.1:4040/api/tunnels | python3 -c 'import sys,json
try: ts=json.load(sys.stdin).get("tunnels",[])
except Exception: ts=[]
print("listed" if any("lasercomponents" in t.get("public_url","") and t.get("config",{}).get("addr","").endswith("localhost:3003") for t in ts) else "absent")' 2>/dev/null)
        log "decision: no restart (403 = ngrok account limit; agent tunnel ${tun:-absent})"
        [ "$DRY" = 1 ] && echo "$(date -Is) [dry-run] public 403 ${ecode:-no ERR code} → would alert, no restart"
        msg="PUBLIC 403 ${ecode:-(no ERR_NGROK code)}: ngrok account limit — top up at dashboard.ngrok.com; no restart attempted. Local flow: $([ $local_ok = 1 ] && echo OK || echo FAIL)."
        alert_now=1 ;;
      000|502|404)
        if [ "$local_ok" != 1 ]; then
          log "decision: no ngrok restart (local flow failing — lc-connect is the problem)"
          msg="PUBLIC $desc and local flow failing (step $r)."; [ "$pub_fails" -ge 2 ] && alert_now=1
        else
          lastn=$(rd "$TS_NGROK_RESTART"); lastn=${lastn:-0}
          recent=0; [ -f "$NGROK_RESTARTS" ] && recent=$(awk -v n="$NOW" -v w=$NGROK_WINDOW '$1+0>n-w' "$NGROK_RESTARTS" | wc -l)
          if [ "$recent" -ge $NGROK_CAP ]; then
            log "decision: no restart (cap: $recent ngrok restarts in last 6 h)"
            msg="PUBLIC $desc, local OK. ngrok restart cap reached ($recent/6 h) — alert only, check manually."; alert_now=1
          elif [ $((NOW-lastn)) -lt $RESTART_GAP ]; then
            log "decision: no restart (ngrok restarted $(( (NOW-lastn)/60 )) min ago, limit 1/30 min)"
            msg="PUBLIC $desc, local OK; ngrok restarted recently, waiting."; [ "$pub_fails" -ge 2 ] && alert_now=1
          elif [ "$DRY" = 1 ]; then log "would restart ngrok.service ($((recent+1))/$NGROK_CAP in 6 h)"
            msg="PUBLIC $desc, local OK. Restarted ngrok."; [ "$pub_fails" -ge 2 ] && alert_now=1
          else
            sudo -n systemctl restart ngrok.service; rc=$?
            wr "$TS_NGROK_RESTART" "$NOW"; echo "$NOW" >>"$NGROK_RESTARTS"
            awk -v n="$NOW" -v w=$NGROK_WINDOW '$1+0>n-w' "$NGROK_RESTARTS" >"$NGROK_RESTARTS.tmp" && mv "$NGROK_RESTARTS.tmp" "$NGROK_RESTARTS"
            log "action: restarted ngrok.service (rc=$rc, $((recent+1))/$NGROK_CAP in 6 h)"
            msg="PUBLIC $desc, local OK. Restarted ngrok (rc=$rc)."; [ "$pub_fails" -ge 2 ] && alert_now=1
          fi
        fi ;;
      5*) log "decision: alert only (5xx, no restart)"; msg="PUBLIC $desc — alert only, no restart."; alert_now=1 ;;
      *)  log "decision: alert only (unexpected status, no restart)"; msg="PUBLIC $desc — unexpected, alert only, no restart."; alert_now=1 ;;
    esac
    key="$st${ecode:+:$ecode}"
    if [ "$alert_now" = 1 ] && [ "$key" != "$pub_key" ]; then
      push "$msg" 1; [ "$DRY" = 1 ] || { pub_alerted=1; pub_key=$key; }
    elif [ "$alert_now" = 1 ]; then log "alert suppressed (already alerted for $key this incident)"; fi
  fi
else
  log "public probe skipped (last $(( (NOW-lastp)/60 )) min ago, every 30 min)"
fi
save
