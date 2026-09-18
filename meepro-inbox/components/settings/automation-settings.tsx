'use client';

import React, { useState, useEffect } from 'react';
import {
  Zap,
  Bot,
  Clock,
  MessageSquare,
  Shuffle,
  Tag,
  Play,
  Check,
  AlertCircle,
  Plus,
  Trash2,
  Sparkles,
  RefreshCw,
  Sliders,
  Send,
  UserCheck,
  Sun,
  Moon,
} from 'lucide-react';
import {
  type AutomationsConfig,
  type KeywordRule,
  type Channel,
  type CasePriority,
  defaultKeywordRules,
  channelNames,
} from '@/lib/inbox-data';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface AutomationSettingsProps {
  onRefresh?: () => Promise<void>;
}

const DAYS_MAP = [
  { id: 1, label: 'จันทร์ (Mon)' },
  { id: 2, label: 'อังคาร (Tue)' },
  { id: 3, label: 'พุธ (Wed)' },
  { id: 4, label: 'พฤหัส (Thu)' },
  { id: 5, label: 'ศุกร์ (Fri)' },
  { id: 6, label: 'เสาร์ (Sat)' },
  { id: 0, label: 'อาทิตย์ (Sun)' },
];

export default function AutomationSettings({ onRefresh }: AutomationSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'automations' | 'routing' | 'keywords' | 'simulator'>('automations');

  // Config State
  const [config, setConfig] = useState<AutomationsConfig>({
    org_id: 'org_meepro',
    welcome_greeting_enabled: true,
    welcome_greeting_text: 'สวัสดีครับ ยินดีต้อนรับสู่ MeePro Mobile & Accessories มีอะไรให้แอดมินช่วยดูแลแจ้งได้เลยครับ 😊',
    off_hours_enabled: true,
    off_hours_text: 'ขณะนี้อยู่นอกเวลาทำการ (เวลาทำการ 09:00 - 18:00 น.) แอดมินได้รับข้อความแล้วและจะรีบติดต่อกลับในเวลาทำการครับ 🙏',
    off_hours_schedule: { start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5, 6] },
    closing_message_enabled: false,
    closing_message_text: 'ขอบคุณที่ติดต่อ MeePro ครับ หากมีข้อสงสัยเพิ่มเติมสามารถทักแชทได้ตลอดเวลาครับ ✨',
    routing_mode: 'round_robin',
    previous_agent_affinity: true,
    keyword_rules: defaultKeywordRules,
    updated_at: new Date().toISOString(),
  });

  // Modal State for Keyword Rule
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null);
  const [ruleForm, setRuleForm] = useState<KeywordRule>({
    id: '',
    name: '',
    keywords: [],
    action_type: 'both',
    tag: '',
    priority: 'normal',
    reply_text: '',
    enabled: true,
  });
  const [keywordInput, setKeywordInput] = useState('');

  // Simulator State
  const [simMessage, setSimMessage] = useState('สนใจผ่อน iPhone 15 มีโปรบัตรเครดิต 0% ไหมครับ');
  const [simChannel, setSimChannel] = useState<Channel>('facebook');
  const [simTimeMode, setSimTimeMode] = useState<'working_hours' | 'off_hours'>('working_hours');
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    try {
      setLoading(true);
      const res = await fetch('/api/automations', {
        headers: { 'oai-authenticated-user-id': 'owner-org-meepro' },
      });
      if (res.ok) {
        const json: any = await res.json();
        if (json.config) {
          setConfig(json.config);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('ไม่สามารถโหลดข้อมูลระบบอัตโนมัติได้');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveConfig() {
    try {
      setSaving(true);
      const res = await fetch('/api/automations', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'oai-authenticated-user-id': 'owner-org-meepro',
        },
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        const err: any = await res.json();
        throw new Error(err.error || 'Failed to save configuration');
      }

      toast.success('บันทึกการตั้งค่าระบบอัตโนมัติเรียบร้อยแล้ว');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSaving(false);
    }
  }

  function handleAddOrUpdateRule() {
    if (!ruleForm.name.trim()) {
      toast.error('กรุณาระบุชื่อกฎ');
      return;
    }
    const kwList = keywordInput
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    const mergedKeywords = Array.from(new Set([...ruleForm.keywords, ...kwList]));
    if (mergedKeywords.length === 0) {
      toast.error('กรุณาระบุคีย์เวิร์ดอย่างน้อย 1 คำ');
      return;
    }

    const updatedRule: KeywordRule = {
      ...ruleForm,
      id: ruleForm.id || `rule-${Date.now()}`,
      keywords: mergedKeywords,
      enabled: ruleForm.enabled !== false,
    };

    let newRules = [...config.keyword_rules];
    if (editingRuleIndex !== null) {
      newRules[editingRuleIndex] = updatedRule;
    } else {
      newRules.push(updatedRule);
    }

    setConfig({ ...config, keyword_rules: newRules });
    setRuleModalOpen(false);
    setEditingRuleIndex(null);
    setKeywordInput('');
    toast.success(editingRuleIndex !== null ? 'แก้ไขกฎคีย์เวิร์ดสำเร็จ' : 'เพิ่มกฎคีย์เวิร์ดสำเร็จ');
  }

  function handleDeleteRule(index: number) {
    const newRules = config.keyword_rules.filter((_, i) => i !== index);
    setConfig({ ...config, keyword_rules: newRules });
    toast.success('ลบกฎคีย์เวิร์ดเรียบร้อย');
  }

  function handleToggleRule(index: number) {
    const newRules = [...config.keyword_rules];
    newRules[index] = { ...newRules[index], enabled: !newRules[index].enabled };
    setConfig({ ...config, keyword_rules: newRules });
  }

  async function handleRunSimulation() {
    try {
      setSimulating(true);
      const testTime =
        simTimeMode === 'off_hours'
          ? '2026-09-18T22:30:00Z' // 22:30 UTC = 05:30 BKK (off hours)
          : '2026-09-18T04:30:00Z'; // 04:30 UTC = 11:30 BKK (working hours)

      const res = await fetch('/api/automations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'oai-authenticated-user-id': 'owner-org-meepro',
        },
        body: JSON.stringify({
          message: simMessage,
          channel: simChannel,
          test_time: testTime,
          is_first_message: true,
        }),
      });

      if (!res.ok) {
        throw new Error('Simulation failed');
      }

      const data: any = await res.json();
      setSimResult(data.simulation);
      toast.success('จำลองระบบสำเร็จ! ตรวจสอบผลลัพธ์ด้านล่าง');
    } catch (err: any) {
      toast.error(err.message || 'เกิดข้อผิดพลาดในการจำลอง');
    } finally {
      setSimulating(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* Header Bar */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400 rounded-xl">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Preset Automations & Intelligent Routing
              <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-300 font-medium">
                Phase 5
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              กำหนดข้อความตอบกลับอัตโนมัติ กฎคีย์เวิร์ดติดแท็ก และอัลกอริทึมกระจายแชทอัจฉริยะ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchConfig}
            disabled={loading}
            className="p-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleSaveConfig}
            disabled={saving}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium text-xs flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
          >
            {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            บันทึกการเปลี่ยนแปลง
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex gap-2">
        {[
          { id: 'automations', label: 'บอทตอบกลับอัตโนมัติ', icon: Bot },
          { id: 'routing', label: 'การกระจายแชทอัจฉริยะ', icon: Shuffle },
          { id: 'keywords', label: `กฎคีย์เวิร์ดติดแท็ก (${config.keyword_rules.length})`, icon: Tag },
          { id: 'simulator', label: 'แซนด์บ็อกซ์ทดสอบ (Simulator)', icon: Play },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
                isActive
                  ? 'border-violet-600 text-violet-600 dark:text-violet-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-5xl mx-auto w-full">
        {/* TAB 1: PRESET AUTOMATIONS */}
        {activeTab === 'automations' && (
          <div className="space-y-6">
            {/* Welcome Greeting */}
            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-lg">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Welcome Greeting (ข้อความต้อนรับทักทายแรกเข้า)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      ส่งอัตโนมัติเมื่อลูกค้าส่งข้อความแรกเข้าสู่ระบบในเวลาทำการ
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.welcome_greeting_enabled}
                    onChange={(e) => setConfig({ ...config, welcome_greeting_enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {config.welcome_greeting_enabled && (
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>เนื้อหาข้อความต้อนรับ</span>
                    <span className="text-[11px] text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 px-2 py-0.5 rounded">
                      ใช้ &#123;&#123;customer_name&#125;&#125; เพื่อแทรกชื่อลูกค้า
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    value={config.welcome_greeting_text}
                    onChange={(e) => setConfig({ ...config, welcome_greeting_text: e.target.value })}
                    className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-violet-500"
                    placeholder="พิมพ์ข้อความทักทาย..."
                  />
                </div>
              )}
            </div>

            {/* Outside-Hours Auto-Responder */}
            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg">
                    <Moon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Outside-Hours Auto-Responder (ตอบกลับอัตโนมัตินอกเวลาทำการ)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      ส่งข้อความแจ้งลูกค้าเมื่อมีข้อความทักเข้ามาหลังเวลาปิดทำการ
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.off_hours_enabled}
                    onChange={(e) => setConfig({ ...config, off_hours_enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {config.off_hours_enabled && (
                <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                  {/* Schedule Picker */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700/60">
                    <div>
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1.5 flex items-center gap-1.5">
                        <Sun className="h-3.5 w-3.5 text-amber-500" />
                        เวลาทำการปกติ (Bangkok Time)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={config.off_hours_schedule?.start || '09:00'}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              off_hours_schedule: {
                                ...(config.off_hours_schedule || { days: [1, 2, 3, 4, 5, 6], end: '18:00' }),
                                start: e.target.value,
                              },
                            })
                          }
                          className="px-2.5 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                        />
                        <span className="text-xs text-slate-500">ถึง</span>
                        <input
                          type="time"
                          value={config.off_hours_schedule?.end || '18:00'}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              off_hours_schedule: {
                                ...(config.off_hours_schedule || { days: [1, 2, 3, 4, 5, 6], start: '09:00' }),
                                end: e.target.value,
                              },
                            })
                          }
                          className="px-2.5 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1.5 flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-blue-500" />
                        วันที่เปิดทำการ
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {DAYS_MAP.map((day) => {
                          const active = config.off_hours_schedule?.days?.includes(day.id);
                          return (
                            <button
                              key={day.id}
                              type="button"
                              onClick={() => {
                                const currentDays = config.off_hours_schedule?.days || [1, 2, 3, 4, 5, 6];
                                const newDays = active
                                  ? currentDays.filter((d) => d !== day.id)
                                  : [...currentDays, day.id];
                                setConfig({
                                  ...config,
                                  off_hours_schedule: {
                                    ...(config.off_hours_schedule || { start: '09:00', end: '18:00' }),
                                    days: newDays,
                                  },
                                });
                              }}
                              className={`text-[11px] px-2 py-0.5 rounded-sm font-medium transition-colors ${
                                active
                                  ? 'bg-violet-600 text-white'
                                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              {day.label.split(' ')[0]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-500">ข้อความตอบกลับนอกเวลาทำการ</label>
                    <textarea
                      rows={3}
                      value={config.off_hours_text}
                      onChange={(e) => setConfig({ ...config, off_hours_text: e.target.value })}
                      className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-violet-500"
                      placeholder="พิมพ์ข้อความแจ้งเวลาทำการ..."
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Chat-Closing Message */}
            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-lg">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Chat-Closing Message (ข้อความส่งท้ายเมื่อปิดการสนทนา)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      ส่งข้อความขอบคุณและแบบสำรวจความพึงพอใจอัตโนมัติเมื่อเจ้าหน้าที่กด Resolved
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.closing_message_enabled}
                    onChange={(e) => setConfig({ ...config, closing_message_enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-amber-600"></div>
                </label>
              </div>

              {config.closing_message_enabled && (
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                  <textarea
                    rows={2}
                    value={config.closing_message_text}
                    onChange={(e) => setConfig({ ...config, closing_message_text: e.target.value })}
                    className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-violet-500"
                    placeholder="พิมพ์ข้อความปิดเคส..."
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: INTELLIGENT ROUTING */}
        {activeTab === 'routing' && (
          <div className="space-y-6">
            {/* Routing Strategy Card */}
            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 rounded-xl">
                  <Shuffle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    โหมดการกระจายแชทเข้า (Routing Strategy)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    เลือกวิธีการส่งต่องานแชทใหม่ให้แก่ทีมงานตามภาระงานและตารางเวลา
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div
                  onClick={() => setConfig({ ...config, routing_mode: 'round_robin' })}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    config.routing_mode === 'round_robin'
                      ? 'border-violet-600 bg-violet-50/50 dark:bg-violet-950/30'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <Sliders className="h-4 w-4 text-violet-600" />
                      Balanced Round-Robin (กระจายตามเวรและภาระงาน)
                    </span>
                    {config.routing_mode === 'round_robin' && (
                      <span className="h-4 w-4 rounded-full bg-violet-600 text-white flex items-center justify-center text-[10px]">
                        ✓
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    ระบบจะตรวจสอบตารางเวลาทำงาน (Working Hours) และสิทธิ์การเข้าถึงช่องทาง (Channel Access)
                    ก่อนมอบหมายแชทให้เจ้าหน้าที่ที่กำลังอยู่เวรและมีจำนวนเคสค้างน้อยที่สุด
                  </p>
                </div>

                <div
                  onClick={() => setConfig({ ...config, routing_mode: 'manual' })}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    config.routing_mode === 'manual'
                      ? 'border-violet-600 bg-violet-50/50 dark:bg-violet-950/30'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <UserCheck className="h-4 w-4 text-slate-600" />
                      Manual Assignment (เจ้าหน้าที่กดรับเอง)
                    </span>
                    {config.routing_mode === 'manual' && (
                      <span className="h-4 w-4 rounded-full bg-violet-600 text-white flex items-center justify-center text-[10px]">
                        ✓
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    แชทใหม่ทั้งหมดจะเข้าสู่กล่อง Unassigned เพื่อให้หัวหน้าทีมมอบหมายงาน หรือให้แอดมินเป็นผู้กดรับเคสด้วยตนเอง
                  </p>
                </div>
              </div>
            </div>

            {/* Previous Agent Affinity Card */}
            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-lg">
                    <UserCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Previous Agent Affinity (ส่งกลับหาแอดมินเดิมหากอยู่เวร)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      เมื่อลูกค้าเก่าทักกลับมา ระบบจะส่งบทสนทนากลับไปยังเจ้าหน้าที่ที่เคยดูแลเคสก่อนหน้าเพื่อความต่อเนื่อง
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.previous_agent_affinity}
                    onChange={(e) => setConfig({ ...config, previous_agent_affinity: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 rounded-lg text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <p>
                  หากแอดมินเดิมไม่อยู่ในเวลาปฏิบัติงาน (Off Duty) หรือไม่มีสิทธิ์เข้าถึงช่องทางนั้น
                  ระบบจะตกไปใช้ Balanced Round-Robin เพื่อส่งต่อให้แอดมินคนอื่นที่พร้อมให้บริการทันที
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: KEYWORD AUTO-TAGGING & RULES */}
        {activeTab === 'keywords' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  กฎดักจับคีย์เวิร์ดและตอบกลับอัตโนมัติ (Keyword Rules Engine)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  ตรวจจับคำสำคัญในแชทเพื่อติดแท็ก จัดระดับความสำคัญ (Priority) หรือตอบคำถามที่พบบ่อยได้ทันที
                </p>
              </div>
              <button
                onClick={() => {
                  setRuleForm({
                    id: `rule-${Date.now()}`,
                    name: '',
                    keywords: [],
                    action_type: 'both',
                    tag: '',
                    priority: 'normal',
                    reply_text: '',
                    enabled: true,
                  });
                  setKeywordInput('');
                  setEditingRuleIndex(null);
                  setRuleModalOpen(true);
                }}
                className="px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                เพิ่มกฎคีย์เวิร์ดใหม่
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {config.keyword_rules.map((rule, idx) => (
                <div
                  key={rule.id || idx}
                  className={`p-4 bg-white dark:bg-slate-900 border rounded-xl transition-all ${
                    rule.enabled
                      ? 'border-slate-200 dark:border-slate-800 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 opacity-60 bg-slate-50 dark:bg-slate-900/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">{rule.name}</span>
                        {rule.priority && (
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              rule.priority === 'urgent'
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                                : rule.priority === 'high'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400'
                            }`}
                          >
                            {rule.priority.toUpperCase()}
                          </span>
                        )}
                        {rule.tag && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1">
                            <Tag className="h-2.5 w-2.5" />
                            {rule.tag}
                          </span>
                        )}
                      </div>

                      {/* Keywords List */}
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <span className="text-[11px] text-slate-400 font-medium">คีย์เวิร์ด:</span>
                        {rule.keywords.map((kw, kIdx) => (
                          <span
                            key={kIdx}
                            className="text-[11px] px-2 py-0.5 bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300 rounded border border-violet-100 dark:border-violet-900/40"
                          >
                            "{kw}"
                          </span>
                        ))}
                      </div>

                      {/* Auto Reply Preview */}
                      {rule.reply_text && (
                        <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2">
                          <Bot className="h-3.5 w-3.5 text-violet-500 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{rule.reply_text}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleRule(idx)}
                        className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                          rule.enabled
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                            : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {rule.enabled ? 'เปิดใช้งาน' : 'ปิดอยู่'}
                      </button>
                      <button
                        onClick={() => {
                          setEditingRuleIndex(idx);
                          setRuleForm({ ...rule });
                          setKeywordInput('');
                          setRuleModalOpen(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="แก้ไขกฎ"
                      >
                        <Sliders className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteRule(idx)}
                        className="p-1.5 text-rose-400 hover:text-rose-600 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/50"
                        title="ลบกฎ"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: SIMULATOR SANDBOX */}
        {activeTab === 'simulator' && (
          <div className="space-y-6">
            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl">
                  <Play className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Interactive Automation & Routing Sandbox
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    พิมพ์ทดสอบข้อความเสมือนลูกค้าทักจริง เพื่อทดสอบการดักจับคีย์เวิร์ด การติดแท็ก และการกระจายไปยังแอดมิน
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                      ช่องทางจำลอง (Channel)
                    </label>
                    <select
                      value={simChannel}
                      onChange={(e) => setSimChannel(e.target.value as Channel)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                    >
                      <option value="facebook">Facebook Messenger (MeePro Official)</option>
                      <option value="instagram">Instagram Direct (MeePro Store)</option>
                      <option value="tiktok">TikTok Shop Customer Chat</option>
                      <option value="line">LINE Official Account (@meepro.official)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                      เวลาจำลอง (Simulation Time)
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSimTimeMode('working_hours')}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 border transition-all ${
                          simTimeMode === 'working_hours'
                            ? 'border-violet-600 bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 font-semibold'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <Sun className="h-3.5 w-3.5 text-amber-500" />
                        ในเวลาทำการ (11:30 น.)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSimTimeMode('off_hours')}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 border transition-all ${
                          simTimeMode === 'off_hours'
                            ? 'border-violet-600 bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 font-semibold'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <Moon className="h-3.5 w-3.5 text-indigo-500" />
                        นอกเวลาทำการ (23:30 น.)
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                    ข้อความลูกค้าที่ต้องการทดสอบ
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={simMessage}
                      onChange={(e) => setSimMessage(e.target.value)}
                      placeholder="พิมพ์ข้อความทดสอบ เช่น ผ่อนไอโฟน, หน้าร้านอยู่ไหน, ราคาเท่าไหร่..."
                      className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-violet-500"
                    />
                    <button
                      type="button"
                      onClick={handleRunSimulation}
                      disabled={simulating || !simMessage.trim()}
                      className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      {simulating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      รันการทดสอบ
                    </button>
                  </div>
                </div>
              </div>

              {/* Simulation Result Card */}
              {simResult && (
                <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900 border border-violet-200 dark:border-violet-900/60 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                    <span className="text-xs font-bold text-violet-700 dark:text-violet-400 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4" />
                      ผลลัพธ์การประมวลผล (Simulation Diagnostics)
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {new Date(simResult.tested_time).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    {/* Routing Output */}
                    <div className="p-3 bg-white dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase">การกระจายแชท (Routing)</span>
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                        <UserCheck className="h-4 w-4 text-emerald-500" />
                        {simResult.routing.assignee ? simResult.routing.assigneeName || simResult.routing.assignee : 'Unassigned (รอรับ)'}
                      </div>
                      <span className="text-[11px] text-slate-500 block">
                        เหตุผล: <span className="font-mono text-violet-600">{simResult.routing.reason}</span>
                      </span>
                    </div>

                    {/* Tagging Output */}
                    <div className="p-3 bg-white dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase">แท็กที่ได้รับ (Auto-Tag)</span>
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                        <Tag className="h-4 w-4 text-violet-500" />
                        {simResult.automation.appliedTag || 'ไม่มีแท็กที่ตรง'}
                      </div>
                      <span className="text-[11px] text-slate-500 block">
                        Priority: <span className="font-semibold">{simResult.automation.appliedPriority || 'normal'}</span>
                      </span>
                    </div>

                    {/* Matched Rule */}
                    <div className="p-3 bg-white dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase">กฎที่ตรวจพบ (Matched Rule)</span>
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                        {simResult.automation.matchedRule ? simResult.automation.matchedRule.name : 'ไม่มีกฎที่ตรง (Default)'}
                      </div>
                      <span className="text-[11px] text-slate-500 block">
                        ตอบกลับอัตโนมัติ: {simResult.automation.automatedReplies.length} ข้อความ
                      </span>
                    </div>
                  </div>

                  {/* Bot Messages to Send */}
                  {simResult.automation.automatedReplies.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        ข้อความที่ระบบตอบกลับลูกค้าโดยอัตโนมัติ:
                      </span>
                      {simResult.automation.automatedReplies.map((r: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-3 bg-violet-50 dark:bg-violet-950/40 border border-violet-100 dark:border-violet-900/40 rounded-lg text-xs text-slate-800 dark:text-slate-200 flex items-start gap-2"
                        >
                          <Bot className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <span className="text-[10px] uppercase font-bold text-violet-600 dark:text-violet-400">
                              [{r.type}]
                            </span>
                            <p>{r.body}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL: ADD / EDIT KEYWORD RULE */}
      <Dialog open={ruleModalOpen} onOpenChange={setRuleModalOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Tag className="h-4 w-4 text-violet-600" />
              {editingRuleIndex !== null ? 'แก้ไขกฎคีย์เวิร์ด' : 'เพิ่มกฎดักจับคีย์เวิร์ดใหม่'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                ชื่อกฎ (Rule Name)
              </label>
              <input
                type="text"
                value={ruleForm.name}
                onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                placeholder="เช่น สอบถามการผ่อนชำระ, แจ้งปัญหาเคลมสินค้า..."
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                คีย์เวิร์ดที่ต้องการดักจับ (คั่นด้วยเครื่องหมายจุลภาค ,)
              </label>
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                placeholder="เช่น ผ่อน, งวด, บัตรเครดิต, spaylater"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              />
              {ruleForm.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {ruleForm.keywords.map((kw, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] px-2 py-0.5 bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300 rounded-full flex items-center gap-1"
                    >
                      {kw}
                      <button
                        type="button"
                        onClick={() =>
                          setRuleForm({
                            ...ruleForm,
                            keywords: ruleForm.keywords.filter((_, i) => i !== idx),
                          })
                        }
                        className="hover:text-rose-600"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                  แท็กที่จะติดให้เคส
                </label>
                <input
                  type="text"
                  value={ruleForm.tag}
                  onChange={(e) => setRuleForm({ ...ruleForm, tag: e.target.value })}
                  placeholder="เช่น ผ่อนชำระ"
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                  ระดับความสำคัญ (Priority)
                </label>
                <select
                  value={ruleForm.priority || 'normal'}
                  onChange={(e) => setRuleForm({ ...ruleForm, priority: e.target.value as CasePriority })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                >
                  <option value="urgent">🔴 ด่วนที่สุด (Urgent)</option>
                  <option value="high">🟠 ด่วน (High)</option>
                  <option value="normal">🔵 ปกติ (Normal)</option>
                  <option value="low">⚪ ต่ำ (Low)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                การกระทำ (Action)
              </label>
              <select
                value={ruleForm.action_type}
                onChange={(e) => setRuleForm({ ...ruleForm, action_type: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              >
                <option value="both">ติดแท็กและตอบกลับอัตโนมัติ (Both)</option>
                <option value="tag">ติดแท็กอย่างเดียว (Tag only)</option>
                <option value="reply">ตอบกลับอัตโนมัติอย่างเดียว (Reply only)</option>
              </select>
            </div>

            {(ruleForm.action_type === 'both' || ruleForm.action_type === 'reply') && (
              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                  ข้อความตอบกลับอัตโนมัติทันที
                </label>
                <textarea
                  rows={3}
                  value={ruleForm.reply_text || ''}
                  onChange={(e) => setRuleForm({ ...ruleForm, reply_text: e.target.value })}
                  placeholder="เช่น MeePro รองรับการผ่อนชำระ 0% สูงสุด 10 เดือนผ่านบัตรเครดิต..."
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setRuleModalOpen(false)}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleAddOrUpdateRule}
              className="px-4 py-1.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors"
            >
              บันทึกกฎ
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
