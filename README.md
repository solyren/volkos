# <p align="center">🤖 VOLKOS BOT</p>

<div align="center">
  <strong>Interconnected Telegram + WhatsApp messaging bridge</strong>
  <br/>
  Seamlessly connect your WhatsApp account through Telegram and relay messages between both platforms in real-time.
</div>

<br/>

> [!NOTE]
> This bot uses Baileys for WhatsApp connectivity and grammY for Telegram integration. It supports multi-user architecture with role-based access control and persistent WhatsApp sessions.

## 📋 Table of Contents

- [Installation](#-installation)
- [Configuration](#-configuration)
- [User Commands](#-user-commands)
- [Admin Commands](#-admin-commands)
- [Features](#-features)
- [Development](#-development)
- [Support](#-support)

## 💻 Installation

### Prerequisites

Make sure you have the following installed:

- **Node.js 18+** - Download from [nodejs.org](https://nodejs.org/)
- **npm** - Comes with Node.js
- **Telegram Bot Token** - Create via [BotFather](https://t.me/botfather)
- **Upstash Redis** - Create free instance at [upstash.com](https://upstash.com/)

### Local Setup

1. **Clone and navigate to the project:**

```bash
git clone https://github.com/yourusername/volkos.git
cd volkos
```

2. **Install dependencies:**

```bash
npm install
```

3. **Configure environment variables:**

```bash
cp .env.example .env
```

4. **Edit `.env` with your credentials:**

```env
TELEGRAM_TOKEN=your_bot_token_from_botfather
TELEGRAM_ADMIN_ID=your_telegram_user_id
UPSTASH_REDIS_REST_URL=https://your-upstash-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_token
DEBUG=false
```

5. **Start the bot:**

```bash
npm start
```

The bot is now running and listening for commands!

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `TELEGRAM_TOKEN` | Bot token from BotFather | `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11` |
| `TELEGRAM_ADMIN_ID` | Your Telegram user ID | `123456789` |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis endpoint | `https://example.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash API token | `AaIrAAI...` |
| `DEBUG` | Enable debug logging | `true` or `false` |

### Finding Your Telegram User ID

Send `/start` to [@userinfobot](https://t.me/userinfobot) to get your User ID.

## 📱 User Commands

### Getting Started

1. **Send `/start`** to initialize your account
   - Owners are auto-detected and get full admin access
   - New users automatically get a 24-hour trial
   - You'll see a menu with available actions

### Interactive Menu System

The bot uses a modern button-based interface instead of typing commands:

**For Regular Users:**
- 📱 **Pair WhatsApp** - Start the pairing process
- 📊 **Status** - Check your connection status
- ❌ **Disconnect** - Remove WhatsApp pairing
- ❓ **Help** - Display help information

**For Owners (Admins):**
- 🛠️ **Owner Panel** - Access admin functions
- 📱 **Pairing** - Manage pairing for your account
- 👥 **View Users** - List all users and their statuses
- ➕ **Add User** - Create new trial or permanent users
- 📊 **System Status** - See system statistics

### Pairing Workflow

1. Click **📱 Pair WhatsApp** button (or send `/pair`)
2. Enter your WhatsApp phone number with country code:
   ```
   Example: +62812345678
   ```
3. The bot generates a pairing code (e.g., `VOLKSBOT`)
4. Open WhatsApp on your phone:
   - Go to **Settings** → **Linked Devices** → **Link a Device**
   - Scan the QR code displayed in Telegram
   - Or manually enter the pairing code if needed
5. Confirm the pairing by scanning/entering the code
6. Wait for confirmation: `✅ VOLKSBOT Connected!`

## 👑 Admin Commands

Owner-only features accessible via the **🛠️ Owner Panel** button. No need to type commands!

### Admin Panel Features

**User Management:**
- **👥 View Users** - See all users with their:
  - Telegram ID
  - Role (Trial, User, or Owner)
  - WhatsApp phone number
  - Account status (Active/Inactive)

- **➕ Add User** - Create new users:
  1. Click **➕ Add User**
  2. Enter user's Telegram ID (numeric)
  3. Select role: 
     - `trial (1 day)` - Limited 24-hour access
     - `user (permanent)` - Unlimited access
     - `owner` - Full admin access

**System Information:**
- **📊 System Status** - View statistics:
  - Total users count
  - Active users (not expired)
  - WhatsApp paired users
  - Trial vs permanent user breakdown

### User Roles Explained

- **Owner** 👑
  - Full admin access
  - Can manage all users
  - Can add/remove users
  - View system statistics
  - Unrestricted pairing access

- **User** 👤
  - Permanent access
  - Can pair WhatsApp
  - Can relay messages
  - No expiration date
  - Cannot access admin features

- **Trial** ⏳
  - 24-hour limited access
  - Can pair WhatsApp
  - Can relay messages
  - Auto-expires after 24 hours
  - Cannot access admin features

## ✨ Features

### Core Functionality
- ✅ Multi-user support with per-user WhatsApp pairing
- ✅ Persistent WhatsApp sessions (no re-pairing after restart)
- ✅ Real-time message relay between Telegram and WhatsApp
- ✅ Connection status monitoring
- ✅ Automatic trial expiration (24-hour limit)
- ✅ Interactive button-based UI (no command typing needed)
- ✅ VOLKSBOT custom pairing code (always "VOLKSBOT")

### Architecture
- ✅ Per-user socket pooling for WhatsApp
- ✅ Redis-based state persistence
- ✅ Role-based access control
- ✅ Secure credential management per user
- ✅ Async connection handling with proper initialization

### Reliability
- ✅ Auto-reconnection on disconnect
- ✅ Graceful error handling
- ✅ Detailed logging with pino
- ✅ Type-safe configuration

## 🔄 How It Works

### Session Architecture

```
┌─────────────────────────────────────────────────────┐
│              VOLKOS BOT ARCHITECTURE                │
└─────────────────────────────────────────────────────┘

User (Telegram)
      │
      ├─► Telegram Bot (grammY)
      │    ├─ Session management
      │    ├─ Button/menu routing
      │    └─ Message handling
      │
      ├─► Redis Database (Upstash)
      │    ├─ User profiles
      │    ├─ Role assignments
      │    └─ Session state
      │
      └─► WhatsApp Socket Pool
           ├─ Per-user socket
           ├─ Session persistence
           └─ Message relay
```

### Pairing Process (Detailed Flow)

1. **User clicks "📱 Pair WhatsApp"**
   - Bot creates empty session for user
   - Telegram waits for phone input

2. **User enters phone number (+62812345678)**
   - Bot validates phone format
   - Creates unique WhatsApp socket for user
   - Initializes 8-second connection delay

3. **Bot requests pairing code**
   - Calls Baileys `requestPairingCode()`
   - Generates "VOLKSBOT" pairing code
   - Displays QR code to user

4. **User scans/enters code in WhatsApp**
   - WhatsApp validates code
   - Creates linked device session

5. **Connection established**
   - Socket authenticates
   - Bot sends: `✅ VOLKSBOT Connected!`
   - User's WhatsApp phone saved to Redis
   - Session becomes persistent

6. **Session persistence**
   - Credentials stored in `auth_info/{userId}/session/`
   - Bot restart automatically reconnects
   - No re-pairing needed!

### Message Relay Flow

```
WhatsApp Message
      │
      └─► Baileys Socket (per-user)
           │
           └─► Event: messages.upsert
                │
                └─► Message Handler
                     │
                     └─► Telegram Bot
                          │
                          └─► User receives message
```

## 👨‍💻 Development

### Scripts

```bash
npm start           # Start the bot in production
npm run lint        # Run ESLint with auto-fix
npm run lint:check  # Check for linting issues
```

### Code Quality Standards

- **Linting**: ESLint enforces code style
- **Function Comments**: All functions require `// -- functionName --` prefix
- **No console.log**: Use logger utilities only
- **Code Style**: const/let only, no var

### Project Structure

```
volkos/
├── src/
│   ├── telegram/          # Telegram bot handlers
│   ├── whatsapp/          # WhatsApp integration
│   ├── db/                # Database/Redis operations
│   ├── middleware/        # Auth & authorization
│   ├── jobs/              # Background tasks
│   └── index.js           # Entry point
├── auth_info/             # WhatsApp credentials (gitignored)
├── .env                   # Environment config (gitignored)
└── package.json           # Dependencies
```

### Before Committing

1. Make your changes
2. Run linter: `npm run lint`
3. Verify ESLint passes
4. Test the changes
5. Commit with descriptive message

## 🐛 Troubleshooting

### Pairing Code Not Displaying

**Issue**: "Connection Closed" error with status 401 or 428

**Solutions**:
- Wait 5-10 minutes and try again (WhatsApp rate limiting)
- Try from a different network or VPN
- Delete `auth_info/` folder for fresh start
- Check internet connectivity

### Socket Timeout

**Issue**: Pairing times out after 30 seconds

**Solutions**:
- Clear `auth_info/` directory
- Ensure stable internet connection
- Retry from different IP/network
- Check logs for detailed error messages

### Messages Not Relaying

**Issue**: Messages not being forwarded between platforms

**Solutions**:
- Verify both connections are active: `/status`
- Reconnect WhatsApp: `/disconnect` then `/pair`
- Check bot logs for errors
- Ensure sufficient bandwidth

## 📚 References

- [grammY Documentation](https://grammy.dev/)
- [Baileys GitHub](https://github.com/WhiskeySockets/Baileys)
- [Telegram Bot API](https://core.telegram.org/bots/api)

## 🤝 Contributing

Contributions are welcome! If you find bugs or have feature suggestions:

1. Open an [issue](https://github.com/yourusername/volkos/issues)
2. Create a [pull request](https://github.com/yourusername/volkos/pulls)
3. Follow the code style guidelines

## 🙌 Support

If you find this project helpful, please consider:
- Giving it a ⭐ star on GitHub
- Sharing it with others
- Opening issues for bugs and suggestions

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

<div align="center">
  Made with ❤️ | <a href="https://t.me/yourusername">Contact</a>
</div>
