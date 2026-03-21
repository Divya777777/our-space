/* =====================================================
   room.js — Couple's Room Logic
   WebRTC via PeerJS + Spotify Web Playback SDK sync
   ===================================================== */

// ─── CONFIG ──────────────────────────────────────────
// Replace with your Spotify Client ID from developer.spotify.com
const SPOTIFY_CLIENT_ID = 'e67c927aa02344298493bada37f2c0e5';
const REDIRECT_URI = 'https://divya777777.github.io/our-space/room.html';
const SCOPES = [
    'streaming',
    'user-read-email',
    'user-read-private',
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
].join(' ');

// ─── SESSION DATA ─────────────────────────────────────
const myName = sessionStorage.getItem('ourspace_name') || 'You';
const roomId = sessionStorage.getItem('ourspace_room') || '';

if (!roomId) {
    window.location.href = 'index.html';
}

// ─── STAR / SHOOTING STAR BACKGROUND ─────────────────
(function initStars() {
    const canvas = document.getElementById('starCanvas');
    const ctx = canvas.getContext('2d');
    let stars = [];
    let W, H;

    function resize() {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
        stars = [];
        for (let i = 0; i < 220; i++) {
            stars.push({
                x: Math.random() * W,
                y: Math.random() * H,
                r: Math.random() * 1.5 + 0.2,
                alpha: Math.random(),
                speed: Math.random() * 0.005 + 0.002,
                dir: Math.random() > 0.5 ? 1 : -1,
            });
        }
    }

    function draw() {
        ctx.clearRect(0, 0, W, H);
        for (const s of stars) {
            s.alpha += s.speed * s.dir;
            if (s.alpha >= 1 || s.alpha <= 0.05) s.dir *= -1;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${s.alpha.toFixed(2)})`;
            ctx.fill();
        }
        requestAnimationFrame(draw);
    }

    window.addEventListener('resize', resize);
    resize();
    draw();
})();

(function initShootingStars() {
    const container = document.getElementById('shootingStars');
    function spawnStar() {
        const el = document.createElement('div');
        el.className = 'shooting-star';
        const angle = Math.random() * 30 + 20;
        el.style.setProperty('--angle', angle + 'deg');
        el.style.top = Math.random() * 60 + '%';
        el.style.left = Math.random() * 80 + '%';
        el.style.animationDuration = (Math.random() * 0.8 + 0.6) + 's';
        container.appendChild(el);
        setTimeout(() => el.remove(), 1500);
    }
    setInterval(spawnStar, 3200);
    setTimeout(spawnStar, 1000);
})();

// ─── DOM REFS ─────────────────────────────────────────
const roomCodeDisplay = document.getElementById('roomCodeDisplay');
const myNameDisplay = document.getElementById('myNameDisplay');
const myLabel = document.getElementById('myLabel');
const myPlaceholderName = document.getElementById('myPlaceholderName');
const partnerLabel = document.getElementById('partnerLabel');
const partnerPlaceholderName = document.getElementById('partnerPlaceholderName');
const connectionStatus = document.getElementById('connectionStatus');
const statusDot = connectionStatus.querySelector('.status-dot');
const statusText = connectionStatus.querySelector('.status-text');
const myVideo = document.getElementById('myVideo');
const partnerVideo = document.getElementById('partnerVideo');
const myPlaceholder = document.getElementById('myPlaceholder');
const partnerPlaceholder = document.getElementById('partnerPlaceholder');
const muteBtn = document.getElementById('muteBtn');
const videoBtn = document.getElementById('videoBtn');
const startCallBtn = document.getElementById('startCallBtn');
const callActions = document.getElementById('callActions');
const leaveBtn = document.getElementById('leaveBtn');
const copyRoomBtn = document.getElementById('copyRoomBtn');

// Spotify DOM
const spotifyConnectBtn = document.getElementById('spotifyConnectBtn');
const spotifyDisconnected = document.getElementById('spotifyDisconnected');
const spotifyPlayer = document.getElementById('spotifyPlayer');
const nowPlayingWho = document.getElementById('nowPlayingWho');
const albumArt = document.getElementById('albumArt');
const trackName = document.getElementById('trackName');
const trackArtist = document.getElementById('trackArtist');
const trackAlbum = document.getElementById('trackAlbum');
const currentTimeEl = document.getElementById('currentTime');
const totalTimeEl = document.getElementById('totalTime');
const progressFill = document.getElementById('progressFill');
const progressBarBg = document.getElementById('progressBarBg');
const playPauseBtn = document.getElementById('playPauseBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const volumeSlider = document.getElementById('volumeSlider');
const syncText = document.getElementById('syncText');

// ─── INIT UI ──────────────────────────────────────────
roomCodeDisplay.textContent = roomId;
myNameDisplay.textContent = myName;
myLabel.textContent = `${myName} 🌙`;
myPlaceholderName.textContent = myName;

// ─── TOAST ────────────────────────────────────────────
function toast(msg, type = 'info', duration = 3500) {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    document.getElementById('toastContainer').appendChild(el);
    setTimeout(() => {
        el.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(() => el.remove(), 300);
    }, duration);
}

// ─── COPY ROOM CODE ───────────────────────────────────
copyRoomBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(roomId).then(() => toast('Room code copied! 📋', 'success'));
});

// ─── LEAVE ────────────────────────────────────────────
leaveBtn.addEventListener('click', () => {
    if (peer) peer.destroy();
    if (spotifySDKPlayer) spotifySDKPlayer.disconnect();
    sessionStorage.removeItem('ourspace_name');
    sessionStorage.removeItem('ourspace_room');
    window.location.href = 'index.html';
});

// ─── CONNECTION STATUS ────────────────────────────────
function setStatus(state, text) {
    statusDot.className = 'status-dot ' + state;
    statusText.textContent = text;
}

// ─────────────────────────────────────────────────────
//  WEBRTC / PEERJS
// ─────────────────────────────────────────────────────
let peer = null;
let peerConn = null;  // MediaConnection (call)
let dataConn = null;  // DataConnection (sync)
let localStream = null;
let isMuted = false;
let isVideoOff = false;
let isInCall = false;

// Derive a deterministic peer ID from room code.
// PeerJS only accepts alphanumeric IDs, so we hash the room string to hex.
async function hashRoomId(str) {
    const data = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest('SHA-1', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 20);
}

// Initialize peer IDs asynchronously (wraps setupPeer)
let peerIdA, peerIdB;

function initPeer(id) {
    return new Promise((resolve, reject) => {
        const p = new Peer(id, {
            debug: 0,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' },
                ]
            }
        });
        p.on('open', () => resolve(p));
        p.on('error', e => reject(e));
    });
}

async function setupPeer() {
    setStatus('connecting', 'Connecting…');
    try {
        // Try to be peer A
        peer = await initPeer(peerIdA);
        // Successfully claimed A — wait for B to connect
        toast(`Room ready! Share code: ${roomId}`, 'info', 5000);
        setStatus('connecting', 'Waiting for partner…');

        // Listen for incoming data (sync) and call
        peer.on('connection', conn => {
            dataConn = conn;
            setupDataConn();
        });
        peer.on('call', call => {
            answerCall(call);
        });

    } catch (err) {
        if (err.type === 'unavailable-id') {
            // We are B — connect to A
            try {
                peer = await initPeer(peerIdB);
                setStatus('connecting', 'Connecting to partner…');

                // Open data connection to A
                dataConn = peer.connect(peerIdA, { reliable: true });
                setupDataConn();

                toast('Partner found! Starting connection…', 'info');
            } catch (err2) {
                toast('Could not connect. Please refresh.', 'error');
                console.error(err2);
            }
        } else {
            toast('Connection error. Please refresh.', 'error');
            console.error(err);
        }
    }
}

function setupDataConn() {
    dataConn.on('open', () => {
        setStatus('connected', `Connected with partner 💫`);
        partnerPlaceholderName.textContent = 'Partner 💫';
        toast('Partner connected! 🌙', 'success');
        syncText.textContent = 'Partner connected 🌙';
    });

    dataConn.on('data', msg => {
        handleSyncMessage(msg);
    });

    dataConn.on('close', () => {
        setStatus('disconnected', 'Partner disconnected');
        partnerPlaceholderName.textContent = 'Offline…';
        toast('Partner disconnected 💔', 'error');
    });

    dataConn.on('error', err => {
        console.error('DataConn error:', err);
    });
}

function sendSync(msg) {
    if (dataConn && dataConn.open) {
        dataConn.send(msg);
    }
}

// ─── CALL ──────────────────────────────────────────────
startCallBtn.addEventListener('click', () => {
    if (isInCall) {
        endCall();
    } else {
        startCall();
    }
});

async function startCall() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        myVideo.srcObject = localStream;
        myVideo.classList.add('active');
        myPlaceholder.style.display = 'none';

        startCallBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>
      End Call
    `;
        startCallBtn.classList.add('end-call');
        isInCall = true;

        // Call the other peer
        const remotePeerId = peer.id === peerIdA ? peerIdB : peerIdA;
        const call = peer.call(remotePeerId, localStream);
        if (call) {
            handleCallStream(call);
        }

        // Also listen for incoming call (both might call simultaneously)
        peer.on('call', call => {
            call.answer(localStream);
            handleCallStream(call);
        });

    } catch (err) {
        toast('Could not access camera/mic. Check permissions.', 'error');
        console.error(err);
    }
}

function answerCall(call) {
    if (localStream) {
        call.answer(localStream);
    } else {
        navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
            localStream = stream;
            myVideo.srcObject = stream;
            myVideo.classList.add('active');
            myPlaceholder.style.display = 'none';
            isInCall = true;
            startCallBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg> End Call`;
            startCallBtn.classList.add('end-call');
            call.answer(stream);
            handleCallStream(call);
        }).catch(err => {
            toast('Could not access camera/mic.', 'error');
        });
    }
}

function handleCallStream(call) {
    call.on('stream', remoteStream => {
        partnerVideo.srcObject = remoteStream;
        partnerVideo.classList.add('active');
        partnerPlaceholder.style.display = 'none';
    });
    call.on('close', () => {
        partnerVideo.srcObject = null;
        partnerVideo.classList.remove('active');
        partnerPlaceholder.style.display = 'flex';
        toast('Call ended', 'info');
    });
}

function endCall() {
    if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
        localStream = null;
    }
    myVideo.srcObject = null;
    myVideo.classList.remove('active');
    myPlaceholder.style.display = 'flex';
    partnerVideo.srcObject = null;
    partnerVideo.classList.remove('active');
    partnerPlaceholder.style.display = 'flex';
    isInCall = false;
    startCallBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>
    Start Call
  `;
    startCallBtn.classList.remove('end-call');
    toast('Call ended', 'info');
}

// Mute toggle
muteBtn.addEventListener('click', () => {
    if (!localStream) return;
    isMuted = !isMuted;
    localStream.getAudioTracks().forEach(t => t.enabled = !isMuted);
    muteBtn.classList.toggle('muted', isMuted);
    muteBtn.title = isMuted ? 'Unmute' : 'Mute';
    // Update icon
    muteBtn.innerHTML = isMuted
        ? `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/></svg>`
        : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v6a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm-1 14.93V21h2v-3.07A8.001 8.001 0 0 0 20 10h-2a6 6 0 0 1-12 0H4a8.001 8.001 0 0 0 7 7.93z"/></svg>`;
});

// Video toggle
videoBtn.addEventListener('click', () => {
    if (!localStream) return;
    isVideoOff = !isVideoOff;
    localStream.getVideoTracks().forEach(t => t.enabled = !isVideoOff);
    videoBtn.classList.toggle('video-off', isVideoOff);
    if (isVideoOff) {
        myVideo.classList.remove('active');
        myPlaceholder.style.display = 'flex';
    } else {
        myVideo.classList.add('active');
        myPlaceholder.style.display = 'none';
    }
});

// ─────────────────────────────────────────────────────
//  SPOTIFY WEB PLAYBACK SDK
// ─────────────────────────────────────────────────────
let spotifySDKPlayer = null;
let spotifyDeviceId = null;
let spotifyToken = null;
let isSpotifyReady = false;
let isPlaying = false;
let currentTrackUri = null;
let progressInterval = null;
let currentPositionMs = 0;
let totalDurationMs = 0;
let isSyncing = false; // prevent sync echo

// ── OAuth PKCE flow ───────────────────────────────────
async function generateCodeVerifier(length = 128) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    const random = new Uint8Array(length);
    crypto.getRandomValues(random);
    for (let i = 0; i < length; i++) result += chars[random[i] % chars.length];
    return result;
}

async function generateCodeChallenge(verifier) {
    const data = new TextEncoder().encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function redirectToSpotify() {
    if (SPOTIFY_CLIENT_ID === 'YOUR_SPOTIFY_CLIENT_ID') {
        toast('⚠️ Please add your Spotify Client ID in room.js', 'error', 7000);
        return;
    }
    const verifier = await generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    sessionStorage.setItem('pkce_verifier', verifier);

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: SPOTIFY_CLIENT_ID,
        scope: SCOPES,
        redirect_uri: REDIRECT_URI,
        code_challenge_method: 'S256',
        code_challenge: challenge,
    });

    window.location.href = 'https://accounts.spotify.com/authorize?' + params.toString();
}

