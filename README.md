<p align="center">
  <img src="frontend/public/logo.png" alt="Ershak" width="260">
</p>

<p align="center"><b>حط القرش عالقرش، واحنا نحرسه</b><br>Stack your coins. We guard them.</p>

---

**Ershak (قِرشك)** is an online banking system with a built-in **Fraud Guard**.
Customers open Savings and Current accounts, deposit, withdraw, transfer and save towards goals.
Before any money leaves an account, the Fraud Guard scores the risk and decides:

| Risk score | What happens |
|---|---|
| 0 – 29 | The transaction goes through |
| 30 – 59 | The customer confirms with a one-time code (OTP) |
| 60+ | The money is held until a bank officer approves or rejects it |

DEPI graduation project · Software Testing track.

## Run it

You only need **Java 21** ([adoptium.net](https://adoptium.net)).

- **Windows:** double-click `run.bat`
- **macOS / Linux:** `./run.sh`
- **Or:** `java -jar release/ershak.jar`

Then open **http://localhost:7070**. The first start creates a database (`ershak.db`) with demo data.

| Role | Username | Password |
|---|---|---|
| Customer | `omar.ahmed` | `Ershak@2026` |
| Customer | `sara.mahmoud`, `mona.khaled`, `youssef.gomaa` | `Ershak@2026` |
| Customer (team) | `youel`, `mohamed.shaaban`, `mohamed.hany`, `asmaa` | `Ershak@2026` |
| Customer (instructor / testing) | `eng.ahmed`, `test` | `Ershak@2026` |
| Bank officer | `admin` | `Admin@2026` (you must change it on first login) |
| Bank officer (team) | `youel.admin`, `shaaban.admin`, `hany.admin`, `asmaa.admin`, `ahmed.admin` | `Admin@2026` (must change on first login) |

Every team customer starts with money and three small past transfers, so the Fraud Guard already knows their usual amounts.

To start over, stop the app and delete `ershak.db`.

## Features

**Customers**
- Register and log in. Passwords are hashed with salted PBKDF2. Three wrong passwords lock the login for 15 minutes (*التالتة تابتة*).
- Savings accounts (5% yearly interest, 4 outgoing operations a month, no overdraft) and Current accounts (EGP 2,000 overdraft).
- Deposit, withdraw and transfer, with daily limits and an EGP 2 fee for transfers to other people. Every transfer is atomic.
- Explained risk: when a transfer is checked, the customer sees exactly which rules fired and why.
- OTP confirmation with a simulated SMS inbox inside the app.
- "Not me" button: cancels a held transfer and freezes the account.
- Savings goals with progress (*حط القرش عالقرش*).
- History with filters, pagination, and statements as **PDF** or CSV. The PDF is written by hand in Java (`PdfWriter`), no library.
- Notifications, with sounds: a two-note "ching ching" when money arrives, a chime when a transfer goes through, and a warning tone when something is held or locked. Made with the browser's Web Audio API (no audio files). Profile > Sounds turns them off.

**Bank officer (admin console)**
- Dashboard: customers, deposits, today's transactions, review queue.
- Review queue: approve or reject held transactions, with the reasons.
- Customers: search, lock or unlock logins, freeze or unfreeze accounts.
- Tamper-evident audit log: every entry stores the SHA-256 of the entry before it. *Verify integrity* finds any record edited directly in the database.
- Fraud rules: every threshold and point value can be tuned. Changes are logged.
- Monthly interest for savings accounts (runs once per month).

## The Fraud Guard

| Rule | Fires when | Points |
|---|---|---|
| R1 | Amount ≥ 5× the customer's 30-day average (needs 3+ past transfers) | 30 |
| R2 | 3 or more outgoing transactions within 2 minutes | 30 |
| R3 | First transfer to an account, amount ≥ EGP 5,000 | 30 |
| R4 | Between 00:00 and 05:00, amount ≥ EGP 2,000 | 20 |
| R5 | Amount ≥ 90% of the account balance | 20 |
| R6 | Amount ≥ 80% of what is left of today's limit | 10 |

Each rule is one class implementing the `FraudRule` interface (Strategy pattern). Adding a rule means writing one class.

## Architecture

```
frontend/  React web app (Vite)  ──HTTP/JSON──►  backend/  Java 21
                                                   ├── web/        tiny HTTP server + JSON (JDK only, no framework)
                                                   ├── api/        REST routes → one call into the core each
                                                   ├── service/    business logic (accounts, transfers, goals, admin, audit)
                                                   ├── fraud/      FraudEngine + 6 rules
                                                   ├── model/      Account → SavingsAccount / CurrentAccount, Transaction, …
                                                   ├── dao/        JDBC + prepared statements
                                                   ├── security/   PBKDF2, sessions, rate limiting
                                                   ├── exception/  InsufficientFunds, InvalidAmount, AccountFrozen, LimitExceeded, …
                                                   └── db/         SQLite, ACID transactions
```

- **Pure Java.** The server, routing, JSON and even the PDF writer are written on top of the JDK. The only library is the SQLite JDBC driver.
- **OOP:** inheritance and polymorphism (`Account`), Factory (`AccountFactory`), Strategy (`FraudRule`), Singleton (`Database`), custom exception hierarchy (`BankException`).
- **Money** is always `BigDecimal` with 2 decimals, never `double`.
- **Security:** PBKDF2 password hashing, random session tokens with 5-minute inactivity timeout, login rate limiting, prepared statements (no SQL injection), ownership check on every account, security headers.

## Develop

Requirements: Java 21, Maven, Node 18+.

```bash
# Backend: tests and runnable JAR
cd backend
mvn test
mvn package            # → backend/target/ershak.jar
mvn exec:java          # runs on http://localhost:7070

# Frontend with live reload (proxies /api to :7070)
cd frontend
npm install
npm run dev            # → http://localhost:5173

# Build the web app into the Java project, then repackage
npm run build
```

Environment variables: `PORT` (7070; if it is busy and you did not set it, the app tries the next ports), `ERSHAK_DB` (`jdbc:sqlite:ershak.db`), `ERSHAK_DEMO_DATA` (`true`), `ERSHAK_ADMIN_PASSWORD` (the password every officer starts with, default `Admin@2026`), `ERSHAK_ALLOWED_ORIGIN` (frontend URL when hosted separately).

## Hosting

The web app is inside the jar, so one process serves everything. A `Dockerfile` and a Render `render.yaml` are included.

1. Push this repo to GitHub.
2. On [render.com](https://render.com): **New + > Blueprint**, pick the repo. It reads `render.yaml`.
3. Set `ERSHAK_ADMIN_PASSWORD` to a password only you know. Without it, anyone who reads this README can log in as an officer.
4. Open the URL Render gives you (`/api/health` must answer `{"status":"ok"}`).

**About the data.** SQLite is a file. On Render's free plan the disk is wiped whenever the service sleeps or redeploys, so the app starts again with the demo data and customers who registered are lost. That is fine for a demo. To keep real data, use a paid plan with a disk mounted at `/data` (the lines are in `render.yaml`) or another host with a volume, such as Fly.io or Railway.

The first request after a sleep takes about 30 to 60 seconds on the free plan. Open the site before the demo.

## Testing

- `backend/src/test`: 35 JUnit tests covering accounts, every fraud rule, OTP, holds, lockout, ownership, audit tampering, goals, JSON, the PDF statement and idle sessions.
- `docs/Ershak.postman_collection.json`: 20 API requests with assertions. Import into Postman, run the app, run the collection.

## Demo script (5 minutes)

Delete `ershak.db` before the demo so the demo history is fresh (the Fraud Guard compares against the last 30 days).

1. Log in as `omar.ahmed`. Show balances, recent activity and goals.
2. Transfer **EGP 300** to Sara → goes through instantly.
3. From the **current** account, transfer **EGP 3,000** to Sara → the Fraud Guard asks for a code and explains why. Copy the code from the SMS card and confirm.
4. From the **savings** account, transfer **EGP 9,500** to Mona (never paid before) → **held**. Show the reasons.
5. Log in as `admin` in another browser. Reject it in the review queue. Omar gets the money back and a notification.
6. Log in as `sara.mahmoud` with a wrong password three times → *التالتة تابتة*.
7. Open `ershak.db` (DB Browser for SQLite), edit any row in `audit_log`, then press **Verify integrity** → tampering detected.
8. Open the code: `Account` hierarchy, `FraudRule` interface, custom exceptions.

## API

All endpoints are under `/api`. Send `Authorization: Bearer <token>` after logging in.

| Method | Path | |
|---|---|---|
| POST | `/auth/register`, `/auth/login`, `/auth/logout` | Accounts and sessions |
| GET | `/me` · POST `/me/password` | Current user |
| GET, POST | `/accounts` · POST `/accounts/{id}/close` | Accounts |
| GET | `/accounts/{id}/transactions?type&status&from&to&min&max&page&size` | History |
| GET | `/accounts/{id}/statement.csv?from&to` · `/statement.pdf?from&to` | CSV and PDF statements |
| POST | `/transactions/deposit`, `/withdraw`, `/transfer` | Money (returns the risk) |
| POST | `/transactions/{id}/otp`, `/transactions/{id}/cancel` | OTP and "not me" |
| GET | `/transactions/recent`, `/transactions/{id}` | Activity |
| GET, POST, DELETE | `/goals`, `/goals/{id}/contribute`, `/goals/{id}/withdraw` | Savings goals |
| GET | `/notifications`, `/sms` · POST `/notifications/read-all` | Inbox |
| GET | `/admin/overview`, `/admin/reviews`, `/admin/customers`, `/admin/audit`, `/admin/rules` | Officer |
| POST | `/admin/reviews/{id}/approve` · `/reject`, `/admin/users/{id}/lock` · `/unlock`, `/admin/accounts/{id}/freeze` · `/unfreeze`, `/admin/audit/verify`, `/admin/interest` | Officer actions |
| PUT | `/admin/settings` | Tune rules and limits |

---

This is a simulation for education. No real money, cards, SMS or bank connections.
