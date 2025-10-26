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

All users can access these commands:

| Command | Description |
|---------|-------------|
| `/start` | Start the bot and see available options |
| `/help` | Display help information |
| `/pair` | Begin WhatsApp pairing process |
| `/status` | Check your connection status |
| `/disconnect` | Disconnect your WhatsApp account |

### Pairing Workflow

1. Send `/pair` to the bot
2. Enter your WhatsApp phone number with country code (e.g., `+62812345678`)
3. The bot displays a pairing code
4. Open WhatsApp → **Settings** → **Linked Devices** → **Link a Device**
5. Scan the QR code or enter the pairing code
6. Wait for confirmation message

## 👑 Admin Commands

Owner-only commands for managing users and the system:

| Command | Description |
|---------|-------------|
| `/admin_users` | List all users with roles and pairing status |
| `/admin_add_user <userId> <role>` | Create new user (roles: `trial`, `user`, `owner`) |
| `/admin_remove_user <userId>` | Delete user and disconnect WhatsApp |
| `/admin_set_role <userId> <role>` | Change user's role |
| `/admin_set_expiry <userId> <days>` | Set expiry date (0 = permanent) |
| `/admin_remove_pairing <userId>` | Remove WhatsApp pairing for user |
| `/admin_status` | Display system statistics |

### User Roles

- **Owner**: Full access to all features and admin commands
- **User**: Permanent access to pairing and messaging
- **Trial**: 24-hour limited access, auto-expires

## ✨ Features

### Core Functionality
- ✅ Multi-user support with per-user WhatsApp pairing
- ✅ Persistent WhatsApp sessions (no re-pairing after restart)
- ✅ Real-time message relay between Telegram and WhatsApp
- ✅ Connection status monitoring
- ✅ Automatic trial expiration (24-hour limit)

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
