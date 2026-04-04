import {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
	AttachmentBuilder,
} from 'discord.js';

// Base URL for the spotiflac API
const SPOTIDL_API = 'https://spotdl.xwalfie.dev';

// Discord's max file size for non-boosted servers is 25MB
const MAX_FILE_SIZE = 25 * 1024 * 1024;

export default {
	data: new SlashCommandBuilder()
		.setName('download')
		.setDescription('Download a Spotify track')
		.addStringOption((option) =>
			option
				.setName('url')
				.setDescription('Spotify track URL')
				.setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName('format')
				.setDescription('Audio format (default: LOSSLESS)')
				.setRequired(false)
				.addChoices(
					{ name: 'FLAC (Lossless)', value: 'LOSSLESS' },
					{ name: 'FLAC (Hi-Res Lossless)', value: 'HI_RES_LOSSLESS' },
					{ name: 'MP3 (320kbps)', value: 'MP3_320' },
				),
		)
		.addStringOption((option) =>
			option
				.setName('service')
				.setDescription('Download service (default: tidal)')
				.setRequired(false)
				.addChoices(
					{ name: 'Tidal', value: 'tidal' },
					{ name: 'Amazon Music', value: 'amazon' },
					{ name: 'Qobuz', value: 'qobuz' },
				),
		),
	async execute(interaction: ChatInputCommandInteraction) {
		const url = interaction.options.getString('url', true);
		const format = interaction.options.getString('format') ?? 'LOSSLESS';
		const service = interaction.options.getString('service') ?? 'tidal';

		await interaction.deferReply();

		try {
			const res = await fetch(`${SPOTIDL_API}/download`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url, service, format }),
			});

			if (!res.ok) {
				const err = (await res.json()) as { error: string };
				await interaction.editReply(`Download failed: ${err.error}`);
				return;
			}

			const buffer = Buffer.from(await res.arrayBuffer());

			// Warn if file exceeds Discord's upload limit
			if (buffer.byteLength > MAX_FILE_SIZE) {
				await interaction.editReply(
					`File is too large to upload (${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB). Discord's limit is 25MB.`,
				);
				return;
			}

			// Extract filename from content-disposition header
			const filename =
				res.headers
					.get('content-disposition')
					?.match(/filename="(.+)"/)?.[1] ?? 'track.flac';

			const attachment = new AttachmentBuilder(buffer, { name: filename });
			await interaction.editReply({ files: [attachment] });
		}
		catch (error) {
			console.error('Error downloading track:', error);
			const msg = error instanceof Error ? error.message : 'Unknown error';
			await interaction.editReply(`Download failed: ${msg}`);
		}
	},
};
