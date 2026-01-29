import fs from 'fs';
import path from 'path';
import './socket/server.js';
import { Client, Collection, GatewayIntentBits } from 'discord.js';
import { fileURLToPath } from 'node:url';
import config from './config.json' with { type: 'json' };

const { discordToken } = config;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

// Load event files
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter((file) => file.endsWith('.ts') || file.endsWith('.js'));

for (const file of eventFiles) {
	const filePath = path.join(eventsPath, file);
	const eventModule = await import(filePath);
	const event = eventModule.default;

	if (event.once) {
		client.once(event.name, (...args: any[]) => event.execute(...args));
	}
	else {
		client.on(event.name, (...args: any[]) => event.execute(...args));
	}
}

// Load command files
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.ts') || file.endsWith('.js'));

	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const commandModule = await import(filePath);
		const command = commandModule.default;

		// Set a new item in the Collection with the key as the command name and the value as the exported module
		if (command && 'data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		}
		else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

// Log in to Discord with your client's token
client.login(discordToken);
