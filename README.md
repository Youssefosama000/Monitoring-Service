# Alamar Monitoring Service

Monitor your domains and IPs 24/7. Get email alerts instantly when anything goes down and when it recovers.

---

## Requirements

Make sure you have these installed before starting:

- [Node.js](https://nodejs.org/) v18 or higher
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for the database)
- [Git](https://git-scm.com/)

---

## How to Run the Project

### Step 1 — Clone the repository

```bash
git clone https://github.com/Youssefosama000/Monitoring-Service.git
cd Monitoring-Service
```

### Step 2 — Install dependencies

```bash
npm install
```

### Step 3 — Configure environment variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Open `.env` and fill in your SMTP credentials:

```env
PORT=3000

DB_HOST=localhost
DB_PORT=5433
DB_NAME=alamar_monitoring
DB_USER=alamar
DB_PASS=alamar123

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_gmail@gmail.com
SMTP_PASS=your_gmail_app_password
EMAIL_FROM=alerts@yourdomain.com
```

> For Gmail: go to https://myaccount.google.com/apppasswords and generate an App Password.

### Step 4 — Start the database

Make sure Docker Desktop is running, then:

```bash
docker compose up -d
```

This starts a PostgreSQL database on port 5433 and runs the schema automatically.

Verify it is running:

```bash
docker ps
```

You should see `alamar_postgres` with status `Up`.

### Step 5 — Start the server

```bash
node server.js
```

You should see:

```
Alamar Monitoring running at http://localhost:3000
```

The monitoring worker starts automatically with the server and checks all targets every 60 seconds.

### Step 6 — Open the dashboard

Open your browser and go to:

```
http://localhost:3000
```

---

## How to Use

1. Click **Add Monitor** in the sidebar
2. Enter a domain (e.g. `example.com`) or IP address (e.g. `1.2.3.4`)
3. Select the type and protocol
4. Enter the email address to receive alerts
5. Click **Add Monitor**

The system checks the target immediately and updates the status to **UP** or **DOWN** within seconds.

When a target goes down, an email alert is sent to the address you entered. When it recovers, a second email is sent automatically.

---

## Project Structure

```
Monitoring-Service/
├── server.js                   ← Main entry point — starts server + worker
├── docker-compose.yml          ← PostgreSQL database
├── .env.example                ← Environment variable template
├── database/
│   ├── schema.sql              ← Database tables (auto-loaded by Docker)
│   └── db.js                   ← Database connection
├── api/
│   ├── routes.js               ← API endpoint definitions
│   └── monitorController.js    ← Request handlers
├── worker/
│   ├── monitorWorker.js        ← Runs health checks on schedule
│   └── checker.js              ← HTTP / HTTPS / Ping / TCP check logic
├── services/
│   └── emailService.js         ← Sends DOWN and RECOVERY emails
├── middleware/
│   └── auth.js                 ← Auth middleware (connect to your auth system)
├── utils/
│   └── targetValidator.js      ← Validates domain and IP formats
└── frontend/
    ├── index.html              ← Dashboard UI
    ├── style.css               ← Styles
    └── app.js                  ← Frontend logic
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/monitors` | Add a new domain or IP to monitor |
| `GET` | `/api/monitors` | List all monitors |
| `GET` | `/api/monitors/:id` | Get details of one monitor |
| `PATCH` | `/api/monitors/:id` | Update monitor settings |
| `DELETE` | `/api/monitors/:id` | Delete a monitor |
| `GET` | `/api/monitors/:id/history` | Get status check history |

### POST /api/monitors — Body

```json
{
  "target": "example.com",
  "target_type": "DOMAIN",
  "notification_email": "alerts@example.com",
  "protocol": "HTTPS",
  "check_interval_seconds": 60
}
```

| Field | Required | Options | Default |
|-------|----------|---------|---------|
| `target` | Yes | domain or IP | — |
| `target_type` | Yes | `DOMAIN`, `IP` | — |
| `notification_email` | Yes | any email | — |
| `protocol` | No | `HTTP`, `HTTPS`, `PING`, `TCP` | `HTTP` |
| `port` | No | 1–65535 | null |
| `check_interval_seconds` | No | 30–86400 | `60` |

---

## How Monitoring Works

- The worker runs every **60 seconds** and checks all active targets
- When a new monitor is added, it is checked **immediately**
- A target must fail **2 consecutive checks** before being marked DOWN (prevents false alarms)
- When a target goes DOWN → email alert is sent
- When a target recovers back to UP → recovery email is sent
- All check results are stored in the `status_history` table

---

## Email Alerts

Two emails are sent automatically:

**DOWN alert subject:** `[ALERT] Your domain example.com is DOWN`

**Recovery alert subject:** `[RESOLVED] Your domain example.com is back UP`

All emails are logged in the `alert_emails_log` database table.

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `monitored_targets` | All registered domains and IPs with current status |
| `status_history` | Every individual check result |
| `alert_emails_log` | Audit log of all sent emails |

---

## For the Development Team

1. **Auth** — `middleware/auth.js` currently injects a fixed `customer_id = 1`. Replace this with your real session or JWT verification.
2. **SMTP** — Fill in real credentials in `.env` to enable email alerts. Gmail App Passwords work out of the box.
3. **Production deployment** — Run `node server.js` with PM2 to keep it alive:
   ```bash
   npm install -g pm2
   pm2 start server.js --name alamar-monitoring
   pm2 save
   pm2 startup
   ```
4. **Port conflict** — If port 5432 is already in use on your machine, the database uses port 5433 by default (configured in `docker-compose.yml` and `.env`).
