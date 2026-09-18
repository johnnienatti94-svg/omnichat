-- =====================================================================
-- MeePro Omnichannel Customer Inbox (Omnichat)
-- Supabase / PostgreSQL Production Database Schema
-- Compatible with: Supabase SQL Editor, Drizzle ORM, Vercel & Edge Functions
-- =====================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Staff Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent', -- 'admin', 'supervisor', 'agent'
  channel_access JSONB NOT NULL DEFAULT '[]'::jsonb,
  working_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Teams
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  leader_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Team Members
CREATE TABLE IF NOT EXISTS team_members (
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, user_id)
);

-- 5. Channel Connections (Facebook, Instagram, TikTok Shop)
CREATE TABLE IF NOT EXISTS channel_connections (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  channel TEXT NOT NULL, -- 'facebook', 'instagram', 'tiktok'
  name TEXT NOT NULL,
  account_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'demo', 'disconnected'
  credentials_encrypted TEXT NOT NULL DEFAULT '',
  webhook_secret TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Customers Directory
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Cross-Channel Customer Identities
CREATE TABLE IF NOT EXISTS customer_identities (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  external_id TEXT NOT NULL,
  handle TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_channel_external_id UNIQUE (channel, external_id)
);

-- 8. Conversations / Tickets
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  channel TEXT NOT NULL, -- 'facebook', 'instagram', 'tiktok'
  handle TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- 'open', 'closed'
  assignee TEXT NOT NULL DEFAULT 'unassigned',
  tag TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'normal', -- 'urgent', 'high', 'normal', 'low'
  issue_type TEXT NOT NULL DEFAULT '',
  resolution TEXT NOT NULL DEFAULT '',
  sales_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  sales_successful BOOLEAN NOT NULL DEFAULT FALSE,
  closed_at TIMESTAMPTZ,
  closed_by TEXT,
  customer_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Messages Thread
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  direction TEXT NOT NULL, -- 'inbound', 'outbound'
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  external_id TEXT NOT NULL DEFAULT '',
  delivery_status TEXT NOT NULL DEFAULT 'delivered',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Saved Quick Replies
CREATE TABLE IF NOT EXISTS replies (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL
);

-- 11. Channel Setup Profiles
CREATE TABLE IF NOT EXISTS channel_setup (
  channel TEXT NOT NULL,
  owner TEXT NOT NULL,
  account TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (channel, owner)
);

-- 12. Immutable Audit Trail
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Preset Automations & Tagging Rules
CREATE TABLE IF NOT EXISTS automations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  condition JSONB NOT NULL DEFAULT '{}'::jsonb,
  action JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. Workspace Initialization Tracker
CREATE TABLE IF NOT EXISTS initialized (
  owner TEXT PRIMARY KEY
);

-- =====================================================================
-- Performance Indexes
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_conversations_owner ON conversations(owner);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_channel ON conversations(channel);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_assignee ON conversations(assignee);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_external_id ON messages(external_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id ON audit_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_identities_lookup ON customer_identities(channel, external_id);
CREATE INDEX IF NOT EXISTS idx_automations_org_id ON automations(org_id);

-- =====================================================================
-- RLS (Row Level Security) - Enabled by default with permissive service role
-- =====================================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_setup ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE initialized ENABLE ROW LEVEL SECURITY;

-- Allow full access for backend service role key
DO $$
BEGIN
  CREATE POLICY "Service role full access on organizations" ON organizations FOR ALL USING (true);
  CREATE POLICY "Service role full access on users" ON users FOR ALL USING (true);
  CREATE POLICY "Service role full access on teams" ON teams FOR ALL USING (true);
  CREATE POLICY "Service role full access on team_members" ON team_members FOR ALL USING (true);
  CREATE POLICY "Service role full access on channel_connections" ON channel_connections FOR ALL USING (true);
  CREATE POLICY "Service role full access on customers" ON customers FOR ALL USING (true);
  CREATE POLICY "Service role full access on customer_identities" ON customer_identities FOR ALL USING (true);
  CREATE POLICY "Service role full access on conversations" ON conversations FOR ALL USING (true);
  CREATE POLICY "Service role full access on messages" ON messages FOR ALL USING (true);
  CREATE POLICY "Service role full access on replies" ON replies FOR ALL USING (true);
  CREATE POLICY "Service role full access on channel_setup" ON channel_setup FOR ALL USING (true);
  CREATE POLICY "Service role full access on audit_logs" ON audit_logs FOR ALL USING (true);
  CREATE POLICY "Service role full access on automations" ON automations FOR ALL USING (true);
  CREATE POLICY "Service role full access on initialized" ON initialized FOR ALL USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
