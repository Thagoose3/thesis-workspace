# 🎓 ThesisMind - Web Workspace for Thesis Reading & Literature Review

เว็บแอปพลิเคชันสำหรับบริหารจัดการการอ่านเปเปอร์และวิทยานิพนธ์ (Thesis) แบบครบวงจร ออกแบบมาเพื่อให้นักวิจัย นักศึกษาปริญญาโท-เอก สามารถจัดโครงสร้างบท อ่าน PDF จดโน้ต ไฮไลต์ข้อความ ดึง Citation และสร้าง **Literature Review Matrix** สำหรับนำไปเขียนบทที่ 2 ได้อย่างมีประสิทธิภาพ

---

## 🚀 ฟังก์ชันหลักของระบบ (Key Features)

### 1. ระบบจัดการไฟล์และโฟลเดอร์ (Windows Folder Style Explorer)
- **Folder Hierarchy**: สร้างโฟลเดอร์หลักและโฟลเดอร์ย่อยได้ไม่จำกัดระดับชั้น (เช่น `Chapter 1`, `Chapter 2 -> Sub-topic`)
- **Breadcrumb Navigation**: แถบนำทางคลิกย้อนกลับไปแต่ละระดับของโฟลเดอร์ได้ทันที
- **File Operations**: เปลี่ยนชื่อ (Rename), ย้ายข้ามโฟลเดอร์ (Move), ลบไฟล์/โฟลเดอร์ (Delete)
- **Drag-and-Drop File Upload**: ลากไฟล์ `.pdf` จากคอมพิวเตอร์มาวางในโฟลเดอร์ที่ต้องการเพื่ออัปโหลดทันที
- **Tagging System**: ติดแท็กหัวข้อให้เอกสาร เช่น `#Ransomware`, `#CloudSecurity`, `#DeepLearning`, `#ZeroTrust` สำหรับกรองไฟล์ข้ามโฟลเดอร์

### 2. ระบบอ่านเอกสารและจดบันทึก (In-Browser PDF Reader & Annotation)
- **In-Browser PDF Viewer**: เรนเดอร์ PDF หน้าต่อหน้าอย่างคมชัดด้วย Canvas และ Text Layer
- **Multi-color Text Highlighter**: ลากคลุมตัวหนังสือบน PDF แล้วเลือกสีไฮไลต์ได้ 5 สี (🟡 เหลือง, 🟢 เขียว, 🔵 ฟ้า, 🟣 ม่วง, 🌸 ชมพู)
- **Contextual Side-Notes**: แปะโน้ตหรือความเห็นผูกติดไว้กับข้อความที่ไฮไลต์ พร้อมบันทึกเลขหน้า (Page Number) อัตโนมัติ
- **Annotation Sidebar**: แถบด้านข้างรวบรวมข้อความที่ไฮไลต์และโน้ตทั้งหมด คลิกที่โน้ตเพื่อ Jump Scroll ไปยังหน้านั้นใน PDF ทันที
- **Markdown Scratchpad**: กล่องจดบันทึกสรุปไอเดียรวมประจำไฟล์ รองรับ Markdown พร้อม Live Preview
- **Dark / Sepia Mode สำหรับ PDF**: ปรับฟิลเตอร์หน้ากระดาษ PDF เป็น Normal White, Sepia ถนอมสายตา, หรือ Dark Mode พื้นหลังดำตัวหนังสือขาว
- **Instant Text-to-Speech (TTS)**: คลุมข้อความหรือคลิกที่ข้อความไฮไลต์ แล้วกดปุ่มลำโพงเพื่อให้อ่านออกเสียงภาษาอังกฤษให้ฟัง ปรับความเร็วได้ (0.75x - 1.5x)

### 3. ระบบจัดการงานวิจัยและอ้างอิง (Thesis Research Helper)
- **Citation & Metadata Manager**: ช่องกรอกข้อมูลเปเปอร์ (Title, Authors, Year, Journal/Conference, Volume, Issue, Pages, DOI, Abstract)
- **One-Click BibTeX / Citation Copy**: ปุ่มคลิกเดียวเพื่อแปลงข้อมูลเปเปอร์เป็น:
  - `BibTeX` (สำหรับ LaTeX / Overleaf)
  - `APA 7th Edition`
  - `IEEE Format`
  - `MLA 9th Edition`
- **Global Search (ค้นหาแบบละเอียด)**: กด `Ctrl + K` เพื่อค้นหาแบบ Real-time ครอบคลุมทั้งชื่อไฟล์, แท็ก, ข้อความที่ไฮไลต์, และเนื้อหาใน Side-notes
- **Paper Summary Matrix (ตารางเปรียบเทียบงานวิจัย)**:
  - ดึงโน้ตสรุปของทุกเปเปอร์ในโฟลเดอร์เดียวกันมาเรียงเป็นตาราง Matrix อัตโนมัติ (คอลัมน์: Title & Authors / Key Contributions / Limitations / Methodology / Findings / BibTeX)
  - Export ตารางเป็น Markdown Table หรือ CSV สำหรับนำไปเขียนบทที่ 2 ได้ทันที

### 4. ระบบความปลอดภัยและการจัดการข้อมูล (Offline-First & Firebase Sync)
- **Offline-First Storage**: บันทึกข้อมูลและไฟล์ PDF ทั้งหมดลง IndexedDB ในเครื่องอัตโนมัติ ใช้งานได้ทันทีโดยไม่ต้องต่ออินเทอร์เน็ต
- **Firebase Backend Ready**: มีช่องใส่ Firebase Web Config ในปุ่ม Settings ด้านขวาบน เพื่อเชื่อมต่อ Firebase Firestore, Storage, และ Google Authentication
- **Export Summary**: รวมโน้ตและไฮไลต์ทั้งหมดในโฟลเดอร์ออกมาเป็นไฟล์ `.md` แผ่นเดียว

---

## 💻 วิธีการเปิดใช้งาน (How to Run)

### วิธีที่ 1: ดับเบิลคลิกไฟล์ `start.bat`
ดับเบิลคลิกไฟล์ `start.bat` ในโฟลเดอร์โปรเจกต์ ระบบจะรันเซิร์ฟเวอร์และเปิดเบราว์เซอร์ให้อัตโนมัติ

### วิธีที่ 2: รันผ่าน Terminal / Command Line
```powershell
cd C:\Users\pooth\.gemini\antigravity\scratch\thesis-workspace
python serve.py
```
แล้วเปิดเบราว์เซอร์ไปที่: `http://localhost:5173`

---

## ⌨️ คีย์ลัด (Keyboard Shortcuts)
- **`Ctrl + K`** : เปิดหน้าต่าง Global Deep Search
- **`Esc`** : ปิดหน้าต่าง Modal ค้นหา / Matrix
