---
name: senior-backend
description: >
  Backend engineering guide for Lisva Shop (Next.js 16 server actions and route handlers, Prisma 6 on
  PostgreSQL, Zod, Auth.js, Telegram alerts): architecture, data integrity, security review, query and
  index checks, migrations. Use when building or reviewing server-side code, fixing slow queries,
  changing the schema, or hardening an endpoint.
license: MIT + Commons Clause
metadata:
  version: 1.3.0-lisva
  author: borghei (original), adapted for Lisva Shop
  category: engineering
  domain: backend
  updated: 2026-11-15
  tags: [nextjs, prisma, postgresql, zod, security, migrations]
---
# Senior Backend (Lisva edition)

Adapted from a generic Express/Fastify/Koa skill to this project. **Project rules win over anything in this skill:** `CLAUDE.md`, `docs/constitution.md`, `docs/SPEC.md`, and the feature's `spec.md` / `plan.md`. The `backend-builder` agent follows this skill.

## Project facts

| Topic | This project |
|---|---|
| Runtime | Next.js 16 App Router, `cacheComponents` on, `src/proxy.ts` (not middleware). Read `node_modules/next/dist/docs/` before using an API. |
| Entry points | Server actions and route handlers only. No separate API server. |
| Domain code | `src/lib/<domain>/`: plain functions taking the Prisma client first (`createOrder(db, input)`). No repositories or DI containers. |
| Database | PostgreSQL 16 (Docker locally, managed in production). Prisma **6.19** (Prisma 7 needs Node 22.18+; local Node is 20.13). |
| Schema | `prisma/schema.prisma` plus hand-written SQL in the init migration (CHECK constraints, NULL-safe unique index, pg_trgm index). Diagram: `docs/specs/001-database/diagram.md`. |
| Validation | Zod 4 at every edge. |
| Errors | Typed business errors with a stable `code` (`OrderError`); actions return `{ ok, data } | { ok: false, error }`. |
| Auth | Auth.js (planned, F08), roles CUSTOMER / ADMIN. |
| Alerts | Telegram Bot API after commit; failure never fails the order. |
| Tests | Vitest 4; DB tests use the real `lisva_test` database (`src/test/db.ts`). Needs `npm run db:up`. |
| Commands | `npm run db:up / db:migrate / db:deploy / db:seed / db:studio`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`. |

## Workflows

### 1. Build a backend feature
1. Read `spec.md`, `plan.md`, `tasks.md`, then the relevant Next.js guide.
2. Put business rules in a domain function; keep pure rules (pricing, transitions) as separate pure functions.
3. Write tests first for anything touching money, stock or status (happy path, out of stock, invalid transition, concurrent change, rollback).
4. Add the thin entry point: parse with Zod, authorize, call the domain function, map the result.
5. Run lint, typecheck, tests and build. Then run the security checklist below.

### 2. Review server-side code (checklist)
- Authorization checked on the server for every non-public action? Ownership checked for every read or write by id?
- Input bounded (lengths, array sizes, ranges, enums)?
- Multi-step writes in one `$transaction`; decisions made on reads inside it; races guarded by conditional `updateMany`?
- Side effects (Telegram, email, revalidation) after commit, failures tolerated and logged?
- Prices and names recomputed from the database, never taken from the client?
- No personal data (phone, address, email) or secrets in logs? New env names in `.env.example` and validated at startup?
- Public create endpoints idempotent against double submit and rate-limited?
- No returning raw Prisma models to the client?

### 3. Investigate a slow query
1. Reproduce with realistic data (`npm run db:seed`, or more rows).
2. `docker exec lisva-db psql -U lisva -d lisva -c "EXPLAIN (ANALYZE, BUFFERS) <query>"`.
3. Read the plan (see `references/database_optimization_guide.md`, sections 1-3). Add only the index the plan needs; check it is used; drop indexes that never are.
4. Fix N+1 with Prisma `include`/`select` or one batched query. Paginate every list.

### 4. Change the schema
1. Edit `prisma/schema.prisma`.
2. `npx prisma migrate dev --create-only --name <change>` (in a real terminal; it can hang without one), review the SQL, add hand-written SQL if Prisma cannot express it.
3. Apply it, then check drift: `prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script` must print an empty migration.
4. Never edit an applied migration. Breaking changes use expand, backfill, contract. Prisma has no automatic down migration, so write the rollback plan in the migration's comment before applying it anywhere shared.
5. Run the full test suite.

### 5. Load-test (later, optional)
Only against localhost or staging, never production, and only with the owner's agreement (it sends real traffic). Read `scripts/api_load_tester.py` first. Always pass `--min-success` so a run where most requests failed does not look like a pass.

## Reference docs: what applies here
Based on the section headings; read the sections you need, not whole files.

| File | Use for | Skip (does not fit this project) |
|---|---|---|
| `references/backend_security_practices.md` | OWASP sections (broken access control, injection, logging), input validation with Zod | Express middleware and helmet snippets (use `headers` in `next.config.ts` instead), JWT sections (Auth.js owns sessions) |
| `references/database_optimization_guide.md` | EXPLAIN, indexing strategies, N+1 | `pg-pool` pooling (Prisma manages it), DataLoader (use Prisma batching) |
| `references/api_design_patterns.md` | Error-handling and pagination ideas; webhook design in release 2 | REST resource naming, versioning, GraphQL (no public API yet) |
| `references/workflows-and-patterns.md`, `references/tools-reference.md` | Load-tester usage only | Scaffolder and Express patterns |

Each reference file carries a short note at the top repeating this.

## Tools: status in this project

| Tool | Status | Notes |
|---|---|---|
| `scripts/api_load_tester.py` | Usable later | Standard library only; the only script that uses the network. See workflow 5. |
| `scripts/api_scaffolder.py` | **Not used** | Generates Express/Fastify/Koa routes from OpenAPI. We have no such server. |
| `scripts/database_migration_tool.py` | **Do not rely on it** | Run on a real `pg_dump` of our database it reported "Tables: 0" and no findings: its parser does not handle quoted CamelCase names, so the result is a false all-clear. Use EXPLAIN and schema review instead. (Read-only unless `--output` is given.) |

`assets/` holds sample OpenAPI and SQL files for the original tools; ignore them.

## Anti-patterns
Generic (kept from the original skill):
- Adding an index for every slow query. Read the plan, add what it needs, drop unused ones.
- Shipping a migration without thinking through the rollback.
- Reading a load test that "finished" as a pass. Check the success rate; gate with `--min-success`.

Specific to Lisva:
- Business logic in a route handler or server action.
- Side effects (Telegram, email) inside a transaction.
- Read-then-write on stock or status instead of a conditional update.
- Trusting a price, name or total sent by the browser.
- Logging customer phone numbers or addresses.
- Editing an applied migration, or dropping the hand-written SQL.
- Mocking Prisma in tests instead of using the test database.

## Scope
Covers: server-side architecture, data integrity, security review, query and index checks, migrations, load testing, for this codebase.
Does not cover: UI (see `senior-frontend`), infrastructure and CI/CD, monitoring and tracing, GraphQL.
