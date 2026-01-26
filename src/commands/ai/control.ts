import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { processCommand } from '../../services/aiClient.js';

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
			await interaction.editReply(`\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``);
		}
		catch (error) {
			console.error('Error processing command:', error);
			await interaction.editReply(
				`Error processing command: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);
		}
	},
};
