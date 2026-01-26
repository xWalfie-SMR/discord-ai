import axios from 'axios';
import config from '../config.json' with { type: 'json' };

export const apiHandler = axios.create({
	baseURL: 'https://models.github.ai',
	headers: {
		'Content-Type': 'application/json',
		Authorization: `Bearer ${config.githubToken}`,
	},
	timeout: 5000,
});

export async function post(endpoint: string, data: object) {
	try {
		const response = await apiHandler.post(endpoint, data);
		return response.data;
	}
	catch (error) {
		if (axios.isAxiosError(error) && error.response) {
			console.error('API Error:', JSON.stringify(error.response.data, null, 2));
		}
		throw error;
	}
}

export async function get(endpoint: string) {
	const response = await apiHandler.get(endpoint);
	return response.data;
}
