# <p align="center">🤖 VOLKOS BOT</p>

<div align="center">
  <strong>Telegram x WhatsApp Bridge</strong>
  <br/>
  Hubungkan akun WhatsApp melalui Telegram dengan fitur lengkap dan mudah.
</div>

<br/>

> [!NOTE]
> Multi-user WhatsApp bot dengan Baileys + grammY. Persistent sessions, role-based access, dan relay pesan real-time.

## 📋 Daftar Isi

- [Instalasi](#-instalasi)
- [Konfigurasi](#-konfigurasi)
- [Panduan Pengguna](#-panduan-pengguna)
  - [Akses Bot (PM Only)](#-akses-bot)
  - [Verifikasi Grup](#verifikasi-grup)
- [Admin Panel](#-admin-panel)
- [Fitur Lengkap](#-fitur-lengkap)
- [Pengembangan](#-pengembangan)

## 💻 Instalasi

### Persyaratan

- **Node.js 18+** - [nodejs.org](https://nodejs.org/)
- **npm** - Included dengan Node.js
- **Telegram Bot Token** - [@BotFather](https://t.me/botfather)
- **Upstash Redis** - [upstash.com](https://upstash.com/)

### Setup

```bash
git clone https://github.com/solyren/volkos.git
cd volkos
npm install
cp .env.example .env
# Edit .env dengan credentials kamu
npm start
```

## ⚙️ Konfigurasi

Edit `.env`:

```env
TELEGRAM_TOKEN=your_token
TELEGRAM_ADMIN_ID=your_id
UPSTASH_REDIS_REST_URL=your_url
UPSTASH_REDIS_REST_TOKEN=your_token
EMAIL_ENCRYPTION_KEY=your_32byte_hex_key (generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
DEBUG=false
DEFAULT_TRIAL_DAYS=1
```

**Cari Telegram User ID**: Kirim ke [@userinfobot](https://t.me/userinfobot)

## 📱 Panduan Pengguna

### ⚠️ Akses Bot

> **Bot hanya bisa diakses via Private Message (PM)**
> 
> Bot akan **mengabaikan semua pesan di group/channel**. Harus chat langsung ke bot:
> - ✅ Chat pribadi dengan bot → **Berfungsi normal**
> - ❌ Pesan di group → **Diabaikan**
> 
> Jika bot ada di group kamu, dia tidak akan merespons. Gunakan bot melalui DM (Direct Message) saja!

### Verifikasi Grup

Pengguna baru harus join grup berikut untuk akses bot:
- **urGank** - Group komunitas
- **urGank Chat** - Group diskusi

**Alur Verifikasi:**
1. Kirim `/start` ke bot
2. Klik tombol grup untuk join
3. Klik "✅ Sudah Join" untuk verifikasi otomatis
4. Akses bot diberikan ✅

> **Catatan Owner:** Pemilik bot (admin) otomatis bypass verifikasi grup - tidak perlu join.

### Menu User

Kirim `/start` untuk akses menu:

- 📱 **Pair WhatsApp** → Input nomor (format: 628xxx) → Scan QR code
- 📊 **Status** → Cek koneksi WA kamu
- 🔍 **Cek Bio** → Input nomor atau upload `.txt` file (max 500 nomor)
- 📧 **Setup Email** → Gmail + App Password untuk fix nomor
- 🔧 **Fix Nomor** → Kirim email fix nomor ke WhatsApp support
- ❌ **Disconnect** → Putus pairing WhatsApp
- ❓ **Help** → Bantuan

### Alur Dasar

**Pair WhatsApp:**
1. Klik **📱 Pair WhatsApp**
2. Masukkan nomor: `628812345678`
3. Scan QR code dengan WhatsApp linked devices
4. Tunggu konfirmasi ✅

**Check Bio:**
1. Klik **🔍 Cek Bio**
2. Kirim nomor per baris atau upload file `.txt`
3. Bot return file Excel hasil (cooldown: 20 detik)

**Fix Nomor:**
1. Owner setup template: **📧 Menu Email** → **📝 Set Template**
   - Gunakan placeholder: `{nama}` dan `{nomor}`
2. User setup email: **📧 Setup Email**
3. User klik **🔧 Fix Nomor** → Input nomor
4. Bot kirim email ke `support@support.whatsapp.com` (cooldown: 120 detik)

## 👑 Admin Panel

**User Management:**
- **👥 Lihat User** → Daftar user + detail
- **➕ Tambah User** → Format: `123456789 30` (user ID + hari akses)
- **🔄 Perpanjang User** → Format: `123456789 7` (tambah 7 hari)
- **🗑️ Hapus User** → Format: `123456789` (hapus user)

**Pengaturan:**
- **⚙️ Atur Hari Trial** → Set durasi default trial user baru
- **📢 Broadcast** → Kirim pesan ke semua user
- **📊 Status Sistem** → Statistik user, koneksi, etc

**Email Management:**
- **📧 Menu Email** → Setup/view/delete email template
- Template wajib punya placeholder `{nama}` dan `{nomor}`

### Peran User

| Peran | Durasi | Admin | Pair WA |
|-------|--------|-------|---------|
| Owner 👑 | Permanen | ✅ | ✅ |
| Pengguna 👤 | Permanen | ❌ | ✅ |
| Trial ⏳ | Durasi Custom | ❌ | ✅ |

## ✨ Fitur Lengkap

**Core:**
- Multi-user dengan socket pooling per-user
- Persistent WhatsApp sessions (auto-reconnect)
- Relay pesan real-time Telegram ↔ WhatsApp
- Custom pairing code: `VOLKSBOT`

**Advanced:**
- Check bio hingga 500 nomor + adaptive rate limiting (3-10/sec)
- Email otomatis untuk fix nomor ke support WA
- Cooldown system (20s check bio, 120s fix nomor)
- Template email customizable dengan placeholder
- Broadcast ke semua user
- User management (add, extend, delete)
- Trial expiry otomatis

**Architecture:**
- Redis-based state persistence
- Role-based access control (RBAC)
- Per-user socket isolation
- Secure credential encryption

## 👨‍💻 Pengembangan

### Scripts

```bash
npm start           # Production
npm run dev         # Development + auto-reload
npm run lint        # ESLint auto-fix
npm run lint:check  # Check only
```

### Coding Standards

- **ESLint**: Wajib pass (0 errors)
- **Function Markers**: `// -- functionName --` di SETIAP function (ATURAN MUTLAK)
- **Comments**: Hanya boleh ada function marker, TIDAK boleh ada komentar lain
- **Style**: const/let only, single quotes, semicolons, curly braces
- **Logging**: Gunakan logger, bukan console.log
- **File Names**: kebab-case.js

### ATURAN MUTLAK DEVELOPMENT

1. **SETIAP CODE berubah → Update AGENTS.md**
   - Dokumentasikan perubahan struktur/logic di AGENTS.md
   - Ini adalah peraturan mutlak yang tidak boleh dilanggar

2. **Breaking Changes → Update README.md**
   - Jika ada perubahan fitur user-facing
   - Update dokumentasi pengguna

3. **Function Markers (MANDATORY)**
   ```javascript
   // -- functionName --
   export const functionName = async () => {
     // No other comments allowed!
   };
   ```

4. **ESLint Check**
   ```bash
   npm run lint  # HARUS 0 errors sebelum commit
   ```

### Commit Convention

```
feat: add new feature
fix: fix bug
docs: update AGENTS.md / README.md
refactor: code cleanup
```

**Sebelum commit**: `npm run lint` + manual test + review `git diff`

### Best Practices

- ✅ Update AGENTS.md setiap ada CODE changes (PERATURAN MUTLAK)
- ✅ Update README.md untuk breaking changes
- ✅ Add function markers (// -- name --) untuk SETIAP function
- ✅ No hardcoded credentials
- ✅ Validate user input
- ❌ No comments selain function markers
- ❌ No `// eslint-disable` comments
- ❌ No console.log di production
- ❌ No var, gunakan const/let

**Lihat AGENTS.md untuk dokumentasi lengkap pengembangan.**

---

<div align="center">
  Made with ❤️ | Referensi: <a href="https://grammy.dev">grammY</a> • <a href="https://github.com/WhiskeySockets/Baileys">Baileys</a> • <a href="https://core.telegram.org/bots/api">Telegram API</a>
</div>
