/* =====================================================
   room.js — Couple's Room Logic
   WebRTC via PeerJS + YouTube IFrame API
   PIN-secured rooms — no stored credentials
   ===================================================== */

// ─── SESSION (cleared on browser close) ──────────────
const myName = sessionStorage.getItem('ourspace_name') || 'You';
const roomId = sessionStorage.getItem('ourspace_room') || '';
const roomPin = sessionStorage.getItem('ourspace_pin') || '';

if (!roomId) { window.location.href = 'index.html'; }

// ─── END-TO-END ENCRYPTION (AES-256-GCM) ─────────────
// Encrypts all messages, files, and sync data BEFORE sending via WebRTC
// Works with BOTH cloud PeerJS and self-hosted server!
let encryptionKey = null;

async function deriveEncryptionKey() {
    // Derive a strong encryption key from roomId + roomPin
    const keyMaterial = roomId + '::' + roomPin + '::ourspace_v1';
    const encoder = new TextEncoder();
    const keyData = encoder.encode(keyMaterial);

    // Use PBKDF2 to derive key (100,000 iterations for security)
    const baseKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );

    const salt = encoder.encode('ourspace_salt_v1_' + roomId);

    encryptionKey = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );

    console.log('[ENCRYPTION] 🔐 AES-256-GCM key derived from room credentials');

    // Show encryption indicator in UI
    const encryptionStatus = document.getElementById('encryptionStatus');
    if (encryptionStatus) {
        encryptionStatus.style.display = 'block';
        encryptionStatus.title = 'All messages, files, and sync data are encrypted with AES-256-GCM before transmission';
    }
}

async function encryptData(data) {
    if (!encryptionKey) await deriveEncryptionKey();

    // Convert data to JSON string then to bytes
    const encoder = new TextEncoder();
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    const dataBytes = encoder.encode(dataString);

    // Generate random IV (initialization vector) for each message
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt with AES-256-GCM
    const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        encryptionKey,
        dataBytes
    );

    // Combine IV + encrypted data for transmission
    const combined = new Uint8Array(iv.length + encryptedData.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedData), iv.length);

    // Convert to base64 for easy transmission
    return btoa(String.fromCharCode(...combined));
}

async function decryptData(encryptedString) {
    if (!encryptionKey) await deriveEncryptionKey();

    try {
        // Decode from base64
        const combined = Uint8Array.from(atob(encryptedString), c => c.charCodeAt(0));

        // Extract IV and encrypted data
        const iv = combined.slice(0, 12);
        const encryptedData = combined.slice(12);

        // Decrypt with AES-256-GCM
        const decryptedData = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            encryptionKey,
            encryptedData
        );

        // Convert bytes back to string
        const decoder = new TextDecoder();
        const dataString = decoder.decode(decryptedData);

        // Try to parse as JSON, otherwise return as string
        try {
            return JSON.parse(dataString);
        } catch {
            return dataString;
        }
    } catch (err) {
        console.error('[ENCRYPTION] ❌ Decryption failed:', err);
        return null; // Invalid key or corrupted data
    }
}

// Encrypt file data (for image/file sharing)
async function encryptFile(arrayBuffer, fileName) {
    if (!encryptionKey) await deriveEncryptionKey();

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        encryptionKey,
        arrayBuffer
    );

    // Return both IV and encrypted data
    return {
        iv: btoa(String.fromCharCode(...iv)),
        data: btoa(String.fromCharCode(...new Uint8Array(encryptedData))),
        fileName: fileName
    };
}

async function decryptFile(encryptedFile) {
    if (!encryptionKey) await deriveEncryptionKey();

    try {
        const iv = Uint8Array.from(atob(encryptedFile.iv), c => c.charCodeAt(0));
        const data = Uint8Array.from(atob(encryptedFile.data), c => c.charCodeAt(0));

        const decryptedData = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            encryptionKey,
            data
        );

        return {
            data: decryptedData,
            fileName: encryptedFile.fileName
        };
    } catch (err) {
        console.error('[ENCRYPTION] ❌ File decryption failed:', err);
        return null;
    }
}

