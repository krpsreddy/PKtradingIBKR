# ngrok Secure Local Development Tunnels

Production-grade **two-tunnel** setup for this project:

| Tunnel   | Local target              | Public use                          |
|----------|---------------------------|-------------------------------------|
| frontend | `http://localhost:4200`   | Angular dev server (SPA + HMR)      |
| backend  | `http://localhost:8080`   | Spring Boot REST + WebSockets       |

Both tunnels use **HTTPS only** and **HTTP basic auth**.

> **Security warning:** Never commit `.env`, `ngrok.yml`, or authtokens. If your ngrok authtoken was exposed (chat, logs, git), **rotate it immediately** at [dashboard.ngrok.com](https://dashboard.ngrok.com/get-started/your-authtoken).

---

## Folder structure

```
dev/ngrok/
├── .env.example              # Copy → .env (secrets)
├── ngrok.yml.template        # Reference only
├── ngrok.yml                 # Generated (gitignored)
├── .ngrok-urls.env           # Generated tunnel URLs (gitignored)
├── docker-compose.ngrok.yml
├── README.md
├── angular/
│   ├── environment.ngrok.ts.example
│   └── serve-ngrok.sh
├── spring/
│   └── application-ngrok.properties.example
└── scripts/
    ├── generate-config.sh
    ├── generate-config.ps1
    ├── generate-config-docker.sh
    ├── start-all.sh              # Foreground — both tunnels
    ├── start-all-background.sh   # Background + write URLs
    ├── start-all.ps1
    ├── stop.sh
    ├── health-check.sh
    ├── health-check.ps1
    └── lib/common.sh
```

---

## Quick start (Mac/Linux)

### 1. Install ngrok v3

```bash
brew install ngrok/ngrok/ngrok
ngrok version   # should be 3.x
```

### 2. Configure secrets

```bash
cd dev/ngrok
cp .env.example .env
chmod 600 .env
```

Edit `.env`:

```bash
NGROK_AUTHTOKEN=your_token_from_dashboard
NGROK_BASIC_AUTH_USER=dev
NGROK_BASIC_AUTH_PASS=use-a-long-random-password-min-20-chars
```

Optional IP allowlist (paid ngrok plan):

```bash
NGROK_IP_ALLOWLIST=203.0.113.10/32,198.51.100.0/24
```

### 3. Start local apps

**Terminal A — Spring Boot**

```bash
# Copy Spring ngrok profile once:
cp dev/ngrok/spring/application-ngrok.properties.example \
   src/main/resources/application-ngrok.properties

# After tunnels are up, export CORS origin from .ngrok-urls.env
export $(grep -v '^#' dev/ngrok/.ngrok-urls.env | xargs) 2>/dev/null || true

SPRING_PROFILES_ACTIVE=ngrok mvn spring-boot:run
```

**Terminal B — Angular (ngrok-friendly host binding)**

```bash
chmod +x dev/ngrok/angular/serve-ngrok.sh
./dev/ngrok/angular/serve-ngrok.sh
```

### 4. Start both tunnels

**Terminal C — foreground (recommended for first run)**

```bash
cd dev/ngrok
chmod +x scripts/*.sh scripts/lib/*.sh
./scripts/start-all.sh
```

**Or background:**

```bash
./scripts/start-all-background.sh
```

### 5. Health check

```bash
./scripts/health-check.sh
```

Browser access:

- Open the **frontend** URL printed by ngrok (or in `.ngrok-urls.env`)
- Enter basic auth when prompted (`NGROK_BASIC_AUTH_USER` / `NGROK_BASIC_AUTH_PASS`)

---

## Quick start (Windows)

```powershell
cd dev\ngrok
copy .env.example .env
# Edit .env in notepad

.\scripts\generate-config.ps1
.\scripts\start-all.ps1
```

Health check:

```powershell
.\scripts\health-check.ps1
```

---

## Docker (optional)

Apps still run on the **host**; only the ngrok agent runs in Docker.

```bash
cd dev/ngrok
cp .env.example .env   # fill in values
./scripts/generate-config-docker.sh
docker compose -f docker-compose.ngrok.yml up
```

Agent UI: `http://127.0.0.1:4040` (local only)

---

## Angular remote backend URL

After tunnels start, copy URLs from `.ngrok-urls.env`:

```bash
cat dev/ngrok/.ngrok-urls.env
```

Create `frontend/src/environments/environment.ngrok.ts` from the example:

```bash
cp dev/ngrok/angular/environment.ngrok.ts.example \
   frontend/src/environments/environment.ngrok.ts
```

Set `apiUrl` to your **backend** ngrok URL + `/api`:

```typescript
export const environment = {
  production: false,
  apiUrl: 'https://YOUR-BACKEND-ID.ngrok-free.app/api',
  ngrokMode: true
};
```

Wire into `angular.json` (optional `ngrok` serve configuration) or replace `environment.ts` temporarily while testing remotely.

**SPA routing:** ngrok forwards all paths to `ng serve`; Angular dev server handles client-side routes.

**WebSockets / live reload:** Supported on HTTP tunnels. Use `--allowed-hosts=all` (see `serve-ngrok.sh`). If HMR fails, hard-refresh or disable live reload for remote demos.

---

## Spring Boot CORS + security

1. Copy profile:

   ```bash
   cp dev/ngrok/spring/application-ngrok.properties.example \
      src/main/resources/application-ngrok.properties
   ```

2. Run with profile:

   ```bash
   export $(grep -v '^#' dev/ngrok/.ngrok-urls.env | xargs)
   SPRING_PROFILES_ACTIVE=ngrok mvn spring-boot:run
   ```

3. `WebConfig` reads `app.cors.extra-origin-patterns` so your **frontend ngrok URL** is allowed.

### Actuator / admin hardening

- **Do not** expose `/actuator/env`, `/actuator/beans`, `/actuator/heapdump` on a public tunnel.
- The ngrok profile disables most actuator endpoints; only `health` is enabled with no details.
- Keep IBKR credentials, DB passwords, and Telegram tokens in `application-local.properties` (gitignored) — never in tunneled defaults.

### Recommended secure headers (optional filter)

For production-like dev, add response headers on `/api/**`:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Cache-Control: no-store` (for sensitive API responses)

---

## Security best practices

| Practice | Why |
|----------|-----|
| Basic auth on **both** tunnels | Public URLs are discoverable |
| Strong random basic auth password | Prevents casual scanning |
| Rotate `NGROK_AUTHTOKEN` if leaked | Token grants account access |
| `inspect: false` on backend | Disables request replay UI for API tunnel |
| Agent UI on `127.0.0.1:4040` only | Don't expose tunnel admin publicly |
| IP allowlist (paid) | Restrict to office/VPN CIDRs |
| Separate frontend/backend tunnels | Least exposure; different policies possible |
| Never tunnel production databases | Local dev only |
| Stop tunnels when done | `./scripts/stop.sh` |

---

## Troubleshooting

### `ERR_NGROK_401` / basic auth loop

- Verify username/password in `.env` match what you enter in the browser.
- Regenerate config: `./scripts/generate-config.sh`

### CORS errors from Angular ngrok → backend ngrok

- Export `APP_CORS_EXTRA_ORIGIN_PATTERNS` from `.ngrok-urls.env`
- Restart Spring Boot with `SPRING_PROFILES_ACTIVE=ngrok`
- Confirm frontend origin matches exactly (scheme + host, no trailing slash)

### ngrok free tier browser warning

- ngrok may show an interstitial page on first visit — click through or upgrade to remove it.

### Angular `Invalid Host header`

- Use `./dev/ngrok/angular/serve-ngrok.sh` (`--allowed-hosts=all`)

### Tunnel up but 502 Bad Gateway

- Ensure local app is running on the expected port (`4200` / `8080`)
- Docker: use `generate-config-docker.sh` (`host.docker.internal`)

### IP allowlist not working

- Requires paid ngrok plan; verify CIDR syntax in `NGROK_IP_ALLOWLIST`

### Check tunnel status

```bash
curl -s http://127.0.0.1:4040/api/tunnels | jq '.tunnels[] | {name, public_url, proto}'
```

---

## Exact command reference

```bash
# One-time setup
cd dev/ngrok && cp .env.example .env && chmod 600 .env

# Generate config
./scripts/generate-config.sh

# Start tunnels (foreground)
./scripts/start-all.sh

# Start tunnels (background + URL file)
./scripts/start-all-background.sh

# Stop
./scripts/stop.sh

# Verify
./scripts/health-check.sh

# Spring Boot with ngrok profile
export $(grep -v '^#' .ngrok-urls.env | xargs)
SPRING_PROFILES_ACTIVE=ngrok mvn spring-boot:run

# Angular for ngrok
../../dev/ngrok/angular/serve-ngrok.sh
```

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NGROK_AUTHTOKEN` | Yes | From ngrok dashboard |
| `NGROK_BASIC_AUTH_USER` | Yes | Basic auth username |
| `NGROK_BASIC_AUTH_PASS` | Yes | Basic auth password |
| `NGROK_IP_ALLOWLIST` | No | Comma-separated CIDRs (paid) |
| `NGROK_WEB_ADDR` | No | Agent UI bind (default `127.0.0.1:4040`) |
| `NGROK_FRONTEND_DOMAIN` | No | Reserved domain (paid) |
| `NGROK_BACKEND_DOMAIN` | No | Reserved domain (paid) |

Advisory: this setup is for **local development demos only**, not production deployment.
