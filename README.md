This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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

## Release and hotfix flow

- Normal releases: `feature/* → stage → main` (optionally through `local` before `stage`). A push to `stage` deploys staging; a push to `main` deploys production.
- Urgent production fixes: create `hotfix/<name>` from the production revision on `main`, include only the fix, test locally against the production-compatible backend, and open a PR into `main`. The existing CI checks still run; merging deploys production without merging unfinished staging features.
- After release, open a PR from the same `hotfix/<name>` branch into `stage` before deleting it. This keeps the fix in future releases.
- There is no separate hotfix environment. Frontend and backend fixes use separate PRs; coordinate their deployment order and keep their API changes compatible. Backend migration checks must use the production schema, not the newer staging schema.
- Repository settings must protect `main` against direct pushes and require the `Validate branch flow`, `Test and lint`, and `Build production image` checks. Workflow files alone do not enforce these protections. Production deployment still starts automatically after a push to `main`, subject to any existing environment approvals.

## Portal authentication

Seller and manager login, refresh and logout use `/portal-auth/{portal}/{action}/`
in Next.js. Each portal has its own HttpOnly refresh cookie; browser JavaScript
receives only the access token. The old shared Django refresh cookie is ignored.
Existing users must sign in again once after upgrading.

Set the server-only `BACKEND_URL` at runtime to the Django base URL reachable from
Next.js (for example `http://web:8000` in a shared Docker network). Development
defaults to `http://127.0.0.1:8000`. Production requires `BACKEND_URL` explicitly.
The reverse proxy must send `/portal-auth/` to Next.js and preserve the `Host`,
`Origin` and trusted client `X-Forwarded-For` headers. `/api/` routing stays unchanged.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