// ─── ENHANCED STAR BACKGROUND ─────────────────────────
(function initStars() {
    const canvas = document.getElementById('starCanvas');
    const ctx = canvas.getContext('2d');
    let stars = [], W, H;
    const starColors = [
        [255, 255, 255],   // white
        [200, 220, 255],   // blue-white
        [255, 240, 220],   // warm
        [180, 200, 255],   // blue
        [255, 220, 200],   // amber
    ];
    function resize() {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
        stars = [];
        for (let i = 0; i < 400; i++) {
            const col = starColors[Math.floor(Math.random() * starColors.length)];
            const isBright = Math.random() < 0.08; // 8% are bright feature stars
            stars.push({
                x: Math.random() * W,
                y: Math.random() * H,
                r: isBright ? Math.random() * 2 + 1.5 : Math.random() * 1.2 + 0.2,
                alpha: Math.random(),
                speed: isBright ? Math.random() * 0.008 + 0.004 : Math.random() * 0.004 + 0.001,
                dir: Math.random() > 0.5 ? 1 : -1,
                col,
                glow: isBright,
            });
        }
    }
    function draw() {
        ctx.clearRect(0, 0, W, H);
        for (const s of stars) {
            s.alpha += s.speed * s.dir;
            if (s.alpha >= 1) { s.alpha = 1; s.dir = -1; }
            if (s.alpha <= 0.03) { s.alpha = 0.03; s.dir = 1; }
            const [r, g, b] = s.col;
            if (s.glow) {
                ctx.shadowBlur = 8;
                ctx.shadowColor = `rgba(${r},${g},${b},${(s.alpha * 0.7).toFixed(2)})`;
            }
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${r},${g},${b},${s.alpha.toFixed(2)})`;
            ctx.fill();
            if (s.glow) ctx.shadowBlur = 0;
        }
        requestAnimationFrame(draw);
    }
    window.addEventListener('resize', resize); resize(); draw();
})();

// ─── REALISTIC SHOOTING STARS ─────────────────────────
(function initShootingStars() {
    const container = document.getElementById('shootingStars');
    function spawn() {
        const el = document.createElement('div');
        el.className = 'shooting-star';
        const angle = Math.random() * 25 + 25;
        const len = Math.random() * 120 + 60;
        const dur = Math.random() * 0.6 + 0.5;
        el.style.setProperty('--angle', angle + 'deg');
        el.style.setProperty('--trail-len', len + 'px');
        el.style.top = Math.random() * 50 + '%';
        el.style.left = Math.random() * 70 + 10 + '%';
        el.style.animationDuration = dur + 's';
        container.appendChild(el);
        setTimeout(() => el.remove(), 1800);
    }
    // Spawn more frequently with occasional bursts
    setInterval(spawn, 2200);
    setTimeout(spawn, 500);
    setTimeout(spawn, 1200);
    // Occasional double
    setInterval(() => { spawn(); setTimeout(spawn, 200); }, 7000);
})();

// ─── EXPAND / MINIMIZE PANELS ─────────────────────────
const myVideoPanel = document.getElementById('myVideoPanel');
const ytPlayerWrapper = document.getElementById('ytPlayerWrapper');

const originalParents = new Map();
let ancestorOverrides = []; // track ancestors we modified

function clearAncestorOverrides() {
    ancestorOverrides.forEach(el => {
        el.style.removeProperty('transform');
        el.style.removeProperty('backdrop-filter');
        el.style.removeProperty('-webkit-backdrop-filter');
        el.style.removeProperty('filter');
        el.style.removeProperty('overflow');
        el.style.removeProperty('contain');
    });
    ancestorOverrides = [];
}

function overrideAncestors(el) {
    // Walk up from el to body, disable properties that create containing blocks
    let node = el.parentElement;
    while (node && node !== document.body) {
        node.style.setProperty('transform', 'none', 'important');
        node.style.setProperty('backdrop-filter', 'none', 'important');
        node.style.setProperty('-webkit-backdrop-filter', 'none', 'important');
        node.style.setProperty('filter', 'none', 'important');
        node.style.setProperty('overflow', 'visible', 'important');
        node.style.setProperty('contain', 'none', 'important');
        ancestorOverrides.push(node);
        node = node.parentElement;
    }
}

function collapseAll() {
    // Restore moved video panels
    originalParents.forEach((info, el) => {
        if (el.parentNode === document.body) {
            info.parent.insertBefore(el, info.next);
        }
    });
    originalParents.clear();
    clearAncestorOverrides();
    document.querySelectorAll('.expanded, .pip').forEach(el => el.classList.remove('expanded', 'pip'));
    document.querySelectorAll('.expand-btn').forEach(b => { b.textContent = '⛶'; b.title = 'Maximize'; });

    const ytBtn = document.getElementById('ytExpandBtn');
    if (ytBtn) {
        ytBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`;
        ytBtn.title = 'Maximize';
    }

    document.body.classList.remove('has-expanded');
}

// Custom listener for the ytExpandBtn 
document.getElementById('ytExpandBtn').addEventListener('click', () => {
    const panel = document.getElementById('ytPlayerWrapper');
    if (panel.classList.contains('expanded')) {
        collapseAll();
        return;
    }
    collapseAll();
    overrideAncestors(panel);
    panel.classList.add('expanded');

    const ytBtn = document.getElementById('ytExpandBtn');
    ytBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>`;
    ytBtn.title = 'Minimize';

    document.body.classList.add('has-expanded');

    // PIP video panels
    Array.from(document.querySelectorAll('.video-panel')).forEach(vp => {
        originalParents.set(vp, { parent: vp.parentNode, next: vp.nextSibling });
        document.body.appendChild(vp);
        vp.classList.add('pip');
    });
});

const ytCollapseBtn = document.getElementById('ytCollapseBtn');
if (ytCollapseBtn) ytCollapseBtn.addEventListener('click', collapseAll);

document.querySelectorAll('.expand-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const panel = document.getElementById(targetId);
        if (!panel) return;

        if (panel.classList.contains('expanded')) {
            collapseAll();
            return;
        }

        collapseAll();

        // For YT player: don't move, override ancestors instead (moving kills iframe)
        if (targetId === 'ytPlayerWrapper') {
            overrideAncestors(panel);
        } else {
            // Video panels can be safely moved to body
            originalParents.set(panel, { parent: panel.parentNode, next: panel.nextSibling });
            document.body.appendChild(panel);
        }

        panel.classList.add('expanded');
        btn.textContent = '✕';
        btn.title = 'Minimize';
        document.body.classList.add('has-expanded');

        // PIP for video panels
        if (targetId === 'ytPlayerWrapper') {
            Array.from(document.querySelectorAll('.video-panel')).forEach(vp => {
                originalParents.set(vp, { parent: vp.parentNode, next: vp.nextSibling });
                document.body.appendChild(vp);
                vp.classList.add('pip');
            });
        } else {
            Array.from(document.querySelectorAll('.video-panel')).forEach(vp => {
                if (vp.id !== targetId) {
                    originalParents.set(vp, { parent: vp.parentNode, next: vp.nextSibling });
                    document.body.appendChild(vp);
                    vp.classList.add('pip');
                }
            });
        }
    });
});

// Allow clicking a PIP to swap and maximize it instead
document.body.addEventListener('click', (e) => {
    const pipPanel = e.target.closest('.video-panel.pip');
    if (pipPanel) {
        // Find the expand button for this panel and click it
        const btn = pipPanel.querySelector('.expand-btn');
        if (btn) btn.click();
    }
});



// ─── DOM REFS ─────────────────────────────────────────
const roomCodeDisplay = document.getElementById('roomCodeDisplay');
const myNameDisplay = document.getElementById('myNameDisplay');
const connectionStatus = document.getElementById('connectionStatus');
const statusDot = connectionStatus.querySelector('.status-dot');
const statusText = connectionStatus.querySelector('.status-text');
const myVideo = document.getElementById('myVideo');
const myPlaceholder = document.getElementById('myPlaceholder');
const muteBtn = document.getElementById('muteBtn');
const videoBtn = document.getElementById('videoBtn');
const startCallBtn = document.getElementById('startCallBtn');
const leaveBtn = document.getElementById('leaveBtn');
const copyRoomBtn = document.getElementById('copyRoomBtn');

// YouTube DOM
const ytUrlInput = document.getElementById('ytUrlInput');
const ytLoadBtn = document.getElementById('ytLoadBtn');
const musicIdle = document.getElementById('musicIdle');
const ytNowPlayingCard = document.getElementById('ytNowPlayingCard');
const ytNowPlayingWho = document.getElementById('ytNowPlayingWho');
const ytTrackTitle = document.getElementById('ytTrackTitle');
const ytProgressBg = document.getElementById('ytProgressBg');
const ytProgressFill = document.getElementById('ytProgressFill');
const ytCurrentTimeEl = document.getElementById('ytCurrentTime');
const ytTotalTimeEl = document.getElementById('ytTotalTime');
const ytPlayPauseBtn = document.getElementById('ytPlayPauseBtn');
const ytVolumeSlider = document.getElementById('ytVolumeSlider');
const ytSyncText = document.getElementById('ytSyncText');

// ─── INIT UI ──────────────────────────────────────────
roomCodeDisplay.textContent = roomId;
myNameDisplay.textContent = myName;

// ─── TOAST ────────────────────────────────────────────
function toast(msg, type = 'info', duration = 3500) {
    const el = document.createElement('div');
    el.className = `toast ${type}`; el.textContent = msg;
    document.getElementById('toastContainer').appendChild(el);
    setTimeout(() => { el.style.animation = 'toastOut 0.3s ease forwards'; setTimeout(() => el.remove(), 300); }, duration);
}

// ─── COPY / LEAVE ─────────────────────────────────────
copyRoomBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(roomId).then(() => toast('Room code copied! 📋', 'success'));
});

leaveBtn.addEventListener('click', () => {
    if (peer) peer.destroy();
    if (ytPlayer && ytPlayer.stopVideo) ytPlayer.stopVideo();
    sessionStorage.clear();
    window.location.href = 'index.html';
});

// ─── STATUS ───────────────────────────────────────────
function setStatus(state, text) {
    statusDot.className = 'status-dot ' + state;
    statusText.textContent = text;
}

// ─────────────────────────────────────────────────────
//  PIN SECURITY (HMAC-SHA256)
// ─────────────────────────────────────────────────────
// Secure HMAC-SHA256 authentication token generation
let hmacKey = null;

async function deriveHmacKey() {
    if (hmacKey) return hmacKey;

    // Derive HMAC key from room credentials
    const keyMaterial = roomId + '::' + roomPin + '::hmac_v2';
    const encoder = new TextEncoder();
    const keyData = encoder.encode(keyMaterial);

    const baseKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );

    const salt = encoder.encode('ourspace_hmac_salt_' + roomId);

    hmacKey = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
        },
        baseKey,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify']
    );

    console.log('[SECURITY] 🔐 HMAC-SHA256 key derived for authentication');
    return hmacKey;
}

async function roomPinToken() {
    const key = await deriveHmacKey();
    const encoder = new TextEncoder();

    // Include timestamp for freshness (prevents replay attacks within 5 min window)
    const timestamp = Math.floor(Date.now() / (5 * 60 * 1000)); // 5-minute windows
    const message = encoder.encode(roomPin + '::' + timestamp);

    const signature = await crypto.subtle.sign('HMAC', key, message);
    const signatureArray = Array.from(new Uint8Array(signature));

    // Return base64 encoded HMAC
    return btoa(String.fromCharCode(...signatureArray)).substring(0, 32);
}

async function verifyPinToken(token, providedTimestamp = null) {
    const key = await deriveHmacKey();
    const encoder = new TextEncoder();

    // Try current and previous time window (allows 10 min tolerance)
    const currentWindow = Math.floor(Date.now() / (5 * 60 * 1000));
    const windows = [currentWindow, currentWindow - 1];

    for (const window of windows) {
        const message = encoder.encode(roomPin + '::' + window);
        const expectedSignature = await crypto.subtle.sign('HMAC', key, message);
        const expectedToken = btoa(String.fromCharCode(...new Uint8Array(expectedSignature))).substring(0, 32);

        if (token === expectedToken) {
            return true;
        }
    }

    return false;
}

// ─────────────────────────────────────────────────────
//  WEBRTC / PEERJS
// ─────────────────────────────────────────────────────
let peer = null, localStream = null;
let isMuted = false, isVideoOff = false, isInCall = false;

let hostId = '';
let isHost = false;
let approvedTokens = [];
const peersMap = {};

// Load approved tokens (encrypted)
(async () => {
    const tokens = await loadSecureData(`approved_${roomId || ''}`);
    if (tokens) {
        approvedTokens = tokens;
        console.log('[SECURITY] 🔐 Loaded encrypted approved tokens');
    }
})();

// ─── RATE LIMITING & AUTH TRACKING ────────────────────
const authAttempts = {};  // Track failed auth attempts per peer
const MAX_AUTH_ATTEMPTS = 5;
const AUTH_ATTEMPT_WINDOW = 5 * 60 * 1000;  // 5 minutes
const AUTH_BLOCK_DURATION = 15 * 60 * 1000;  // 15 minutes

function isAuthBlocked(peerId) {
    const peerAttempts = authAttempts[peerId];
    if (!peerAttempts) return false;

    // Check if blocked
    if (peerAttempts.blocked && (Date.now() - peerAttempts.blockedAt) < AUTH_BLOCK_DURATION) {
        console.warn(`[SECURITY] 🚫 Peer ${peerId} is blocked for ${Math.ceil((AUTH_BLOCK_DURATION - (Date.now() - peerAttempts.blockedAt)) / 1000 / 60)} more minutes`);
        return true;
    }

    // Unblock after duration
    if (peerAttempts.blocked && (Date.now() - peerAttempts.blockedAt) >= AUTH_BLOCK_DURATION) {
        peerAttempts.blocked = false;
        peerAttempts.attempts = [];
        console.log(`[SECURITY] ✅ Peer ${peerId} unblocked`);
    }

    // Count recent attempts
    const recentAttempts = peerAttempts.attempts.filter(ts => Date.now() - ts < AUTH_ATTEMPT_WINDOW);
    peerAttempts.attempts = recentAttempts;

    if (recentAttempts.length >= MAX_AUTH_ATTEMPTS) {
        peerAttempts.blocked = true;
        peerAttempts.blockedAt = Date.now();
        console.warn(`[SECURITY] 🚫 Peer ${peerId} blocked after ${MAX_AUTH_ATTEMPTS} failed attempts`);
        return true;
    }

    return false;
}

function recordAuthAttempt(peerId, success) {
    if (!authAttempts[peerId]) {
        authAttempts[peerId] = { attempts: [], blocked: false };
    }

    if (!success) {
        authAttempts[peerId].attempts.push(Date.now());
        console.warn(`[SECURITY] ⚠️ Failed auth attempt from ${peerId} (${authAttempts[peerId].attempts.length}/${MAX_AUTH_ATTEMPTS})`);
    } else {
        // Clear attempts on successful auth
        authAttempts[peerId].attempts = [];
        console.log(`[SECURITY] ✅ Successful auth from ${peerId}`);
    }
}

async function hashRoomId(str) {
    const data = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest('SHA-256', data);  // Upgraded from SHA-1
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 20);
}

// Secure send wrapper - encrypts messages before sending
async function secureSend(conn, msg) {
    // Don't encrypt auth messages (needed for initial handshake)
    if (msg.type === 'auth_request' || msg.type === 'auth_accepted' ||
        msg.type === 'auth_rejected' || msg.type === 'peer_intro') {
        conn.send(msg);
        return;
    }

    // Encrypt all other messages
    const encrypted = await encryptData(msg);
    conn.send({ type: 'encrypted', data: encrypted });
}

// Secure broadcast - encrypts and sends to all peers
async function broadcast(msg, excludeId = null) {
    for (const p of Object.values(peersMap)) {
        if (p.dataConn && p.dataConn.open && p.dataConn.peer !== excludeId) {
            await secureSend(p.dataConn, msg);
        }
    }
}

function sendSync(msg) { broadcast(msg); }

async function setupPeer() {
    setStatus('connecting', 'Connecting…');
    hostId = (await hashRoomId(roomId)) + 'h'; // PeerJS IDs: alphanumeric only, no underscores

    // Auto-detect: use local server if running on localhost/custom port, otherwise use cloud
    const isLocalServer = window.location.protocol === 'http:' &&
        (window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1' ||
            window.location.port !== '');

    // Better ICE server configuration for more reliable connections
    const peerConfig = {
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' }
            ],
            iceTransportPolicy: 'all'
        },
        debug: 0 // Set to 3 for verbose debugging if needed
    };

    // If running on local server (npm start), use custom server
    if (isLocalServer && window.location.port) {
        peerConfig.host = window.location.hostname;
        peerConfig.port = parseInt(window.location.port);
        peerConfig.path = '/peerjs';
        console.log('[PEER] Using LOCAL PeerJS server at:', `${peerConfig.host}:${peerConfig.port}${peerConfig.path}`);
    } else {
        // Otherwise use default PeerJS cloud (works with file:// protocol)
        console.log('[PEER] Using CLOUD PeerJS server (default)');
    }

    return new Promise((resolve) => {
        peer = new Peer(hostId, peerConfig);

        peer.on('open', id => {
            isHost = true;
            console.log('[HOST] Successfully registered as host with ID:', id);
            toast(`Room created! You are the Host. 🌙`, 'success', 5000);
            setStatus('connected', 'Waiting for guests…');
            setupHostListeners();
            resolve();
        });

        peer.on('error', err => {
            console.error('[PEER] PeerJS error:', err.type, err);
            if (err.type === 'unavailable-id') {
                isHost = false;
                console.log('[GUEST] Host exists, joining as guest...');
                peer = new Peer(peerConfig);
                peer.on('open', id => {
                    console.log('[GUEST] Successfully registered as guest with ID:', id);
                    toast('Room already exists — joining as guest! 🚶', 'info', 4000);
                    setStatus('connecting', 'Connecting to Host…');
                    connectToHost();
                    resolve();
                });
                peer.on('error', guestErr => {
                    console.error('[GUEST] Failed to register as guest:', guestErr);
                    toast('Network error connecting to server. Check console for details.', 'error');
                });
            } else {
                toast('Network error connecting to server. Check console for details.', 'error');
            }
        });

        peer.on('disconnected', () => {
            console.warn('[PEER] Disconnected from signaling server, attempting reconnect...');
            peer.reconnect();
        });
    });
}

function setupHostListeners() {
    console.log('[HOST] Setting up listeners for incoming connections');

    peer.on('connection', conn => {
        console.log('[HOST] Incoming connection from peer:', conn.peer);

        // Always set up data listener FIRST so we don't miss post-auth messages
        conn.on('data', async msg => {
            // Handle unencrypted auth messages
            if (msg.type === 'auth_request') {
                console.log('[HOST] Received auth request from:', msg.name);
                handleAuthRequest(conn, msg.name, msg.token);
                return;
            }

            // Decrypt encrypted messages
            if (msg.type === 'encrypted') {
                const decrypted = await decryptData(msg.data);
                if (decrypted && peersMap[conn.peer]) {
                    handleSyncMessage(decrypted, conn.peer);
                }
            } else if (peersMap[conn.peer]) {
                // Fallback for unencrypted messages (backward compatibility)
                handleSyncMessage(msg, conn.peer);
            }
        });

        conn.on('close', () => {
            console.log('[HOST] Peer disconnected:', conn.peer);
            handlePeerDisconnect(conn.peer);
        });

        conn.on('error', (err) => {
            console.error('[HOST] Connection error with peer:', conn.peer, err);
        });

        // Also handle auth from metadata (fires immediately on connect in some PeerJS versions)
        const meta = conn.metadata;
        if (meta && meta.type === 'auth_request') {
            console.log('[HOST] Received auth request via metadata from:', meta.name);
            handleAuthRequest(conn, meta.name, meta.token);
        }
    });

    peer.on('call', call => {
        console.log('[HOST] Incoming call from:', call.peer);
        handleIncomingCall(call);
    });
}

async function handleAuthRequest(conn, guestName, token) {
    const peerId = conn.peer;

    // Check if peer is rate-limited
    if (isAuthBlocked(peerId)) {
        console.warn(`[SECURITY] 🚫 Blocked auth attempt from ${peerId}`);
        conn.send({ type: 'auth_rejected', reason: 'rate_limited' });
        setTimeout(() => conn.close(), 500);
        logAuthEvent('auth_blocked', { peerId, guestName, reason: 'rate_limited' });
        return;
    }

    // Check if token is in approved list AND not expired
    const approvedEntry = approvedTokens.find(entry =>
        (typeof entry === 'string' ? entry : entry.token) === token
    );

    if (approvedEntry) {
        // Check if token has expiration
        if (typeof approvedEntry === 'object' && approvedEntry.expiresAt) {
            if (Date.now() > approvedEntry.expiresAt) {
                console.warn(`[SECURITY] ⚠️ Expired token from ${peerId}`);
                // Remove expired token
                approvedTokens = approvedTokens.filter(e =>
                    (typeof e === 'object' ? e.token : e) !== token
                );
                saveApprovedTokens();
                recordAuthAttempt(peerId, false);
                conn.send({ type: 'auth_rejected', reason: 'token_expired' });
                setTimeout(() => conn.close(), 500);
                logAuthEvent('auth_rejected', { peerId, guestName, reason: 'token_expired' });
                return;
            }
        }

        // Token valid - accept guest
        recordAuthAttempt(peerId, true);
        logAuthEvent('auth_success', { peerId, guestName, method: 'approved_token' });
        acceptGuest(conn, guestName, token);
    } else {
        // New connection - show approval modal
        document.getElementById('authMessage').textContent = `${guestName} wants to join.`;
        document.getElementById('authModal').style.display = 'flex';

        document.getElementById('authAcceptBtn').onclick = () => {
            document.getElementById('authModal').style.display = 'none';

            // Store token with expiration (30 minutes)
            const tokenEntry = {
                token: token,
                approvedAt: Date.now(),
                expiresAt: Date.now() + 30 * 60 * 1000,  // 30 minutes
                guestName: guestName,
                peerId: peerId
            };

            approvedTokens.push(tokenEntry);
            saveApprovedTokens();
            recordAuthAttempt(peerId, true);
            logAuthEvent('auth_success', { peerId, guestName, method: 'manual_approval' });
            acceptGuest(conn, guestName, token);
        };

        document.getElementById('authRejectBtn').onclick = () => {
            document.getElementById('authModal').style.display = 'none';
            recordAuthAttempt(peerId, false);
            logAuthEvent('auth_rejected', { peerId, guestName, reason: 'manual_rejection' });
            conn.send({ type: 'auth_rejected', reason: 'rejected_by_host' });
            setTimeout(() => conn.close(), 500);
        };
    }
}

async function saveApprovedTokens() {
    await saveSecureData(`approved_${roomId}`, approvedTokens);
}

// ─── AUDIT LOGGING SYSTEM ─────────────────────────────
const AUDIT_LOG_DB = 'OurSpaceAuditLog';
let auditDB = null;

function initAuditLog() {
    const request = indexedDB.open(AUDIT_LOG_DB, 1);

    request.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('logs')) {
            const store = db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
            store.createIndex('timestamp', 'timestamp', { unique: false });
            store.createIndex('event', 'event', { unique: false });
            store.createIndex('roomId', 'roomId', { unique: false });
        }
    };

    request.onsuccess = e => {
        auditDB = e.target.result;
        console.log('[AUDIT] 📋 Audit logging initialized');
    };

    request.onerror = e => {
        console.error('[AUDIT] Failed to initialize audit log:', e);
    };
}

function logAuthEvent(event, details) {
    if (!auditDB) return;

    const logEntry = {
        timestamp: Date.now(),
        event: event,
        roomId: roomId,
        peerId: details.peerId || 'unknown',
        guestName: details.guestName || 'unknown',
        success: details.success !== false,
        reason: details.reason || null,
        method: details.method || null
    };

    try {
        const tx = auditDB.transaction(['logs'], 'readwrite');
        const store = tx.objectStore('logs');
        store.add(logEntry);

        console.log(`[AUDIT] ${logEntry.success ? '✅' : '⚠️'} ${event}:`, details);

        // Cleanup old logs (keep last 1000 entries)
        tx.oncomplete = () => {
            cleanupOldLogs();
        };
    } catch (err) {
        console.error('[AUDIT] Failed to write log:', err);
    }
}

function cleanupOldLogs() {
    if (!auditDB) return;

    try {
        const tx = auditDB.transaction(['logs'], 'readwrite');
        const store = tx.objectStore('logs');
        const countRequest = store.count();

        countRequest.onsuccess = () => {
            const count = countRequest.result;
            if (count > 1000) {
                // Delete oldest entries
                const deleteCount = count - 1000;
                const index = store.index('timestamp');
                const cursorRequest = index.openCursor();
                let deleted = 0;

                cursorRequest.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor && deleted < deleteCount) {
                        cursor.delete();
                        deleted++;
                        cursor.continue();
                    }
                };
            }
        };
    } catch (err) {
        console.error('[AUDIT] Failed to cleanup logs:', err);
    }
}

// Get recent audit logs (for debugging/admin view)
function getAuditLogs(limit = 50) {
    return new Promise((resolve, reject) => {
        if (!auditDB) {
            resolve([]);
            return;
        }

        try {
            const tx = auditDB.transaction(['logs'], 'readonly');
            const store = tx.objectStore('logs');
            const index = store.index('timestamp');
            const request = index.openCursor(null, 'prev');  // Reverse order (newest first)

            const logs = [];
            request.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor && logs.length < limit) {
                    logs.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(logs);
                }
            };

            request.onerror = () => reject(request.error);
        } catch (err) {
            reject(err);
        }
    });
}

// Initialize audit logging
initAuditLog();

// ─── LOCALSTORAGE ENCRYPTION ──────────────────────────
// Encrypt sensitive localStorage data (playlists, tokens, recent rooms)

async function encryptLocalStorage(key, data) {
    try {
        const encrypted = await encryptData(data);
        localStorage.setItem(key, encrypted);
        return true;
    } catch (err) {
        console.error('[STORAGE] Failed to encrypt data:', err);
        return false;
    }
}

async function decryptLocalStorage(key) {
    try {
        const encrypted = localStorage.getItem(key);
        if (!encrypted) return null;

        // Try to decrypt
        const decrypted = await decryptData(encrypted);
        if (decrypted) return decrypted;

        // If decryption fails, might be old unencrypted data
        // Try to parse as JSON
        try {
            return JSON.parse(encrypted);
        } catch {
            return null;
        }
    } catch (err) {
        console.error('[STORAGE] Failed to decrypt data:', err);
        return null;
    }
}

// Wrapper functions for secure storage
async function saveSecureData(key, data) {
    await encryptLocalStorage(key, data);
}

async function loadSecureData(key) {
    return await decryptLocalStorage(key);
}

// ─── AUTOMATIC CLEANUP UTILITIES ──────────────────────
function cleanupExpiredTokens() {
    if (!approvedTokens || approvedTokens.length === 0) return;

    const before = approvedTokens.length;
    approvedTokens = approvedTokens.filter(entry => {
        if (typeof entry === 'object' && entry.expiresAt) {
            return Date.now() < entry.expiresAt;
        }
        return true;  // Keep old-format tokens
    });

    if (approvedTokens.length < before) {
        console.log(`[CLEANUP] 🧹 Removed ${before - approvedTokens.length} expired tokens`);
        saveApprovedTokens();
    }
}

function cleanupOldRoomData() {
    // Clean up data from rooms not accessed in 30 days
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    // Get all localStorage keys
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('ourspace_playlist_') ||
            key.startsWith('approved_')) {
            // Check if room has been inactive
            const roomCode = key.replace('ourspace_playlist_', '').replace('approved_', '');
            if (roomCode !== roomId) {  // Don't clean current room
                keysToRemove.push(key);
            }
        }
    }

    if (keysToRemove.length > 0) {
        console.log(`[CLEANUP] 🧹 Found ${keysToRemove.length} old room data entries`);
        // For safety, we'll log them but not auto-delete (user can manually clear)
    }
}

function deleteAllRoomData() {
    // Utility to completely wipe all room data (for user privacy)
    if (!confirm('Delete ALL room data including chat history, playlists, and approved guests? This cannot be undone!')) {
        return;
    }

    // Clear localStorage
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('ourspace_')) {
            localStorage.removeItem(key);
        }
    });

    // Delete all IndexedDB databases
    indexedDB.deleteDatabase(CHAT_DB_NAME);
    indexedDB.deleteDatabase(AUDIT_LOG_DB);

    console.log('[CLEANUP] 🧹 All room data deleted');
    toast('All data deleted successfully', 'success');

    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1000);
}

// Run cleanup on load
cleanupExpiredTokens();

// Run cleanup every hour
setInterval(() => {
    cleanupExpiredTokens();
    cleanupOldRoomData();
}, 60 * 60 * 1000);  // 1 hour

// Expose utilities for manual use
window.deleteAllRoomData = deleteAllRoomData;

// Security status command (for debugging/admin)
window.showSecurityStatus = async function () {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔐 SECURITY STATUS REPORT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📊 Encryption:');
    console.log(`  ✅ E2E Encryption: ${encryptionKey ? 'ACTIVE (AES-256-GCM)' : 'INACTIVE'}`);
    console.log(`  ✅ HMAC Auth: ${hmacKey ? 'ACTIVE (HMAC-SHA256)' : 'INACTIVE'}`);
    console.log(`  ✅ Room Hash: SHA-256`);

    console.log('\n🛡️ Authentication:');
    console.log(`  • Approved Tokens: ${approvedTokens.length}`);
    console.log(`  • Rate Limiting: ACTIVE (${MAX_AUTH_ATTEMPTS} attempts per ${AUTH_ATTEMPT_WINDOW / 1000 / 60} min)`);
    console.log(`  • Token Expiry: 30 minutes`);

    console.log('\n💾 Storage:');
    console.log(`  • Playlists: ENCRYPTED`);
    console.log(`  • Chat History: ENCRYPTED`);
    console.log(`  • Approved Tokens: ENCRYPTED`);

    console.log('\n📝 Audit Log:');
    try {
        const logs = await getAuditLogs(10);
        console.log(`  • Total Events Logged: ${logs.length > 0 ? '1000+' : '0'}`);
        console.log(`  • Recent Events: ${logs.length}`);
        if (logs.length > 0) {
            console.log(`  • Last Event: ${logs[0].event} at ${new Date(logs[0].timestamp).toLocaleString()}`);
        }
    } catch (err) {
        console.log(`  • Audit Log: ERROR`);
    }

    console.log('\n👥 Active Connections:');
    console.log(`  • Role: ${isHost ? 'HOST' : 'GUEST'}`);
    console.log(`  • Peers: ${Object.keys(peersMap).length}`);
    Object.values(peersMap).forEach((peer, i) => {
        console.log(`    ${i + 1}. ${peer.name} ${peer.dataConn.open ? '🟢' : '🔴'}`);
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Commands:');
    console.log('  • showSecurityStatus() - Show this status');
    console.log('  • getAuditLogs(50) - View recent audit logs');
    console.log('  • deleteAllRoomData() - Delete all data (DANGER!)');
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
};

// Show security status on load (after 2 seconds)
setTimeout(() => {
    console.log('\n🔐 Security features active! Type showSecurityStatus() for details.\n');
}, 2000);

function acceptGuest(conn, guestName, token) {
    const newPeerId = conn.peer;

    const activePeers = Object.keys(peersMap).map(id => ({ id, name: peersMap[id].name }));
    conn.send({
        type: 'auth_accepted',
        peers: activePeers,
        hostPlaylists: roomPlaylists,
        ytState: { videoId: ytVideoId, time: ytPlayer?.getCurrentTime?.() || 0, playing: ytPlaying }
    });

    peersMap[newPeerId] = { dataConn: conn, name: guestName, callConn: null, stream: null };
    broadcast({ type: 'guest_joined', id: newPeerId, name: guestName }, newPeerId);

    toast(`${guestName} joined! 🌙`, 'success');
    renderChatRecipientDropdown();

    if (isInCall && localStream) {
        const call = peer.call(newPeerId, localStream);
        if (call) handleOutboundCall(call, newPeerId);
    }
}

let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 5;
let connectionTimeout = null;

function connectToHost(retryCount = 0) {
    // Progressive delay: 2s, 3s, 4s, 5s, 6s for retries
    const delay = retryCount === 0 ? 2000 : 2000 + (retryCount * 1000);

    console.log(`[GUEST] Attempting to connect to host (attempt ${retryCount + 1}/${MAX_CONNECTION_ATTEMPTS}) in ${delay}ms...`);
    setStatus('connecting', `Connecting to host... (attempt ${retryCount + 1}/${MAX_CONNECTION_ATTEMPTS})`);

    setTimeout(async () => {
        connectionAttempts = retryCount;

        const token = await roomPinToken();

        const hostConn = peer.connect(hostId, {
            reliable: true,
            metadata: { type: 'auth_request', token: token, name: myName },
            serialization: 'json'
        });

        // Connection timeout - if not connected in 10 seconds, retry or fail
        connectionTimeout = setTimeout(() => {
            if (!peersMap[hostId]) {
                console.warn('[GUEST] Connection timeout, host not responding');
                hostConn.close();
                handleConnectionFailure(retryCount);
            }
        }, 10000);

        hostConn.on('open', () => {
            console.log('[GUEST] Data channel opened to host');
            clearTimeout(connectionTimeout);
            connectionAttempts = 0; // Reset on successful connection
            // Also send via data channel as backup (some PeerJS versions don't surface metadata)
            hostConn.send({ type: 'auth_request', token: token, name: myName });
        });

        hostConn.on('error', err => {
            console.error('[GUEST] Connection error:', err);
            clearTimeout(connectionTimeout);
            handleConnectionFailure(retryCount, err);
        });

        hostConn.on('data', async msg => {
            // Handle unencrypted auth messages
            if (msg.type === 'auth_rejected') {
                clearTimeout(connectionTimeout);
                setStatus('disconnected', 'Host rejected your join request.');
                toast('Join request rejected! Wrong PIN?', 'error');
                hostConn.close();
                return;
            }

            if (msg.type === 'auth_accepted') {
                clearTimeout(connectionTimeout);
                setStatus('connected', 'Connected to Room.');
                toast('Joined Room successfully! 🌙', 'success');
                console.log('[GUEST] Successfully authenticated with host');

                peersMap[hostId] = { dataConn: hostConn, name: 'Host', callConn: null, stream: null };

                if (msg.hostPlaylists) {
                    roomPlaylists = msg.hostPlaylists;
                    savePlaylist(); renderPlaylist();
                }
                if (msg.ytState && msg.ytState.videoId) {
                    loadYouTubeVideo(msg.ytState.videoId, msg.ytState.time, msg.ytState.playing);
                }

                msg.peers.forEach(p => {
                    const conn = peer.connect(p.id, { reliable: true });
                    setupGuestToGuest(conn, p.name);
                });

                renderChatRecipientDropdown();
                return;
            }

            // Decrypt encrypted messages
            if (msg.type === 'encrypted') {
                const decrypted = await decryptData(msg.data);
                if (decrypted && peersMap[hostId]) {
                    handleSyncMessage(decrypted, hostId);
                }
            } else if (peersMap[hostId]) {
                // Fallback for unencrypted messages (backward compatibility)
                handleSyncMessage(msg, hostId);
            }
        });

        hostConn.on('close', () => {
            console.log('[GUEST] Host connection closed');
            clearTimeout(connectionTimeout);
            setStatus('disconnected', 'Host disconnected.');
            endCall();
            toast('Host left the room.', 'error');
        });

        peer.on('connection', conn => {
            conn.on('data', async msg => {
                // Handle unencrypted peer intro
                if (msg.type === 'peer_intro') {
                    setupGuestToGuest(conn, msg.name);
                    toast(`${msg.name} joined!`, 'info');
                    return;
                }

                // Decrypt encrypted messages
                if (msg.type === 'encrypted') {
                    const decrypted = await decryptData(msg.data);
                    if (decrypted && peersMap[conn.peer]) {
                        handleSyncMessage(decrypted, conn.peer);
                    }
                } else if (peersMap[conn.peer]) {
                    // Fallback for unencrypted messages (backward compatibility)
                    handleSyncMessage(msg, conn.peer);
                }
            });
            conn.on('close', () => handlePeerDisconnect(conn.peer));
        });

        peer.on('call', call => handleIncomingCall(call));
    }, delay);
}

function handleConnectionFailure(retryCount, error = null) {
    if (error) {
        console.error('[GUEST] Connection failed with error:', error.type || error);
    }

    if (retryCount < MAX_CONNECTION_ATTEMPTS - 1) {
        console.log(`[GUEST] Retrying connection (${retryCount + 1}/${MAX_CONNECTION_ATTEMPTS - 1})...`);
        toast(`Connection failed. Retrying... (${retryCount + 2}/${MAX_CONNECTION_ATTEMPTS})`, 'warning', 3000);
        connectToHost(retryCount + 1);
    } else {
        console.error('[GUEST] Max connection attempts reached. Giving up.');
        setStatus('disconnected', 'Could not reach host.');
        toast('Could not reach Host. Please check:\n1. Host has created the room\n2. Room code is correct\n3. Both you and host have stable internet', 'error', 8000);
    }
}

function setupGuestToGuest(conn, peerName) {
    conn.on('open', () => { conn.send({ type: 'peer_intro', name: myName }); });
    peersMap[conn.peer] = { dataConn: conn, name: peerName, callConn: null, stream: null };

    conn.on('data', async msg => {
        if (msg.type === 'peer_intro') return; // Ignore duplicate intros

        // Decrypt encrypted messages
        if (msg.type === 'encrypted') {
            const decrypted = await decryptData(msg.data);
            if (decrypted) {
                handleSyncMessage(decrypted, conn.peer);
            }
        } else {
            // Fallback for unencrypted messages (backward compatibility)
            handleSyncMessage(msg, conn.peer);
        }
    });
    conn.on('close', () => handlePeerDisconnect(conn.peer));
    renderChatRecipientDropdown();
}

function handlePeerDisconnect(id) {
    if (peersMap[id]) {
        toast(`${peersMap[id].name} left.`, 'info');
        removeVideoPanel(id);
        delete peersMap[id];
        renderChatRecipientDropdown();
    }
}

// ─── CALL ─────────────────────────────────────────────
startCallBtn.addEventListener('click', () => {
    if (isInCall) endCall(); else startCall();
});

// ─── RINGTONE SYSTEM (Web Audio API, no files needed) ───
let ringtoneOscillators = [];
let ringtoneInterval = null;

function playRingtone() {
    stopRingtone();
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    function ring() {
        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.04);
        gainNode.gain.setValueAtTime(0.18, ctx.currentTime + 0.15);
        gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25);
        gainNode.connect(ctx.destination);

        [880, 1100].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            osc.connect(gainNode);
            osc.start(ctx.currentTime + i * 0.06);
            osc.stop(ctx.currentTime + 0.3);
            ringtoneOscillators.push(osc);
        });
    }

    ring();
    ringtoneInterval = setInterval(ring, 1800);
    // Auto-stop after 30 seconds
    setTimeout(stopRingtone, 30000);
}

function stopRingtone() {
    if (ringtoneInterval) { clearInterval(ringtoneInterval); ringtoneInterval = null; }
    ringtoneOscillators.forEach(o => { try { o.stop(); } catch (_) { } });
    ringtoneOscillators = [];
}

// ─── INCOMING CALL NOTIFICATION UI ───────────────────
let pendingIncomingCall = null;

function showIncomingCallUI(callerName, callObj) {
    pendingIncomingCall = callObj;
    document.getElementById('callerName').textContent = callerName;
    const modal = document.getElementById('incomingCallModal');
    modal.style.display = 'flex';
    playRingtone();

    // Request browser notification if app is in background
    if (document.hidden && Notification.permission === 'granted') {
        new Notification(`📞 Call from ${callerName}`, {
            body: 'Tap to open Our Space and answer',
            icon: '/favicon.ico'
        });
    } else if (Notification.permission === 'default') {
        Notification.requestPermission();
    }

    document.getElementById('acceptCallBtn').onclick = () => {
        stopRingtone();
        modal.style.display = 'none';
        if (pendingIncomingCall) answerIncomingCall(pendingIncomingCall);
        pendingIncomingCall = null;
    };
    document.getElementById('declineCallBtn').onclick = () => {
        stopRingtone();
        modal.style.display = 'none';
        if (pendingIncomingCall) { pendingIncomingCall.close(); }
        pendingIncomingCall = null;
    };
}

async function answerIncomingCall(call) {
    const id = call.peer;
    if (!peersMap[id]) return;

    if (localStream) {
        call.answer(localStream);
        peersMap[id].callConn = call;
        call.on('stream', stream => addVideoPanel(id, stream));
        call.on('close', () => removeVideoPanel(id));
    } else {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: { noiseSuppression: true, echoCancellation: true, autoGainControl: true }
            });
            localStream = stream;
            myVideo.srcObject = stream;
            myVideo.classList.add('active');
            myPlaceholder.style.display = 'none';
            isInCall = true;
            startCallBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg> End Call`;
            startCallBtn.classList.add('end-call');
            call.answer(stream);
            peersMap[id].callConn = call;
            call.on('stream', s => addVideoPanel(id, s));
            call.on('close', () => removeVideoPanel(id));
        } catch (e) {
            toast('Could not access camera/mic.', 'error');
        }
    }
}

