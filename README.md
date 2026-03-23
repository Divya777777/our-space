# Our Space 🌙

A private, peer-to-peer video chat and music streaming app designed for couples. All communication is encrypted and direct between peers - no data is stored on any server.

## 🎯 Two Ways to Use This App

1. **Simple Mode**: Just double-click `index.html` - works immediately, no installation!
2. **Server Mode**: Run `npm start` - more reliable, requires Node.js setup

Choose whichever works best for you!

## Features

- 🎥 **Peer-to-peer video calls** - Direct WebRTC connections
- 💬 **Private chat** - Messages stored only on your device
- 🎵 **Synchronized music streaming** - YouTube integration
- 🔒 **PIN-protected rooms** - Only approved guests can join
- 🔐 **End-to-end encryption** - AES-256-GCM encryption layer on top of WebRTC
- 🌙 **Privacy-first** - No data collection, no tracking
- 📱 **Local storage** - All data stays on your computer

## Quick Start

### ⚡ Simple Mode (No Installation - Works Immediately!)

**Just double-click `index.html` and it works!**

This uses the cloud PeerJS server (free, public). Perfect for:
- Quick testing
- Occasional use
- When you don't want to install anything

**Pros:**
- ✅ No installation required
- ✅ Works instantly
- ✅ No server to maintain

**Cons:**
- ⚠️ Relies on cloud PeerJS server (can be slow/unreliable)
- ⚠️ May have connection issues on some networks

---

### 🚀 Server Mode (Better Reliability - Requires Setup)

**For better connection reliability, run your own server:**

#### First Time Setup

1. **Install Node.js** (if not already installed)
   - Download from: https://nodejs.org/
   - Choose LTS version (recommended)

2. **Install Dependencies**
   ```bash
   cd our-space
   npm install
   ```

#### Running the App

**Method 1: Auto-start (Recommended)**
```bash
npm start
```
This will:
- Start your own PeerJS server (more reliable!)
- Start the web server
- Automatically open your browser to http://localhost:3000

**Method 2: Manual start**
```bash
npm run server
```
Then open http://localhost:3000 in your browser

**Pros:**
- ✅ Much more reliable connections
- ✅ Better performance
- ✅ Full privacy (your own server)
- ✅ Can share with partner on same network

**Cons:**
- ⚠️ Requires Node.js installation
- ⚠️ Need to keep server running

---

### 🌐 Sharing with Partner

