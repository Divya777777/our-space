const express = require('express');
const { ExpressPeerServer } = require('peer');
const path = require('path');

const app = express();
const PORT = 3000;
const PEER_PORT = 9000;

// Serve static files (HTML, CSS, JS)
app.use(express.static(__dirname));

// Main route - serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start HTTP server
const server = app.listen(PORT, () => {
    console.log('\n✨ Our Space Server Started! ✨\n');
    console.log(`🌐 Web App:     http://localhost:${PORT}`);
    console.log(`🔌 PeerJS:      http://localhost:${PEER_PORT}`);
    console.log('\n📱 Open the link above in your browser to use the app!');
    console.log('🔒 All connections are peer-to-peer and private.\n');
});

// Create PeerJS server
const peerServer = ExpressPeerServer(server, {
    path: '/peerjs',
    debug: false, // Set to true for verbose logging
    allow_discovery: true,
    proxied: false,
    // Security options
    alive_timeout: 60000, // 60 seconds
    key: 'ourspace', // Simple key for local use
    concurrent_limit: 5000
});

// Handle PeerJS on a separate endpoint
app.use('/peerjs', peerServer);

// PeerJS events
peerServer.on('connection', (client) => {
    console.log(`✅ Peer connected: ${client.getId()}`);
});

peerServer.on('disconnect', (client) => {
    console.log(`❌ Peer disconnected: ${client.getId()}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down server...\n');
    server.close(() => {
        console.log('✅ Server closed successfully.\n');
        process.exit(0);
    });
});

// Error handling
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});