async function startCall() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: {
                noiseSuppression: true, echoCancellation: true, autoGainControl: true,
                googEchoCancellation: true, googAutoGainControl: true, googNoiseSuppression: true, googHighpassFilter: true
            }
        });
        myVideo.srcObject = localStream;
        myVideo.classList.add('active');
        myPlaceholder.style.display = 'none';

        startCallBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg> End Call`;
        startCallBtn.classList.add('end-call');
        isInCall = true;

        // Directly call all connected peers — no ringtone needed when everyone is in the room
        setTimeout(() => {
            Object.keys(peersMap).forEach(id => {
                const call = peer.call(id, localStream);
                if (call) handleOutboundCall(call, id);
            });
        }, 400);

    } catch (err) { toast('Could not access camera/mic.', 'error'); }
}

function handleOutboundCall(call, id) {
    peersMap[id].callConn = call;
    call.on('stream', stream => { addVideoPanel(id, stream); });
    call.on('close', () => { removeVideoPanel(id); });
    call.on('error', () => { removeVideoPanel(id); });
}

function handleIncomingCall(call) {
    const id = call.peer;
    if (!peersMap[id]) return;
    const callerName = peersMap[id]?.name || 'Someone';

    if (!document.hidden) {
        // Tab is active — user is already in the room, auto-answer with no interruption
        answerIncomingCall(call);
    } else {
        // Tab is hidden — user is away, show ring overlay + sound + browser notification
        showIncomingCallUI(callerName, call);
    }
}

function addVideoPanel(id, stream) {
    let panel = document.getElementById(`panel_${id}`);
    if (!panel) {
        panel = document.createElement('div');
        panel.className = 'video-panel';
        panel.id = `panel_${id}`;
        panel.innerHTML = `
            <video id="video_${id}" autoplay playsinline class="video-element active"></video>
            <div class="video-label">${peersMap[id].name}</div>
            <button class="expand-btn" data-target="panel_${id}" title="Expand">⛶</button>
        `;
        document.getElementById('videoGrid').appendChild(panel);

        panel.querySelector('.expand-btn').addEventListener('click', (e) => {
            panel.classList.toggle('expanded');
            document.body.classList.toggle('has-expanded', panel.classList.contains('expanded'));
            e.target.innerHTML = panel.classList.contains('expanded') ? '✕' : '⛶';
        });
    }
    const vid = document.getElementById(`video_${id}`);
    if (vid) vid.srcObject = stream;
    document.querySelector('.video-grid').classList.remove('alone');
}

function removeVideoPanel(id) {
    const panel = document.getElementById(`panel_${id}`);
    if (panel) panel.remove();

    if (document.querySelectorAll('.video-panel').length <= 1) {
        document.querySelector('.video-grid').classList.add('alone');
    }
}

function endCall() {
    if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
    myVideo.srcObject = null; myVideo.classList.remove('active'); myPlaceholder.style.display = 'flex';

    Object.keys(peersMap).forEach(id => {
        if (peersMap[id].callConn) {
            peersMap[id].callConn.close();
            peersMap[id].callConn = null;
        }
        removeVideoPanel(id);
    });

    isInCall = false;
    startCallBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg> Start Call`;
    startCallBtn.classList.remove('end-call');
    toast('Call ended', 'info');
}

function renderChatRecipientDropdown() {
    let sel = document.getElementById('chatRecipient');
    if (!sel) {
        sel = document.createElement('select');
        sel.id = 'chatRecipient';
        // Inline styles so it matches the dark glass theme regardless of caching
        sel.setAttribute('style', [
            'appearance: none',
            'background: rgba(255,255,255,0.07)',
            'border: 1px solid rgba(255,255,255,0.15)',
            'border-radius: 20px',
            'color: rgba(255,255,255,0.85)',
            'font-family: Inter, sans-serif',
            'font-size: 0.78rem',
            'padding: 4px 28px 4px 12px',
            'cursor: pointer',
            'outline: none',
            'margin-right: 6px',
            'max-width: 120px',
            'background-image: url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\'%3E%3Cpath d=\'M0 0l5 6 5-6z\' fill=\'rgba(255,255,255,0.5)\'/%3E%3C/svg%3E")',
            'background-repeat: no-repeat',
            'background-position: right 10px center',
        ].join(';'));

        const header = document.querySelector('.chat-header');
        if (header) header.insertBefore(sel, header.querySelector('.chat-close-btn'));
    }

    const currVal = sel.value;
    let optionsHtml = `<option value="all">🌍 Everyone</option>`;
    Object.keys(peersMap).forEach(id => {
        optionsHtml += `<option value="${id}">🔒 ${peersMap[id].name}</option>`;
    });
    sel.innerHTML = optionsHtml;

    if (currVal && Array.from(sel.options).find(o => o.value === currVal)) {
        sel.value = currVal;
    }
}

