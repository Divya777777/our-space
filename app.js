/* =====================================================
   app.js — Index page logic
   ===================================================== */

// --- Star canvas ---
(function initStars() {
  const canvas = document.getElementById('starCanvas');
  const ctx = canvas.getContext('2d');
  let stars = [], W, H;
  function resize() {
    W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight;
    stars = [];
    for (let i = 0; i < 180; i++)
      stars.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.5 + 0.2, alpha: Math.random(), speed: Math.random() * 0.005 + 0.002, dir: Math.random() > 0.5 ? 1 : -1 });
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (const s of stars) { s.alpha += s.speed * s.dir; if (s.alpha >= 1 || s.alpha <= 0.05) s.dir *= -1; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fillStyle = `rgba(255,255,255,${s.alpha.toFixed(2)})`; ctx.fill(); }
    requestAnimationFrame(draw);
  }
  window.addEventListener('resize', resize); resize(); draw();
})();

// --- Shooting stars ---
(function () {
  const c = document.getElementById('shootingStars');
  function spawn() {
    const el = document.createElement('div'); el.className = 'shooting-star';
    el.style.setProperty('--angle', (Math.random() * 30 + 20) + 'deg');
    el.style.top = Math.random() * 60 + '%'; el.style.left = Math.random() * 80 + '%';
    el.style.animationDuration = (Math.random() * 0.8 + 0.6) + 's';
    c.appendChild(el); setTimeout(() => el.remove(), 1500);
  }
  setInterval(spawn, 2800); setTimeout(spawn, 600);
})();

// --- Recent rooms ---
const RECENT_KEY = 'ourspace_recent_rooms';

function getRecentRooms() {
  return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
}

function saveRecentRoom(name, room) {
  let recent = getRecentRooms().filter(r => r.room !== room);
  recent.unshift({ name, room, ts: Date.now() });
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 6)));
}

function renderRecentRooms() {
  const recent = getRecentRooms();
  const section = document.getElementById('recentSection');
  const container = document.getElementById('recentRooms');
  if (!recent.length) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  container.innerHTML = recent.map(r => `
    <button class="recent-room-btn" onclick="joinRecent('${escHtml(r.name)}','${escHtml(r.room)}')">
      <span class="recent-moon">🌙</span>
      <div class="recent-info">
        <div class="recent-room-name">${escHtml(r.name)}</div>
        <div class="recent-room-code">${escHtml(r.room)}</div>
      </div>
      <span class="recent-arrow">→</span>
    </button>
  `).join('');
}

function escHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

window.joinRecent = function (name, room) {
  document.getElementById('nameInput').value = name;
  document.getElementById('roomInput').value = room;
  document.getElementById('pinInput').focus();
  document.getElementById('pinInput').scrollIntoView({ behavior: 'smooth', block: 'center' });
};

renderRecentRooms();

// --- Room join ---
const adjectives = ['moonlit', 'starry', 'cosmic', 'dreamy', 'velvet', 'silver', 'golden', 'tender', 'mystic', 'lunar'];
const nouns = ['sky', 'night', 'orbit', 'comet', 'galaxy', 'nebula', 'moon', 'stars', 'dawn', 'twilight'];

document.getElementById('generateBtn').addEventListener('click', () => {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  document.getElementById('roomInput').value = `${adj}${noun}${Math.floor(Math.random() * 90) + 10}`;
});

document.getElementById('createBtn').addEventListener('click', () => {
  if (!document.getElementById('roomInput').value.trim()) {
    document.getElementById('generateBtn').click();
  }
  enterRoom(true);
});

document.getElementById('joinBtn').addEventListener('click', () => {
  enterRoom(false);
});
['nameInput', 'roomInput', 'pinInput'].forEach(id => {
  document.getElementById(id).addEventListener('keydown', e => { if (e.key === 'Enter') enterRoom(); });
});

function enterRoom(isCreating = false) {
  const name = document.getElementById('nameInput').value.trim();
  const room = document.getElementById('roomInput').value.trim().toLowerCase().replace(/\s+/g, '-');
  const pin = document.getElementById('pinInput').value.trim();
  if (!name) { shake('nameInput'); return; }
  if (!room) { shake('roomInput'); return; }
  saveRecentRoom(name, room);
  sessionStorage.setItem('ourspace_name', name);
  sessionStorage.setItem('ourspace_room', room);
  sessionStorage.setItem('ourspace_pin', pin);

  const btn = isCreating ? document.getElementById('createBtn') : document.getElementById('joinBtn');
  btn.innerHTML = '<span>Entering…</span>'; btn.disabled = true;
  setTimeout(() => { window.location.href = 'room.html'; }, 400);
}

function shake(id) {
  const el = document.getElementById(id).closest('.input-wrapper');
  el.style.animation = 'none'; el.offsetHeight; el.style.animation = 'shake 0.4s ease';
  document.getElementById(id).focus();
}
const s = document.createElement('style');
s.textContent = `@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}`;
document.head.appendChild(s);
