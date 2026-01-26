import axios from 'axios';
import config from '../config.json' with { type: 'json' };

export const apiHandler = axios.create({
	baseURL: 'https://models.github.ai',
	timeout: 5000,
	headers: {
		'Content-Type': 'application/json',
		'Authorization': `Bearer ${config.githubToken}`,
	},
});

export async function post(endpoint: string, data: object) {
	const response = await apiHandler.post(endpoint, data);
	return response.data;
}

export async function get(endpoint: string) {
	const response = await apiHandler.get(endpoint);
	return response.data;
}
