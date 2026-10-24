This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Importing bank transactions

`POST /api/import/transactions` is exempt from the login redirect and instead requires `Authorization: Bearer` matching the `IMPORT_API_TOKEN` environment variable. The endpoint responds with 401 when the variable is unset, missing, or wrong. Rows are inserted in one SQLite transaction and skipped when the same statement line is imported again.

Set the token (production):

```bash
fly secrets set IMPORT_API_TOKEN="$(openssl rand -hex 32)" -a nwtracker
```

Optional cron access for `POST /api/hevy/sync` uses a separate secret. Without it, that route requires a logged-in session:

```bash
fly secrets set HEVY_SYNC_TOKEN="$(openssl rand -hex 32)" -a nwtracker
```

Import a statement (creates a CASH account named Chase UK, institution Chase UK, when that account does not already exist):

```bash
curl -sS -X POST https://nwtracker.fly.dev/api/import/transactions \
  -H "Authorization: Bearer $IMPORT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "account": "Chase UK",
    "statementMonth": "2026-09",
    "openingBalance": 230.76,
    "closingBalance": 507.11,
    "transactions": [
      {
        "date": "2026-09-01",
        "description": "From HARGREAVES LANSDOW - HLAM CLIENT ACC",
        "type": "Payment",
        "amount_gbp": 150.00,
        "direction": "in",
        "balance_gbp": 380.76,
        "category": "Income/Transfers in"
      },
      {
        "date": "2026-09-02",
        "description": "ALDI",
        "type": "Purchase",
        "amount_gbp": 12.12,
        "direction": "out",
        "balance_gbp": 362.76,
        "category": "Groceries"
      }
    ]
  }'
```

A successful response looks like `{ "inserted": 2, "skipped": 0, "balanceCheck": { "ok": false } }`. `balanceCheck.ok` is true when the opening balance plus every signed amount matches the closing balance and each running balance. Dates may also be written as `01 Sep 2026`. Open `/spending` after the import.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
