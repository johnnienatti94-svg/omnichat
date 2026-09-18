# MeePro Omnichannel Customer Inbox (Omnichat)

> **Enterprise Multi-Channel Customer Inbox & Sales Platform**  
> Supporting **Facebook Messenger**, **Instagram Direct**, and **TikTok Shop Customer Chat**  
> Built with **React 19**, **Next.js / Vinext**, **TypeScript**, **Cloudflare D1 / Drizzle ORM**, **Tailwind CSS**, and **shadcn/ui**.

---

## 🌟 Key Capabilities

1. **Unified Omnichannel Inbox**
   - Consolidated 3-column inbox uniting Facebook Messenger, Instagram Direct, and TikTok Shop customer conversations into a single operational interface.
   - Real-time SLA indicators, priority badges (`urgent`, `high`, `normal`, `low`), and unread notifications.
   - Quick replies with keyboard shortcut trigger (`/` slash command) and keyword instant search.
   - 24-Hour policy reply window indicator preventing accidental platform policy breaches.

2. **Executive Analytics & Sales Performance Dashboard**
   - Live KPI summary cards: Total Won Revenue (`฿`), Win Rate (`%`), Active Open Tickets with Urgency breakdown, and Resolved Case Rate with CSAT ratings.
   - Channel volume and revenue contribution distribution bars.
   - Inquiry categorization tracking by issue type and tags.
   - Team Performance Leaderboard tracking agent on-duty status, assigned tickets, resolved cases, won deals, and total sales generated.
   - Deep-link queues for Recent Won Deals and Urgent Tickets.

3. **Ticket Lifecycle & Case Closure with Sales Tracking**
   - Rich case metadata: Total sales currency input (`THB`), successful sales outcome toggle, issue classification, and resolution notes.
   - Automated 24-hour reopen rule: reopens resolved tickets automatically when a customer replies within 24 hours.

4. **Team Management & Fine-Grained Access Control**
   - Organization multi-tenancy with staff roles: **ผู้ดูแลบัญชี (Admin)**, **Supervisor**, and **แอดมิน (Agent)**.
   - Channel-level access permissions: restrict agents to specific channels (e.g. TikTok only vs. all channels).
   - Weekly working hours schedule per staff member with Asia/Bangkok timezone calculation.

5. **Intelligent Routing & Business Automations**
   - Least-busy round-robin auto-assignment among on-duty staff.
   - Previous agent affinity routing for returning customers.
   - Off-hours auto-responder and welcome greetings.
   - Keyword-based auto-tagging engine (e.g. "ผ่อน" -> `ผ่อนชำระ`, `high priority`).
   - Interactive Live Sandbox Simulator in automation settings for testing rule matching in real time.

6. **Provider Webhook Gateway & Security Architecture**
   - Normalized Message Model standardizing multi-channel events.
   - Web Crypto HMAC-SHA256 signature verification with timing-safe comparison (`X-Hub-Signature-256`).
   - Idempotent deduplication discarding re-delivered webhooks.
   - Outbound send API enforcing strict 24-hour platform reply windows.
   - AES-256-GCM symmetric encryption for channel access tokens and credentials.
   - Zero-token exposure on client APIs.
   - Immutable security and audit trail logging in `audit_logs`.

---

## 📂 Repository Layout

