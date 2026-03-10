# Domain / IP Monitoring Service

A background service that monitors customer-registered domains and IPs, and sends email alerts when a target goes down or recovers.

---

## Project Structure

```
monitoring-service/
├── database/
│   └── schema.sql              ← Run this first to set up the DB tables
├── api/
│   ├── routes.js               ← Express API route definitions
│   └── monitorController.js    ← CRUD logic for monitored targets
├── worker/
│   ├── monitorWorker.js        ← Scheduled worker: fetches targets & runs checks
│   └── checker.js              ← HTTP / Ping / TCP health check logic
├── services/
│   └── emailService.js         ← Sends DOWN and RECOVERY alert emails
├── .env.example                ← Copy to .env and fill in credentials
└── README.md
```

---

## Setup Instructions

### 1. Install dependencies

```bash
npm install express express-validator axios nodemailer pg dotenv
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in your values:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=alamar_monitoring
DB_USER=postgres
DB_PASS=yourpassword

# SMTP Email
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your_sendgrid_api_key
EMAIL_FROM=alerts@alamar.com
```

### 3. Set up the database

```bash
psql -U postgres -d alamar_monitoring -f database/schema.sql
```

### 4. Start the API server

```bash
node app.js
```

### 5. Run the monitoring worker

The worker should run every 30–60 seconds via a cron job or PM2:

```bash
# Using cron (every 60 seconds):
* * * * * node /path/to/monitoring-service/worker/monitorWorker.js

# Using PM2 (recommended for production):
pm2 start worker/monitorWorker.js --name monitor-worker --cron "* * * * *"
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/monitors` | Add a domain or IP to monitor |
| `GET` | `/api/monitors` | List all monitors for the customer |
| `GET` | `/api/monitors/:id` | Get details of one monitor |
| `PATCH` | `/api/monitors/:id` | Update monitor settings |
| `DELETE` | `/api/monitors/:id` | Delete a monitor |
| `GET` | `/api/monitors/:id/history` | Get status check history |

### POST /api/monitors — Request Body

```json
{
  "target": "example.com",
  "target_type": "DOMAIN",
  "notification_email": "customer@email.com",
  "protocol": "HTTP",
  "check_interval_seconds": 60
}
```

| Field | Required | Values | Default |
|-------|----------|--------|---------|
| `target` | Yes | domain or IP string | — |
| `target_type` | Yes | `DOMAIN` or `IP` | — |
| `notification_email` | Yes | valid email | — |
| `protocol` | No | `HTTP`, `HTTPS`, `PING`, `TCP` | `HTTP` |
| `port` | No | 1–65535 | null |
| `check_interval_seconds` | No | 30–86400 | `60` |

---

## How the Worker Operates

```
Every N seconds (via cron):
│
├─ Query DB for targets due for a check
│
├─ For each target (in parallel, up to 10 at a time):
│   ├─ Run health check (HTTP/Ping/TCP)
│   ├─ Update current_status and consecutive_failures in DB
│   ├─ Insert row into status_history
│   └─ If status changed to DOWN (after N consecutive fails):
│       └─ Send DOWN alert email → notification_email
│       If status changed from DOWN to UP:
│       └─ Send RECOVERY email → notification_email
```

### Failure threshold logic

- A single failed check does NOT trigger an alert immediately.
- The target must fail **2 consecutive checks** (configurable via `failure_threshold`) before the status flips to DOWN and an email is sent.
- This prevents false alarms from transient network blips.

---

## Email Alerts

Two types of emails are sent automatically:

### DOWN Alert (sent when target goes offline)
- **Subject:** `[ALERT] Your domain example.com is DOWN`
- **Content:** Target name, type, protocol, time detected, error reason

### RECOVERY Alert (sent when target comes back online)
- **Subject:** `[RESOLVED] Your domain example.com is back UP`
- **Content:** Target name, recovered timestamp

All sent emails are logged in the `alert_emails_log` table for audit purposes.

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `monitored_targets` | Stores all customer-registered domains/IPs with current status |
| `status_history` | Log of every individual check result (up or down) |
| `alert_emails_log` | Audit log of every email alert sent |

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `express` | API server |
| `express-validator` | Request validation |
| `axios` | HTTP health checks |
| `nodemailer` | Email delivery |
| `pg` | PostgreSQL client |
| `dotenv` | Environment config |

---

## Notes for the Developer Team

1. **Auth middleware** (`middleware/auth.js`) must inject `req.customerId` — connect this to your existing customer authentication system.
2. **DB client** (`database/db.js`) should export a configured `pg.Pool` instance using the `.env` credentials.
3. **Target validation** (`utils/targetValidator.js`) should validate IP format (regex) and domain format before insert.
4. The worker is stateless and safe to run multiple instances — the DB query uses `last_checked_at` to avoid double-checking the same target.
5. For high scale (1000+ targets), consider replacing the cron worker with a **BullMQ** job queue backed by Redis.
