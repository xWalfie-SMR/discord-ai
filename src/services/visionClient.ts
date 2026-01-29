import { GoogleGenAI, PartMediaResolutionLevel, ThinkingLevel } from '@google/genai';
import config from '../config.json' with { type: 'json' };

const ai = new GoogleGenAI({ apiKey: config.googleApiKey });

export async function verifyScreenshot(screenshot: string, command: string): Promise<boolean> {
	const base64 = screenshot.startsWith('data:image/') ? screenshot.split(',')[1] : screenshot;
	const response = await ai.models.generateContent({
		model: 'gemini-3-flash-preview',
		contents: [
			{
				inlineData: { mimeType: 'image/png', data: base64 },
				mediaResolution: { level: PartMediaResolutionLevel.MEDIA_RESOLUTION_HIGH },
			},
			{
				text: `User requested: "${command}"\n\nDid the action succeed? Answer YES or NO only.`,
			},
		],
		config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
	});
	const answer = response.text?.trim().toUpperCase() ?? '';
	return answer === 'YES';
}