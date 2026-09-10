# E-Way Bill Module — Deployment Guide

## Overview

The E-Way Bill module supports generation, vehicle updates, validity extension, cancellation, PDF/email export, and reporting. By default it runs in **sandbox mode** (mock EBN) so you can test without NIC/GSP credentials.

## Database migration

```bash
npx prisma migrate deploy
npx prisma generate
```

Migration: `20260706140000_eway_bill_module`

## Environment variables

Add to `.env`:

```env
# Required for encrypted GSP credential storage (uses AUTH_SECRET if set)
AUTH_SECRET="your-long-random-secret"

# E-Way Bill GSP integration
EWAY_GSP_MODE="sandbox"          # sandbox | live
EWAY_GSP_BASE_URL=""             # Your GSP proxy URL when live

# Optional: email E-Way Bill PDFs
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""
EMAIL_FROM="Accounting <noreply@example.com>"
```

## Sandbox vs production

| Mode | `EWAY_GSP_MODE` | `sandboxMode` (UI) | Behaviour |
|------|-----------------|--------------------|-----------|
| Sandbox | `sandbox` (default) | ON | Mock 12-digit EBN, 24h validity |
| Live | `live` | OFF | HTTP calls to `EWAY_GSP_BASE_URL` |

Configure GSP credentials under **GST → E-Way Bills → Settings**. Credentials are encrypted with AES-256-GCM via `AUTH_SECRET`.

## Permissions

Uses existing GST permissions:

- `gst.view` — dashboard, detail, PDF download, reports
- `gst.edit` — create, generate, cancel, vehicle update, settings

Accountant role includes `gst.*` by default.

## User workflow

1. **Tax invoice** — open a posted invoice → **E-Way for INV-xxx**
2. **Delivery challan** — Sales → Delivery Challans → create & dispatch → **E-Way for DC-xxx**
3. **Purchase return** — Purchases → Purchase Returns → create & dispatch → **E-Way for PR-xxx**
4. Enter transport mode, vehicle number, distance (km)
5. **Save transport** → **Generate E-Way Bill**
6. Download PDF, print, email, update vehicle (Part-B), extend validity, or cancel

## API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/gst/eway-bills/dashboard` | KPI stats |
| GET | `/api/gst/eway-bills` | List with filters |
| POST | `/api/gst/eway-bills` | Create from invoice body |
| GET/POST | `/api/gst/eway-bills/from-invoice/[id]` | Preview / create |
| GET/POST | `/api/gst/eway-bills/from-delivery-challan/[id]` | Preview / create from challan |
| GET/POST | `/api/gst/eway-bills/from-purchase-return/[id]` | Preview / create from purchase return |
| GET/PATCH/DELETE | `/api/gst/eway-bills/[id]` | Detail / edit / cancel |
| POST | `/api/gst/eway-bills/[id]/generate` | Submit to GSP |
| POST | `/api/gst/eway-bills/[id]/vehicle` | Part-B update |
| POST | `/api/gst/eway-bills/[id]/extend` | Extend validity |
| POST | `/api/gst/eway-bills/[id]/cancel` | Cancel with reason |
| GET | `/api/gst/eway-bills/[id]/pdf` | PDF download |
| POST | `/api/gst/eway-bills/[id]/email` | Email PDF |
| GET/PATCH | `/api/gst/eway-bills/settings` | Company settings |
| GET/POST | `/api/gst/eway-bills/transporters` | Transporter master |
| GET | `/api/gst/eway-bills/reports?type=&format=` | CSV/XLSX/PDF/JSON |

## Tests

```bash
npm run test:eway
```

## Production checklist

- [ ] Run Prisma migration on production DB
- [ ] Set strong `AUTH_SECRET`
- [ ] Obtain GSP credentials from authorized GST Suvidha Provider
- [ ] Set `EWAY_GSP_MODE=live` and `EWAY_GSP_BASE_URL`
- [ ] Disable sandbox in E-Way Bill settings
- [ ] Configure SMTP for email delivery
- [ ] Verify company GSTIN and addresses in Organization Profile
- [ ] Train users on cancellation windows and vehicle update rules per NIC guidelines

## Schema tables

- `EWayBill`, `EWayBillLine` — core document
- `Transporter` — transporter master
- `EWayBillVehicleUpdate` — vehicle movement history
- `EWayBillStatusHistory` — status audit trail
- `EWayBillApiLog` — API request/response logs
- `EWayBillSettings` — thresholds, automation, encrypted credentials
