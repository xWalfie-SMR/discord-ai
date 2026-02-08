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

	// Step 1: Remove markdown code blocks if present
	const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
	const jsonPayload = (codeBlockMatch?.[1] ?? text).trim();

	try {
		// Step 2: First parse attempt
		let parsed = JSON.parse(jsonPayload);

		// Step 3: Handle double-stringified JSON (if AI returns a string instead of object)
		if (typeof parsed === 'string') {
			// Try parsing again in case it's stringified JSON
			try {
				parsed = JSON.parse(parsed);
			}
			catch {
				// If second parse fails, treat the string as plain text
				return { text: parsed };
			}
		}

		// Step 4: Ensure parsed is an object
		if (typeof parsed !== 'object' || parsed === null) {
			return { text: String(parsed) };
		}

		// Step 5: Return the properly structured response
		return {
			text: parsed.text ?? '',
			needsScreenshot: parsed.needsScreenshot ?? false,
			actions: parsed.actions ?? [],
		};
	}
	catch {
		// If parsing fails completely, return the raw text
		return { text };
	}
}

export { chat, ChatResponse };
