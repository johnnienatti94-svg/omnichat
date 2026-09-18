# MeePro — Zaapi Study and Implementation Priorities

Study date: 17 September 2026  
Method: Read-only inspection of the authenticated Zaapi web application.  
Purpose: Identify the structure and workflows needed for a MeePro inbox covering Facebook, Instagram, and TikTok Shop.

## 1. Current status and evidence limits

- Zaapi's navigation, settings, automation templates, and configuration forms were inspected directly.
- No settings were saved, users invited, automations activated, or messages sent during the study.
- The inspected account had no conversations or contacts, so populated-chat behavior and end-to-end messaging could not be verified.
- The presence of a feature in the interface establishes its visible configuration, not successful execution or its underlying architecture.
- TikTok was specifically listed as **TikTok Shop**. Support for ordinary TikTok direct messages was not verified.
- MeePro's published app remains a working demo. The additional capabilities identified below have not been implemented.

## 2. Main application structure

| Section | Observed structure |
| --- | --- |
| Tickets / Inbox | My inbox, unassigned, all open tickets, saved views, closed tickets, spam |
| AI chatbot | Knowledge sources, instructions, AI personality, testing, activation, analytics |
| Analytics | Live dashboard, customer service, team performance, SLA breaches, case fields, sales, tags |
| Automations | Preset automations and custom workflows |
| Broadcasts | LINE OA campaign list, status, scheduling, recipient counts, open counts |
| Contacts | Customer directory, channels, tags, contact information, notes, custom fields |
| Settings | Business/account settings, billing, teams, tags, saved replies, case/contact fields, integrations, workflows, exports |

The inbox uses a narrow global navigation bar, contextual sidebar, ticket list, and conversation workspace. The inspected empty state used light surfaces, thin dividers, compact controls, and resizable panels.

## 3. Team management

### Verified interface

Team management contains three tabs:

- Users
- Teams
- Activity log

The user list displays name, role, channel access, contact information, and working hours. The add-user form asks for a full name, email, role, connection access, and working hours.

The existing account was shown as the owner. The add-user role selector offered Thai labels “ผู้ดูแลบัญชี” and “แอดมิน”; the complete permission matrix behind these roles was not inspected.

Connection access can cover all connected accounts or a selected subset. Working hours can follow business hours or be customized for the user.

**Important distinction:** the interface states that staff working hours affect automatic ticket assignment; they do not restrict login times.

### Implication for MeePro

The production app needs staff membership, explicit roles, channel-level access, and shared assignment. The current demo's “assign to me” control is not a complete team-management system.

## 4. Automatic assignment

The assignment template was inspected without saving it.

### Trigger and scope

- Select the connected accounts to which the rule applies.
- Trigger when an unassigned ticket receives a new message.
- Assign to individual agents or a team.

### Distribution options

- Round-robin distribution during agents' working hours.
- Prefer the previous agent when available; otherwise fall back to round-robin.
- Always use round-robin.

### Outside-hours behavior

The form offers options to stop assignment when no agent is available or continue assignment according to its outside-hours rule. The exact execution and scheduling behavior was not tested.

### Implication for MeePro

Preserve continuity for returning customers while distributing new enquiries fairly. Make off-hours behavior explicit instead of silently assigning work to unavailable staff.

## 5. Ticket lifecycle workflows

| Workflow | Observed configuration in the inspected account |
| --- | --- |
| Automatically reopen a case | Rule described reopening when the customer replies within 24 hours after closure; switch was off |
| Assign to last replying agent | Enabled |
| Close and unassign inactive tickets | Enabled; description specified seven days of inactivity |
| Record sales results after closing a chat | Enabled; prompts the agent to record the sales outcome |

These were the inspected account's settings, not verified universal defaults or recommended MeePro values. MeePro should make appropriate lifecycle rules configurable.

## 6. Case fields and sales tracking

The case-field list showed:

- AI CSAT
- AI summary
- Total sales, using a currency field
- Successful sale, using a yes/no field
- Priority, using a dropdown
- Status, using a dropdown
- Issue type, using a dropdown
- Resolution, using a dropdown

The list also showed whether fields were enabled, which connections they applied to, whether they were required, and who last updated them.

### Implication for MeePro