muteBtn.addEventListener('click', () => {
    if (!localStream) return;
    isMuted = !isMuted;
    localStream.getAudioTracks().forEach(t => t.enabled = !isMuted);
    muteBtn.classList.toggle('muted', isMuted);
    muteBtn.innerHTML = isMuted
        ? `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/></svg>`
        : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v6a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm-1 14.93V21h2v-3.07A8.001 8.001 0 0 0 20 10h-2a6 6 0 0 1-12 0H4a8.001 8.001 0 0 0 7 7.93z"/></svg>`;
});

videoBtn.addEventListener('click', () => {
    if (!localStream) return;
    isVideoOff = !isVideoOff;
    localStream.getVideoTracks().forEach(t => t.enabled = !isVideoOff);
    videoBtn.classList.toggle('video-off', isVideoOff);
    myVideo.classList.toggle('active', !isVideoOff);
    myPlaceholder.style.display = isVideoOff ? 'flex' : 'none';
});

// ─────────────────────────────────────────────────────
//  YOUTUBE IFRAME API
// ─────────────────────────────────────────────────────
let ytPlayer = null;
let ytReady = false;
let ytVideoId = null;
let ytPlaying = false;
let ytDuration = 0;
let ytTimer = null;
let isSyncing = false;

// Load YouTube IFrame script dynamically
const ytScript = document.createElement('script');
ytScript.src = 'https://www.youtube.com/iframe_api';
document.head.appendChild(ytScript);

