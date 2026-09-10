# Tally → ERP Migration Guide

## Root cause analysis (previous implementation)

The prior Tally integration was a **connectivity stub only**:

| Issue | Root cause |
|-------|------------|
| Ledgers not imported | Sync POSTed an **empty** `TALLYMESSAGE` — no COA parser |
| Wrong COA hierarchy | No GROUP import; default ERP chart unrelated to Tally |
| Opening balance mismatch | Opening balances never read from Tally XML |
| Vouchers incomplete | No voucher parser or `JournalEntry` creation |
| GST / inventory wrong | No HSN, stock item, or GST ledger mapping |
| Parent-child lost | `Account.parentId` never set from Tally `PARENT` |
| Reports differ | No reconciliation engine; TB compared opening-only after voucher import |

**Fixes in this build:** auto-create missing parent groups, update existing group hierarchy on re-import, closing trial balance reconciliation (OB + vouchers), bridge export includes vouchers + stock items, legacy Sync button redirects to migration panel.

## New architecture

```
Tally XML / Bridge → xml-parser → migration-service
                      ├─ coa-importer      → Account + TallyEntityMap
                      ├─ voucher-importer  → JournalEntry (TALLY_IMPORT)
                      ├─ inventory-importer → Item
                      └─ reconciliation    → Trial balance compare
```

### Modules (`src/lib/tally/`)

| Module | Purpose |
|--------|---------|
| `xml-parser.ts` | Parse GROUP, LEDGER, VOUCHER, STOCKITEM from Tally XML |
| `group-mapping.ts` | Tally group → `AccountType`, reserved groups |
| `coa-importer.ts` | Hierarchy-preserving COA sync with entity maps |
| `voucher-importer.ts` | All voucher types → balanced journal entries |
| `inventory-importer.ts` | Stock items, HSN, opening qty/value |
| `reconciliation.ts` | Tally vs ERP trial balance drill-down data |
| `tally-bridge.ts` | TallyPrime HTTP export requests |
| `migration-service.ts` | Job orchestration, audit logs |

### Database

- `TallyMigrationJob` — run status, stats, reconcile JSON
- `TallyMigrationLog` — phase-level INFO/WARN/ERROR
- `TallyEntityMap` — idempotent Tally key → ERP id mapping
- `TallyMigrationSnapshot` — parsed summary + source hash
- `Account.tallyGuid`, `isTallyGroup`, `tallyParentName`
- `JournalEntry.tallyVoucherKey/Type/Number`

## Supported import sources

1. **Tally XML upload** — Company backup / Day Book / Masters export
2. **TallyPrime HTTP bridge** — POST export collections to `http://localhost:9000`
3. **Excel / JSON** — Convert to Tally XML envelope, then upload (converter script can be added)

ODBC: use Tally ODBC → export XML, then upload.

## Workflow

1. Enable **Tally integration** in Settings → General
2. Open **Integrations → Tally**
3. Configure bridge URL (if using live export)
4. Select phases: COA, Vouchers, Inventory, Reconcile
5. **Upload Tally XML** or **Import from Tally bridge**
6. Review job logs and trial balance reconciliation
7. Fix mismatches (missing ledgers listed in logs) and re-run (idempotent maps)

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/integrations/tally/migration` | List jobs |
| POST | `/api/integrations/tally/migration/run` | Upload XML (multipart) or `{ source: "tally_api" }` |
| GET | `/api/integrations/tally/migration/[jobId]` | Job detail + logs + reconcile |

## Validation tests

```bash
npm run test:tally
```

Tests verify XML parsing, group classification, voucher lines, and trial balance extraction.

## Production checklist

- [ ] Run `npx prisma db push` or migrate
- [ ] Export full masters + vouchers from Tally (XML)
- [ ] Run COA phase first; verify hierarchy in Chart of Accounts
- [ ] Run voucher phase; confirm trial balance reconcile = 0 mismatches
- [ ] Compare GSTR-1/3B manually until GST voucher mapper extended
- [ ] For 100k+ vouchers, run vouchers-only incremental jobs with `sourceHash` dedup

## Known limits (next iteration)

- GST voucher inventory allocations (BILLALLOCATIONS, INVENTORYENTRIES) — partial
- Cost centres / godowns — schema hooks via `TallyEntityMap`, importers TBD
- Multi-company — single company per job
- Excel direct import — use XML conversion step
