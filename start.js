const { spawn } = require('child_process');
const open = require('open');

const PORT = 3000;
const APP_URL = `http://localhost:${PORT}`;

console.log('\n🚀 Starting Our Space...\n');

// Start the server
const serverProcess = spawn('node', ['server.js'], {
    stdio: 'inherit',
    cwd: __dirname
});

// Wait 2 seconds for server to start, then open browser
setTimeout(() => {
    console.log(`\n🌐 Opening browser at ${APP_URL}...\n`);
    open(APP_URL).catch(err => {
        console.error('❌ Could not open browser automatically:', err.message);
        console.log(`\n📱 Please open this link manually: ${APP_URL}\n`);
    });
}, 2000);

// Handle server process errors
serverProcess.on('error', (err) => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
});

serverProcess.on('close', (code) => {
    if (code !== 0) {
        console.error(`❌ Server exited with code ${code}`);
    }
    process.exit(code);
});

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down...\n');
    serverProcess.kill('SIGINT');
    process.exit(0);
});
