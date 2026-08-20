# Agent Identity Management System (AIMS)

**PS-2.1 — AI Agent Identity Card & Governance Platform**

A complete end-to-end identity management and governance platform for AI agents. AIMS issues machine identities with scoped cryptographic credentials, enforces least-privilege access on protected resources, automates credential rotation, monitors inactivity through stale detection and auto-revocation, provides comprehensive audit logging, and delivers a modern React + TypeScript + Material UI governance dashboard.

---

## Architecture Overview

```
+---------------------------------------------------------------------------------+
|                                React + MUI Frontend                             |
|  [Dashboard]  [Agent Directory]  [Register]  [Quarterly Review]  [Audit Logs]   |
+----------------------------------------+----------------------------------------+
                                         | HTTP / REST (Vite SPA)
                                         v
+---------------------------------------------------------------------------------+
|                               FastAPI Backend (AIMS)                            |
|                                                                                 |
|  +------------------------+  +------------------------+  +-------------------+  |
|  |     Agent Routes       |  |  Protected Resources   |  | Governance Routes |  |
|  | - POST /agents/register|  | - GET /reports (read)  |  | - GET /dashboard  |  |
|  | - GET /agents          |  | - POST /reports (write)|  | - GET /reviews    |  |
|  | - POST /rotate         |  | - GET /admin (admin)   |  | - GET /audit-logs |  |
|  | - Lifecycle (suspend/  |  +------------------------+  +-------------------+  |
|  |   reactivate/decom)    |              |                                      |
|  +------------------------+              v                                      |
|                                [ ScopeChecker Middleware ]                      |
|                                (Validates Token, Hash, Status)                  |
|                                              |                                  |
|  +-------------------------------------------+-------------------------------+  |
|  |                               Core Services                               |  |
|  |  [ TokenService ]        [ ReviewService ]          [ RevokeService ]     |  |
|  |  - JWT Issue & Rotation  - Stale Detection & Risk   - Auto-Revoke & Audit |  |
|  +---------------------------------------------------------------------------+  |
|                                              |                                  |
|                              [ Background Scheduler ]                           |
|                              (Daily Stale -> Risk -> Revoke)                    |
+----------------------------------------------+----------------------------------+
                                               |
                                               v
+---------------------------------------------------------------------------------+
|                            Database (SQLite / PostgreSQL)                       |
|               [ agents ]        [ credentials ]        [ audit_logs ]           |
+---------------------------------------------------------------------------------+
```

---

## Key Features

### 1. Identity Provisioning & Scoped Credentials
- **Agent Identity Card**: Generates unique IDs (`AID-XXXXXXXX`), friendly names, business purposes, and owning teams.
- **Scoped JWTs**: Issues cryptographically signed HS256 JWTs containing `sub`, `agent_name`, `scopes` (`read`, `write`, `admin`), `jti`, `iat`, and `exp`.
- **Zero Raw Token Storage**: Only a SHA-256 hash of the token is stored in the database. DB breaches do not expose usable credentials.

### 2. Real-Time Scope & Status Enforcement
- `require_scope(required_scope)` dependency intercepts incoming requests:
  1. Validates JWT signature, claims, and non-expiration.
  2. Ensures the token's SHA-256 hash matches a currently `ACTIVE` credential.
  3. Verifies the Agent identity record is `ACTIVE` (not suspended, stale, revoked, or decommissioned).
  4. Enforces role & scope hierarchy (`admin` satisfies `read`, `write`, and `admin`).
  5. Automatically stamps `last_api_call` timestamp and writes every access attempt (allow/deny) to the immutable audit log.

### 3. Immediate Credential Rotation & Lifecycle
- **Rotation**: Invalidates previous credentials immediately upon rotation (flipping credential status to `ROTATED`), issuing a fresh JWT.
- **Lifecycle Control**: Secure `suspend`, `reactivate` (auto-issues fresh credential), and `decommission` (revokes all active credentials) operations requiring admin authorization.