async function exchangeCodeForToken(code) {
    const verifier = sessionStorage.getItem('pkce_verifier');
    if (!verifier) return;

    const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: REDIRECT_URI,
            client_id: SPOTIFY_CLIENT_ID,
            code_verifier: verifier,
        }),
    });

    if (!res.ok) {
        toast('Spotify auth failed. Try connecting again.', 'error');
        return;
    }

    const data = await res.json();
    spotifyToken = data.access_token;
    sessionStorage.setItem('spotify_token', spotifyToken);
    sessionStorage.setItem('spotify_token_exp', Date.now() + (data.expires_in - 60) * 1000);

    // Clean URL
    const url = new URL(window.location.href);
    url.searchParams.delete('code');
    url.searchParams.delete('state');
    window.history.replaceState({}, '', url.pathname + (url.search || ''));

    initSpotifySDK();
}

// Check for OAuth callback
const urlParams = new URLSearchParams(window.location.search);
const authCode = urlParams.get('code');
if (authCode) {
    exchangeCodeForToken(authCode);
} else {
    // Check stored token
    const storedToken = sessionStorage.getItem('spotify_token');
    const tokenExp = parseInt(sessionStorage.getItem('spotify_token_exp') || '0');
    if (storedToken && Date.now() < tokenExp) {
        spotifyToken = storedToken;
        initSpotifySDK();
    }
}

