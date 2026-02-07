# Discord AI Bot

A professional Discord bot powered by Google's Gemini AI with advanced PC control capabilities. This bot enables natural language interactions, screenshot analysis, and remote Windows PC automation through a secure WebSocket connection.

## Overview

Discord AI Bot is an intelligent assistant that bridges Discord communication with real-world PC automation. Using Google's Gemini 3 Flash model, the bot interprets user commands, maintains conversation context, and can execute complex actions on remote Windows machines through a companion control client.

## Features

- **AI-Powered Conversations**: Engage in natural language chat using Google's Gemini 3 Flash Preview model with medium-level thinking capabilities
- **Screenshot Analysis**: Request and analyze screenshots to provide visual context-aware assistance
- **Remote PC Control**: Execute keyboard, mouse, and typing actions on Windows PCs via natural language commands
- **Conversation Memory**: Maintains per-user conversation history for contextual interactions
- **Real-time Communication**: Secure HTTPS WebSocket server using Socket.IO for client coordination
- **Discord Integration**: Full slash command support with deferred replies for long-running operations
- **Type-Safe**: Built with TypeScript for enhanced code quality and developer experience

## Architecture

### System Components

1. **Discord Bot Server** (this repository)
   - Hosts the Discord bot and Socket.IO server
   - Processes AI requests and manages conversation state
   - Coordinates screenshot requests and PC control actions

2. **Control Client** (companion repository: `control-client`)
   - Runs on target Windows PC
   - Executes received actions (keyboard, mouse, screenshot capture)
   - Communicates with bot server via WebSocket

### Communication Flow

```
Discord User → Discord Bot → Gemini AI → Action Request → Socket.IO Server
                                                                ↓
Windows PC ← Control Client ← WebSocket Connection ← Socket.IO Server
```

## Prerequisites

