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

// ─── STAR BACKGROUND ─────────────────────────────────
(function initStars() {
    const canvas = document.getElementById('starCanvas');
    const ctx = canvas.getContext('2d');
    let stars = [], W, H;
    function resize() {
        W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight;
        stars = [];
        for (let i = 0; i < 220; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.5 + 0.2, alpha: Math.random(), speed: Math.random() * 0.005 + 0.002, dir: Math.random() > 0.5 ? 1 : -1 });
    }
    function draw() {
        ctx.clearRect(0, 0, W, H);
        for (const s of stars) { s.alpha += s.speed * s.dir; if (s.alpha >= 1 || s.alpha <= 0.05) s.dir *= -1; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fillStyle = `rgba(255,255,255,${s.alpha.toFixed(2)})`; ctx.fill(); }
        requestAnimationFrame(draw);
    }
    window.addEventListener('resize', resize); resize(); draw();
})();

(function initShootingStars() {
    const container = document.getElementById('shootingStars');
    function spawn() {
        const el = document.createElement('div'); el.className = 'shooting-star';
        el.style.setProperty('--angle', (Math.random() * 30 + 20) + 'deg');
        el.style.top = Math.random() * 60 + '%'; el.style.left = Math.random() * 80 + '%';
        el.style.animationDuration = (Math.random() * 0.8 + 0.6) + 's';
        container.appendChild(el); setTimeout(() => el.remove(), 1500);
    }
    setInterval(spawn, 3200); setTimeout(spawn, 1000);
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
myLabel.textContent = `${myName} 🌙`;
myPlaceholderName.textContent = myName;

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
//  PIN SECURITY
// ─────────────────────────────────────────────────────
// Simple deterministic hash of (roomId + pin) — not crypto but prevents casual intrusion
function roomPinToken() {
    const str = roomId + '::' + roomPin;
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = (Math.imul(31, h) + str.charCodeAt(i)) | 0; }
    return Math.abs(h).toString(36);
}

// ─────────────────────────────────────────────────────
//  WEBRTC / PEERJS
// ─────────────────────────────────────────────────────
let peer = null, dataConn = null, localStream = null;
let isMuted = false, isVideoOff = false, isInCall = false;
let peerIdA, peerIdB;

async function hashRoomId(str) {
    const data = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest('SHA-1', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 20);
}

function initPeer(id) {
    return new Promise((resolve, reject) => {
        const p = new Peer(id, {
            debug: 0,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
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
        peer = await initPeer(peerIdA);
        toast(`Room ready! Share code: ${roomId}`, 'info', 5000);
        setStatus('connecting', 'Waiting for partner…');
        peer.on('connection', conn => { dataConn = conn; setupDataConn(); });
        peer.on('call', answerCall);
    } catch (err) {
        if (err.type === 'unavailable-id') {
            try {
                peer = await initPeer(peerIdB);
                setStatus('connecting', 'Connecting to partner…');
                dataConn = peer.connect(peerIdA, { reliable: true });
                setupDataConn();
                peer.on('call', answerCall);
                toast('Partner found! Connecting…', 'info');
            } catch (err2) {
                toast('Could not connect. Please refresh.', 'error');
            }
        } else {
            toast('Connection error. Please refresh.', 'error');
        }
    }
}

function setupDataConn() {
    dataConn.on('open', () => {
        // Immediately send our PIN token for verification
        sendSync({ type: 'pin_verify', token: roomPinToken() });
    });
    dataConn.on('data', msg => handleSyncMessage(msg));
    dataConn.on('close', () => {
        setStatus('disconnected', 'Partner disconnected');
        partnerPlaceholderName.textContent = 'Offline…';
        toast('Partner disconnected 💔', 'error');
        ytSyncText.textContent = 'Partner disconnected';
    });
    dataConn.on('error', err => console.error('DataConn:', err));
}

function sendSync(msg) {
    if (dataConn && dataConn.open) dataConn.send(msg);
}

// ─── CALL ─────────────────────────────────────────────
startCallBtn.addEventListener('click', () => {
    if (isInCall) endCall(); else startCall();
});

async function startCall() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        myVideo.srcObject = localStream;
        myVideo.classList.add('active');
        myPlaceholder.style.display = 'none';
        startCallBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg> End Call`;
        startCallBtn.classList.add('end-call');
        isInCall = true;
        sendSync({ type: 'call_request' });
        if (peer.id === peerIdA) attemptCall();
    } catch (err) {
        toast('Could not access camera/mic. Check permissions.', 'error');
    }
}

function attemptCall() {
    if (!localStream) return;
    const call = peer.call(peerIdB, localStream);
    if (call) handleCallStream(call);
}

function answerCall(call) {
    if (localStream) {
        call.answer(localStream);
        handleCallStream(call);
    } else {
        navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
            localStream = stream;
            myVideo.srcObject = stream; myVideo.classList.add('active'); myPlaceholder.style.display = 'none';
            isInCall = true;
            startCallBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg> End Call`;
            startCallBtn.classList.add('end-call');
            call.answer(stream); handleCallStream(call);
        }).catch(() => toast('Could not access camera/mic.', 'error'));
    }
}

