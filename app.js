/* =====================================================
   app.js — Index page logic
   ===================================================== */

// --- Star canvas ---
(function initStars() {
  const canvas = document.getElementById('starCanvas');
  const ctx = canvas.getContext('2d');
  let stars = [];
  let W, H;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    stars = [];
    for (let i = 0; i < 180; i++) {
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

// --- Shooting stars ---
(function initShootingStars() {
  const container = document.getElementById('shootingStars');
  function spawnStar() {
    const el = document.createElement('div');
    el.className = 'shooting-star';
    const angle = Math.random() * 30 + 20;
    el.style.setProperty('--angle', angle + 'deg');
    el.style.top  = Math.random() * 60 + '%';
    el.style.left = Math.random() * 80 + '%';
    el.style.animationDuration = (Math.random() * 0.8 + 0.6) + 's';
    container.appendChild(el);
    setTimeout(() => el.remove(), 1500);
  }
  setInterval(spawnStar, 2800);
  setTimeout(spawnStar, 600);
})();

// --- Room join logic ---
const adjectives = ['moonlit','starry','cosmic','dreamy','velvet','silver','golden','tender','mystic','lunar'];
const nouns      = ['sky','night','orbit','comet','galaxy','nebula','moon','stars','dawn','twilight'];

document.getElementById('generateBtn').addEventListener('click', () => {
  const adj  = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num  = Math.floor(Math.random() * 90) + 10;
  document.getElementById('roomInput').value = `${adj}-${noun}-${num}`;
});

document.getElementById('enterBtn').addEventListener('click', enterRoom);
document.getElementById('roomInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') enterRoom();
});
document.getElementById('nameInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') enterRoom();
});

function enterRoom() {
  const name = document.getElementById('nameInput').value.trim();
  const room = document.getElementById('roomInput').value.trim().toLowerCase().replace(/\s+/g, '-');

  if (!name) {
    shakeInput('nameInput');
    return;
  }
  if (!room) {
    shakeInput('roomInput');
    return;
  }

  // Store in session
  sessionStorage.setItem('ourspace_name', name);
  sessionStorage.setItem('ourspace_room', room);

  // Animate button
  const btn = document.getElementById('enterBtn');
  btn.innerHTML = '<span>Entering…</span>';
  btn.disabled = true;

  setTimeout(() => {
    window.location.href = `room.html`;
  }, 400);
}

function shakeInput(id) {
  const el = document.getElementById(id);
  el.parentElement.style.animation = 'none';
  el.parentElement.offsetHeight; // reflow
  el.parentElement.style.animation = 'shake 0.4s ease';
  el.focus();
}

// Add shake keyframe dynamically
const style = document.createElement('style');
style.textContent = `
  @keyframes shake {
    0%,100% { transform: translateX(0); }
    20%      { transform: translateX(-8px); }
    40%      { transform: translateX(8px); }
    60%      { transform: translateX(-5px); }
    80%      { transform: translateX(5px); }
  }
`;
document.head.appendChild(style);
