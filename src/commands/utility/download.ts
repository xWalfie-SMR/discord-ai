import {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
	AttachmentBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ComponentType,
	DiscordAPIError,
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
const HOSTED_LINK_THRESHOLD_BYTES = 25 * 1024 * 1024;
const DISCORD_MESSAGE_MAX_LENGTH = 2000;
// Matches backend failures like: `all 7 APIs failed. Last error: HTTP 404.`
const API_FAILURE_HEADER_PATTERN = /^all\s+(\d+)\s+APIs\s+failed\.\s*last error:\s*([^\n]+)$/i;
// Matches backend endpoint lines like: `https://host:443/: state=closed, consecutive_failures=2`
const API_ENDPOINT_FAILURE_PATTERN = /^\s*https?:\/\/([^/\s]+)\/?:\s*state=([^,\n]+),\s*consecutive_failures=(\d+)/gim;
const SERVICE_FAILURE_RETRY_GUIDANCE = 'Please retry in a few minutes or try another track.';

// Button interaction timeout (30 seconds)
const BUTTON_TIMEOUT = 30000;

interface UserDownloadResponse {
    active: boolean;
    filename?: string;
    expires_at?: string;
}

interface HostedDownloadResponse {
    type: 'hosted';
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
		),
	async execute(interaction: ChatInputCommandInteraction) {
		const url = interaction.options.getString('url', true);
		const format = interaction.options.getString('format') ?? 'LOSSLESS';
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
				body: JSON.stringify({ url, format }),
			});

			if (!res.ok) {
				const err = await readErrorMessage(res);
				await interaction.editReply({
					content: formatDownloadFailureMessage(err),
					allowedMentions: { parse: [] },
					components: [],
				});
				return;
			}

			const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
			if (contentType.startsWith('application/json')) {
				const responseData = await res.json() as {
					type?: unknown;
					download_url?: unknown;
				};
				if (isHostedDownloadResponse(responseData)) {
					await sendHostedDownloadReply(interaction, userId, responseData.download_url);
					return;
				}

				const responseType = typeof responseData.type === 'string' ? responseData.type : 'unknown';
				await interaction.editReply({
					content: `Download failed: Expected JSON type "hosted" but received "${responseType}". Please try again.`,
					components: [],
				});
				return;
			}

			const discordUploadLimit = Number.isFinite(interaction.attachmentSizeLimit)
				&& interaction.attachmentSizeLimit > 0
				? interaction.attachmentSizeLimit
				: HOSTED_LINK_THRESHOLD_BYTES;
			const uploadLimit = Math.min(HOSTED_LINK_THRESHOLD_BYTES, discordUploadLimit);
			const contentLengthHeader = res.headers.get('content-length');
			const contentLength = contentLengthHeader === null
				? Number.NaN
				: Number.parseInt(contentLengthHeader, 10);

			// If the server reports an oversized file, avoid buffering the full response.
			if (Number.isFinite(contentLength) && contentLength > uploadLimit) {
				await sendHostedDownloadReply(interaction, userId);
				return;
			}

			const buffer = Buffer.from(await res.arrayBuffer());

			// Files over the 25MB hosting split or Discord's channel upload limit are served via hosted links.
			if (buffer.byteLength > uploadLimit) {
				await sendHostedDownloadReply(interaction, userId);
				return;
			}

			// Extract filename from content-disposition header
			const filename = res.headers
				.get('content-disposition')
				?.match(/filename="(.+)"/)?.[1]
				?? 'track.flac';

			const attachment = new AttachmentBuilder(buffer, { name: filename });
			try {
				await interaction.editReply({
					content: null,
					files: [attachment],
					components: [],
				});
			}
			catch (error) {
				if (error instanceof DiscordAPIError && error.code === 40005) {
					await sendHostedDownloadReply(interaction, userId);
					return;
				}
				throw error;
			}
		}
		catch (error) {
			console.error('Error downloading track:', error);
			const msg = error instanceof Error ? error.message : 'Unknown error';
			await interaction.editReply({
				content: formatDownloadFailureMessage(msg),
				allowedMentions: { parse: [] },
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

function isHostedDownloadResponse(response: {
	type?: unknown;
	download_url?: unknown;
}): response is HostedDownloadResponse {
	return response.type === 'hosted'
		&& (response.download_url === undefined || typeof response.download_url === 'string');
}

async function readErrorMessage(res: Response): Promise<string> {
	const statusSuffix = res.statusText ? ` ${res.statusText}` : '';
	const fallback = `HTTP ${res.status}${statusSuffix}`;
	const bodyText = await res.text();

	if (!bodyText.trim()) {
		return fallback;
	}

	try {
		const parsed = JSON.parse(bodyText) as { error?: unknown; message?: unknown };
		if (typeof parsed.error === 'string' && parsed.error.trim()) {
			return parsed.error;
		}
		if (typeof parsed.message === 'string' && parsed.message.trim()) {
			return parsed.message;
		}
	}
	catch {
		// Non-JSON responses are valid; fall back to plain text.
	}

	return bodyText;
}

function formatDownloadFailureMessage(message: string): string {
	const prefix = 'Download failed: ';
	const serviceFailureMessage = formatServiceFailureMessage(message);
	if (serviceFailureMessage !== null) {
		return truncateDownloadFailureDetail(serviceFailureMessage, prefix);
	}

	return truncateDownloadFailureDetail(message, prefix);
}

function truncateDownloadFailureDetail(detailMessage: string, prefix: string): string {
	const maxDetailLength = DISCORD_MESSAGE_MAX_LENGTH - prefix.length;
	const safeMessage = detailMessage.replace(/@/g, '@\u200b');
	const ellipsis = '…';
	const detail = safeMessage.length > maxDetailLength
		? `${safeMessage.slice(0, Math.max(0, maxDetailLength - ellipsis.length))}${ellipsis}`
		: safeMessage;
	return `${prefix}${detail}`;
}

function formatServiceFailureMessage(message: string): string | null {
	const trimmed = message.trim();
	const headerMatch = trimmed.match(API_FAILURE_HEADER_PATTERN);
	if (headerMatch === null) {
		return null;
	}

	const endpointMatches = [...trimmed.matchAll(API_ENDPOINT_FAILURE_PATTERN)];

	const expectedCount = Number.parseInt(headerMatch[1], 10);
	const endpointCount = Number.isFinite(expectedCount) && expectedCount > 0
		? expectedCount
		: endpointMatches.length;
	const lastError = headerMatch[2].trim();
	const endpointLabel = endpointCount > 0
		? `${endpointCount} provider endpoints`
		: 'provider endpoints';

	if (endpointMatches.length === 0) {
		return [
			`All ${endpointLabel} failed (${lastError}).`,
			'The service could not find a working fallback source.',
			SERVICE_FAILURE_RETRY_GUIDANCE,
		].join(' ');
	}

	const services = endpointMatches.map((match) => {
		const [authority, state, consecutiveFailures] = match.slice(1);
		return `• ${authority} (${state}, failures: ${consecutiveFailures})`;
	}).join('\n');

	return [
		`All ${endpointLabel} failed (${lastError}).`,
		'No fallback source could be used for this track.',
		'Tried services:',
		services,
		SERVICE_FAILURE_RETRY_GUIDANCE,
	].join('\n');
}

async function sendHostedDownloadReply(
	interaction: ChatInputCommandInteraction,
	userId: string,
	downloadUrl?: string,
): Promise<void> {
	const url = downloadUrl ?? `${HOSTED_BASE_URL}/${userId}`;
	await interaction.editReply({
		content: `Your file is ready: ${url}\nExpires in 1 hour. Click the link to download.`,
		components: [],
	});
}