```text
├── Docs/                                        # Implementation plan & 7 phase audit reports
│   ├── audit_phase_1_2026-09-18.md              # Phase 1: Project Extraction & Local Dev Verification
│   ├── audit_phase_2_2026-09-18.md              # Phase 2: Database Schema & Multi-Tenancy Architecture
│   ├── audit_phase_3_2026-09-18.md              # Phase 3: Team Management & Staff Access Control
│   ├── audit_phase_4_2026-09-18.md              # Phase 4: Ticket Lifecycle, Case Fields & Sales Tracking
│   ├── audit_phase_5_2026-09-18.md              # Phase 5: Intelligent Routing & Preset Automations
│   ├── audit_phase_6_2026-09-18.md              # Phase 6: Live Channel Adapters & Webhook Gateway
│   ├── audit_phase_7_2026-09-18.md              # Phase 7: Analytics Dashboard, Security & Hardening
│   └── implementation_plan_2026-09-18.md        # Complete Phased Roadmap & Audit Checklists
├── meepro-inbox/                                # Web Application Source Code
│   ├── app/                                     # Next.js App Router (Pages, RSC & API Routes)
│   │   ├── api/
│   │   │   ├── actions/                         # Ticket updates, case fields, sales closure
│   │   │   ├── automations/                     # Automation rules CRUD
│   │   │   ├── channels/send/                   # Outbound channel messaging (24h window enforcement)
│   │   │   ├── team/                            # Team, staff permissions, and audit logs
│   │   │   ├── users/                           # User management & working hours
│   │   │   ├── webhooks/[channel]/              # Unified webhook receiver (FB, IG, TikTok)
│   │   │   └── workspace/                       # Workspace bootstrap with masked tokens
│   │   ├── page.tsx                             # Entry point
│   │   └── workspace.tsx                        # Main application shell & tab routing
│   ├── components/
│   │   ├── analytics/                           # Executive Dashboard & Sales Performance
│   │   ├── inbox/                               # 3-Column Inbox, Chat Bubbles, Quick Replies
│   │   ├── settings/                            # Automation Settings, Audit Trail Explorer
│   │   └── team/                                # Team Management & Staff Access Control
│   ├── db/
│   │   └── schema.ts                            # Drizzle D1 SQLite Database Schema
│   ├── drizzle/                                 # Database Migration Files
│   ├── lib/
│   │   ├── automations-engine.ts                # Keyword triggers & auto-tagging engine
│   │   ├── channels/                            # Channel adapters (Facebook, Instagram, TikTok)
│   │   ├── routing-engine.ts                    # Round-robin, on-duty check & agent affinity
│   │   ├── security/                            # HMAC verifier, AES-256-GCM encryption
│   │   └── ticket-lifecycle.ts                  # Auto-reopen, inactivity, case metrics
│   └── scripts/
│       └── test-webhooks.mjs                    # End-to-end webhook test suite
└── MeePro_Zaapi_Study_and_Implementation_Priorities.md # Product Specification Benchmark
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v20+ or v24+
- **pnpm**: v9+ or v10+

### 2. Installation
```bash
cd meepro-inbox
pnpm install
```

### 3. Type Checking & Build
```bash
# Verify TypeScript definitions
pnpm typecheck

# Compile production bundle
pnpm build
```

### 4. Running Local Development Server
```bash
# Starts Wrangler / Miniflare local D1 server on http://127.0.0.1:8787
pnpm start
```

### 5. Running Automated Webhook & Channel Test Suite
```bash
node scripts/test-webhooks.mjs
```

Test suite validates:
- GET Challenge verification for Facebook Messenger, Instagram Direct, and TikTok Shop.
- HMAC-SHA256 signature verification & rejection of tampered payloads.
- Multi-channel payload normalization into unified message model.
- Idempotent deduplication of re-delivered webhooks.
- Channel-specific agent routing.
- Keyword auto-tagging on webhook arrival.
- 24-Hour reply policy window enforcement (200 OK within 24h, 403 `POLICY_WINDOW_EXPIRED` beyond 24h).

---

## 🔒 Security & Privacy

- **Credential Encryption**: All channel credentials, app secrets, and page access tokens are symmetrically encrypted using Web Crypto AES-256-GCM.
- **Client Sanitization**: Client endpoints (`/api/workspace`) completely strip access tokens to ensure zero token exposure in browser memory or network inspectors.
- **Constant-Time HMAC Verification**: Webhook signatures are validated using constant-time string comparisons to prevent timing side-channel attacks.
- **Audit Logging**: All administrative privilege changes, outbound dispatches, sales closures, and automated bot actions are recorded in the `audit_logs` table.

---

## 📜 License
Private & Proprietary — MeePro
