export function controlPrompt(command: string) {
	return `Convert this command into a JSON array of PC automation actions, the target computer uses Windows 10. Return ONLY valid JSON, no explanation.

Format:
[
    { "type": "key", "key": "win" },
    { "type": "key_combination", "keys": ["ctrl", "shift", "n"] },
    { "type": "type", "text": "chrome" },
    { "type": "click", "button": "left", "x": 100, "y": 200 },
    { "type": "key", "key": "enter" },
    { "type": "wait", "ms": 1000 }
]

Action types: "key" (keyboard shortcut), "key_combination" (multiple keys pressed together in order), "type" (type text), "wait" (pause in ms), "click" (mouse click)

Command: ${command}`;
}