type Message = {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
};

const conversations = new Map<string, Message[]>();

function getMessages(userId: string): Message[] {
	return conversations.get(userId) ?? [];
}

function storeMessage(userId: string, role: 'user' | 'assistant', content: string): void {
	const history = getMessages(userId);
	history.push({ role, content, timestamp: Date.now() });
	conversations.set(userId, history);
}

function clearMessages(userId: string): void {
	conversations.delete(userId);
}

export { getMessages, storeMessage, clearMessages, Message };