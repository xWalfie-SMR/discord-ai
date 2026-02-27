import { Socket, Server } from 'socket.io';
import { createServer } from 'https';
import { readFileSync } from 'fs';
import { Action } from '../types/actions.js';

// Map to store pending screenshot requests by userId
// eslint-disable-next-line no-unused-vars
const pendingScreenshots = new Map<string, { resolve: (screenshot: string) => void; reject: (err: Error) => void; timer: ReturnType<typeof setTimeout> }>();

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

/**
 * Look up the live Socket instance for a userId.
 * Returns undefined if the mapping is stale or the socket is disconnected.
 */
function getSocket(userId: string): Socket | undefined {
	const socketId = userToSocket.get(userId);
	if (!socketId) return undefined;

	const socket = io.sockets.sockets.get(socketId);
	if (!socket || socket.disconnected) {
		userToSocket.delete(userId);
		return undefined;
	}
	return socket;
}

/**
 * Cancel and clean up a pending screenshot request (if any).
 */
function cancelPending(userId: string, reason?: Error): void {
	const pending = pendingScreenshots.get(userId);
	if (!pending) return;
	clearTimeout(pending.timer);
	pendingScreenshots.delete(userId);
	if (reason) pending.reject(reason);
}

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
			cancelPending(userId, new Error('Control client disconnected'));
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
			const pending = pendingScreenshots.get(data.userId);
			if (pending) {
				clearTimeout(pending.timer);
				pendingScreenshots.delete(data.userId);
				pending.resolve(data.screenshot);
			}
		},
	);
});

const SCREENSHOT_TIMEOUT_MS = 30_000;
const SCREENSHOT_MAX_ATTEMPTS = 2;

function requestScreenshot(userId: string, prompt: string): Promise<string> {
	return new Promise((resolve, reject) => {
		let attempts = 0;

		const attempt = () => {
			attempts++;

			const socket = getSocket(userId);
			if (!socket) {
				reject(new Error('No control client connected'));
				return;
			}

			// Clean up any leftover pending request
			cancelPending(userId);

			const timer = setTimeout(() => {
				pendingScreenshots.delete(userId);
				if (attempts < SCREENSHOT_MAX_ATTEMPTS) {
					console.warn(
						`Screenshot timeout for ${userId}, retrying (attempt ${attempts + 1}/${SCREENSHOT_MAX_ATTEMPTS})...`,
					);
					attempt();
				}
				else {
					reject(new Error(
						`Screenshot request timed out after ${attempts} attempt(s)`,
					));
				}
			}, SCREENSHOT_TIMEOUT_MS);

			pendingScreenshots.set(userId, { resolve, reject, timer });

			socket.emit('request_screenshot', { userId, prompt });
		};

		attempt();
	});
}

function executeActions(userId: string, actions: Action[]): void {
	if (!actions.length) return;

	const socket = getSocket(userId);
	if (!socket) return;

	socket.emit('execute_actions', { userId, actions });
}

export default io;
export { requestScreenshot, executeActions };
