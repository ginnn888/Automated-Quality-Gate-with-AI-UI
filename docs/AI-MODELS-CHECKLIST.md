# ตรวจการใช้งาน AI ที่ผู้ใช้กำหนดเอง

> เอกสารนี้บันทึกพฤติกรรมรุ่นวันที่ 26 ตุลาคม 2026 สำหรับ flow ติดตั้งรวม การเก็บเทสต์ และ AngularJS coverage ให้ดู [คู่มือรุ่นใหม่](INSTALL-AND-TESTS-CHECKLIST.md)

## สิ่งที่เพิ่ม

- ขั้นตั้งค่าการตรวจ มีรูปแบบการเชื่อมต่อ ชื่อโมเดล และเวลารอ สำหรับทั้ง JavaScript และ AngularJS
- Gemini API เดิมใช้ `GEMINI_API_KEY` และยังอ้างอิง Action รุ่นเดิม `aa02584e5fe1b41af88b6a2091302484920e2915` เพื่อลดผลกระทบต่อผู้ใช้เดิม
- AI API อื่นใช้รูปแบบ OpenAI-compatible Chat Completions: กรอก HTTPS URL แบบเต็ม ชื่อโมเดล และบันทึก `AI_API_KEY`
- ไม่จำกัดรายชื่อโมเดล ไม่โหลดรายการโมเดล และไม่สลับโมเดลอัตโนมัติ
- API URL และชื่อโมเดลอยู่ใน workflow จึงต้องไม่มีข้อมูลลับ ส่วน key ส่งแบบเข้ารหัสไป GitHub Secrets
- เว็บไม่เรียก AI และไม่รันโค้ดของ repo; Action เรียก AI เมื่อ workflow ทำงาน

## ก่อนทดลองบน GitHub

1. เผยแพร่ commit ของ Action รุ่นใหม่ตาม `flexibleEngineRef` ใน `src/lib/config.ts` ไปยัง repository `test-github-marketplace` ให้เข้าถึงได้บน GitHub โดยต้องมีทั้ง source และ `dist/index.js` ที่ build แล้ว
   รุ่นที่เว็บอ้างอิงคือ commit `3d88cb218b4fa1ea2db009ab1531b9c332b52ffe` ซึ่งเผยแพร่บน `main` ของ Action แล้ว หากใช้วิธี squash/rebase จน SHA เปลี่ยน ต้องอัปเดต `flexibleEngineRef` ให้ตรง commit ที่มี bundle รุ่นนี้บน GitHub แล้วทดสอบเว็บอีกครั้ง
2. หากยังไม่เผยแพร่ เว็บจะหยุดที่ตรวจความพร้อมและแจ้งว่าไม่สามารถยืนยัน Action รุ่นใหม่ได้ จะไม่สร้าง PR ที่อ้างอิง commit ที่ยังไม่มีบน GitHub
3. ตั้งค่า GitHub App/env และสิทธิ์ตาม README เดิม ใช้ repository สำหรับทดลองก่อน
4. ไม่ต้องเปลี่ยน workflow ของ repo เดิมทั้งหมดในครั้งเดียว เปลี่ยนเฉพาะ repo ทดลองผ่าน PR ก่อน

## จุดที่ให้เจ้าของระบบเช็ค

| จุดตรวจ | สิ่งที่ควรเห็น |
| --- | --- |
| เลือก repo → ตั้งค่าการตรวจ | มีช่องรูปแบบการเชื่อมต่อและชื่อโมเดล ทั้ง JavaScript/Jest และ AngularJS |
| เลือก Gemini API | ชื่อโมเดลเริ่มต้นเดิม กรอกชื่ออื่นเองได้ และใช้ `GEMINI_API_KEY` |
| เลือก AI API อื่น | มีช่อง API URL และชื่อโมเดลที่ไม่บังคับเลือกจากรายการ |
| กรอกข้อมูลไม่ครบ/URL เป็น HTTP/ใส่ key ใน query | ไปขั้นถัดไปไม่ได้และมีข้อความอธิบาย |
| ขั้นเชื่อมต่อบริการ | ปุ่มบันทึก `AI_API_KEY` สำหรับ AI API อื่น หรือ `GEMINI_API_KEY` สำหรับ Gemini ค่าหายจากช่องหลังบันทึกสำเร็จ |
| ขั้นตรวจสอบก่อนติดตั้ง | แสดงโมเดลและ URL ที่เลือก ดู workflow แล้ว key ต้องเป็น `${{ secrets.AI_API_KEY }}` ไม่มี key จริง |
| PR ติดตั้ง/อัปเดต | เปลี่ยนไฟล์บน branch ใหม่ ไม่ merge อัตโนมัติ และเรียก Action commit ใหม่สำหรับ AI API อื่น |
| AngularJS workflow | สาม jobs generate/checks/report; checks ไม่มี AI key และ report ไม่มี AI key |
| หลัง merge PR ติดตั้ง | เปิด PR งานที่แก้ `src/*.js` แล้วดู Actions และความคิดเห็น Test Results / Security Audit / AI Code Review |
| ใช้โมเดลและ key ที่ถูกต้อง | AI สร้างผลรีวิว/เทสต์ และรายงานผลการรันจริง ความสำเร็จขึ้นกับโค้ดและความสามารถโมเดล |
| จงใจใส่ key ผิด หรือชื่อโมเดลที่ไม่มี ใน repo ทดลอง | มีข้อความผิดพลาดตามสาเหตุ ผล AI ไม่แสดง PASS และเว็บยังใช้งานได้ |
| ทดสอบ Gemini เดิม | เตรียมโปรเจกต์ บันทึก key สร้าง PR และตรวจงานได้ตามขั้นตอนเดิม |

