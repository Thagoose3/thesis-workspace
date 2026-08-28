# 🎓 PaperVault - Minimalist Research Studio & Literature Synthesis

**PaperVault** คือเว็บแอปพลิเคชันสำหรับบริหารจัดการการอ่านเปเปอร์วิจัยและวิทยานิพนธ์ (Thesis) แบบครบวงจร ออกแบบมาเพื่อให้นักวิจัย นักศึกษาปริญญาโท-เอก สามารถจัดโครงสร้างบท อ่าน PDF จดโน้ต ไฮไลต์ข้อความ ดึง Citation และสร้าง **Literature Review Matrix** สำหรับนำไปเขียนงานวิจัยได้อย่างมีประสิทธิภาพ

---

## 🚀 ฟังก์ชันหลักของระบบ (Key Features)

### 1. ระบบจัดการไฟล์และโฟลเดอร์ (PaperVault Explorer)
- **Folder Hierarchy**: สร้างโฟลเดอร์หลักและโฟลเดอร์ย่อยได้ไม่จำกัดระดับชั้น
- **Breadcrumb Navigation**: แถบนำทางคลิกย้อนกลับไปแต่ละระดับของโฟลเดอร์ได้ทันที
- **Drag-and-Drop File Moving**: ลากเปเปอร์ย้ายเข้าโฟลเดอร์ได้ทันที
- **Tagging System**: ติดแท็กหัวข้อให้เอกสาร เช่น `#Ransomware`, `#CloudSecurity`, `#DeepLearning`, `#ZeroTrust`

### 2. ระบบอ่านเอกสารและจดบันทึก (PDF Reader & Studio)
- **In-Browser PDF Viewer**: เรนเดอร์ PDF หน้าต่อหน้าอย่างคมชัดด้วย Canvas และ Text Layer
- **Multi-color Text Highlighter**: ไฮไลต์ข้อความแม่นยำระดับ Sub-pixel พร้อมเฉดสีโปร่งแสง Pastel ไม่บดบังตัวหนังสือ
- **Page Rotation**: หมุนหน้าเอกสาร 90° แยกตามแต่ละหน้าได้อย่างอิสระ
- **Floating Textbox & Freehand Drawing**: กล่องข้อความพร้อมแถบปรับแต่งลอย (ขนาด, ตัวหนา, ตัวเอียง, สี) และเครื่องมือวาดรูปทรง Box พร้อมบอกขนาดพิกเซลเรียลไทม์
- **F.R.I.D.A.Y. & Thai AI Co-pilot TTS**: เสียงอ่าน AI ภาษาไทยและอังกฤษ สุขุม ชัดถ้อยชัดคำ พร้อมสัญญาณ Comms Link ในหูฟัง

### 3. ระบบจัดการงานวิจัยและอ้างอิง (Research Synthesis & Matrix)
- **Citation & Metadata Manager**: รองรับ BibTeX, APA 7th, IEEE, MLA 9th
- **Global Search (`Ctrl + K`)**: ค้นหาแบบ Real-time ครอบคลุมทั้งชื่อไฟล์, แท็ก, ข้อความที่ไฮไลต์, และ Side-notes
- **Literature Review Matrix**: สรุปเปรียบเทียบเปเปอร์ในโฟลเดอร์เป็นตาราง Matrix อัตโนมัติ พร้อมส่งออก Markdown / CSV

### 4. ระบบความปลอดภัยและการจัดการข้อมูล (Firebase & Google Cloud Sync)
- **Sign in with Google**: ล็อกอินผ่าน Google Account
- **Cross-Device Cloud Sync**: ซิงก์ข้อมูลเปเปอร์, ไฮไลต์, โน้ต และโฟลเดอร์ขึ้น Cloud Firestore อัตโนมัติ เปิดใช้งานบน iPad, แล็ปท็อป หรือคอมพิวเตอร์เครื่องอื่นได้อย่างไร้รอยต่อ
- **Offline-First Storage**: ทำงานผ่าน IndexedDB ในเครื่องได้ 100% แม้ไม่มีอินเทอร์เน็ต

---

## 💻 วิธีการเปิดใช้งาน (How to Run)

### เปิดผ่าน GitHub Pages (ออนไลน์):
👉 **[https://Thagoose3.github.io/thesis-workspace/](https://Thagoose3.github.io/thesis-workspace/)**

### หรือรัน Local Server:
```powershell
python serve.py
```
แล้วเปิดเบราว์เซอร์ไปที่: `http://localhost:5173`
