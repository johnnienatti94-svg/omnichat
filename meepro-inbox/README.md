# MeePro Inbox

Private working prototype of a customer-service inbox. Facebook, Instagram and TikTok Shop are represented with explicitly marked sample conversations. No external channel is connected and no live message sending is implemented.

## Implemented
- Filter/search demo conversations, reply, resolve/reopen, assign to self, tag and keep customer/internal notes.
- Saved replies and contact directory.
- Overview derived from conversation records.
- Save non-secret business profile details for connection planning.
- Server persistence in D1, per-authenticated-owner isolation, same-origin write checks, input validation and idempotent reply inserts.
- Hosted identity is supplied by Sites private access. Anonymous API reads/writes are rejected.

## Live integration work remaining
1. Confirm Facebook Page, Instagram professional account, and whether TikTok means TikTok Shop or ordinary DMs.
2. Configure the relevant platform developer applications, messaging access and account authorization; verify the current provider API contracts and regional account eligibility.
3. Provision publicly reachable verified webhook ingress separately from the owner-private UI, validate signatures, deduplicate provider events, and associate account-scoped customer identifiers.
4. Add encrypted server-side token storage, refresh/revocation handling, outbound message adapters, delivery status and provider-specific reply-window enforcement.
5. Test a real inbound/outbound round trip before enabling the Live inbox.
6. Add explicit staff membership and branch/team authorization before multi-user production rollout. This version stores each authenticated owner’s demo workspace separately.

No passwords, tokens or Zaapi account data are included in source or sample data.

## Validation
Production build and TypeScript check passed. A local built-worker test passed persistence, idempotent demo sends, notes, resolution, saved replies, closed-ticket reply rejection, owner isolation and anonymous rejection. Browser review covered desktop layout, search and connection setup. Mobile behavior is implemented with responsive styles but was not separately browser-emulated. WebMCP filter registration is feature-detected; runtime testing was unavailable in the preview browser.