// Connect button
spotifyConnectBtn.addEventListener('click', () => {
    if (!isSpotifyReady) {
        redirectToSpotify();
    }
});

// ── SDK Initialization ────────────────────────────────
window.onSpotifyWebPlaybackSDKReady = () => {
    // SDK is available — will init once we have token
    if (spotifyToken) initSpotifySDK();
};

function initSpotifySDK() {
    if (!spotifyToken) return;
    if (spotifySDKPlayer) spotifySDKPlayer.disconnect();

    spotifySDKPlayer = new Spotify.Player({
        name: `Our Space 🌙 (${myName})`,
        getOAuthToken: cb => cb(spotifyToken),
        volume: volumeSlider.value / 100,
    });

    spotifySDKPlayer.addListener('ready', ({ device_id }) => {
        spotifyDeviceId = device_id;
        isSpotifyReady = true;
        spotifyConnectBtn.textContent = '✓ Spotify Connected';
        spotifyConnectBtn.classList.add('connected');
        spotifyDisconnected.style.display = 'none';
        spotifyPlayer.style.display = 'flex';
        toast('Spotify connected 🎵', 'success');
        // Transfer playback to this device
        transferPlayback(device_id);
    });

    spotifySDKPlayer.addListener('not_ready', () => {
        isSpotifyReady = false;
    });

    spotifySDKPlayer.addListener('player_state_changed', state => {
        if (!state) return;
        updatePlayerUI(state);

        // Broadcast state to partner
        if (!isSyncing) {
            const track = state.track_window.current_track;
            sendSync({
                type: 'spotify_state',
                trackUri: track.uri,
                trackName: track.name,
                artistName: track.artists.map(a => a.name).join(', '),
                albumName: track.album.name,
                albumImage: track.album.images[0]?.url || '',
                positionMs: state.position,
                durationMs: state.duration,
                paused: state.paused,
                sentBy: myName,
            });
        }
    });

    spotifySDKPlayer.addListener('initialization_error', ({ message }) => {
        console.error('Spotify init error:', message);
        toast('Spotify error: ' + message, 'error');
    });
    spotifySDKPlayer.addListener('authentication_error', () => {
        toast('Spotify auth expired. Please reconnect.', 'error');
        sessionStorage.removeItem('spotify_token');
        spotifyConnectBtn.textContent = 'Connect Spotify';
        spotifyConnectBtn.classList.remove('connected');
    });
    spotifySDKPlayer.addListener('account_error', () => {
        toast('Spotify Premium required for synced playback.', 'error', 6000);
    });

    spotifySDKPlayer.connect();
}

