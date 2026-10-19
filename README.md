## AngularJS และการใช้ Action ต้นฉบับ (19 ตุลาคม 2026)

หน้าเว็บเลือก JavaScript/Jest หรือ AngularJS 1.x ได้ โดยเรียก Action ที่ commit aa02584e5fe1b41af88b6a2091302484920e2915 และให้ Action ตรวจ สร้างผลลัพธ์ และโพสต์คอมเมนต์ทั้งหมด ไม่มี summary/ตัวตัดสินผลตรวจที่เว็บเพิ่มเอง

AngularJS ใช้สาม jobs ตาม docs/angularjs.md และ workflow ของ angularjs-ai-review-demo: generate → checks → report ส่ง artifacts รวม hidden files และตรวจสิทธิ์แยก job ไม่ execute โค้ด PR ใน job ที่มี Gemini secret หรือสิทธิ์เขียนคอมเมนต์
- ตั้งชนิดโปรเจกต์ AngularJS, Gemini model และ timeout 10–180 วินาที แล้วบันทึก GEMINI_API_KEY
- โหมดนี้ไม่มี coverage/SonarCloud ตามข้อจำกัดของ Action รุ่นนี้ และใช้ report_only: true ตามต้นฉบับ สถานะ job สำเร็จไม่เท่ากับทุกผลตรวจผ่าน ให้ดูรายงาน
- แอปต้องมี package.json, package-lock.json ที่ตรงกัน, dependency angular และโค้ด src/*.js เว็บไม่เพิ่ม Jest หรือ test config สำหรับ AngularJS
- สร้าง PR ติดตั้ง/อัปเดต → merge เข้า base branch → เปิดหรืออัปเดต PR งาน ระบบใช้ pull_request_target จาก base branch ไม่รันจาก push อย่างเดียว
- repo ที่มี quality-gate.yml จะอัปเดตไฟล์เดิม; หากมี aq-review.yml ที่รู้จักจะอัปเดตไฟล์นั้น หากมีทั้งสองจะให้แก้ความซ้ำก่อน ไม่เพิ่ม workflow ซ้ำ
- config_cov.json และ sonar-project.properties เดิมเก็บไว้เมื่อเปลี่ยนเป็น AngularJS แต่ workflow AngularJS ไม่เรียกใช้ ส่วน JavaScript ยังใช้ config ของ engine เดิม
- สถานะติดตั้งรองรับ quality-gate.yml และ aq-review.yml พร้อมสาม phase โดย AngularJS ไม่ต้องมี config_cov.json
- ตรวจด้วย unit/integration mocks และ production build; ยังต้องทดลอง GitHub end-to-end ด้วย App/keys ของเจ้าของบัญชี ไม่มีการสร้าง PR ใน repo ผู้ใช้ระหว่างพัฒนา

## สถานะล่าสุด: เปิดทดลองติดตั้ง Action เดิมแล้ว

ขั้นตรวจสอบก่อนติดตั้ง → ตรวจความพร้อมติดตั้ง → ตรวจไฟล์เดิม/ใหม่ → สร้าง PR ติดตั้ง → เปิด PR และ merge เอง
ต้องเตรียม npm/Jest ให้พร้อมและ merge PR เตรียมโปรเจกต์ก่อน พร้อมบันทึก GEMINI_API_KEY และ SONAR_TOKEN เมื่อเปิด SonarCloud
GitHub App ต้องมี Contents, Pull requests, Workflows และ Secrets ตามสิทธิ์ Read and write ที่ GitHub มีให้ แล้วผู้ติดตั้งอนุมัติสิทธิ์ใหม่
ทดสอบปิด/เปิด SonarCloud ได้โดยเปลี่ยนการตั้งค่าแล้วสร้าง PR ใหม่ ผลแสดงที่ Actions → workflow run และ logs รายงาน AI ใน PR ขึ้นกับ engine เดิม ไม่รับรองว่าจะตรวจสำเร็จ
ไม่มีการแก้ repo engine, ไม่มีการ merge อัตโนมัติ และไม่มีการสร้าง PR จริงระหว่างพัฒนา การตรวจสถานะติดตั้งบน dashboard ยังไม่ทำ
JavaScript เรียก Action หลังการสแกนตาม workflow ต้นฉบับ ผลและรายงานจัดการโดย Action

# Automated Quality Gate · Web UI

เว็บ Next.js + Tailwind CSS + TypeScript สำหรับตั้งค่าการตรวจคุณภาพโค้ดด้วย AI ผ่าน GitHub Actions

## เริ่มใช้งานในเครื่อง

ต้องมี Node.js 22 ขึ้นไปและ npm

```powershell
cd D:\Work\project\Automated-Quality-Gate-witj-AI-UI
npm install
npm run dev
```

เปิด http://localhost:3000 แล้วเลือก **ทดลองดูตัวอย่าง** เพื่อทดลองโดยไม่ต้องใช้บัญชีหรือ keys ข้อมูลตัวอย่างไม่ได้มาจาก GitHub และไม่มีการเขียนข้อมูลกลับไปยัง repo

## สิ่งที่ทำแล้ว

- Dashboard, ค้นหา repository, หน้าการเชื่อมต่อ และคู่มือภาษาไทย
- Wizard เลือก repo → coverage / SonarCloud → คำแนะนำ keys → ดูไฟล์และดาวน์โหลดตัวอย่าง JSON
- รองรับหน้าจอเล็ก, focus indicator, modal focus trap และปิดด้วย Escape
- GitHub App OAuth login, ตรวจ state, session cookie เข้ารหัสแบบ HttpOnly และหมดอายุในหนึ่งชั่วโมง
- API อ่าน repo ที่ user และ GitHub App มีสิทธิ์ร่วมกัน พร้อม pagination
- Secrets ไม่อยู่ใน localStorage, export หรือฐานข้อมูล รับ Gemini/Sonar key และส่งแบบ sealed-box ไป GitHub Actions Secrets ของ repo ที่เลือกได้
- Action reference ตรึงกับ commit ที่ตรวจสอบแล้ว แต่ยังไม่ถือว่า engine พร้อมใช้งาน

## ขอบเขตที่ตั้งใจเว้นไว้

ตามที่ตกลง ทำเว็บก่อนและกลับมาแก้ Action ร่วมกันภายหลัง ขณะนี้ **สร้าง PR ติดตั้ง Action เดิมเพื่อทดลองได้ ไม่เก็บ secrets ในเว็บ (ส่งไป GitHub ได้แล้ว) ไม่รายงานผลตรวจจริง (แต่สร้าง PR เตรียม npm/Jest ได้แล้ว) และไม่บอกว่า repo ติดตั้งแล้วจากเพียงการ authorize แอป**

`POST /api/install` ตอบ 409 โดยไม่อ่าน credentials จึงไม่สามารถข้ามปุ่ม disabled มาเขียน repo ได้ ไฟล์ดาวน์โหลดเป็นตัวอย่างเพื่อรีวิว ไม่ควรรันก่อนแก้ข้อจำกัดของ Action ใน `docs/ENGINE-FOLLOWUP.md`

Dashboard จริงแสดงรายชื่อ repo ที่แอปเข้าถึงได้ ส่วนสถานะติดตั้ง/ผลตรวจมีเฉพาะข้อมูลตัวอย่างที่ติดป้ายชัดเจน ไม่มี database หรือ webhook ในรุ่นนี้

## สิ่งที่เจ้าของเว็บต้องตั้งค่าเอง

1. ไป https://github.com/settings/apps/new เพื่อสร้าง **GitHub App** (ไม่ใช่ OAuth App)
2. Homepage URL สำหรับพัฒนา: `http://localhost:3000`
3. Callback URL: `http://localhost:3000/api/auth/callback`
4. ตั้ง **Setup URL** เป็น `http://localhost:3000/api/github/return` และเปิด **Redirect on update** ส่วน **Request user authorization (OAuth) during installation** ให้ปิดไว้ เพราะเว็บทำ Login ก่อนส่งไปเลือก repo
5. สำหรับฟีเจอร์เตรียมโปรเจกต์ ตั้ง Repository permissions: **Contents: Read and write**, **Pull requests: Read and write** และ Metadata: read (อัตโนมัติ) แล้วให้ผู้ติดตั้งอนุมัติสิทธิ์ใหม่ การบันทึก key ต้องเพิ่ม **Secrets: Read and write** และอนุมัติสิทธิ์ใหม่; การสร้าง workflow ต้องมี Workflows: Read and write และปิด webhook ไว้ได้
6. เลือก Any account หากจะให้คนอื่นใช้ จากนั้นกดเชื่อมต่อ GitHub บนเว็บ เว็บจะพาไปอนุญาต App และเลือก repo ให้
7. คัดลอก `.env.example` เป็น `.env.local` สร้าง Client secret ของ App
8. เติม `APP_URL`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_APP_SLUG` และ `SESSION_SECRET`
9. สร้าง Session secret อย่างน้อย 32 ตัวอักษรด้วยคำสั่งด้านล่าง แล้ว restart dev server

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

ใช้ hostname เดียวกันสำหรับ APP_URL, callback และเบราว์เซอร์ เช่น `localhost` ทั้งหมด อย่าสลับกับ `127.0.0.1` ระหว่าง login

GitHub App อาจถูกองค์กรจำกัดสิทธิ์หรือรอผู้ดูแลอนุมัติ ผู้ใช้ต้องอนุญาต repo ก่อนเว็บจะอ่านได้ เมื่อ session หมดอายุให้เข้าสู่ระบบใหม่ รุ่นนี้ยังไม่ refresh token อัตโนมัติ

App secret เป็นความลับของเจ้าของระบบ ไม่ต้องส่งในแชตและห้าม commit `.env.local` ขึ้น GitHub ส่วน Gemini/Sonar keys เป็นของผู้ใช้ปลายทาง บันทึกลง Repository Secrets ผ่านขั้นเชื่อมต่อบริการได้แล้ว

## เฟสติดตั้งจริง

- แก้ engine และตรวจไฟล์ dist ให้ตรงกับ source
- เพิ่ม App private key / App ID และ permissions สำหรับ contents, workflows, pull requests และ actions secrets เท่าที่จำเป็น
- สร้าง PR ติดตั้ง workflow พร้อมการจัดการ retry/conflict (ตรวจสิทธิ์ repo และอัปโหลด secrets แบบ sealed-box ทำแล้ว)
- รับ webhook ที่ตรวจลายเซ็น หรืออ่าน API เพื่อแยก Pending PR / Installed / Removed / Failed
- ทดสอบ PR, push, merge, fork, Dependabot และ token หมดอายุ
- ตั้ง branch rules แยกต่างหากหากต้องการบล็อก merge เมื่อ quality gate ไม่ผ่าน

## ตรวจสอบ

```powershell
npm test
npm run typecheck
npm run build
```

Tests ตรวจ schema, coverage config, Sonar toggle, secret references, immutable Action reference และการป้องกัน workflow รับ secrets จาก fork

Production ต้องใช้ hosting ที่รัน Next.js server ได้ พร้อม HTTPS และ environment variables ไม่รองรับ static export เพราะมี OAuth และ server routes ขณะนี้ยังไม่ได้ deploy

## Design

พื้นหลัง cloud #f7f9fc, ตัวอักษร navy #172b4d, accent blue #275dda, เส้นแบ่ง #e5eaf2, success green #23805a ใช้ Segoe UI / Leelawadee UI จากเครื่อง ไม่โหลด font ภายนอก Layout เป็น sidebar + workspace list และ wizard 4 ขั้น ไม่มีสถานะสำเร็จปลอม

## อ้างอิง

- https://docs.github.com/en/rest/apps/installations
- https://docs.github.com/en/rest/actions/secrets
- https://github.com/NonnaritRammaneekultawat-6609650459/test-github-marketplace


## เตรียม npm/Jest ผ่านหน้าเว็บ (เพิ่มแล้ว)

1. เชื่อม GitHub App ที่มีสิทธิ์ Contents / Pull requests แบบ Read and write และติดตั้งใน repo งาน
2. เลือก repo ในหน้าเว็บ แล้วเปิดหน้าตั้งค่า
3. ในขั้นตั้งค่าการตรวจ กด **ตรวจไฟล์ที่ขาด**
4. อ่านรายการไฟล์และเปิดดูเนื้อหาเดิม/เนื้อหาที่เสนอ
5. กด **สร้าง PR เตรียมโปรเจกต์** เว็บจะเพิ่มไฟล์ลง branch ใหม่และเปิด PR ให้ตรวจและ merge ด้วยตนเอง
6. หลัง merge กดตรวจอีกครั้ง ระบบจะแสดงว่าไม่มีไฟล์ที่ต้องเพิ่มหากครบแล้ว

โหมดตัวอย่างจำลอง repo ที่มีเพียง src/math.js และปิดการสร้าง PR จริง ไม่ต้องกรอก keys และไม่มีการส่ง secrets ในขั้นตอนนี้

### รองรับ

- JavaScript CommonJS ใช้ npm ที่ root ของ repo
- Repo ที่ไม่มี package.json/lockfile: เพิ่ม package.json, package-lock.json ที่สร้างด้วย npm จริง และ jest.config.cjs
- package.json เดิมที่ยังไม่มี dependencies: เพิ่ม Jest 30.5.2 โดยรักษาชื่อ เวอร์ชัน scripts และ metadata
- Repo ที่มี Jest กับ lockfile ตรงกับ dependencies แล้ว: รักษา dependencies และ lockfile เดิม เพิ่มเฉพาะ config หรือ test script ที่ยังไม่มี
- ไม่เขียนทับ test script หรือ Jest config เดิม

### ข้อจำกัดที่แสดงในเว็บ

- โปรเจกต์ที่มี dependencies เดิมแต่ยังไม่มี Jest/lockfile ที่เข้ากัน: ต้องรัน npm install --save-dev jest และ commit lockfile ก่อน ไม่ใช้ lock template ไปทับ dependency tree เดิม
- TypeScript, JSX, ES modules, workspaces, monorepo, Yarn/pnpm/Bun และ shrinkwrap ต้องเตรียมเฉพาะโปรเจกต์
- ต้องมี commit แรกใน repo ก่อนสร้าง branch/PR
- ถ้ามีแค่ test.js ที่ root ระบบเตรียม npm/Jest ให้ได้ แต่ Action เดิมยังตรวจเฉพาะ src/ ต้องย้าย source หรือแก้ engine ก่อน
- PR นี้ไม่สร้างเทสต์ ไม่เพิ่ม workflow ไม่บอกว่าคุณภาพผ่าน และไม่เปิดติดตั้ง Action

### การทำงานฝั่งเซิร์ฟเวอร์

`POST /api/preparation` รับ action inspect/create; ตรวจ session และ Origin ทุกครั้ง ใช้ GitHub App user token จึงจำกัดสิทธิ์ตามทั้งผู้ใช้และ app ตรวจ push permission เพิ่มอีกครั้ง อ่านไฟล์จาก commit เดียวกัน และปฏิเสธ preview ที่เก่าหรือถูกเปลี่ยน

การสร้างใช้ Git tree commit เดียวบน branch quality-gate/prepare-... ไม่เขียน main หรือ force push กดซ้ำจะคืน PR ที่เปิดอยู่เดิม หากสร้าง branch ได้แต่ PR ล้มเหลว สามารถ retry โดยตรวจ tree/parent ก่อนใช้ branch เดิม

เซิร์ฟเวอร์ไม่รันโค้ด repo, npm scripts หรือ Jest config ของผู้ใช้ Lock template อยู่ใน src/lib/setup-template-lock.json และสร้างจาก Jest 30.5.2 ด้วย npm install --package-lock-only --ignore-scripts; ปรับเฉพาะ metadata root ให้ตรง package.json ของผู้ใช้

ทดสอบการวางแผนและ API GitHub ด้วย mock รวมกรณีไม่มีสิทธิ์, snapshot เก่า, tree ไม่ครบ และ retry PR ส่วนการสร้าง PR บน GitHub จริงยังต้องมี GitHub App ที่ตั้งค่าแล้ว


### Verification 2026-10-17

ชุดไฟล์ที่สร้างถูกนำไปทดสอบในโปรเจกต์ชั่วคราวด้วย npm ci และ Jest: ผ่าน 1 test และรายงาน coverage 100% สำหรับ fixture math.js (เป็นผลของ fixture ไม่ใช่ผลตรวจ repo ผู้ใช้)

npm audit ของ Jest template 30.5.2 ยังรายงานช่องโหว่ระดับ moderate 19 รายการใน dependency chain ไม่มี high/critical ณ วันที่ตรวจ ไม่ใช้ audit fix --force ที่เสนอ downgrade Jest; ควรติดตามอัปเดต dependencies และนโยบาย audit ของ engine ก่อนเปิดใช้จริง

ยังไม่ได้ทดสอบ login/สร้าง PR บน GitHub จริง เพราะยังต้องตั้ง GitHub App ของเจ้าของระบบ และยังไม่ได้ตรวจ UI ผ่าน browser automation เนื่องจากข้อจำกัดสิทธิ์ที่พบก่อนหน้า


## อนุญาต GitHub App ผ่านเว็บ (เพิ่มแล้ว)

ผู้ใช้กด **เชื่อมต่อ GitHub** → Login → ถ้ายังไม่มี repo ที่อนุญาต เว็บพาไปหน้า Install ของ GitHub → ผู้ใช้เลือก repo และกด Install → GitHub ส่งกลับเว็บที่ Setup URL → เว็บตรวจสิทธิ์จริงและโหลดรายชื่อ repo

ผู้ที่มี repo อนุญาตแล้วจะเข้า Dashboard ได้ทันที และใช้ปุ่ม **อนุญาต / เพิ่ม repo** เพื่อเพิ่มหรือเปลี่ยน repo ได้ ปุ่มเดียวกันมีในหน้าว่างและขั้นเลือก repo ของ wizard ด้วย

เจ้าของ App ต้องตั้ง:

- Redirect URI: `http://localhost:3000/api/auth/callback` สำหรับ Login
- Setup URL: `http://localhost:3000/api/github/return` สำหรับกลับจากเลือก repo
- Redirect on update: เปิด
- Request user authorization (OAuth) during installation: ปิด สำหรับลำดับ login-first นี้
- ใช้ hostname/port ให้ตรง APP_URL ทุกช่อง เปลี่ยนเป็นโดเมน HTTPS เมื่อ deploy

ไม่เชื่อ installation_id หรือ setup_action จาก URL กลับ เว็บไซต์ตรวจ user token กับรายชื่อ installations/repositories ของ App นี้จาก GitHub จริง หากยังไม่มีสิทธิ์หรือรอองค์กรอนุมัติจะแสดงข้อความให้ดำเนินการต่อ ไม่แสดงว่าติดตั้งเสร็จและไม่วนกลับไป GitHub อัตโนมัติ

การอนุญาต App ยังไม่ใช่การติดตั้ง workflow ตรวจคุณภาพ ส่วนการติดตั้ง workflow ทำผ่าน PR ในขั้นตรวจสอบก่อนติดตั้ง

## บันทึก keys และเลือกโปรเจกต์ SonarCloud ที่มีอยู่

- ขั้นเชื่อมต่อบริการ: กรอก Gemini API key หรือ Sonar token แล้วกดบันทึกลง repo แต่ละรายการ การบันทึกทับ secret ชื่อเดิม; ไม่ได้ตรวจว่า key ใช้งานกับผู้ให้บริการได้
- ต้องเพิ่ม Repository permissions → Secrets: Read and write ใน GitHub App และอนุมัติสิทธิ์ใหม่ของ installation; หาก session หมดอายุให้เข้าสู่ระบบใหม่
- Key ผ่าน backend ของเว็บชั่วคราวและเข้ารหัสด้วย public key ของ repo ก่อนส่ง GitHub ไม่มีการบันทึกลงฐานข้อมูล/localStorage/export และไม่แสดงค่ากลับ; production ต้องใช้ HTTPS และไม่เปิด request-body logging
- ขั้นตั้งค่าการตรวจ: เปิด SonarCloud กรอก Organization Key และ token แล้วกดแสดงโปรเจกต์ที่มีอยู่ เลือกเพื่อเติม Project Key ได้ รองรับ SonarCloud EU; รายการเป็นโปรเจกต์ที่ token เข้าถึงได้ ไม่ใช่หลักฐานว่าผูกกับ GitHub repo ที่เลือกแล้ว
- Token ค้นหาใช้กับ SonarCloud เท่านั้น ไม่บันทึกลง repo อัตโนมัติ ถ้าจะใช้ workflow ต้องกดบันทึก SONAR_TOKEN ในขั้นเชื่อมต่อบริการต่างหาก
- การบันทึก key ยังไม่ติดตั้งหรือเปิดรัน Action; ต้องสร้างและ merge PR ติดตั้ง workflow ก่อน; engine ยังไม่ได้แก้ไข

## สถานะการติดตั้งบนหน้า Repositories

อ่าน .github/workflows/quality-gate.yml และ config_cov.json จาก commit เดียวกันใน default branch: พบ workflow เรียก engine และ coverage config ถูกต้อง = ติดตั้งแล้ว; ไม่พบ workflow = ยังไม่ติดตั้ง; ไฟล์ผิดหรือไม่ครบ = ตั้งค่าไม่ครบ; API/สิทธิ์ผิดพลาด = ตรวจสอบไม่ได้ สถานะไม่ยืนยัน secrets, workflow เปิดใช้งาน หรือผลตรวจผ่าน
มีตัวกรองและจำนวนแยกสถานะ พร้อมปุ่มรีเฟรชหลัง merge PR ติดตั้ง รายการโหลดจาก GitHub App ที่ตั้งค่าไว้เท่านั้น ข้อความตั้งค่า GitHub App/env และแผนพัฒนาไม่แสดงใน UI ผู้ใช้แล้ว
