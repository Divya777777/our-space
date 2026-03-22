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
const partnerVideoPanel = document.getElementById('partnerVideoPanel');
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
    [myVideoPanel, partnerVideoPanel].forEach(vp => {
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
            [myVideoPanel, partnerVideoPanel].forEach(vp => {
                originalParents.set(vp, { parent: vp.parentNode, next: vp.nextSibling });
                document.body.appendChild(vp);
                vp.classList.add('pip');
            });
        } else if (targetId === 'myVideoPanel') {
            originalParents.set(partnerVideoPanel, { parent: partnerVideoPanel.parentNode, next: partnerVideoPanel.nextSibling });
            document.body.appendChild(partnerVideoPanel);
            partnerVideoPanel.classList.add('pip');
        } else if (targetId === 'partnerVideoPanel') {
            originalParents.set(myVideoPanel, { parent: myVideoPanel.parentNode, next: myVideoPanel.nextSibling });
            document.body.appendChild(myVideoPanel);
            myVideoPanel.classList.add('pip');
        }
    });
});

// Allow clicking a PIP to swap and maximize it instead
[myVideoPanel, partnerVideoPanel].forEach(panel => {
    panel.addEventListener('click', (e) => {
        if (panel.classList.contains('pip')) {
            // Find the expand button for this panel and click it
            const btn = panel.querySelector('.expand-btn');
            if (btn) btn.click();
        }
    });
});



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
        partnerPlaceholderName.textContent = 'Waiting...';
        document.querySelector('.video-grid').classList.add('alone');
        endCall();
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
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: {
                noiseSuppression: true,
                echoCancellation: true,
                autoGainControl: true,
                googEchoCancellation: true,
                googAutoGainControl: true,
                googNoiseSuppression: true,
                googHighpassFilter: true
            }
        });
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
        navigator.mediaDevices.getUserMedia({
            video: true,
            audio: { noiseSuppression: true, echoCancellation: true, autoGainControl: true }
        }).then(stream => {
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
            document.querySelector('.video-grid').classList.remove('alone');
            toast('Partner connected! 🌙', 'success');
            ytSyncText.textContent = 'Partner connected 🌙';
            sendSync({ type: 'peer_name', name: myName });
            // Share our full playlist so partner sees everything we've saved
            if (playlist.length > 0) {
                sendSync({ type: 'playlist_sync', roomPlaylists });
            }
            // Sync our local Chat History to partner (in case they joined from a new device)
            if (chatDB_ready) {
                const tx = chatDB.transaction('messages', 'readonly');
                const req = tx.objectStore('messages').getAll();
                req.onsuccess = () => {
                    if (req.result && req.result.length > 0) {
                        sendSync({ type: 'chat_history_sync', messages: req.result });
                    }
                };
            }
        }
    }

    // ── Secure Chat History Sync ──────────────────────────────
    if (msg.type === 'chat_history_sync') {
        if (!chatDB_ready || !msg.messages || msg.messages.length === 0) return;

        const tx = chatDB.transaction('messages', 'readwrite');
        const store = tx.objectStore('messages');
        let addedNew = false;

        msg.messages.forEach(chatMsg => {
            const req = store.get(chatMsg.id);
            req.onsuccess = () => {
                if (!req.result) {
                    store.put(chatMsg);
                    addedNew = true;
                }
            };
        });

        tx.oncomplete = () => {
            if (addedNew) {
                loadChatHistory();
                toast('Chat history securely synced from partner device! 🔄', 'success');
            }
        };
        return;
    }

    // ── Secure Chat Messaging ─────────────────────────────────
    if (msg.type === 'chat_msg') {
        const chatMsg = msg.message;
        chatMsg.senderLabel = msg.sentBy || "Partner";
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

    // ── Call coordination ─────────────────────────────
    if (msg.type === 'call_request') {
        if (peer.id === peerIdA) {
            if (localStream) attemptCall(); else startCall();
        } else {
            if (!localStream) {
                try {
                    localStream = await navigator.mediaDevices.getUserMedia({
                        video: true,
                        audio: {
                            noiseSuppression: true,
                            echoCancellation: true,
                            autoGainControl: true,
                            googEchoCancellation: true,
                            googAutoGainControl: true,
                            googNoiseSuppression: true,
                            googHighpassFilter: true
                        }
                    });
                    myVideo.srcObject = localStream; myVideo.classList.add('active'); myPlaceholder.style.display = 'none';
                    isInCall = true;
                    startCallBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg> End Call`;
                    startCallBtn.classList.add('end-call');
                } catch (e) { toast('Could not access camera/mic.', 'error'); }
            }
        }
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

function loadPlaylist() {
    try {
        const parsedRoom = JSON.parse(localStorage.getItem(PLAYLIST_KEY));
        if (Array.isArray(parsedRoom)) roomPlaylists = { "Room Playlist": parsedRoom };
        else if (parsedRoom && typeof parsedRoom === 'object') roomPlaylists = parsedRoom;
    } catch (e) { }

    try {
        const parsedPersonal = JSON.parse(localStorage.getItem(PERSONAL_PLAYLIST_KEY));
        if (Array.isArray(parsedPersonal)) personalPlaylists = { "My Playlist": parsedPersonal };
        else if (parsedPersonal && typeof parsedPersonal === 'object') personalPlaylists = parsedPersonal;
    } catch (e) { }

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

function savePlaylist() {
    localStorage.setItem(PLAYLIST_KEY, JSON.stringify(roomPlaylists));
    localStorage.setItem(PERSONAL_PLAYLIST_KEY, JSON.stringify(personalPlaylists));
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
    const hash = await hashRoomId(roomId);
    peerIdA = hash + 'a';
    peerIdB = hash + 'b';
    await setupPeer();
    loadPlaylist();

    const sendName = () => { if (dataConn && dataConn.open) sendSync({ type: 'peer_name', name: myName }); };
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

function loadChatHistory() {
    if (!chatDB) return;
    const tx = chatDB.transaction('messages', 'readonly');
    const store = tx.objectStore('messages');
    const req = store.getAll();
    req.onsuccess = () => {
        const msgs = req.result;
        const container = document.getElementById('chatMessages');
        container.innerHTML = '';
        msgs.forEach(msg => appendChatMessage(msg, false));
        container.scrollTop = container.scrollHeight;
    };
}

function appendChatMessage(msg, saveToDb = true) {
    if (saveToDb && chatDB) {
        const tx = chatDB.transaction('messages', 'readwrite');
        tx.objectStore('messages').put(msg);
    }

    const container = document.getElementById('chatMessages');
    const div = document.createElement('div');
    const isMe = msg.sender === myName;
    div.className = `chat-msg ${isMe ? 'me' : 'partner'}`;
    div.dataset.chatId = msg.id;

    let contentHtml = '';
    if (msg.type === 'image') {
        contentHtml = `<img src="${msg.content}" class="chat-img-preview" alt="Image" />`;
    } else if (msg.type === 'file') {
        contentHtml = `<a href="${msg.content}" download="${msg.fileName}" class="chat-file-preview" target="_blank">📄 ${msg.fileName}</a>`;
    } else {
        const safeText = msg.content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        contentHtml = `<span>${safeText}</span>`;
    }

    const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    div.innerHTML = `
        <div class="chat-bubble">${contentHtml}</div>
        <div class="chat-meta">
            <span>${isMe ? 'You' : msg.senderLabel}</span>
            <span>${timeStr}</span>
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
    const msg = {
        id: Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        sender: myName,
        sentBy: myName,
        senderLabel: myName,
        type: type,
        content: type === 'text' ? text : fileData,
        fileName: fileName,
        timestamp: Date.now()
    };
    appendChatMessage(msg, true);
    sendSync({ type: 'chat_msg', message: msg, sentBy: myName });
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