async function transferPlayback(deviceId) {
    if (!spotifyToken) return;
    await fetch('https://api.spotify.com/v1/me/player', {
        method: 'PUT',
        headers: {
            'Authorization': 'Bearer ' + spotifyToken,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ device_ids: [deviceId], play: false }),
    });
}

// ── Player UI ─────────────────────────────────────────
function updatePlayerUI(state) {
    const track = state.track_window.current_track;
    isPlaying = !state.paused;
    currentTrackUri = track.uri;
    currentPositionMs = state.position;
    totalDurationMs = state.duration;

    trackName.textContent = track.name;
    trackArtist.textContent = track.artists.map(a => a.name).join(', ');
    trackAlbum.textContent = track.album.name;

    const img = track.album.images[0]?.url;
    if (img) albumArt.src = img;

    updatePlayPauseIcon();
    updateProgressUI();
    startProgressTracking();
}

function updatePlayPauseIcon() {
    const playIcon = playPauseBtn.querySelector('.play-icon');
    const pauseIcon = playPauseBtn.querySelector('.pause-icon');
    playIcon.style.display = isPlaying ? 'none' : 'block';
    pauseIcon.style.display = isPlaying ? 'block' : 'none';
}

function updateProgressUI() {
    const pct = totalDurationMs > 0 ? (currentPositionMs / totalDurationMs) * 100 : 0;
    progressFill.style.width = pct + '%';
    currentTimeEl.textContent = msToTime(currentPositionMs);
    totalTimeEl.textContent = msToTime(totalDurationMs);
}