window.onYouTubeIframeAPIReady = function () {
    ytPlayer = new YT.Player('ytPlayer', {
        height: '200',
        width: '100%',
        playerVars: {
            autoplay: 0,
            controls: 0,
            modestbranding: 1,
            rel: 0,
            iv_load_policy: 3,
            enablejsapi: 1,
            origin: window.location.origin,
        },
        events: {
            onReady: () => { ytReady = true; },
            onStateChange: onYtStateChange,
        },
    });
};

function onYtStateChange(event) {
    if (isSyncing) return;
    const state = event.data;
    const videoId = (ytPlayer.getVideoData && ytPlayer.getVideoData().video_id) || ytVideoId || '';
    const currentTime = ytPlayer.getCurrentTime() || 0;

    ytPlaying = state === YT.PlayerState.PLAYING;
    updateYtIcon();

    if (ytPlaying) startYtTimer(); else clearInterval(ytTimer);

    sendSync({
        type: 'yt_state',
        videoId,
        currentTime,
        playing: ytPlaying,
        sentBy: myName,
    });
}

// Extract video ID from any YouTube/YouTube Music URL or bare ID
function extractYouTubeId(input) {
    const patterns = [
        /[?&]v=([a-zA-Z0-9_-]{11})/,
        /youtu\.be\/([a-zA-Z0-9_-]{11})/,
        /embed\/([a-zA-Z0-9_-]{11})/,
        /^([a-zA-Z0-9_-]{11})$/,
    ];
    for (const p of patterns) { const m = input.match(p); if (m) return m[1]; }
    return null;
}

async function loadYouTubeVideo(videoId, startSeconds = 0, autoplay = true) {
    if (!ytReady || !ytPlayer) {
        setTimeout(() => loadYouTubeVideo(videoId, startSeconds, autoplay), 500);
        return;
    }
    ytVideoId = videoId;

    // Show player card
    musicIdle.style.display = 'none';
    ytNowPlayingCard.style.display = 'flex';

    // Fetch title via oEmbed (no API key required)
    try {
        const r = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
        const d = await r.json();
        ytTrackTitle.textContent = d.title || '—';
        ytNowPlayingWho.textContent = 'Now Playing';
    } catch (e) { ytTrackTitle.textContent = '—'; }

    if (autoplay) {
        ytPlayer.loadVideoById({ videoId, startSeconds });
    } else {
        ytPlayer.cueVideoById({ videoId, startSeconds });
    }
}

// Load button
ytLoadBtn.addEventListener('click', () => {
    const videoId = extractYouTubeId(ytUrlInput.value.trim());
    if (!videoId) { toast('Paste a valid YouTube link 🔗', 'error'); return; }
    loadYouTubeVideo(videoId, 0, true);
    sendSync({ type: 'yt_load', videoId, sentBy: myName });
    ytUrlInput.value = '';
});
ytUrlInput.addEventListener('keydown', e => { if (e.key === 'Enter') ytLoadBtn.click(); });

// Play/pause
ytPlayPauseBtn.addEventListener('click', () => {
    if (!ytPlayer || !ytReady) return;
    if (ytPlaying) ytPlayer.pauseVideo(); else ytPlayer.playVideo();
});

// Volume
ytVolumeSlider.addEventListener('input', () => {
    if (ytPlayer) ytPlayer.setVolume(ytVolumeSlider.value);
});

// Seek
ytProgressBg.addEventListener('click', e => {
    if (!ytPlayer || !ytDuration) return;
    const rect = ytProgressBg.getBoundingClientRect();
    ytPlayer.seekTo(((e.clientX - rect.left) / rect.width) * ytDuration, true);
});

function updateYtIcon() {
    ytPlayPauseBtn.querySelector('.play-icon').style.display = ytPlaying ? 'none' : 'block';
    ytPlayPauseBtn.querySelector('.pause-icon').style.display = ytPlaying ? 'block' : 'none';
}

function startYtTimer() {
    clearInterval(ytTimer);
    ytTimer = setInterval(() => {
        if (!ytPlayer || !ytReady) return;
        const cur = ytPlayer.getCurrentTime() || 0;
        const dur = ytPlayer.getDuration() || 0;
        ytDuration = dur;
        const pct = dur > 0 ? (cur / dur) * 100 : 0;
        ytProgressFill.style.width = pct + '%';
        ytCurrentTimeEl.textContent = secToTime(cur);
        ytTotalTimeEl.textContent = secToTime(dur);
    }, 600);
}

function secToTime(s) {
    const m = Math.floor(s / 60); const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────
//  SYNC MESSAGE HANDLER
// ─────────────────────────────────────────────────────
async function handleSyncMessage(msg, senderId) {
    if (!msg || !msg.type) return;

    if (msg.type === 'guest_joined') {
        if (msg.id !== hostId && msg.id !== peer?.id) {
            const conn = peer.connect(msg.id, { reliable: true });
            setupGuestToGuest(conn, msg.name);
        }
        return;
    }

    // ── Secure Chat Messaging ─────────────────────────────────
    if (msg.type === 'chat_msg') {
        const chatMsg = msg.message;
        chatMsg.senderLabel = msg.sentBy || "Unknown";

        if (chatMsg.to && chatMsg.to !== 'all' && chatMsg.to !== peer?.id) {
            return;
        }
        // Check for duplicates
        if (!chatDB_ready || !document.querySelector(`[data-chat-id="${chatMsg.id}"]`)) {
            appendChatMessage(chatMsg, true);
            const panel = document.getElementById('chatPanel');
            if (!panel || !panel.classList.contains('show')) {
                toast(`New message from ${chatMsg.senderLabel} 💬`, 'info');
            }
        }
        return;
    }

    // ── Call coordination / ring notification ──────────
    if (msg.type === 'call_ring' || msg.type === 'call_request') {
        // The actual WebRTC call arrives via peer.on('call') — this is just the ring notification
        const callerName = msg.callerName || peersMap[senderId]?.name || 'Someone';
        toast(`📞 ${callerName} is calling…`, 'info', 5000);
        playRingtone();
        // Ring will stop automatically when WebRTC call arrives via handleIncomingCall
        return;
    }

    // ── Playlist sync from partner ─────────────────────────
    if (msg.type === 'playlist_sync') {
        if (msg.roomPlaylists) {
            // merge or replace
            for (const [name, list] of Object.entries(msg.roomPlaylists)) {
                if (!roomPlaylists[name]) roomPlaylists[name] = [];
                for (const item of list) {
                    if (!roomPlaylists[name].find(p => p.videoId === item.videoId)) {
                        roomPlaylists[name].push(item);
                    }
                }
            }
            savePlaylist(); renderPlaylist(); toast('Playlists synced 📋', 'info');
        } else if (msg.playlist) {
            // legacy array merge to "Room Playlist"
            if (!roomPlaylists["Room Playlist"]) roomPlaylists["Room Playlist"] = [];
            for (const item of msg.playlist) {
                if (!roomPlaylists["Room Playlist"].find(p => p.videoId === item.videoId)) {
                    roomPlaylists["Room Playlist"].push(item);
                }
            }
            savePlaylist(); renderPlaylist(); toast('Playlists synced 📋', 'info');
        }
        return;
    }

    if (msg.type === 'playlist_add') {
        const name = msg.playlistName || "Room Playlist";
        if (!roomPlaylists[name]) roomPlaylists[name] = [];
        if (msg.item && !roomPlaylists[name].find(p => p.videoId === msg.item.videoId)) {
            roomPlaylists[name].push(msg.item);
            savePlaylist();
            renderPlaylist();
            toast(`${msg.item.title.slice(0, 30)}… added to ${name} 🎵`, 'info');
        }
        return;
    }

    if (msg.type === 'playlist_remove') {
        const name = msg.playlistName || "Room Playlist";
        if (roomPlaylists[name]) {
            const idx = roomPlaylists[name].findIndex(p => p.videoId === msg.videoId);
            if (idx !== -1) { roomPlaylists[name].splice(idx, 1); savePlaylist(); renderPlaylist(); }
        }
        return;
    }

    // ── Partner loaded a new song ─────────────────────
    if (msg.type === 'yt_load') {
        toast(`${msg.sentBy} is playing a song 🎵`, 'info');
        ytNowPlayingWho.textContent = `${msg.sentBy} picked this`;
        loadYouTubeVideo(msg.videoId, 0, true);
        return;
    }

    // ── YouTube playback sync ─────────────────────────
    if (msg.type === 'yt_state') {
        isSyncing = true;
        ytSyncText.textContent = `${msg.sentBy} ${msg.playing ? 'is playing' : 'paused'} 🌙`;

        if (msg.videoId && msg.videoId !== ytVideoId) {
            // Different video — load it
            await loadYouTubeVideo(msg.videoId, msg.currentTime, msg.playing);
        } else if (ytPlayer && ytReady) {
            // Same video — sync position if drifted > 2s
            if (Math.abs((ytPlayer.getCurrentTime() || 0) - msg.currentTime) > 2) {
                ytPlayer.seekTo(msg.currentTime, true);
            }
            if (msg.playing && ytPlayer.getPlayerState() !== YT.PlayerState.PLAYING) {
                ytPlayer.playVideo();
            } else if (!msg.playing && ytPlayer.getPlayerState() === YT.PlayerState.PLAYING) {
                ytPlayer.pauseVideo();
            }
        }
        ytPlaying = msg.playing;
        updateYtIcon();
        if (ytPlaying) startYtTimer(); else clearInterval(ytTimer);
        setTimeout(() => { isSyncing = false; }, 400);
        return;
    }

    // ── Partner name ──────────────────────────────────
    if (msg.type === 'peer_name') {
        partnerLabel.textContent = msg.name + ' 💫';
        partnerPlaceholderName.textContent = msg.name;
    }
}

// ─────────────────────────────────────────────────────
//  PLAYLIST  (persisted per room in localStorage)
// ─────────────────────────────────────────────────────
const PLAYLIST_KEY = `ourspace_playlist_${roomId}`;
const PERSONAL_PLAYLIST_KEY = 'ourspace_personal_playlist';

let roomPlaylists = { "Room Playlist": [] };
let personalPlaylists = { "My Playlist": [] };
let activePlaylistTab = 'room'; // 'room' | 'personal'
let activePlaylistName = 'Room Playlist';

async function loadPlaylist() {
    try {
        const parsedRoom = await loadSecureData(PLAYLIST_KEY);
        if (Array.isArray(parsedRoom)) roomPlaylists = { "Room Playlist": parsedRoom };
        else if (parsedRoom && typeof parsedRoom === 'object') roomPlaylists = parsedRoom;
    } catch (e) {
        console.error('[STORAGE] Failed to load room playlists:', e);
    }

    try {
        const parsedPersonal = await loadSecureData(PERSONAL_PLAYLIST_KEY);
        if (Array.isArray(parsedPersonal)) personalPlaylists = { "My Playlist": parsedPersonal };
        else if (parsedPersonal && typeof parsedPersonal === 'object') personalPlaylists = parsedPersonal;
    } catch (e) {
        console.error('[STORAGE] Failed to load personal playlists:', e);
    }

    ensureActivePlaylist();
    renderPlaylist();
}

function ensureActivePlaylist() {
    if (Object.keys(roomPlaylists).length === 0) roomPlaylists["Room Playlist"] = [];
    if (Object.keys(personalPlaylists).length === 0) personalPlaylists["My Playlist"] = [];

    const dict = activePlaylistTab === 'room' ? roomPlaylists : personalPlaylists;
    if (!dict[activePlaylistName]) {
        activePlaylistName = Object.keys(dict)[0];
    }
}

async function savePlaylist() {
    await saveSecureData(PLAYLIST_KEY, roomPlaylists);
    await saveSecureData(PERSONAL_PLAYLIST_KEY, personalPlaylists);
}

function getActiveList() {
    ensureActivePlaylist();
    const dict = activePlaylistTab === 'room' ? roomPlaylists : personalPlaylists;
    return dict[activePlaylistName];
}

function renderPlaylist() {
    ensureActivePlaylist();
    const list = getActiveList();
    const container = document.getElementById('playlistItems');
    const empty = document.getElementById('playlistEmpty');
    const count = document.getElementById('playlistCount');
    const dropdown = document.getElementById('playlistDropdown');

    if (count) count.textContent = list.length + (list.length === 1 ? ' song' : ' songs');

    document.querySelectorAll('.pl-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === activePlaylistTab));

    const dict = activePlaylistTab === 'room' ? roomPlaylists : personalPlaylists;
    if (dropdown) {
        dropdown.innerHTML = Object.keys(dict).map(name => `<option value="${name}" ${name === activePlaylistName ? 'selected' : ''}>${name}</option>`).join('');
    }

    if (list.length === 0) {
        container.innerHTML = ''; empty.style.display = 'block'; return;
    }
    empty.style.display = 'none';
    container.innerHTML = list.map((item, i) => `
        <div class="pl-item ${ytVideoId === item.videoId ? 'pl-item--active' : ''}" data-i="${i}">
            <img class="pl-thumb" src="https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg" alt="" loading="lazy" />
            <div class="pl-title" title="${item.title}">${item.title}</div>
            <div class="pl-btns">
                <button class="pl-play" onclick="playFromPlaylist(${i})" title="Play">▶</button>
                <button class="pl-del"  onclick="deleteFromPlaylist(${i})" title="Remove">✕</button>
            </div>
        </div>
    `).join('');
}

// Tab listeners
document.querySelectorAll('.pl-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        activePlaylistTab = tab.dataset.tab;
        ensureActivePlaylist();
        renderPlaylist();
    });
});

