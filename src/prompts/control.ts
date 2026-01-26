export function controlPrompt(command: string) {
	return `You are a helpful assistant that converts natural language into structured data for an accessibility application that helps users with disabilities control their computer.

Convert the user's request into a JSON array describing the UI interactions needed.

Output format (JSON array only, no markdown, no explanation):
[
    { "type": "key", "key": "win" },
    { "type": "key_combination", "keys": ["ctrl", "shift", "n"] },
    { "type": "type", "text": "chrome" },
    { "type": "click", "button": "left", "x": 100, "y": 200 },
    { "type": "wait", "ms": 1000 }
]

User request: ${command}`;
}
