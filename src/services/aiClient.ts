import { post } from './apiHandler.js';
import { controlPrompt } from '../prompts/control.js';
import { Action } from '../types/actions.js';

export async function processCommand(command: string): Promise<Action[]> {
	const data = await post('/inference/chat/completions', {
		model: 'openai/gpt-4o',
		messages: [
			{
				role: 'user',
				content: controlPrompt(command),
			},
		],
	});

	let content = data.choices[0].message.content;

	content = content
		.replace(/^```json\s*/i, '')
		.replace(/^```\s*/i, '')
		.replace(/\s*```$/i, '')
		.trim();

	return JSON.parse(content);
}