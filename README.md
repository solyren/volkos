# VOLKOS BOT

Interconnected Telegram + WhatsApp bot that bridges messages between both platforms.

## Quick Start

### Prerequisites
- Node.js 18+
- Telegram Bot Token (from BotFather)

### Installation

```bash
npm install
```

### Configuration

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Fill in your credentials:
```env
TELEGRAM_TOKEN=your_bot_token
TELEGRAM_ADMIN_ID=your_user_id
DEBUG=false
```

### Running

```bash
npm run dev
```

## Commands

### `/pair`
Initiate WhatsApp pairing flow. The bot will request your phone number and display a pairing code.

### `/status`
Check current connection status of Telegram and WhatsApp.

### `/disconnect`
Disconnect WhatsApp session.

## How It Works

1. Start the Telegram bot with `/pair`
2. Enter your WhatsApp phone number (with country code)
3. Scan the pairing code in WhatsApp → Linked Devices
4. Bot establishes WhatsApp connection
5. Messages between platforms are automatically relayed

## Project Structure

See [AGENTS.md](./AGENTS.md) for detailed architecture and development rules.

## Development

```bash
npm run lint        # Run ESLint with auto-fix
npm run dev         # Start development
```

## License

MIT