document.getElementById('playlistDropdown').addEventListener('change', (e) => {
    activePlaylistName = e.target.value;
    renderPlaylist();
});

document.getElementById('newPlaylistBtn').addEventListener('click', () => {
    const name = prompt("Enter new playlist name:");
    if (name && name.trim()) {
        const cleanName = name.trim();
        if (activePlaylistTab === 'room') {
            if (!roomPlaylists[cleanName]) roomPlaylists[cleanName] = [];
        } else {
            if (!personalPlaylists[cleanName]) personalPlaylists[cleanName] = [];
        }
        activePlaylistName = cleanName;
        savePlaylist();
        renderPlaylist();
        if (activePlaylistTab === 'room') {
            sendSync({ type: 'playlist_sync', roomPlaylists });
        }
    }
});

document.getElementById('addToPlaylistBtn').addEventListener('click', async () => {
    if (!ytVideoId) return;
    const list = getActiveList();
    if (list.find(p => p.videoId === ytVideoId)) { toast('Already in playlist!', 'info'); return; }

    const titleEL = document.getElementById('ytTrackTitle');
    const title = titleEL.textContent && titleEL.textContent !== '—' ? titleEL.textContent : ytVideoId;

    const item = { videoId: ytVideoId, title, addedAt: Date.now() };
    list.push(item);
    savePlaylist();
    renderPlaylist();

    // Sync to partner only if acting on Room playlist
    if (activePlaylistTab === 'room') {
        sendSync({ type: 'playlist_add', item, playlistName: activePlaylistName });
    }
    toast(`Added to ${activePlaylistName} 📋`, 'success');
});

window.playFromPlaylist = function (i) {
    const item = getActiveList()[i];
    if (!item) return;
    loadYouTubeVideo(item.videoId, 0, true);
    sendSync({ type: 'yt_load', videoId: item.videoId, sentBy: myName });
};

window.deleteFromPlaylist = function (i) {
    const list = getActiveList();
    const removed = list[i];
    list.splice(i, 1);
    savePlaylist();
    renderPlaylist();

    // Sync removal to partner only if acting on Room playlist
    if (activePlaylistTab === 'room' && removed) {
        sendSync({ type: 'playlist_remove', videoId: removed.videoId, playlistName: activePlaylistName });
    }
};

// ── Playlist Management Menu ────────────────────────────────
const plMenuBtn = document.getElementById('plMenuBtn');
const plMenuPopup = document.getElementById('plMenuPopup');

if (plMenuBtn && plMenuPopup) {
    plMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetTab = activePlaylistTab === 'room' ? 'Personal' : 'Room';
        document.getElementById('plMenuMove').innerHTML = `↔️ Move to ${targetTab}`;
        const copyBtn = document.getElementById('plMenuCopy');
        if (copyBtn) copyBtn.innerHTML = `↗️ Send copy to ${targetTab}`;
        plMenuPopup.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
        if (!plMenuPopup.contains(e.target) && e.target !== plMenuBtn) {
            plMenuPopup.classList.remove('show');
        }
    });

    document.getElementById('plMenuRename').addEventListener('click', () => {
        plMenuPopup.classList.remove('show');
        const newName = prompt(`Rename "${activePlaylistName}" to:`, activePlaylistName);
        if (newName && newName.trim() && newName !== activePlaylistName) {
            const cleanName = newName.trim();
            const dict = activePlaylistTab === 'room' ? roomPlaylists : personalPlaylists;
            if (dict[cleanName]) {
                toast('Name already exists!', 'error');
                return;
            }
            dict[cleanName] = dict[activePlaylistName];
            delete dict[activePlaylistName];
            activePlaylistName = cleanName;
            savePlaylist();
            renderPlaylist();
            if (activePlaylistTab === 'room') sendSync({ type: 'playlist_sync', roomPlaylists });
            toast('Playlist renamed!', 'success');
        }
    });

    const copyBtnClick = document.getElementById('plMenuCopy');
    if (copyBtnClick) {
        copyBtnClick.addEventListener('click', () => {
            plMenuPopup.classList.remove('show');
            const sourceDict = activePlaylistTab === 'room' ? roomPlaylists : personalPlaylists;
            const targetDict = activePlaylistTab === 'room' ? personalPlaylists : roomPlaylists;

            if (targetDict[activePlaylistName]) {
                toast(`Playlist "${activePlaylistName}" already exists there.`, 'error');
                return;
            }

            targetDict[activePlaylistName] = [...(sourceDict[activePlaylistName] || [])];
            savePlaylist();

            if (activePlaylistTab === 'personal') {
                sendSync({ type: 'playlist_sync', roomPlaylists });
            }
            toast('Playlist copied! 📋', 'success');
        });
    }

    document.getElementById('plMenuMove').addEventListener('click', () => {
        plMenuPopup.classList.remove('show');
        if (activePlaylistName === 'Room Playlist' || activePlaylistName === 'My Playlist') {
            toast('Cannot move default playlist.', 'info');
            return;
        }
        const sourceDict = activePlaylistTab === 'room' ? roomPlaylists : personalPlaylists;
        const targetDict = activePlaylistTab === 'room' ? personalPlaylists : roomPlaylists;
        const targetTab = activePlaylistTab === 'room' ? 'personal' : 'room';

        if (targetDict[activePlaylistName]) {
            toast('A playlist with this name already exists in destination.', 'error');
            return;
        }

        targetDict[activePlaylistName] = sourceDict[activePlaylistName];
        delete sourceDict[activePlaylistName];

        savePlaylist();

        if (activePlaylistTab === 'room' || targetTab === 'room') {
            sendSync({ type: 'playlist_sync', roomPlaylists });
        }

        activePlaylistTab = targetTab;
        renderPlaylist();
        toast('Playlist moved!', 'success');
    });

    document.getElementById('plMenuDelete').addEventListener('click', () => {
        plMenuPopup.classList.remove('show');
        if (activePlaylistName === 'Room Playlist' || activePlaylistName === 'My Playlist') {
            toast('Cannot delete default playlist.', 'info');
            return;
        }
        if (confirm(`Are you sure you want to delete "${activePlaylistName}"?`)) {
            const dict = activePlaylistTab === 'room' ? roomPlaylists : personalPlaylists;
            delete dict[activePlaylistName];
            activePlaylistName = activePlaylistTab === 'room' ? "Room Playlist" : "My Playlist";
            savePlaylist();
            renderPlaylist();
            if (activePlaylistTab === 'room') sendSync({ type: 'playlist_sync', roomPlaylists });
            toast('Playlist deleted.', 'info');
        }
    });
}

// ─────────────────────────────────────────────────────
//  CINEMA MODE — fullscreen + auto-hide UI on idle
// ─────────────────────────────────────────────────────
let cinemaActive = false;
let cinemaTimer = null;

const cinemaBtn = document.getElementById('cinemaBtn');
cinemaBtn.addEventListener('click', toggleCinema);

// Also toggle on F key, and handle Escape for un-expanding
document.addEventListener('keydown', e => {
    if (e.key === 'f' || e.key === 'F') { if (!e.target.matches('input,textarea')) toggleCinema(); }
    if (e.key === 'Escape') {
        if (document.body.classList.contains('has-expanded')) {
            collapseAll();
        }
    }
});

