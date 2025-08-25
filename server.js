const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { generateWorld } = require('./worldgen');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(__dirname));

// Persistent world state
let world = generateWorld();

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Send initial world state
    socket.emit('worldData', world);

    // Broadcast new player
    socket.broadcast.emit('playerMove', { id: socket.id, position: { x: 16, y: 10, z: 16 }, sprinting: false });

    socket.on('playerMove', (data) => {
        socket.broadcast.emit('playerMove', data);
    });

    socket.on('blockUpdate', (data) => {
        if (data.type) {
            world[data.position] = data.type;
        } else {
            delete world[data.position];
        }
        socket.broadcast.emit('blockUpdate', data);
    });

    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        socket.broadcast.emit('playerDisconnect', socket.id);
    });
});

server.listen(3000, () => {
    console.log('Server running on port 3000');
});