### 4. Continuous Governance & Risk Scoring
- **Stale Detection**: Flags agents inactive for $\ge 30$ days (configurable via `STALE_THRESHOLD_DAYS`).
- **Auto-Revocation**: Automatically revokes credentials and deactivates agents idle for $\ge 90$ days (configurable via `AUTO_REVOKE_THRESHOLD_DAYS`).
- **Explainable Risk Scoring (0–100)**: Evaluates scope breadth (admin=40, write=20, read=5), status penalties, idle intervals, and unused credentials.
- **In-Process Scheduler**: APScheduler runs daily automated governance sweeps.

### 5. React + TypeScript + Material UI Frontend
- **Dashboard**: Real-time KPI cards, interactive status distribution donut chart, top risk rankings, stale alerts, and live audit activity stream (auto-refreshing every 30s).
- **Agent Directory**: Searchable, filterable table with status chips, risk badges, scope chips, and pagination.
- **Register Agent**: Clean registration wizard with one-time copyable modal for issued credentials.
- **Agent Detail**: Deep profile card, credential history timeline, agent-specific audit logs, and action controls.
- **Quarterly Reviews**: Comprehensive governance report tracking overdue rotations (>90d), stale agents, and risk rankings.
- **Audit Logs**: Filterable log viewer for all system operations with search and action filters.

---

## Project Structure

```
agent-identity-management/
├── app/
│   ├── main.py                 # FastAPI application, CORS, lifecycle scheduler
│   ├── config.py               # Pydantic BaseSettings & startup guards
│   ├── database.py             # SQLAlchemy engine & session factory
│   ├── utils.py                # Shared timezone utilities
│   ├── models/                 # SQLAlchemy models (agent, credential, audit)
│   ├── schemas/                # Pydantic schemas (requests, responses, validators)
│   ├── routes/                 # API routers (agent, auth, review)
│   ├── services/               # Token, review, and revocation services
│   └── middleware/
│       └── scope_checker.py     # Fast scope enforcement & audit interceptor
├── frontend/                   # React 18/19 + TypeScript + Vite + Material UI v5
│   ├── src/
│   │   ├── api/client.ts       # Typed Axios API client
│   │   ├── components/         # Layout, StatusChip, RiskBadge, TokenDialog, AdminModal
│   │   ├── context/            # Notification & Auth context providers
│   │   ├── pages/              # Dashboard, AgentList, AgentDetail, Register, Review, AuditLogs
│   │   ├── types/              # Domain TypeScript interfaces
│   │   ├── App.tsx             # Root router & theme definition
│   │   └── main.tsx            # React entry point
│   ├── package.json
│   └── vite.config.ts
├── tests/                      # Pytest automated test suite
│   ├── conftest.py             # TestClient fixtures, in-memory DB isolation
│   ├── test_registration.py     # Registration & validation tests
│   ├── test_scope_enforcement.py# Scope access control & rejection tests
│   ├── test_rotation.py        # Token rotation & immediate invalidation tests
│   ├── test_stale_and_revoke.py # Inactivity detection & auto-revoke tests
│   └── test_lifecycle.py       # Suspend, reactivate, and decommission tests
├── scripts/
│   ├── seed_agents.py          # Seeds FinanceBot, HRBot, AuditBot
│   └── run_success_criteria_tests.py # Phase 6 end-to-end verification script
├── render.yaml                 # Render Infrastructure-as-Code deployment blueprint
├── requirements.txt            # Python dependencies
├── requirements-dev.txt        # Development & testing dependencies
├── .env.example                # Example environment variables template
└── README.md
```

---

## Getting Started

### Prerequisites
- **Python**: 3.11+
- **Node.js**: 18+ (with `npm`)

---

### Backend Setup

1. **Activate Virtual Environment**:
   ```bash
   # From the project root
   python -m venv venv

   # Windows
   venv\Scripts\activate
   # macOS / Linux
   source venv/bin/activate
   ```

2. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   pip install -r requirements-dev.txt
   ```

3. **Configure Environment**:
   ```bash
   # Copy sample environment configuration
   cp .env.example .env     # Windows PowerShell: Copy-Item .env.example .env
   ```

4. **Start the API Server**:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   - **API Root**: [http://localhost:8000](http://localhost:8000)
   - **Interactive API Docs (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)
   - **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

---

### Frontend Setup

1. **Navigate to `frontend/`**:
   ```bash
   cd frontend
   ```

2. **Install Dependencies & Run Development Server**:
   ```bash
   npm install
   npm run dev
   ```
   - **Frontend UI**: [http://localhost:5173](http://localhost:5173)

---

## Running the Automated Test Suite

The test suite runs 35+ comprehensive unit and integration tests using in-memory SQLite isolation:

```bash
# In the project root (with venv active):
pytest tests/ -v
```

### Test Coverage Breakdown:
- **`test_registration.py`**: Agent creation, scope validation, ID generation, pagination.
- **`test_scope_enforcement.py`**: Scope enforcement (`read`, `write`, `admin`), invalid token rejection (401), unauthorized scope denial (403), admin privilege superset.
- **`test_rotation.py`**: Immediate rejection of old tokens, new token validation, non-admin rotation restrictions, credential history tracking.
- **`test_stale_and_revoke.py`**: Inactivity thresholds, stale flagging, auto-revocation transitions, quarterly report inclusions.
- **`test_lifecycle.py`**: Admin-scoped suspension, reactivations with fresh credential issuance, decommission revocation cascades, audit event stamping.

---

## Phase 6 Success-Criteria Verification

With the backend server running in one terminal (`uvicorn app.main:app --reload`):

```bash
python -m scripts.run_success_criteria_tests
```

**Expected Output:**
```
Registered:
 FinanceBot: AID-XXXXXXXX
 HRBot:      AID-YYYYYYYY
 AuditBot:   AID-ZZZZZZZZ

[PASS] FinanceBot Read -> HTTP 200 (expected Pass)
[PASS] FinanceBot Write -> HTTP 403 (expected Denied)
[PASS] HRBot Write -> HTTP 200 (expected Pass)
[PASS] AuditBot Admin -> HTTP 200 (expected Pass)
```

---

## Environment Variables Reference

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./aims.db` | SQLAlchemy database connection URI (SQLite for local dev, PostgreSQL for production). |
| `JWT_SECRET_KEY` | `dev-secret-change-me` | Secret key used to sign bearer JWTs. Must be changed in production. |
| `JWT_ALGORITHM` | `HS256` | Cryptographic algorithm for JWT signing. |
| `STALE_THRESHOLD_DAYS` | `30` | Number of days of inactivity before an agent is flagged as `STALE`. |
| `AUTO_REVOKE_THRESHOLD_DAYS` | `90` | Number of days before a stale agent is automatically `REVOKED`. |
| `CREDENTIAL_LIFETIME_DAYS` | `90` | Default validity period for newly issued credentials. |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Comma-separated list of origins allowed by CORS middleware. |
| `DEBUG` | `true` | Debug flag. When set to `false`, server enforces strong `JWT_SECRET_KEY` on startup. |
| `AUTH0_ENABLED` | `false` | Enables external Auth0 OIDC verification. |
| `VITE_API_BASE_URL` | `http://localhost:8000` | Frontend environment variable specifying backend endpoint. |

---

## Deployment on Render

AIMS includes a turnkey [`render.yaml`](render.yaml) Blueprint configuring both the Python Web Service and the Vite Static Site.

### Step-by-Step Deployment:

1. **Push Repository to GitHub**:
   ```bash
   git push origin main
   ```

2. **Create Render Blueprint**:
   - Log into [Render.com](https://render.com).
   - Click **New +** $\rightarrow$ **Blueprint**.
   - Connect your AIMS GitHub repository.
   - Render will parse `render.yaml` and configure:
     - **`aims-api`**: Python web service (`uvicorn app.main:app --host 0.0.0.0 --port $PORT`).
     - **`aims-frontend`**: Static web application publishing `frontend/dist`.

3. **Configure Database (Production)**:
   - For persistent production data, provision a **Render Managed PostgreSQL** database instance.
   - Update `DATABASE_URL` in the `aims-api` Environment settings to your PostgreSQL internal connection URL.

4. **Verify Deployment**:
   - Access the live frontend application URL provided by Render.
   - Test registration, rotation, and governance sweeps directly from the live UI!
