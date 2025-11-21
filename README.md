# VOLKOS BOT

Multi-user WhatsApp bot yang terhubung dengan Telegram menggunakan Baileys dan grammY. Mendukung persistent sessions, role-based access control, dan relay pesan real-time.

## Requirements

- Node.js 18+
- npm
- Telegram Bot Token dari [@BotFather](https://t.me/botfather)
- Upstash Redis

## Installation

```bash
git clone https://github.com/solyren/volkos.git
cd volkos
npm install
cp .env.example .env
```

Edit `.env` dengan credentials:

```env
# Required
TELEGRAM_TOKEN=your_bot_token_here
TELEGRAM_ADMIN_ID=123456789
UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_token_here
EMAIL_ENCRYPTION_KEY=your_32_character_encryption_key_here_64hex

# Optional - Group requirement (leave empty to disable)
REQUIRED_GROUP_ID_1=
REQUIRED_GROUP_ID_2=

# Optional - System config
DEBUG=false

# Optional - Welcome thumbnails (leave empty for defaults)
THUMBNAIL_WELCOME_OWNER=
THUMBNAIL_WELCOME_USER=
```

Jalankan:

```bash
npm start
```

## Configuration

Dapatkan Telegram User ID dengan mengirim pesan ke [@userinfobot](https://t.me/userinfobot).

Generate email encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Usage

Bot hanya merespons private messages. Akses melalui `/start` command.

### User Features

- Pair WhatsApp dengan nomor
- Cek status koneksi
- Check bio dari nomor WhatsApp (hingga 500 nomor)
- Setup email untuk fix nomor
- Disconnect WhatsApp

### Admin Features

- Kelola user (tambah, hapus)
- Broadcast pesan ke semua user
- Setup email template
- Convert XLSX to TXT (extract nomor)

## Features

- Multi-user dengan per-user socket isolation
- WhatsApp session persistence dengan auto-reconnect
- Adaptive rate limiting untuk check bio (3-10/sec)
- Email automation untuk fix nomor
- File conversion (XLSX to TXT)
- Role-based access control (Owner, User)
- Redis-based state management
- Cooldown system

## Development

```bash
npm run dev     # Development dengan auto-reload
npm run lint    # Run linter
npm start       # Production
```

Commit convention:
```
feat: description
fix: description
docs: description
refactor: description
```

Run linter sebelum commit: `npm run lint`

---

Made with Telegram Bot API, grammY, dan Baileys
