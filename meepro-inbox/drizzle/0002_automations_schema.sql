-- Migration 0002: Automations & Intelligent Routing table

CREATE TABLE IF NOT EXISTS `automations` (
	`org_id` text PRIMARY KEY NOT NULL,
	`welcome_greeting_enabled` integer DEFAULT 1 NOT NULL,
	`welcome_greeting_text` text DEFAULT 'สวัสดีครับ ยินดีต้อนรับสู่ MeePro Mobile & Accessories มีอะไรให้แอดมินช่วยดูแลแจ้งได้เลยครับ 😊' NOT NULL,
	`off_hours_enabled` integer DEFAULT 1 NOT NULL,
	`off_hours_text` text DEFAULT 'ขณะนี้อยู่นอกเวลาทำการ (เวลาทำการ 09:00 - 18:00 น.) แอดมินได้รับข้อความแล้วและจะรีบติดต่อกลับในเวลาทำการครับ 🙏' NOT NULL,
	`off_hours_schedule` text DEFAULT '{"start":"09:00","end":"18:00","days":[1,2,3,4,5,6]}' NOT NULL,
	`closing_message_enabled` integer DEFAULT 0 NOT NULL,
	`closing_message_text` text DEFAULT 'ขอบคุณที่ติดต่อ MeePro ครับ หากมีข้อสงสัยเพิ่มเติมสามารถทักแชทได้ตลอดเวลาครับ ✨' NOT NULL,
	`routing_mode` text DEFAULT 'round_robin' NOT NULL,
	`previous_agent_affinity` integer DEFAULT 1 NOT NULL,
	`keyword_rules` text DEFAULT '[]' NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`)
);