function startProgressTracking() {
    clearInterval(progressInterval);
    if (!isPlaying) return;
    progressInterval = setInterval(() => {
        if (isPlaying) {
            currentPositionMs = Math.min(currentPositionMs + 1000, totalDurationMs);
            updateProgressUI();
        }
    }, 1000);
}

function msToTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Controls ──────────────────────────────────────────
playPauseBtn.addEventListener('click', () => {
    if (!spotifySDKPlayer) return;
    spotifySDKPlayer.togglePlay();
});

prevBtn.addEventListener('click', () => {
    if (!spotifySDKPlayer) return;
    spotifySDKPlayer.previousTrack();
});

nextBtn.addEventListener('click', () => {
    if (!spotifySDKPlayer) return;
    spotifySDKPlayer.nextTrack();
});

volumeSlider.addEventListener('input', () => {
    if (!spotifySDKPlayer) return;
    spotifySDKPlayer.setVolume(volumeSlider.value / 100);
});

// Seek on click
progressBarBg.addEventListener('click', e => {
    if (!spotifyToken || !totalDurationMs) return;
    const rect = progressBarBg.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const posMs = Math.floor(pct * totalDurationMs);
    spotifySDKPlayer.seek(posMs);
});

// ─────────────────────────────────────────────────────
//  SYNC MESSAGE HANDLER
// ─────────────────────────────────────────────────────
async function handleSyncMessage(msg) {
    if (!msg || !msg.type) return;

    if (msg.type === 'spotify_state') {
        isSyncing = true;

        // Update UI with what partner is playing
        nowPlayingWho.textContent = `${msg.sentBy} is playing`;
        trackName.textContent = msg.trackName;
        trackArtist.textContent = msg.artistName;
        trackAlbum.textContent = msg.albumName;
        if (msg.albumImage) albumArt.src = msg.albumImage;
        totalDurationMs = msg.durationMs;
        currentPositionMs = msg.positionMs;
        isPlaying = !msg.paused;
        updatePlayPauseIcon();
        updateProgressUI();
        startProgressTracking();
        syncText.textContent = `Synced with ${msg.sentBy} 🌙`;

        // If we have our own Spotify connected → play same track
        if (isSpotifyReady && spotifyToken && spotifyDeviceId) {
            if (msg.trackUri !== currentTrackUri || Math.abs(msg.positionMs - currentPositionMs) > 3000) {
                await playTrackOnDevice(msg.trackUri, msg.positionMs, !msg.paused);
            }
        }

        // Show player panel even if not locally connected
        spotifyDisconnected.style.display = 'none';
        spotifyPlayer.style.display = 'flex';

        setTimeout(() => { isSyncing = false; }, 500);
    }

    if (msg.type === 'peer_name') {
        partnerLabel.textContent = msg.name + ' 💫';
        partnerPlaceholderName.textContent = msg.name;
    }
}

async function playTrackOnDevice(uri, positionMs, play) {
    if (!spotifyToken || !spotifyDeviceId) return;
    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}`, {
        method: 'PUT',
        headers: {
            'Authorization': 'Bearer ' + spotifyToken,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            uris: [uri],
            position_ms: positionMs,
        }),
    });
    if (!play) {
        setTimeout(() => {
            fetch('https://api.spotify.com/v1/me/player/pause?device_id=' + spotifyDeviceId, {
                method: 'PUT',
                headers: { 'Authorization': 'Bearer ' + spotifyToken },
            });
        }, 800);
    }
}

// ─────────────────────────────────────────────────────
//  BOOT
// ─────────────────────────────────────────────────────
(async () => {
    const hash = await hashRoomId(roomId);
    peerIdA = hash + 'a';  // all alphanumeric — safe for PeerJS
    peerIdB = hash + 'b';

    await setupPeer();

    // Send our name to partner once connected
    const sendName = () => {
        if (dataConn && dataConn.open) {
            sendSync({ type: 'peer_name', name: myName });
        }
    };
    setTimeout(sendName, 1000);
    setTimeout(sendName, 3000);
})();
