import {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
	AttachmentBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ComponentType,
} from 'discord.js';
import config from '../../config.json' with { type: 'json' };

interface Config {
    discordToken: string;
    clientId: string;
    guildId: string;
    githubToken: string;
    googleApiKey?: string;
    hostedDownloadBaseUrl?: string;
    spotiflacApiUrl?: string;
}

const typedConfig = config as Config;

// Default values for backwards compatibility
const SPOTIDL_API = typedConfig.spotiflacApiUrl ?? 'https://spotdl.xwalfie.dev';
const HOSTED_BASE_URL = typedConfig.hostedDownloadBaseUrl ?? 'https://dl.xwalfie.dev';

// Discord's max file size for non-boosted servers is 25MB
const MAX_FILE_SIZE = 25 * 1024 * 1024;

// Button interaction timeout (30 seconds)
const BUTTON_TIMEOUT = 30000;

interface UserDownloadResponse {
    active: boolean;
    filename?: string;
    expires_at?: string;
}

interface DownloadResponse {
    type: 'file' | 'hosted';
    filename?: string;
    download_url?: string;
}

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
		const userId = interaction.user.id;

		await interaction.deferReply();

		try {
			// Check for existing user download
			let existingDownload: UserDownloadResponse | null = null;
			try {
				const checkRes = await fetch(`${SPOTIDL_API}/user-download/${userId}`, {
					method: 'GET',
					headers: {
						'X-User-ID': userId,
					},
				});

				if (checkRes.ok) {
					existingDownload = await checkRes.json() as UserDownloadResponse;
				}
			}
			catch (checkError) {
				// If check fails, continue anyway (don't block user)
				console.error('Error checking existing download:', checkError);
			}

			// If user has active download, show button row
			if (existingDownload?.active) {
				const filename = existingDownload.filename ?? 'unknown';
				const expiresAt = existingDownload.expires_at
					? new Date(existingDownload.expires_at)
					: null;
				const timeRemaining = expiresAt
					? formatTimeRemaining(expiresAt)
					: 'soon';

				const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder()
						.setCustomId('replace')
						.setLabel('Replace & Download')
						.setStyle(ButtonStyle.Primary),
					new ButtonBuilder()
						.setCustomId('cancel')
						.setLabel('Cancel')
						.setStyle(ButtonStyle.Secondary),
				);

				const message = await interaction.editReply({
					content: `You have an active download: **${filename}**. It expires in ${timeRemaining}. Replace it or cancel?`,
					components: [row],
				});

				try {
					const buttonInteraction = await message.awaitMessageComponent({
						componentType: ComponentType.Button,
						time: BUTTON_TIMEOUT,
					});

					if (buttonInteraction.customId === 'cancel') {
						await buttonInteraction.update({
							content: 'Download cancelled.',
							components: [],
						});
						return;
					}

					// Replace: cancel existing download first
					if (buttonInteraction.customId === 'replace') {
						await buttonInteraction.deferUpdate();
						try {
							await fetch(`${SPOTIDL_API}/cancel-download/${userId}`, {
								method: 'DELETE',
								headers: {
									'X-User-ID': userId,
								},
							});
						}
						catch (cancelError) {
							console.error('Error cancelling existing download:', cancelError);
							// Continue anyway
						}
					}
				}
				catch {
					// Button interaction timed out
					await interaction.editReply({
						content: 'Download request timed out. Please try again.',
						components: [],
					});
					return;
				}
			}

			// Proceed with download
			const res = await fetch(`${SPOTIDL_API}/download`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-User-ID': userId,
				},
				body: JSON.stringify({ url, service, format }),
			});

			if (!res.ok) {
				const err = (await res.json()) as { error: string };
				await interaction.editReply({
					content: `Download failed: ${err.error}`,
					components: [],
				});
				return;
			}

			const contentType = res.headers.get('content-type') ?? '';
			if (contentType.includes('application/json')) {
				const responseData = await res.json() as DownloadResponse;
				if (responseData.type === 'hosted') {
					const downloadUrl = responseData.download_url ?? `${HOSTED_BASE_URL}/${userId}`;
					await interaction.editReply({
						content: `Your file is ready: ${downloadUrl}\nExpires in 1 hour. Click the link to download.`,
						components: [],
					});
					return;
				}

				await interaction.editReply({
					content: `Download failed: Expected JSON type "hosted" but received "${responseData.type}". Please try again.`,
					components: [],
				});
				return;
			}

			const buffer = Buffer.from(await res.arrayBuffer());

			// Warn if file exceeds Discord's upload limit
			if (buffer.byteLength > MAX_FILE_SIZE) {
				await interaction.editReply({
					content: `File is too large to upload (${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB). Discord's limit is 25MB.`,
					components: [],
				});
				return;
			}

			// Extract filename from content-disposition header
			const filename = res.headers
				.get('content-disposition')
				?.match(/filename="(.+)"/)?.[1]
				?? 'track.flac';

			const attachment = new AttachmentBuilder(buffer, { name: filename });
			await interaction.editReply({
				content: null,
				files: [attachment],
				components: [],
			});
		}
		catch (error) {
			console.error('Error downloading track:', error);
			const msg = error instanceof Error ? error.message : 'Unknown error';
			await interaction.editReply({
				content: `Download failed: ${msg}`,
				components: [],
			});
		}
	},
};

function formatTimeRemaining(expiresAt: Date): string {
	const now = new Date();
	const diff = expiresAt.getTime() - now.getTime();

	if (diff <= 0) {
		return 'soon';
	}

	const minutes = Math.floor(diff / (1000 * 60));
	const hours = Math.floor(minutes / 60);

	if (hours > 0) {
		const remainingMinutes = minutes % 60;
		return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
	}

	return `${minutes}m`;
}