- **Node.js**: Version 18.x or higher
- **Package Manager**: npm or yarn
- **Discord Bot Token**: Obtained from Discord Developer Portal
- **Google AI API Key**: For Gemini API access
- **SSL Certificates**: Required for HTTPS WebSocket server (Let's Encrypt recommended)
- **GitHub Personal Access Token**: (Optional, if using GitHub Models API)

## Installation

### 1. Clone Repository

```bash
git clone https://github.com/xWalfie-SMR/discord-ai.git
cd discord-ai
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Application

Create your configuration file:

```bash
cp src/config.example.json src/config.json
```

Edit `src/config.json` with your credentials:

```json
{
  "discordToken": "YOUR_DISCORD_BOT_TOKEN",
  "clientId": "YOUR_DISCORD_CLIENT_ID",
  "guildId": "YOUR_DISCORD_GUILD_ID",
  "githubToken": "YOUR_GITHUB_PERSONAL_ACCESS_TOKEN",
  "googleApiKey": "YOUR_GOOGLE_AI_API_KEY"
}
```

### 4. Configure SSL Certificates

Update SSL certificate paths in `src/socket/server.ts`:

```typescript
const httpsOptions = {
  key: readFileSync('/path/to/your/privkey.pem'),
  cert: readFileSync('/path/to/your/fullchain.pem'),
};
```

### 5. Deploy Discord Commands

```bash
npm run deploy
```

## Usage

### Development Mode

Run with hot reload for development:

```bash
npm run dev
```

### Production Mode

1. Build the TypeScript project:
```bash
npm run build
```

2. Start the production server:
```bash
npm start
```

### Code Quality

- **Lint code**: `npm run lint`
- **Fix linting issues**: `npm run lint:fix`
- **Type checking**: `npm run typecheck`
- **Run tests**: `npm run test`
- **Validate all**: `npm run validate`

## Available Commands

### `/control <command>`

Primary command for AI interaction and PC control.

**Capabilities:**
- Natural language chat
- Screenshot requests for visual context
- PC automation (keyboard shortcuts, mouse clicks, text input)

**Examples:**

```
/control What's on my screen?
/control Open Chrome and navigate to GitHub
/control Press Windows+R, type "notepad", and press Enter
/control Click at coordinates 500, 300
/control Type "Hello, World!" in the active window
```

**Response Format:**

The AI responds with:
- Text response to the user
- Screenshot request flag (if visual context needed)
- Array of actions to execute (if PC control requested)

### `/user [target]`

Displays information about a Discord user.

**Parameters:**
- `target` (optional): User to query (defaults to command invoker)

**Output:**
- User mention
- Server join date

### `/server`

Displays information about the current Discord server.

**Output:**
- Server name
- Member count

## Project Structure

```
discord-ai/
├── .github/                      # GitHub workflows and configuration
├── .husky/                       # Git hooks for pre-commit validation
├── src/
│   ├── commands/                 # Discord slash command handlers
│   │   ├── ai/
│   │   │   └── control.ts        # Main AI control command
│   │   └── utility/
│   │       ├── server.ts         # Server info command
│   │       └── user.ts           # User info command
│   ├── events/                   # Discord event handlers
│   │   ├── interactionCreate.ts  # Command interaction handler
│   │   └── ready.ts              # Bot ready event
│   ├── prompts/                  # AI prompt templates
│   │   └── control.ts            # Control command prompt
│   ├── services/                 # Core business logic
│   │   ├── aiClient.ts           # Gemini AI integration
│   │   ├── apiHandler.ts         # HTTP API client (GitHub Models)
│   │   ├── conversationStore.ts  # In-memory conversation history
│   │   └── visionClient.ts       # Screenshot verification service
│   ├── socket/                   # WebSocket server
│   │   └── server.ts             # Socket.IO HTTPS server
│   ├── types/                    # TypeScript type definitions
│   │   ├── actions.ts            # PC action type definitions
│   │   └── discord.d.ts          # Discord.js extensions
│   ├── config.example.json       # Configuration template
│   ├── deploy-commands.ts        # Command deployment script
│   └── index.ts                  # Application entry point
├── .gitignore
├── LICENSE                       # MIT License
├── eslint.config.js              # ESLint configuration
├── package.json                  # Project dependencies
├── tsconfig.json                 # TypeScript configuration (development)
├── tsconfig.build.json           # TypeScript configuration (production)
└── README.md                     # This file
```

## Action Types

The bot supports the following PC control actions:

### Key Press
```json
{ "type": "key", "key": "enter" }
```

### Key Combination
```json
{ "type": "key_combination", "keys": ["ctrl", "shift", "n"] }
```

### Text Input
```json
{ "type": "type", "text": "Hello, World!" }
```

### Mouse Click
```json
{ "type": "click", "button": "left", "x": 100, "y": 200 }
```

### Wait/Delay
```json
{ "type": "wait", "ms": 1000 }
```

## Security Considerations

- **SSL/TLS Required**: All WebSocket communications use HTTPS encryption
- **API Key Protection**: Never commit `config.json` to version control
- **Input Validation**: Screenshot data is validated before processing
- **User Isolation**: Conversation histories are separated by Discord user ID
- **Ethical AI Use**: Bot refuses unethical or TOS-violating requests

## Configuration

### Environment Setup

Ensure the following are configured:

1. **Discord Bot**: Create application at https://discord.com/developers/applications
2. **Google AI**: Obtain API key from https://ai.google.dev
3. **SSL Certificates**: Use Let's Encrypt or similar trusted CA
4. **Firewall**: Allow inbound connections on port 3000 (or configured port)

### Discord Bot Permissions

Required permissions:
- Send Messages
- Use Slash Commands
- Attach Files (for screenshot sharing)

## Troubleshooting

### Bot Not Responding
- Verify `discordToken` is correct in `config.json`
- Check bot has proper permissions in Discord server
- Ensure commands are deployed: `npm run deploy`

### Screenshot Request Timeout
- Verify control client is running and connected
- Check WebSocket server is accessible from client
- Confirm SSL certificates are valid

### AI Errors
- Validate `googleApiKey` is active and has quota
- Check network connectivity to Google AI services
- Review error logs for specific API error messages

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Standards

- Follow existing TypeScript/ESLint configuration
- Run `npm run validate` before committing
- Add tests for new features
- Update documentation as needed

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

**xWalfie** (Aram Aljundi Alkhouli)

## Links

- **Repository**: https://github.com/xWalfie-SMR/discord-ai
- **Issues**: https://github.com/xWalfie-SMR/discord-ai/issues
- **Control Client**: https://github.com/xWalfie-SMR/control-client

## Acknowledgments

- [Discord.js](https://discord.js.org/) - Discord API library
- [Google Gemini AI](https://ai.google.dev/) - AI model provider
- [Socket.IO](https://socket.io/) - Real-time communication framework
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript