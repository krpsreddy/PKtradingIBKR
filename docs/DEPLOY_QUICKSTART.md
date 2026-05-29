# Deploy quickstart (JAR + static frontend)

For an old laptop running 24/7 — **no Maven/ng serve** at runtime.

**Complete fresh-machine install:** [Windows](OLD_LAPTOP_SETUP_GUIDE_WINDOWS.md) · [macOS](OLD_LAPTOP_SETUP_GUIDE.md)

## One-time on build machine (or laptop)

```bash
./build-production.sh
```

Produces:

| Artifact | Path |
|----------|------|
| Backend fat JAR | `target/pktradingIBKR-1.0.0-SNAPSHOT.jar` |
| Frontend static | `frontend/dist/trading-dashboard/browser/` |

## One-click run (both)

```bash
./run-production.sh
```

- Backend: http://localhost:8180  
- Frontend: http://localhost:4300  

Stop: `Ctrl+C` or `./stop-production.sh`

## Backend only (mobile / 24/7)

```bash
./run-backend-only.sh
# or
./run-backend-jar.sh
```

Phone Flutter app → `http://<laptop-ip>:8180` (or Tailscale).

## Frontend only (after build)

```bash
./run-frontend-prod.sh
```

## Still required on the machine

1. **Java 21**
2. **PostgreSQL** (`trading_signals`)
3. **IBKR Gateway** (API on; paper **4002** → `IBKR_PORT=4002 ./run-production.sh`)
4. **Config**: `application-local.properties` + env (Telegram, DB password)
5. **IB API JAR** is inside the fat JAR (`lib/TwsApi.jar` at build time)

## Copy to another laptop (minimal)

Copy these from the repo after `./build-production.sh`:

- `target/pktradingIBKR-1.0.0-SNAPSHOT.jar`
- `src/main/resources/application-evolution.properties`
- `application-local.properties` (your secrets, gitignored)
- `lib/TwsApi.jar` (only if JAR build failed — normally not needed)
- Optional: `frontend/dist/` if you want research UI

Install Java 21 + Postgres + Gateway on the target machine. Run `./run-backend-jar.sh`.

## Dev vs production scripts

| Script | Use |
|--------|-----|
| `./start-evolution.sh` | Dev: Maven compile + `ng serve` (hot reload) |
| `./run-production.sh` | Prod: pre-built JAR + static files |
| `./run-backend-only.sh` | Prod: JAR only (Flutter mobile) |
