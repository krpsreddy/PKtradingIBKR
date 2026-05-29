# Old Laptop Setup — Windows (PKtradingIBKR)

Full install and run instructions for a **Windows 10/11** laptop.

**Mac guide:** [OLD_LAPTOP_SETUP_GUIDE.md](OLD_LAPTOP_SETUP_GUIDE.md) (Homebrew / bash scripts)

**Also read:** [SESSION_HANDOFF.md](SESSION_HANDOFF.md) · [PHASE_221_DUAL_RUNTIME_ARCHITECTURE.md](phases/PHASE_221_DUAL_RUNTIME_ARCHITECTURE.md)

---

## Table of contents

1. [Install order](#1-install-order-checklist)
2. [What you need](#2-what-you-need)
3. [Git](#3-git)
4. [Java 21 + Maven](#4-java-21--maven)
5. [PostgreSQL](#5-postgresql)
6. [Get the project](#6-get-the-project)
7. [IBKR TWS API JAR](#7-ibkr-tws-api-jar)
8. [Config & secrets](#8-config--secrets)
9. [IBKR Gateway (Windows)](#9-ibkr-gateway-windows)
10. [Run backend](#10-run-backend)
11. [Flutter mobile (optional)](#11-flutter-mobile-optional)
12. [Angular (optional)](#12-angular-optional)
13. [Copy from another PC](#13-copy-from-another-pc)
14. [Daily startup](#14-daily-startup)
15. [Troubleshooting](#15-troubleshooting)
16. [Command cheat sheet](#16-command-cheat-sheet)

---

## 1. Install order (checklist)

| Step | What |
|------|------|
| ☐ 1 | Git for Windows |
| ☐ 2 | Java 21 (Temurin) |
| ☐ 3 | Apache Maven |
| ☐ 4 | PostgreSQL + database `trading_signals` |
| ☐ 5 | Clone/copy project + `lib\TwsApi.jar` |
| ☐ 6 | `application-local.properties` (DB password) |
| ☐ 7 | IBKR Gateway (paper 4002 / live 4001) |
| ☐ 8 | `mvn compile` then `start-paper.ps1` |
| ☐ 9 | (Optional) Flutter + Android phone |

---

## 2. What you need

| Component | Windows install |
|-----------|-----------------|
| Java 21 | Eclipse Temurin JDK 21 |
| Maven | Apache Maven 3.9+ |
| PostgreSQL | 16.x from postgresql.org or winget |
| IB Gateway | Windows installer from IBKR |
| `lib\TwsApi.jar` | Copy from SDK or your Mac |
| Flutter | Optional — Android to phone |

| Runtime | Port | IB Gateway port |
|---------|------|-----------------|
| **PAPER** | 8180 | 4002 |
| **LIVE** | 8080 | 4001 |

---

## 3. Git

### Option A — winget (recommended)

Open **PowerShell as Administrator**:

```powershell
winget install Git.Git
```

Close and reopen PowerShell.

### Option B — installer

Download: https://git-scm.com/download/win  
Use defaults; include **Git Bash** when asked.

Verify:

```powershell
git --version
```

---

## 4. Java 21 + Maven

### 4.1 Java 21 (Temurin)

**PowerShell (Admin):**

```powershell
winget install EclipseAdoptium.Temurin.21.JDK
```

Or download: https://adoptium.net/temurin/releases/?version=21&os=windows&arch=x64

### 4.2 Maven

```powershell
winget install Apache.Maven
```

Or download: https://maven.apache.org/download.cgi — unzip to `C:\Tools\apache-maven-3.9.x`, add `bin` to PATH.

### 4.3 Environment variables (System)

1. **Settings → System → About → Advanced system settings → Environment Variables**
2. Set **JAVA_HOME** → e.g. `C:\Program Files\Eclipse Adoptium\jdk-21.x.x-hotspot`
3. Add to **Path**:
   - `%JAVA_HOME%\bin`
   - `C:\Program Files\Apache\maven\bin` (your Maven path)

Open a **new** PowerShell window:

```powershell
java -version
mvn -version
```

Both must work before continuing.

---

## 5. PostgreSQL

### 5.1 Install

```powershell
winget install PostgreSQL.PostgreSQL.16
```

Or installer: https://www.postgresql.org/download/windows/

- Remember the **postgres superuser password** you choose during setup.
- Port **5432** (default).
- Install **Stack Builder** optional — skip is fine.

### 5.2 Add PostgreSQL to PATH (if `psql` not found)

Typical path:

```text
C:\Program Files\PostgreSQL\16\bin
```

Add to System **Path**, reopen PowerShell.

### 5.3 Create database

```powershell
psql -U postgres -c "CREATE DATABASE trading_signals;"
```

If your app uses Windows user `pk` as DB user (see `application.properties`), create role or use postgres:

```powershell
psql -U postgres -c "CREATE USER pk WITH PASSWORD 'Kpr1412@postgres';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE trading_signals TO pk;"
psql -U postgres -c "ALTER DATABASE trading_signals OWNER TO pk;"
```

Or use **postgres** as username in config (see §8).

Test:

```powershell
psql -U postgres -d trading_signals -c "SELECT 1;"
```

### 5.4 Start PostgreSQL service

```powershell
Get-Service postgresql*
Start-Service postgresql-x64-16
```

(Set service name from `Get-Service postgresql*`.)

---

## 6. Get the project

### Git clone

```powershell
cd $env:USERPROFILE\IdeaProjects
mkdir IdeaProjects -ErrorAction SilentlyContinue
cd IdeaProjects
git clone https://github.com/krpsreddy/PKtradingIBKR.git
cd PKtradingIBKR
```

### Or copy folder from USB / your Mac

Copy entire `pktradingIBKR` folder to e.g. `C:\Users\YourName\IdeaProjects\pktradingIBKR`.

**Must also copy:**

- `lib\TwsApi.jar`
- `src\main\resources\application-local.properties` (secrets)

---

## 7. IBKR TWS API JAR

Build fails without: `lib\TwsApi.jar`

1. Download **TWS API** from https://interactivebrokers.github.io  
2. In the SDK zip, find `TwsApi.jar` (often under `source\JavaClient\`).
3. Copy:

```powershell
cd C:\Users\YourName\IdeaProjects\pktradingIBKR
mkdir lib -Force
copy C:\Downloads\TwsApi.jar lib\TwsApi.jar
```

Verify build:

```powershell
cd C:\Users\YourName\IdeaProjects\pktradingIBKR
mvn -q compile -DskipTests
```

---

## 8. Config & secrets

```powershell
cd C:\Users\YourName\IdeaProjects\pktradingIBKR
copy src\main\resources\application-local.properties.example src\main\resources\application-local.properties
notepad src\main\resources\application-local.properties
```

Minimum:

```properties
spring.datasource.password=Kpr1412@postgres
spring.datasource.username=postgres
```

(Use `postgres` or `pk` to match the DB user you created.)

Optional session env (PowerShell):

```powershell
$env:TELEGRAM_BOT_TOKEN = "your_token"
$env:TELEGRAM_CHAT_ID = "your_chat_id"
$env:DB_PASSWORD = "Kpr1412@postgres"
```

---

## 9. IBKR Gateway (Windows)

1. Download **IB Gateway** for Windows from Interactive Brokers.
2. Install and log in (paper / live accounts).
3. **Configure → Settings → API → Settings:**
   - ☑ Enable **ActiveX and Socket Clients**
   - ☑ **Enable delayed market data** (required for paper / delayed quotes)
   - Paper socket port: **4002**
   - Live socket port: **4001** (second gateway instance or login)
4. Allow Gateway through **Windows Firewall** when prompted.
5. Keep Gateway running while the backend runs.

---

## 10. Run backend

Use **PowerShell** scripts (native Windows).  
`.sh` scripts need **Git Bash** or **WSL** — prefer `.ps1` on Windows.

### 10.1 First time — allow scripts

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### 10.2 Paper runtime (8180)

```powershell
cd C:\Users\YourName\IdeaProjects\pktradingIBKR
.\start-paper.ps1
```

Log: `logs\paper-runtime.log`

### 10.3 Live runtime (8080)

```powershell
.\start-live.ps1
```

Log: `logs\live-runtime.log`

### 10.4 Both

```powershell
.\start-all.ps1
```

### 10.5 Foreground (see console output)

```powershell
$env:SPRING_PROFILES_ACTIVE = "paper"
$env:IBKR_PORT = "4002"
mvn -q compile spring-boot:run
```

### 10.6 Verify

```powershell
Invoke-RestMethod http://localhost:8180/api/runtime/profile | ConvertTo-Json
Invoke-RestMethod http://localhost:8180/api/live-trader/stream-debug | ConvertTo-Json
```

Healthy: `ibkrStreaming: true`, `symbolsStreaming` > 0, `marketDataEntitlementErrors: 0`.

### 10.7 View logs / errors

```powershell
Get-Content logs\paper-runtime.log -Wait
Select-String " ERROR " logs\paper-runtime.log
```

### 10.8 Stop backend

```powershell
.\stop-backends.ps1
```

Or manually:

```powershell
Get-NetTCPConnection -LocalPort 8180 -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
```

---

## 11. Flutter mobile (optional)

### 11.1 Install Flutter on Windows

```powershell
winget install Google.Flutter
```

Or: https://docs.flutter.dev/get-started/install/windows

```powershell
flutter doctor
```

### 11.2 Android phone (USB)

1. Install **Android Studio** (for USB drivers / platform-tools) or platform-tools only.
2. Enable **Developer options → USB debugging** on phone.
3. Backend on Windows must be reachable at **`http://<windows-lan-ip>:8180`**.

Get Windows LAN IP:

```powershell
ipconfig
# Look for IPv4 under Wi-Fi, e.g. 192.168.1.50
```

Build/run with your IP:

```powershell
cd pk-live-trader-mobile
flutter run --dart-define=PK_HOST=192.168.1.50 --dart-define=LOCAL_API_BASE=http://192.168.1.50:8180
```

**Note:** iPhone builds require a **Mac with Xcode**. On Windows use **Android** only, or point phone at Windows backend over Wi‑Fi.

### 11.3 Release APK

```powershell
cd C:\Users\YourName\IdeaProjects\pktradingIBKR
.\build-mobile-apk.sh
```

Requires **Git Bash** for `.sh` scripts, or run from Git Bash:

```bash
LOCAL_API_BASE=http://192.168.1.50:8180 ./build-mobile-apk.sh
```

---

## 12. Angular (optional)

```powershell
winget install OpenJS.NodeJS.LTS
cd frontend
npm install
npm start
```

Research UI: http://localhost:4200 or port in `angular.json` (evolution uses 4300 via `start-evolution.sh` on Mac only).

For Windows dev, run backend with `start-paper.ps1` and configure Angular proxy if needed.

---

## 13. Copy from another PC

From your **working Mac/PC**, copy to the Windows laptop:

| Item | Path |
|------|------|
| Project folder | `pktradingIBKR\` |
| `lib\TwsApi.jar` | **Required** |
| `application-local.properties` | secrets |
| Pre-built JAR (optional) | `target\pktradingIBKR-1.0.0-SNAPSHOT.jar` |

On Windows with only JAR + Java + Postgres + Gateway:

```powershell
$env:SPRING_PROFILES_ACTIVE = "paper"
java -jar target\pktradingIBKR-1.0.0-SNAPSHOT.jar
```

---

## 14. Daily startup

```powershell
Start-Service postgresql-x64-16
# Start IB Gateway (paper 4002)
cd C:\Users\YourName\IdeaProjects\pktradingIBKR
.\start-paper.ps1
Invoke-RestMethod http://localhost:8180/api/runtime/profile
```

---

## 15. Troubleshooting

| Problem | Fix |
|---------|-----|
| `java` / `mvn` not recognized | Set JAVA_HOME and Path; open new PowerShell |
| `mvn compile` IB API error | Add `lib\TwsApi.jar` |
| DB connection failed | Service running; user/password in `application-local.properties` |
| IBKR **10168** | Gateway: enable **delayed market data**; paper profile uses type 3 |
| `ibkrStreaming: false` | Gateway not running or wrong port (4002/4001) |
| Port already in use | `.\stop-backends.ps1` or kill PID on 8180/8080 |
| Cannot run `.ps1` | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| Phone cannot connect | Use Windows Wi‑Fi IPv4; allow port 8180 in firewall |
| `.sh` scripts fail | Use `.ps1` equivalents or install Git Bash |

Windows firewall rule (Admin PowerShell) — allow inbound 8180:

```powershell
New-NetFirewallRule -DisplayName "PK Paper 8180" -Direction Inbound -LocalPort 8180 -Protocol TCP -Action Allow
```

---

## 16. Command cheat sheet (Windows PowerShell)

```powershell
# === INSTALL (once, Admin) ===
winget install Git.Git EclipseAdoptium.Temurin.21.JDK Apache.Maven PostgreSQL.PostgreSQL.16

# === PROJECT ===
cd $env:USERPROFILE\IdeaProjects
git clone https://github.com/krpsreddy/PKtradingIBKR.git
cd PKtradingIBKR
copy src\main\resources\application-local.properties.example src\main\resources\application-local.properties

# === DB ===
psql -U postgres -c "CREATE DATABASE trading_signals;"
# Edit application-local.properties

# === IB API ===
copy C:\path\to\TwsApi.jar lib\TwsApi.jar
mvn -q compile -DskipTests

# === RUN ===
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
.\start-paper.ps1
.\start-live.ps1
.\start-all.ps1

# === VERIFY ===
Invoke-RestMethod http://localhost:8180/api/runtime/profile
Invoke-RestMethod http://localhost:8180/api/live-trader/stream-debug

# === LOGS ===
Get-Content logs\paper-runtime.log -Tail 50
Select-String " ERROR " logs\paper-runtime.log

# === STOP ===
.\stop-backends.ps1
```

---

## WSL alternative (optional)

If you prefer Mac-like bash scripts:

```powershell
wsl --install
```

In Ubuntu WSL: install Java/Maven/Postgres, clone repo, run `./start-paper.sh`.  
IB Gateway must still run on **Windows** (or WSL2 with networking care). For most users, **native Windows + `.ps1`** is simpler.

---

*Windows guide — Phase 221 dual runtime. Use `start-*.ps1` scripts in repo root.*
