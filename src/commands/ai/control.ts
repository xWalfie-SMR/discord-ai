import {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
	AttachmentBuilder,
} from 'discord.js';
import { getMessages, storeMessage } from '../../services/conversationStore.js';
import { requestScreenshot } from '../../socket/server.js';
import { chat } from '../../services/aiClient.js';

export default {
	data: new SlashCommandBuilder()
		.setName('control')
		.setDescription('Sends a command to the AI.')
		.addStringOption((option) =>
			option
				.setName('command')
				.setDescription('The command to send to the AI')
				.setRequired(true),
		),
	async execute(interaction: ChatInputCommandInteraction) {
		const command = interaction.options.getString('command', true);
		const userId = interaction.user.id;
		await interaction.deferReply();

		try {
			// Retrieve conversation history
			const history = getMessages(userId);

			// Send to AI with command and history
			let response = await chat(command, history);

			// Check if the AI requested a screenshot
			if (response.needsScreenshot) {
				await interaction.editReply('The AI is requesting a screenshot, please wait...');
				const screenshot = await requestScreenshot(userId, command);
				const base64Data = screenshot.split(',')[1];
				const screenshotBuffer = Buffer.from(base64Data, 'base64');
				const attachment = new AttachmentBuilder(screenshotBuffer, { name: 'screenshot.png' });
				storeMessage(userId, 'assistant', 'Requested screenshot.');
				const updatedHistory = getMessages(userId);

				// Re-send to AI with screenshot context
				response = await chat(command, updatedHistory, screenshot);

				// Send final response with screenshot attached
				await interaction.editReply({
					content: response.text,
					files: [attachment],
				});
			}
			else {
				await interaction.editReply(response.text);
			}

			// Store the interaction
			storeMessage(userId, 'user', command);
			storeMessage(userId, 'assistant', response.text);
		}
		catch (error) {
			console.error('Error processing command:', error);
			await interaction.editReply(
				`Error processing command: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);
		}
	},
};
