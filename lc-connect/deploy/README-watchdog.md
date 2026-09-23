# LC Connect watchdog

`watchdog.sh`, run by `lc-watchdog.timer` every 5 min (user unit). Two checks, two cadences:

| Check | Cadence | Target | ngrok requests |
|---|---|---|---|
| Local full login flow (register-once → authorize/PKCE → token → `/mcp` whoami) | every run (5 min) | `$LOCAL_URL` = `http://127.0.0.1:3003` | 0 |
| Public probe: one `GET $PUBLIC_URL/health`, 15 s timeout | every 30 min (timestamp `watchdog.public_probe.ts`) | ngrok URL | 1 |

## Request budget

- Old design: 5 public requests × 288 runs/day ≈ **43,000/month**. That blew the free plan and the account ran out of credit (ERR_NGROK_4026).
- New design: 48 probes/day × 30 ≈ **1,440/month** (≤ 1,500 at worst). The 5-min local flow costs **0** ngrok requests.
- Free ngrok plan: about **20,000 requests/month**, so the watchdog now uses about 7% of it.

## Restart / alert matrix

| Result | Action | Alert (Pushover) |
|---|---|---|
| Local flow OK | none | recovery message if an incident was alerted |
| Local flow fails | restart `lc-connect.service` (user), at most 1 per 30 min (`watchdog.local_restart.ts`) | priority 1 after 2 failures in a row, once per incident |
| Public 200 | none | recovery message if an incident was alerted |
| Public 403 (e.g. `ERR_NGROK_4026`, billing/limit) | **never restart** (also checked: agent `:4040` lists the lasercomponents → localhost:3003 tunnel) | priority 1 right away, names the code: "ngrok account limit — top up at dashboard.ngrok.com" |
| Public 000 / timeout / 502 / 404, local OK | `sudo -n systemctl restart ngrok.service`, at most 1 per 30 min and 3 per 6 h (`watchdog.ngrok_restarts`) | priority 1 after 2 failed probes; right away once the cap is hit (then alert only) |
| Public 000 / 502 / 404, local failing | no ngrok restart (the local branch restarts lc-connect) | after 2 failed probes |
| Public other 5xx / other status | none | priority 1 right away |

Public alerts go out once per incident per status+code (`pub_key` in `watchdog.state`).

## Manual use

```
deploy/watchdog.sh --dry-run --public-now   # print decisions; no restarts, alerts or state writes
deploy/watchdog.sh --public-now             # real run, force the public probe now
```