**Simple Mode (file:// protocol):**
- Both people open `index.html` directly
- Each person creates/joins room independently

**Server Mode (http:// protocol):**
- One person runs the server (`npm start`)
- Share link with partner: `http://localhost:3000` (same network)
- Or share public IP: `http://YOUR_IP:3000` (different networks)

### Using the App

1. **Create a Room (Host)**
   - Enter your name
   - Create a room code (any name you want)
   - Set a PIN (share this only with your partner)
   - Click "Create Room"

2. **Join a Room (Guest)**
   - Enter your name
   - Enter the same room code
   - Enter the same PIN
   - Click "Join Room"

3. **Approve Guest (Host)**
   - When guest tries to join, you'll see a popup
   - Click "Accept" to let them in

4. **Start Video Call**
   - Click the phone icon in the top right
   - Allow camera/microphone access
   - Both host and guest need to start the call

## Privacy & Security

### 🔐 **PRODUCTION-READY SECURITY (v2.0)**

This app now features **enterprise-grade security** with multiple layers of protection:

### **1. Triple-Layer Encryption**

1. **Application-Level Encryption (AES-256-GCM)**
   - All chat messages, files, playlists, and sync data encrypted BEFORE sending
   - Encryption key derived from Room ID + PIN using PBKDF2 (100,000 iterations)
   - Even if someone intercepts WebRTC traffic, they see only encrypted data

2. **Storage Encryption (AES-256-GCM)**
   - Chat history encrypted in IndexedDB
   - Playlists encrypted in localStorage
   - Approved tokens encrypted in localStorage
   - All sensitive data encrypted at rest

3. **WebRTC Built-in Encryption (DTLS/SRTP)**
   - Video and audio encrypted with DTLS/SRTP
   - Data channels encrypted with DTLS
   - Industry-standard encryption

### **2. Advanced Authentication**

- **HMAC-SHA256 Token System** - Replaces weak base64 with cryptographically secure tokens
- **Rate Limiting** - Max 5 failed attempts per 5 minutes, 15-minute automatic block
- **Token Expiration** - Approved tokens expire after 30 minutes
- **Time-Window Validation** - 10-minute tolerance for clock drift
- **SHA-256 Room Hashing** - Upgraded from SHA-1

### **3. Audit & Monitoring**

- **Audit Log System** - All authentication events logged to IndexedDB
- **Security Status Dashboard** - Type `showSecurityStatus()` in console
- **Failed Attempt Tracking** - Real-time monitoring of auth failures
- **Automatic Cleanup** - Expired tokens cleaned hourly

### **4. Automatic Data Management**

- **Token Expiration** - Old tokens automatically removed
- **Audit Log Rotation** - Keep last 1000 events
- **Manual Data Deletion** - Type `deleteAllRoomData()` in console
- **Cleanup on Leave** - Session data cleared on exit

**Result**: Bank-level security for your private conversations!

### What's Stored Locally (Your Computer Only)
- Chat messages (IndexedDB)
- Playlists (localStorage)
- Approved guest tokens (localStorage)
- Session credentials (cleared when browser closes)

### What's Sent Over Network
- **Chat/Files**: Encrypted with AES-256-GCM → Encrypted with WebRTC → Direct P2P
- **Video/Audio**: Encrypted with WebRTC SRTP → Direct P2P
- **Playlists/Sync**: Encrypted with AES-256-GCM → Encrypted with WebRTC → Direct P2P
- **Signaling**: Connection handshake only (no actual data)

### What's NOT Stored Anywhere
- ✅ No chat logs on servers
- ✅ No video recordings
- ✅ No user data collection
- ✅ No analytics or tracking
- ✅ No third-party services (when using self-hosted setup)
- ✅ No encryption keys stored (derived fresh each session)

## Testing Security Features

### Automated Test Suite

Open `test-security.html` in your browser to run comprehensive security tests:

```bash
# Simply open in browser:
open test-security.html

# Or through server:
http://localhost:3000/test-security.html
```

The test suite includes:
- ✅ 16 comprehensive security tests
- ✅ Encryption verification (AES-256-GCM)
- ✅ Authentication testing (HMAC-SHA256)
- ✅ Storage encryption validation
- ✅ Rate limiting checks
- ✅ Token expiration tests
- ✅ Hash consistency verification

### Security Commands

Open browser console (F12) and use these commands:

```javascript
// View security status
showSecurityStatus()

// View recent audit logs
getAuditLogs(50)

// Delete all data (DANGER!)
deleteAllRoomData()
```

## Technical Details

### Architecture
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Video/Audio**: WebRTC (peer-to-peer)
- **Signaling**: PeerJS (self-hosted)
- **NAT Traversal**: STUN servers (5 Google STUN servers)
- **Local Storage**: IndexedDB + localStorage (encrypted)
- **Encryption**: AES-256-GCM + HMAC-SHA256 + PBKDF2
- **Hashing**: SHA-256

### Security Features
| Feature | Implementation | Strength |
|---------|---------------|----------|
| Message Encryption | AES-256-GCM | Military-grade |
| Storage Encryption | AES-256-GCM | Military-grade |
| Auth Tokens | HMAC-SHA256 | Cryptographically secure |
| Key Derivation | PBKDF2 (100k iterations) | NIST recommended |
| Room Hashing | SHA-256 | Industry standard |
| Rate Limiting | 5 attempts / 5 min | Brute-force protection |
| Token Expiry | 30 minutes | Time-limited access |
| Audit Logging | IndexedDB | Full event tracking |

### Ports Used
- **3000**: Web server (HTTP)
- **9000**: PeerJS signaling server (internal)

### Browser Support
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

### Connection Reliability
- **5 STUN servers** for better NAT traversal
- **Auto-retry** with exponential backoff (up to 5 attempts)
- **10-second timeout** per connection attempt
- **Auto-reconnect** if disconnected from signaling server

## Troubleshooting

### "Could not reach host"
1. Make sure host created the room first
2. Check that room code and PIN match exactly
3. Verify both devices have internet connection
4. Check browser console (F12) for detailed errors
5. Wait 2-3 seconds after host creates room before joining

### Camera/Microphone not working
1. Check browser permissions (click lock icon in address bar)
2. Make sure no other app is using camera/mic
3. Try refreshing the page
4. Check browser console for permission errors

### Connection drops frequently
1. Check internet stability
2. Close bandwidth-heavy apps
3. Try disabling VPN if using one
4. Check firewall settings

### Server won't start
1. Make sure port 3000 is not already in use
2. Run: `lsof -i :3000` to check what's using it
3. Kill the process or change port in server.js
4. Make sure Node.js is installed: `node --version`

## Advanced Configuration

### Change Ports
Edit `server.js`:
```javascript
const PORT = 3000;        // Web server port
const PEER_PORT = 9000;   // PeerJS port (not directly exposed)
```

### Enable Debug Logging
Edit `room.js`:
```javascript
debug: 3  // Change from 0 to 3 for verbose logs
```

### Add Custom STUN/TURN Servers
Edit `room.js` around line 340:
```javascript
iceServers: [
    { urls: 'stun:your-stun-server.com:3478' },
    {
        urls: 'turn:your-turn-server.com:3478',
        username: 'user',
        credential: 'password'
    }
]
```

## Remote Access (Optional)

### Access from other devices on same network
1. Find your local IP: `ifconfig` (Mac/Linux) or `ipconfig` (Windows)
2. Share the link: `http://YOUR_LOCAL_IP:3000`
3. Make sure firewall allows connections on port 3000

### Access over internet (Requires port forwarding)
1. Set up port forwarding on your router (port 3000)
2. Find your public IP: https://whatismyip.com
3. Share link: `http://YOUR_PUBLIC_IP:3000`
4. ⚠️ **Security Warning**: Only share with trusted people!

## Scripts

- `npm start` - Auto-start server and open browser
- `npm run server` - Start server only (manual browser open)
- `npm run dev` - Same as npm start

## Stopping the Server

Press `Ctrl+C` in the terminal where the server is running

## Updates & Maintenance

### Update Dependencies
```bash
npm update
```

### Clear All Local Data
In browser console (F12):
```javascript
localStorage.clear();
sessionStorage.clear();
indexedDB.deleteDatabase('OurSpaceChat_YOURROOM');
```

## Contributing

This is a private project, but feel free to fork and customize for your needs!

## License

MIT License - Feel free to use and modify

## Support

If you encounter issues:
1. Check browser console (F12) for errors
2. Check terminal where server is running for errors
3. Verify Node.js version: `node --version` (should be 14+)
4. Make sure all dependencies installed: `npm install`

---

Made with ❤️ for private moments
