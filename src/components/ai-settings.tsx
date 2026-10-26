'use client';

import { defaultSettings, type Settings } from '@/lib/config';

export default function AISettings({ settings, onChange }: { settings: Settings; onChange: (settings: Settings) => void }) {
  const custom = settings.aiProvider === 'openai-compatible';
  return <div className="credential-panel">
    <h3>AI ที่ใช้ตรวจโค้ดและสร้างเทสต์</h3>
    <div className="field-grid">
      <div><label htmlFor="ai-provider">รูปแบบการเชื่อมต่อ AI</label>
        <select id="ai-provider" value={settings.aiProvider} onChange={event => onChange({ ...settings,
          aiProvider: event.target.value as Settings['aiProvider'],
          geminiModel: event.target.value === 'gemini' ? defaultSettings.geminiModel : '',
        })}>
          <option value="gemini">Gemini API (เดิม)</option>
          <option value="openai-compatible">AI API อื่น (OpenAI-compatible)</option>
        </select>
      </div>
      <div><label htmlFor="ai-model">ชื่อโมเดล</label>
        <input id="ai-model" value={settings.geminiModel} onChange={event => onChange({ ...settings, geminiModel: event.target.value })} placeholder="ระบุชื่อโมเดลจากบริการของคุณ" spellCheck={false}/>
      </div>
    </div>
    {custom && <><label htmlFor="ai-api-url">API URL แบบเต็ม</label>
      <input id="ai-api-url" type="url" value={settings.aiApiUrl} onChange={event => onChange({ ...settings, aiApiUrl: event.target.value })} placeholder="https://your-provider.example/v1/chat/completions" spellCheck={false} aria-describedby="ai-api-help"/>
      <p id="ai-api-help" className="field-hint">ใช้ HTTPS URL สำหรับ Chat Completions ที่เข้าถึงจากอินเทอร์เน็ตได้ ไม่ใส่ key ใน URL ระบบไม่จำกัดรายชื่อโมเดล หาก API หรือคำตอบไม่รองรับ จะแจ้งข้อผิดพลาดในผลตรวจ</p>
    </>}
    <label htmlFor="ai-timeout">เวลารอ AI ต่อคำขอ (วินาที)</label>
    <input id="ai-timeout" type="number" min="10" max="180" value={settings.aiTimeout} onChange={event => onChange({ ...settings, aiTimeout: Number(event.target.value) })}/>
  </div>;
}
