import { Socket, Server } from 'socket.io';
import { createServer } from 'https';
import { readFileSync } from 'fs';
import { Action } from '../types/actions.js';

// Map to store pending screenshot requests by userId
// eslint-disable-next-line no-unused-vars
const pendingScreenshots = new Map<string, (screenshot: string) => void>();

const userToSocket = new Map<string, string>();

// HTTPS server options
const httpsOptions = {
	key: readFileSync('/etc/letsencrypt/live/vm.xwalfie.dev/privkey.pem'),
	cert: readFileSync('/etc/letsencrypt/live/vm.xwalfie.dev/fullchain.pem'),
};

// create HTTPS server
const httpsServer = createServer(httpsOptions);

// create Socket.IO server
const io = new Server(httpsServer, {
	cors: {
		origin: '*',
	},
});

// start HTTPS server
httpsServer.listen(3000);

// handle socket connections
io.on('connection', (socket: Socket) => {
	console.log('a user connected');

	socket.on('identify', (data: { userId: string }) => {
		if (!data?.userId) {
			return;
		}

		socket.data.userId = data.userId;
		userToSocket.set(data.userId, socket.id);
	});

	socket.on('disconnect', () => {
		const userId = socket.data.userId as string | undefined;
		if (userId && userToSocket.get(userId) === socket.id) {
			userToSocket.delete(userId);

			// Reject any pending screenshot request for this user
			const resolver = pendingScreenshots.get(userId);
			if (resolver) {
				pendingScreenshots.delete(userId);
			}
		}

		console.log('user disconnected');
	});

	// receive screenshot data from client
	socket.on(
		'screenshot_unvalidated',
		(data: { userId: string; screenshot: string; prompt: string }) => {
			// validate screenshot data
			if (!data.screenshot || !data.screenshot.startsWith('data:image/')) {
				return;
			}

			// resolve the pending screenshot request for this user
			const resolver = pendingScreenshots.get(data.userId);
			if (resolver) {
				resolver(data.screenshot);
				pendingScreenshots.delete(data.userId);
			}
		},
	);
});

function requestScreenshot(
	userId: string,
	prompt: string,
	{ timeoutMs = 30000, retries = 1 } = {},
): Promise<string> {
	return new Promise((resolve, reject) => {
		let attempts = 0;

		const attempt = () => {
			attempts++;

			const socketId = userToSocket.get(userId);
			if (!socketId) {
				reject(new Error('No control client connected'));
				return;
			}

			// Verify the socket is still alive
			const socket = io.sockets.sockets.get(socketId);
			if (!socket || socket.disconnected) {
				userToSocket.delete(userId);
				reject(new Error('Control client connection is stale'));
				return;
			}

			// Clean up any previous pending request for this user
			pendingScreenshots.delete(userId);

			const timeout = setTimeout(() => {
				pendingScreenshots.delete(userId);
				if (attempts <= retries) {
					console.warn(
						`Screenshot timeout for ${userId}, retrying (${attempts}/${retries})...`,
					);
					attempt();
				} else {
					reject(
						new Error(
							`Screenshot request timed out after ${attempts} attempt(s)`,
						),
					);
				}
			}, timeoutMs);

			pendingScreenshots.set(userId, (screenshot: string) => {
				clearTimeout(timeout);
				resolve(screenshot);
			});

			socket.emit('request_screenshot', { userId, prompt });
		};

		attempt();
	});
}

function executeActions(userId: string, actions: Action[]): void {
	if (!actions.length) {
		return;
	}

	const socketId = userToSocket.get(userId);
	if (!socketId) {
		return;
	}

	const socket = io.sockets.sockets.get(socketId);
	if (!socket || socket.disconnected) {
		userToSocket.delete(userId);
		return;
	}

	socket.emit('execute_actions', { userId, actions });
}

export default io;
export { requestScreenshot, executeActions };
