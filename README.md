# Retirement Planner

A retirement planning app — a Spring Boot backend and a Next.js frontend, built
on the same stack as the other apps in `~/Projects`.

```
retirement-planning/
├── backend/    RetireServer — Java 17 · Spring Boot 3.2.5 · MySQL + JPA
└── frontend/   retire-front — Next.js 16 · React 19 · TypeScript · Tailwind v4
```

## Features

- **Retirement projection** (`/plan`) — models saving up to retirement and drawing
  the portfolio down through your planning horizon, in today's (inflation-adjusted)
  dollars, with Social Security income offsetting spending. Answers "does my money
  last?"
- **Social Security breakeven** (`/social-security`) — when claiming later overtakes
  claiming earlier, accounting for an expected investment return, annual COLA, and
  inflation.
- **Roth conversion analyzer** (`/roth`) — after-tax value of converting now vs.
  leaving it tax-deferred, with a break-even future tax rate and a "pay the tax from
  outside funds vs. the conversion" toggle.
- **Accounts** — cookie-session auth (register / sign in) so a plan can be saved.

All financial figures are estimates, not advice.

## Getting started

### Prerequisites

- **JDK 17+** (developed against JDK 25)
- **Node.js 20+**
- **Docker Desktop** (runs the MySQL database)

### Clone

```bash
git clone https://github.com/cnagler56/retirement-planning.git
cd retirement-planning
```

### Backend — `backend/`

The database runs in Docker (MySQL on host port **3307**, so it never collides with
another local MySQL). Set its root password in a gitignored `.env` first:

```powershell
cd backend
Copy-Item .env.example .env   # then edit MYSQL_ROOT_PASSWORD
docker compose up -d
```

Set up local environment variables — use the **same** password for `DB_PASSWORD`
as you put in `.env`, and point `JAVA_HOME` at your JDK:

```powershell
Copy-Item dev-env.example.ps1 dev-env.ps1
. .\dev-env.ps1
.\mvnw.cmd spring-boot:run
```

The API serves on **http://localhost:8083**. Quick check:

```bash
curl http://localhost:8083/api/health
```

> If PowerShell blocks `. .\dev-env.ps1` with a script-execution error, allow local
> scripts for your user once: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

The `retirement` schema and its tables are created automatically on first run
(`createDatabaseIfNotExist` + Hibernate `ddl-auto=update`).

### Frontend — `frontend/`

```powershell
cd frontend
Copy-Item .env.local.example .env.local
npm install
npm run dev
```

The app serves on **http://localhost:3000** and talks to the backend at
`NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8083`).

## Notes

- **Ports:** backend `8083`, frontend `3000`, MySQL `3307`. (Chosen to sit alongside
  the other apps in `~/Projects`.)
- **Stopping the database:** `docker compose stop` from `backend/`; `docker compose up -d`
  to bring it back.
- **Secrets:** none are committed. `backend/.env` (MySQL password), `dev-env.ps1`,
  and `frontend/.env.local` are all gitignored; copy them from the `*.example` files.