function handleCallStream(call) {
    call.on('stream', stream => {
        partnerVideo.srcObject = stream; partnerVideo.classList.add('active'); partnerPlaceholder.style.display = 'none';
    });
    call.on('close', () => {
        partnerVideo.srcObject = null; partnerVideo.classList.remove('active'); partnerPlaceholder.style.display = 'flex';
        toast('Call ended', 'info');
    });
}

function endCall() {
    if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
    myVideo.srcObject = null; myVideo.classList.remove('active'); myPlaceholder.style.display = 'flex';
    partnerVideo.srcObject = null; partnerVideo.classList.remove('active'); partnerPlaceholder.style.display = 'flex';
    isInCall = false;
    startCallBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg> Start Call`;
    startCallBtn.classList.remove('end-call');
    toast('Call ended', 'info');
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
async function handleSyncMessage(msg) {
    if (!msg || !msg.type) return;

    // ── PIN verification (first message exchanged) ─────
    if (msg.type === 'pin_verify') {
        if (msg.token !== roomPinToken()) {
            toast('🔒 Wrong PIN — unauthorized person tried to join!', 'error', 7000);
            dataConn.close();
            setStatus('disconnected', 'Unauthorized connection blocked');
        } else {
            // PIN matched — finalize connection
            setStatus('connected', 'Connected with partner 💫');
            partnerPlaceholderName.textContent = 'Partner 💫';
            toast('Partner connected! 🌙', 'success');
            ytSyncText.textContent = 'Partner connected 🌙';
            sendSync({ type: 'peer_name', name: myName });
        }
        return;
    }

    // ── Call coordination ─────────────────────────────
    if (msg.type === 'call_request') {
        if (peer.id === peerIdA) {
            if (localStream) attemptCall(); else startCall();
        } else {
            if (!localStream) {
                try {
                    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                    myVideo.srcObject = localStream; myVideo.classList.add('active'); myPlaceholder.style.display = 'none';
                    isInCall = true;
                    startCallBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg> End Call`;
                    startCallBtn.classList.add('end-call');
                } catch (e) { toast('Could not access camera/mic.', 'error'); }
            }
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
let playlist = [];

function loadPlaylist() {
    try { playlist = JSON.parse(localStorage.getItem(PLAYLIST_KEY) || '[]'); } catch (e) { playlist = []; }
    renderPlaylist();
}

function savePlaylist() {
    localStorage.setItem(PLAYLIST_KEY, JSON.stringify(playlist));
}

function renderPlaylist() {
    const container = document.getElementById('playlistItems');
    const empty = document.getElementById('playlistEmpty');
    const count = document.getElementById('playlistCount');
    count.textContent = playlist.length + (playlist.length === 1 ? ' song' : ' songs');
    if (playlist.length === 0) {
        container.innerHTML = ''; empty.style.display = 'block'; return;
    }
    empty.style.display = 'none';
    container.innerHTML = playlist.map((item, i) => `
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

document.getElementById('addToPlaylistBtn').addEventListener('click', async () => {
    if (!ytVideoId) return;
    if (playlist.find(p => p.videoId === ytVideoId)) { toast('Already in playlist!', 'info'); return; }
    const title = ytTrackTitle.textContent && ytTrackTitle.textContent !== '—'
        ? ytTrackTitle.textContent
        : ytVideoId;
    playlist.push({ videoId: ytVideoId, title, addedAt: Date.now() });
    savePlaylist();
    renderPlaylist();
    toast('Added to playlist! 📋', 'success');
});

window.playFromPlaylist = function (i) {
    const item = playlist[i];
    if (!item) return;
    loadYouTubeVideo(item.videoId, 0, true);
    sendSync({ type: 'yt_load', videoId: item.videoId, sentBy: myName });
};

window.deleteFromPlaylist = function (i) {
    playlist.splice(i, 1);
    savePlaylist();
    renderPlaylist();
};

// ─────────────────────────────────────────────────────
//  CINEMA MODE — fullscreen + auto-hide UI on idle
// ─────────────────────────────────────────────────────
let cinemaActive = false;
let cinemaTimer = null;

const cinemaBtn = document.getElementById('cinemaBtn');
cinemaBtn.addEventListener('click', toggleCinema);

// Also toggle on F key
document.addEventListener('keydown', e => {
    if (e.key === 'f' || e.key === 'F') { if (!e.target.matches('input,textarea')) toggleCinema(); }
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
    const hash = await hashRoomId(roomId);
    peerIdA = hash + 'a';
    peerIdB = hash + 'b';
    await setupPeer();
    loadPlaylist();

    const sendName = () => { if (dataConn && dataConn.open) sendSync({ type: 'peer_name', name: myName }); };
    setTimeout(sendName, 1500);
    setTimeout(sendName, 3500);
})();

