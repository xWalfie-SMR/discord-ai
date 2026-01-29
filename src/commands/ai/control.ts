import {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
	AttachmentBuilder,
} from 'discord.js';
import { processCommand } from '../../services/aiClient.js';
import { requestScreenshot } from '../../socket/server.js';

export default {
	data: new SlashCommandBuilder()
		.setName('control')
		.setDescription('Sends a command to the AI control system.')
		.addStringOption((option) =>
			option
				.setName('command')
				.setDescription('The command to send to the AI control system')
				.setRequired(true),
		),
	async execute(interaction: ChatInputCommandInteraction) {
		const command = interaction.options.getString('command', true);
		await interaction.deferReply();

		try {
			const result = await processCommand(command);
			await interaction.editReply(
				`\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``,
			);

			// request a screenshot from the connected client and attach it if available
			const screenshot = await requestScreenshot(interaction.user.id, command);
			if (
				typeof screenshot === 'string' &&
        screenshot.startsWith('data:image/')
			) {
				const base64 = screenshot.split(',')[1];
				const buffer = Buffer.from(base64, 'base64');
				const attachment = new AttachmentBuilder(buffer, {
					name: 'screenshot.png',
				});
				await interaction.followUp({
					content: 'Screenshot:',
					files: [attachment],
				});
			}
		}
		catch (error) {
			console.error('Error processing command:', error);
			await interaction.editReply(
				`Error processing command: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);
		}
	},
};