ชื่อโมเดลถูกต้องไม่ได้แปลว่าระบบจะรันเทสต์ผ่านเสมอ โมเดลอาจสร้างโค้ดเทสต์ผิด
หรือส่งคำตอบผิดรูปแบบ ซึ่งต้องรายงานว่าไม่สำเร็จ ไม่ลดเกณฑ์หรือแก้แอปเพื่อให้ผ่าน

AngularJS ยังคง `report_only: true`: job สีเขียวไม่ได้ยืนยันว่าทุกการตรวจผ่าน
ให้ดู FAIL/INCOMPLETE ในรายงาน หากไม่พบผลหรือ AI ล้มเหลวต้องไม่ตีความว่าผ่าน

## ข้อจำกัด

- รองรับ Gemini เดิมและ Chat Completions แบบ OpenAI-compatible ไม่รองรับ API ทุกแบบ เช่น Anthropic Messages หรือ OpenAI Responses โดยตรง
- ปลายทางต้องเป็น HTTPS บนอินเทอร์เน็ต ไม่ redirect และไม่ใช้ IP ภายใน/localhost
- ใช้ Bearer API key; บริการที่ต้องใช้ header หรือขั้นตอนยืนยันสิทธิ์อื่นอาจใช้ไม่ได้
- บริการ AI ได้รับโค้ดตาม workflow และอาจคิดค่าบริการจากบัญชีผู้ใช้ ไม่มีการทดสอบด้วย key จริงอัตโนมัติขณะบันทึก

## การตรวจที่ทำในเครื่องและสิ่งที่ยังต้องตรวจจริง

ตรวจ schema/workflow/secrets และ GitHub API ด้วย mocks, ทดสอบ Action client กับ transport mocks,
ทดสอบ entry point จริงในกรณีขาด key, รัน regression tests และ build ทั้งสองโปรเจกต์
ตรวจ component ตั้งค่าใน browser ด้วยหน้าทดสอบชั่วคราว แล้วนำหน้าทดสอบออก

ผลตรวจ: UI tests 57 ผ่าน, Action AI tests 8 ผ่าน, Action regression/reporting tests 15 ผ่าน,
TypeScript และ production build ผ่าน ทั้งนี้จำนวนดังกล่าวเป็น tests ของระบบ ไม่ใช่ผลตรวจคุณภาพ repo ผู้ใช้

ยังต้องทดลอง login/สร้าง PR/รัน GitHub Actions และเรียกบริการ AI ด้วย key จริงของเจ้าของบัญชี
จึงจะยืนยันการทำงาน end-to-end สำหรับโมเดลและบัญชีนั้นได้

## จุดย้อนกลับ

- UI ก่อนแก้: commit `aa698be3c6ed036377cc54c26317aabcc96f9aef`
- Action ก่อนแก้: commit `aa02584e5fe1b41af88b6a2091302484920e2915`
- งานเดิมที่ยังไม่ commit ใน Action คือ `src/math.js`, `src/security_vulnerable.js`, `src/utility.js` ไม่ได้นำมารวมใน commit งานนี้ และเก็บ diff สำรองไว้ใน `work/recovery/user-engine-changes.patch` ของโปรเจกต์ UI (ignored)
- ถ้า consumer repo มี PR เปลี่ยน workflow ไปแล้ว ต้องย้อน workflow ของ repo นั้นด้วย การย้อนเว็บอย่างเดียวไม่เปลี่ยน workflow บน GitHub
