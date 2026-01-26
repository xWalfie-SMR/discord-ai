import { processCommand } from './services/aiClient.js';

async function test() {
	const result = await processCommand('open chrome and go to discord');
	console.log(result);
}

test();