Keep customer information separate from information about an individual sales or service case. Capture a sales result and value when relevant, so reporting can distinguish conversations from sales.

## 7. Saved replies

The saved-reply screen supports:

- Keywords or shortcuts
- Text messages
- Images and video
- Search
- Last-updated information

### Implication for MeePro

Extend the current text-only demo toward reusable product information, installment explanations, and media responses. Staff should review a prepared reply before sending it.

## 8. Preset automation catalog

| Template | Behavior described by Zaapi's interface |
| --- | --- |
| Assign chats to team members | Distribute conversations to selected agents |
| Welcome message | Reply when a person sends a message for the first time |
| Outside-hours message | Respond outside working hours |
| Chat-closing message | Send a message when an agent closes a ticket |
| Facebook comment response | Like a comment, reply publicly, or send an inbox message |
| Instagram comment response | Reply publicly or send an inbox message |
| Automatic tags | Apply tags based on keywords in customer messages |

A separate custom-workflow section was also visible, but the full custom builder was not inspected.

For MeePro, keyword tags could organize product enquiries, installment questions, accessories, store visits, and after-sales support. These are proposed uses, not rules already configured.

## 9. Channel connections

The integrations screen listed Facebook, Instagram, WhatsApp, LINE Official Account, Shopee, Lazada, TikTok Shop, Gmail, Outlook, Shopify, HubSpot, and website chat widgets.

The requested MeePro scope is Facebook, Instagram, and TikTok. This study only verified **TikTok Shop** in Zaapi's interface. Ordinary TikTok DMs require separate confirmation before committing to that scope.

### Connection invitations

Zaapi provides a connection-invitation section with temporary links for external parties, such as agencies or partners who administer a channel. Its list tracks name, status, invitation link, expiration date, creation date, and creator.

No invitation was created or shared during this study.

### Implication for MeePro

Account owners should authorize access directly rather than share passwords. Saving a public profile URL alone does not establish a messaging connection.

## 10. MeePro implementation priorities

These priorities are recommendations based on the observed interface, not claims that the features are already built.

| Priority | Work | Completion evidence |
| --- | --- | --- |
| 1 | Live channel integrations | Authorized business account and a verified real inbound/outbound messaging round trip for each supported channel |
| 2 | Staff accounts and permissions | Staff can access only authorized channels; shared assignments persist and are enforced server-side |
| 3 | Sales outcomes and richer saved replies | Case outcomes can be recorded and reported; saved responses support the approved content types |
| 4 | Routing and basic automation | Assignment, greetings, off-hours responses, and keyword tags work under clearly defined conditions |
| 5 | AI and advanced reporting | Core messaging is reliable before introducing AI responses and more extensive analytics |

## 11. Current MeePro demo versus production needs

| Capability | Current demo | Remaining work |
| --- | --- | --- |
| Inbox and search | Searchable sample conversations | Receive and synchronize real channel conversations |
| Replies | Demo replies saved; no external delivery | Provider-specific sending, delivery feedback, and failure handling |
| Notes and resolution | Persistent demo notes and resolve/reopen controls | Validate within real customer workflows |
| Assignment | Assign to self or leave unassigned | Multiple staff, teams, working hours, permissions, and routing |
| Saved replies | Text responses | Keyword shortcuts and supported media |
| Channel setup | Saves non-secret account details | Account authorization and verified live integration |
| Reporting | Basic counts from demo data | Real messaging, sales, service, and agent-performance data |
| Automations and AI | Findings documented only | Design, implement, configure, and test separately |

## 12. Information needed before live connection work

1. MeePro's Facebook Page link.
2. MeePro's Instagram username or profile link.
3. MeePro's TikTok account or shop link.
4. Confirmation of whether TikTok means Shop customer chat or ordinary DMs.
5. An authorized account administrator to complete each platform's secure authorization flow.

Do not place passwords, access tokens, or other account secrets in this document.

## 13. Suggested next study checkpoint

- Inspect a populated conversation once one is available.
- Verify attachment handling, internal notes, reassignment, delivery errors, and reopening behavior.
- Inspect team permission details and activity-log coverage.
- Inspect the custom workflow builder without activating rules.
- Confirm platform-specific authorization requirements before implementing live connectors.

This document records product behavior and implementation implications. It is not a verified description of Zaapi's private backend, database schema, or source code.
