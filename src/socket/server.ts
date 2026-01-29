import { Socket, Server } from 'socket.io';

const io = new Server(3000);

io.on('connection', (socket: Socket) => {
	console.log('a user connected');

	socket.on('disconnect', () => {
		console.log('user disconnected');
	});

	// receive screenshot data from client
	socket.on('screenshot_unvalidated', (data: { userId: string, screenshot: string, prompt: string }) => {
		// validate screenshot data
		if (!data.screenshot || !data.screenshot.startsWith('data:image/')) return;

		// emit the screenshot data to the requester
		io.emit('screenshot', data.screenshot);
	});
});

function requestScreenshot(userId: string, prompt: string) {
	// use a Promise to wait for the screenshot response
	return new Promise((resolve) => {
		// emit the request to the client
		io.emit('request_screenshot', { userId, prompt });

		// listen for the screenshot response
		io.once('screenshot', (data: string) => {
			resolve(data);
		});
	});
}

export default io;
export { requestScreenshot };