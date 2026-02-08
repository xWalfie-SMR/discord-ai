import { chatPrompt } from '../prompts/control.js';
import { Action } from '../types/actions.js';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import config from '../config.json' with { type: 'json' };

// Initialize the Google GenAI client
const ai = new GoogleGenAI({ apiKey: config.googleApiKey });

// Define the structure of the AI's chat response
type ChatResponse = {
	text: string;
	needsScreenshot?: boolean;
	actions?: Action[];
};

// Function to interact with the AI model for chat and control
async function chat(
	command: string,
	history: Array<{ role: string; content: string }>,
	screenshot?: string,
): Promise<ChatResponse> {
	// Prepare contents for the AI request
	const contents = [];

	// If a screenshot is provided, add it to the contents
	if (screenshot) {
		const base64Data = screenshot.startsWith('data:image/') ? screenshot.split(',')[1] : screenshot;
		contents.push({
			inlineData: { mimeType: 'image/png', data: base64Data },
		});
	}

	// Add the chat prompt
	contents.push({
		text: chatPrompt(command, history),
	});

	// Send the request to the AI model
	const response = await ai.models.generateContent({
		model: 'gemini-3-flash-preview',
		contents,
		config: { thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM } },
	});

	const text = response.text ?? '';
	const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
	const jsonPayload = (codeBlockMatch?.[1] ?? text).trim();

	try {
		const parsed = JSON.parse(jsonPayload);
		return {
			text: parsed.text ?? '',
			needsScreenshot: parsed.needsScreenshot ?? false,
			actions: parsed.actions ?? [],
		};
	}
	catch {
		return { text };
	}
}

export { chat, ChatResponse };
