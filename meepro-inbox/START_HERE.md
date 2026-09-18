# MeePro Inbox — Antigravity source project

This is actual application source, including the inbox UI, server API routes, SQL schema and migrations. It is based on the MeePro demo built in this conversation. It is not a production-ready social messaging service.

## Run locally

Requirements: Node.js 22.13 or newer and the pnpm version declared in package.json. Extract this entire folder and open it as a project in Antigravity.

Run in the project root:

```sh
pnpm install --frozen-lockfile
pnpm build
```

For a NEW local database, apply the initial schema once:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_cynical_abomination.sql
```

Do not reapply that SQL to an initialized database. Future schema changes require new migrations.

Start development:

```sh
pnpm dev
```

Open http://localhost:5173/signin-with-chatgpt?return_to=/ to enable the bundled local-only mock user. Then use http://localhost:5173/ . Keep development bound to loopback. This development login is not real production authentication.

Validate changes:

```sh
pnpm typecheck
pnpm build
```

The clean exported project defaults to the portable execution profile. No internal preview address, database contents, account passwords, access tokens, repository credentials, or existing Site project identity is included.

## What works

- Search and filter sample Facebook, Instagram, and TikTok Shop conversations.
- Persist demo replies, internal notes, customer notes, assignment-to-self and conversation tags.
- Resolve and reopen conversations.
- View contacts and basic counts.
- Create and edit saved text replies.
- Save public account names and profile links for future connection setup.
- Reject unauthenticated API requests, enforce per-user data isolation and validate writes.

Demo replies are database records only: they are not sent to social platforms.

## Main code files

| File | Purpose |
| --- | --- |
| app/workspace.tsx | Inbox, contacts, replies, overview and connection UI |
| app/globals.css | Responsive MeePro theme and layouts |
| app/api/workspace/route.ts | Load the authenticated user's workspace |
| app/api/actions/route.ts | Validate and persist actions |
| lib/inbox-server.ts | Database access, identity and sample-data initialization |
| lib/inbox-data.ts | Types and explicitly fictional sample conversations |
| db/schema.ts | Drizzle database schema |
| drizzle/0000_cynical_abomination.sql | Initial database migration |
| app/chatgpt-auth.ts | Existing hosted authentication helpers |
| vite.config.ts | Vinext, Cloudflare development runtime and local auth setup |

## Production boundaries

The stack is React + TypeScript + Vinext (Next.js-compatible routing) + Cloudflare D1, not a vanilla Next.js/Vercel deployment. The existing production implementation trusts identity headers supplied by the Sites hosting dispatcher. On any other hosting provider, implement verified server-side authentication and replace identity() in lib/inbox-server.ts before exposing the application. Never trust identity headers supplied by an arbitrary Internet client.

All demo data is scoped to an individual authenticated owner. A real shared team inbox requires organization membership, roles, channel permissions and shared organization-scoped records.

The existing Sites project ID is deliberately removed from this export. Do not deploy the placeholder local D1 database ID or local mock login as a production identity system. Select and configure the target hosting environment first.

## Not implemented

- Facebook/Instagram OAuth and live message adapters.
- TikTok Shop authorization and live message adapters.
- General TikTok DMs; support has not been verified.
- Public webhook ingress, signature verification, provider event deduplication and token encryption/refresh.
- Multi-agent teams, staff permissions, automatic routing, media uploads, AI or broadcast sending.

Profile links alone cannot connect business accounts. Obtain the required provider app configuration and authorization through secure flows. Never request passwords in chat or put tokens in frontend code.

## Antigravity handoff

Paste the following instruction into your coding agent:

> Read START_HERE.md and README.md, then inspect the existing code. First install dependencies, initialize the local database only if needed, start the app and verify persistence using the local mock sign-in. Preserve the MeePro interface and clearly marked demo mode. Implement production capabilities in stages: verified authentication and organization roles; official Facebook/Instagram integration; TikTok Shop integration once API access is confirmed; routing and ticket lifecycle rules; sales outcomes and media replies. Before writing provider-specific integration code, verify the current official documentation and required permissions. Never show Connected or Sent until the backend verifies the actual provider result. Keep tokens server-side, validate webhook signatures, deduplicate events and enforce server-side authorization. Do not publish the local mock authentication. Report what is implemented, tested and blocked by missing credentials or platform approval.
