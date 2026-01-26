import { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { SlashCommandBuilder } from 'discord.js';

export default {
	data: new SlashCommandBuilder()
		.setName('user')
		.setDescription('Provides information about the user.')
		.addUserOption(option =>
			option
				.setName('target')
				.setDescription('The user to get info about')
				.setRequired(false)
		),
	async execute(interaction: ChatInputCommandInteraction) {
		// interaction.user is the object representing the User who ran the command
		// interaction.member is the GuildMember object, which represents the user in the specific guild
		const target = interaction.options.getUser('target') ?? interaction.user;
		const member =
      interaction.options.getMember("target") ?? interaction.member;
		await interaction.reply(
			`User <@${target.id}> joined on ${(member as GuildMember)?.joinedAt}.`,
		);
	},
};