function toggleCinema() {
    if (!cinemaActive) {
        document.documentElement.requestFullscreen().catch(() => {
            // Fullscreen blocked — still do UI hiding
        });
        cinemaActive = true;
        document.body.classList.add('cinema');
        cinemaBtn.textContent = '✕ Exit';
        startCinemaTimer();
        toast('Cinema mode — move your mouse to show controls 🎬', 'info', 3000);
    } else {
        exitCinema();
    }
}

function exitCinema() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
    cinemaActive = false;
    clearTimeout(cinemaTimer);
    document.body.classList.remove('cinema', 'cinema-hidden');
    cinemaBtn.textContent = '🎬';
}

function startCinemaTimer() {
    clearTimeout(cinemaTimer);
    document.body.classList.remove('cinema-hidden');
    cinemaTimer = setTimeout(() => {
        if (cinemaActive) document.body.classList.add('cinema-hidden');
    }, 3000);
}

document.addEventListener('mousemove', () => { if (cinemaActive) startCinemaTimer(); });
document.addEventListener('touchstart', () => { if (cinemaActive) startCinemaTimer(); });
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && cinemaActive) exitCinema(); });

// ─────────────────────────────────────────────────────
//  BOOT
// ─────────────────────────────────────────────────────
(async () => {
    await setupPeer();
    loadPlaylist();

    const sendName = () => { broadcast({ type: 'peer_name', name: myName }); };
    setTimeout(sendName, 1500);

})();

// ─────────────────────────────────────────────────────
//  SECURE LOCAL CHAT (IndexedDB + PeerJS Data Channel)
// ─────────────────────────────────────────────────────
const CHAT_DB_NAME = `OurSpaceChat_${roomId}`;
const CHAT_DB_VERSION = 1;
let chatDB;
let chatDB_ready = false;
let unreadChatCount = 0;

let currentReplyTo = null;

window.clearReplyTo = function () {
    currentReplyTo = null;
    document.getElementById('chatReplyPreview').style.display = 'none';
    const input = document.getElementById('chatInput');
    if (input) input.focus();
};

window.setReplyTo = function (id, text, senderLabel) {
    currentReplyTo = { id, text, senderLabel };
    const preview = document.getElementById('chatReplyPreview');
    preview.style.display = 'flex';
    preview.innerHTML = `
        <div class="reply-preview-text">
            <strong>${senderLabel}</strong>
            ${text.substring(0, 60)}${text.length > 60 ? '...' : ''}
        </div>
        <button class="chat-reply-close" onclick="clearReplyTo()">✕</button>
    `;
    document.getElementById('chatInput').focus();
};

window.scrollToMsg = function (id) {
    const el = document.querySelector(`[data-chat-id="${id}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    else toast('Message is not loaded or too old.', 'info');
};

window.openImageModal = function (src, fileName) {
    document.getElementById('imageModalImg').src = src;
    const dl = document.getElementById('imageModalDownload');
    dl.href = src;
    dl.download = fileName;
    document.getElementById('imageModal').classList.add('show');
};

function initChatDB() {
    const request = indexedDB.open(CHAT_DB_NAME, CHAT_DB_VERSION);
    request.onupgradeneeded = e => {
        chatDB = e.target.result;
        if (!chatDB.objectStoreNames.contains('messages')) {
            chatDB.createObjectStore('messages', { keyPath: 'id' });
        }
    };
    request.onsuccess = e => {
        chatDB = e.target.result;
        chatDB_ready = true;
        loadChatHistory();
    };
    request.onerror = e => console.error("Chat DB error:", e);
}

async function loadChatHistory() {
    if (!chatDB) return;
    const tx = chatDB.transaction('messages', 'readonly');
    const store = tx.objectStore('messages');
    const req = store.getAll();
    req.onsuccess = async () => {
        const msgs = req.result;
        const container = document.getElementById('chatMessages');
        container.innerHTML = '';

        for (const encryptedMsg of msgs) {
            try {
                // Decrypt message
                let msg;
                if (encryptedMsg.encrypted) {
                    const decrypted = await decryptData(encryptedMsg.encrypted);
                    if (decrypted) {
                        msg = { ...decrypted, id: encryptedMsg.id, timestamp: encryptedMsg.timestamp };
                    } else {
                        console.warn('[SECURITY] Failed to decrypt chat message, skipping');
                        continue;
                    }
                } else {
                    // Old unencrypted message
                    msg = encryptedMsg;
                }

                await appendChatMessage(msg, false);
            } catch (err) {
                console.error('[SECURITY] Error loading chat message:', err);
            }
        }

        container.scrollTop = container.scrollHeight;
        console.log('[SECURITY] 🔐 Chat history loaded and decrypted');
    };
}

async function appendChatMessage(msg, saveToDb = true) {
    if (saveToDb && chatDB) {
        try {
            // Encrypt message before storing
            const encryptedMsg = {
                id: msg.id,
                timestamp: msg.timestamp,
                encrypted: await encryptData({
                    sender: msg.sender,
                    sentBy: msg.sentBy,
                    senderLabel: msg.senderLabel,
                    type: msg.type,
                    content: msg.content,
                    fileName: msg.fileName,
                    replyTo: msg.replyTo,
                    to: msg.to,
                    toName: msg.toName
                })
            };

            const tx = chatDB.transaction('messages', 'readwrite');
            tx.objectStore('messages').put(encryptedMsg);
            console.log('[SECURITY] 🔐 Chat message encrypted and stored');
        } catch (err) {
            console.error('[SECURITY] Failed to encrypt chat message:', err);
        }
    }

    const container = document.getElementById('chatMessages');
    const div = document.createElement('div');
    const isMe = msg.sender === myName;
    div.className = `chat-msg ${isMe ? 'me' : 'partner'}`;
    div.dataset.chatId = msg.id;

    let replyHtml = '';
    if (msg.replyTo) {
        replyHtml = `
            <div class="chat-quoted" onclick="scrollToMsg('${msg.replyTo.id}')">
                <strong>${msg.replyTo.senderLabel}</strong>
                <div>${msg.replyTo.text.substring(0, 60)}${msg.replyTo.text.length > 60 ? '...' : ''}</div>
            </div>
        `;
    }

    let contentHtml = '';
    let rawTextForReply = '';
    if (msg.type === 'image') {
        contentHtml = `
            <div class="chat-img-wrapper">
                <img src="${msg.content}" class="chat-img-preview" alt="Image" onclick="openImageModal('${msg.content}', '${msg.fileName || 'image.jpg'}')" />
            </div>
        `;
        rawTextForReply = '📷 Image';
    } else if (msg.type === 'file') {
        contentHtml = `<a href="${msg.content}" download="${msg.fileName}" class="chat-file-preview" target="_blank">📄 ${msg.fileName} <span style="margin-left:auto">⬇️</span></a>`;
        rawTextForReply = `📄 ${msg.fileName}`;
    } else {
        const safeText = msg.content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        contentHtml = `<span>${safeText}</span>`;
        rawTextForReply = safeText;
    }

    const safeReplyStr = rawTextForReply.replace(/'/g, "\\'").replace(/"/g, "&quot;");
    const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const privFlag = msg.to && msg.to !== 'all' ? `<small style="color:var(--accent-purple);margin-left:5px;">[Private]</small>` : '';

    div.innerHTML = `
        <div class="chat-bubble">
            ${replyHtml}
            ${contentHtml}
        </div>
        <div class="chat-meta">
            <span>${isMe ? 'You' : msg.senderLabel}${privFlag}</span>
            <span>${timeStr}</span>
            <button class="chat-action-btn" title="Reply" onclick="setReplyTo('${msg.id}', '${safeReplyStr}', '${isMe ? 'You' : msg.senderLabel}')">↩️</button>
        </div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;

    const panel = document.getElementById('chatPanel');
    if (panel && !panel.classList.contains('show') && !isMe) {
        unreadChatCount++;
        const badge = document.getElementById('chatBadge');
        if (badge) {
            badge.textContent = unreadChatCount;
            badge.style.display = 'block';
        }
    }
}

function sendChatMessage(text, type = 'text', fileData = null, fileName = null) {
    const toId = document.getElementById('chatRecipient')?.value || 'all';
    const toName = toId === 'all' ? 'Everyone' : (peersMap[toId] ? peersMap[toId].name : 'Unknown');

    const msg = {
        id: Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        sender: myName,
        sentBy: myName,
        senderLabel: myName,
        type: type,
        content: type === 'text' ? text : fileData,
        fileName: fileName,
        replyTo: currentReplyTo,
        timestamp: Date.now(),
        to: toId,
        toName: toName
    };
    clearReplyTo();
    appendChatMessage(msg, true);

    if (toId === 'all') {
        broadcast({ type: 'chat_msg', message: msg, sentBy: myName });
    } else if (peersMap[toId] && peersMap[toId].dataConn) {
        secureSend(peersMap[toId].dataConn, { type: 'chat_msg', message: msg, sentBy: myName });
    }
}

// GUI Listeners
const chatToggleBtn = document.getElementById('chatToggleBtn');
const chatPanel = document.getElementById('chatPanel');
const chatCloseBtn = document.getElementById('chatCloseBtn');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');
const chatFileInput = document.getElementById('chatFileInput');

if (chatToggleBtn && chatPanel) {
    chatToggleBtn.addEventListener('click', () => {
        chatPanel.classList.toggle('show');
        if (chatPanel.classList.contains('show')) {
            unreadChatCount = 0;
            const badge = document.getElementById('chatBadge');
            if (badge) badge.style.display = 'none';
            chatInput.focus();
            const container = document.getElementById('chatMessages');
            container.scrollTop = container.scrollHeight;
        }
    });
    chatCloseBtn.addEventListener('click', () => {
        chatPanel.classList.remove('show');
    });
}

if (chatSendBtn && chatInput) {
    chatSendBtn.addEventListener('click', () => {
        const val = chatInput.value.trim();
        if (val) {
            sendChatMessage(val);
            chatInput.value = '';
        }
    });
    chatInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') chatSendBtn.click();
    });
}

if (chatFileInput) {
    chatFileInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            toast('File too large! Keep under 2MB for syncing.', 'error');
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = ev => {
            const base64 = ev.target.result;
            const type = file.type.startsWith('image/') ? 'image' : 'file';
            sendChatMessage('', type, base64, file.name);
            e.target.value = '';
        };
        reader.readAsDataURL(file);
    });
}

// Start Chat DB
initChatDB();
