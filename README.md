# Retirement Planner

A retirement planning app, built on the same stack as the other apps in
`~/Projects`: a **Spring Boot** backend and a **Next.js** frontend.

```
retirement-planner/
├── backend/    RetireServer — Java 17 · Spring Boot 3.2.5 · MySQL + JPA
└── frontend/   retire-front — Next.js 16 · React 19 · TypeScript · Tailwind v4
```

## What's scaffolded so far

Infrastructure only — the plumbing every feature will build on:

- **Auth**: cookie-session (`SessionService` + opaque HttpOnly token), BCrypt
  passwords, `/register` `/login` `/logout` `/me` endpoints, `User` + `UserSession`
  JPA entities.
- **CORS**: global servlet filter that also covers error responses, credentials
  enabled for the cookie.
- **Frontend shell**: typed API client (`src/lib/api.ts`, `credentials: 'include'`),
  `UserContext`, a `(site)` route group with a dashboard, sign-in/register page,
  and a live backend-health indicator.
- **Ops**: Dockerfile, `.env`/dev-env examples, MySQL schema `retirement`.

Retirement-specific features (projections, accounts, contributions, scenarios)
are **not** built yet — the dashboard cards are placeholders.

## Running locally

**Backend** (needs a local MySQL with a `retirement` database, and JDK 17+):

```powershell
cd backend
Copy-Item dev-env.example.ps1 dev-env.ps1   # then fill in DB_PASSWORD
. .\dev-env.ps1
.\mvnw.cmd spring-boot:run                    # serves on http://localhost:8083
```

**Frontend**:

```powershell
cd frontend
Copy-Item .env.local.example .env.local       # points at http://localhost:8083
npm install
npm run dev                                    # serves on http://localhost:3000
```

Ports were chosen to sit alongside the other apps (AgriServer uses 8081); this
backend uses **8083** and the frontend the usual **3000**.
