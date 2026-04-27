import {
	REST,
	Routes,
	ApplicationIntegrationType,
	InteractionContextType,
} from 'discord.js';
import config from './config.json' with { type: 'json' };
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { clientId, discordToken } = config;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const commands = [];
// Grab all the command folders from the commands directory you created earlier
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	// Grab all the command files from the commands directory you created earlier
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter((file: string) => file.endsWith('.ts') || file.endsWith('.js'));

	// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = await import(filePath);
		const commandModule = command.default || command;

		if ('data' in commandModule && 'execute' in commandModule) {
			const commandJson = commandModule.data.toJSON() as {
				name?: string;
				[key: string]: unknown;
			};
			const contexts = commandJson.name === 'server'
				? [InteractionContextType.Guild]
				: [
					InteractionContextType.Guild,
					InteractionContextType.BotDM,
					InteractionContextType.PrivateChannel,
				];
			commands.push({
				...commandJson,
				integration_types: [
					ApplicationIntegrationType.GuildInstall,
					ApplicationIntegrationType.UserInstall,
				],
				contexts,
			});
		}
		else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(discordToken);

// and deploy your commands!
(async () => {
	try {
		console.log(`Started refreshing ${commands.length} global application (/) commands.`);

		// The put method is used to fully refresh all global commands with the current set
		// Global commands are available in all servers the bot is in
		const data = await rest.put(Routes.applicationCommands(clientId), { body: commands }) as any[];

		console.log(`Successfully reloaded ${data.length} global application (/) commands.`);
		console.log('Note: Global commands can take up to 1 hour to propagate to all servers.');
		process.exit(0);
	}
	catch (error) {
		// And of course, make sure you catch and log any errors!
		console.error(error);
	}
})();
