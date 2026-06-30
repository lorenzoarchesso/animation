/**
 * Girl on a Bench — Canvas 2D Animation
 * Duration: ~6 seconds  |  60 fps
 *
 * Scene (inspired by the reference images):
 *   0.0 – 2.5 s  →  girl walks from right edge toward the bench
 *   2.5 – 4.0 s  →  girl slows, leans on bench, sits down
 *   4.0 – 5.5 s  →  girl gently places the rose beside her on the bench
 *   5.5 – 6.0 s  →  hold / fade-out
 */

const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');
const W = canvas.width;   // 1280
const H = canvas.height;  // 720

// ─── Timing ─────────────────────────────────────────────────────────────────
const FPS      = 60;
const DURATION = 6.0;          // seconds
let   t        = 0;            // current time (seconds)
let   rafId    = null;
let   playing  = false;
let   lastTS   = null;

// ─── Colours (from the reference palette) ───────────────────────────────────
const CLR = {
  bg1:       '#f7c5cc',   // light pink fog top
  bg2:       '#c0556a',   // deeper rose bottom
  fog:       'rgba(255,200,210,0.45)',
  bench:     '#6b3a2a',
  benchDark: '#3d1f14',
  ground:    '#b8495e',
  groundRef: 'rgba(180,70,90,0.3)',
  petal:     '#f07090',
  petalDark: '#c0405a',
  skin:      '#f5dcc8',
  hair:      '#d4a050',
  hoodie:    '#5a5870',
  jeans:     '#8aaccc',
  shoe:      '#e8ddd0',
  rosePink:  '#f06080',
  roseGreen: '#4a8040',
};

// ─── Petals (static scatter on ground) ──────────────────────────────────────
const PETALS = Array.from({ length: 60 }, () => ({
  x: Math.random() * W,
  y: H * 0.72 + Math.random() * H * 0.28,
  r: 4 + Math.random() * 8,
  angle: Math.random() * Math.PI * 2,
}));

// ─── Bench geometry (centre-ish of canvas) ──────────────────────────────────
const BX = W * 0.5;   // bench centre x
const BY = H * 0.62;  // bench seat top y

// ─── Easing helpers ─────────────────────────────────────────────────────────
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// ─── Draw helpers ───────────────────────────────────────────────────────────

function drawBackground() {
  // Gradient sky / fog
  const gr = ctx.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0,   '#f9d0d8');
  gr.addColorStop(0.5, '#f0b0be');
  gr.addColorStop(1,   '#c06070');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, W, H);

  // Soft radial glow in the centre (like the backlight in the references)
  const glow = ctx.createRadialGradient(W / 2, H * 0.35, 40, W / 2, H * 0.35, W * 0.55);
  glow.addColorStop(0,   'rgba(255,240,230,0.8)');
  glow.addColorStop(0.5, 'rgba(255,200,210,0.3)');
  glow.addColorStop(1,   'rgba(255,200,210,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Misty ground plane
  const gnd = ctx.createLinearGradient(0, H * 0.68, 0, H);
  gnd.addColorStop(0, 'rgba(160,60,75,0.0)');
  gnd.addColorStop(1, 'rgba(120,40,55,0.7)');
  ctx.fillStyle = gnd;
  ctx.fillRect(0, H * 0.68, W, H * 0.32);

  // Wet-ground reflection strip
  ctx.save();
  ctx.globalAlpha = 0.25;
  const ref = ctx.createLinearGradient(0, H * 0.70, 0, H);
  ref.addColorStop(0, '#f0a0b0');
  ref.addColorStop(1, '#803040');
  ctx.fillStyle = ref;
  ctx.fillRect(0, H * 0.72, W, H * 0.08);
  ctx.restore();
}

function drawTreeFog() {
  // Left tree mass
  ctx.save();
  ctx.globalAlpha = 0.5;
  const lt = ctx.createRadialGradient(W * 0.05, H * 0.3, 10, W * 0.05, H * 0.3, W * 0.3);
  lt.addColorStop(0, 'rgba(140,40,55,0.6)');
  lt.addColorStop(1, 'rgba(140,40,55,0)');
  ctx.fillStyle = lt;
  ctx.fillRect(0, 0, W * 0.4, H);

  // Right tree mass
  const rt = ctx.createRadialGradient(W * 0.95, H * 0.3, 10, W * 0.95, H * 0.3, W * 0.3);
  rt.addColorStop(0, 'rgba(140,40,55,0.6)');
  rt.addColorStop(1, 'rgba(140,40,55,0)');
  ctx.fillStyle = rt;
  ctx.fillRect(W * 0.6, 0, W * 0.4, H);
  ctx.restore();
}

function drawPetals() {
  PETALS.forEach(p => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = CLR.petal;
    ctx.beginPath();
    ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

// ─── Bench ──────────────────────────────────────────────────────────────────
function drawBench() {
  const sw = 260;   // seat width
  const sh = 18;    // seat plank height
  const sx = BX - sw / 2;
  const sy = BY;

  // Legs
  ctx.fillStyle = CLR.benchDark;
  [sx + 20, sx + sw - 20].forEach(lx => {
    ctx.fillRect(lx - 6, sy + sh, 12, 80);
    // cross-brace
    ctx.fillRect(lx - 6, sy + sh + 50, 12, 8);
  });

  // Back legs extension to top
  [sx + 20, sx + sw - 20].forEach(lx => {
    ctx.fillRect(lx - 6, sy - 70, 10, 72);
  });

  // Seat planks (3)
  ctx.fillStyle = CLR.bench;
  for (let i = 0; i < 3; i++) {
    roundRect(sx, sy + i * (sh + 4), sw, sh, 4, CLR.bench);
  }

  // Back planks (2)
  for (let i = 0; i < 2; i++) {
    roundRect(sx, sy - 65 + i * (sh + 4), sw, sh, 4, CLR.bench);
  }

  // Post tops (cap)
  ctx.fillStyle = CLR.benchDark;
  [sx + 20, sx + sw - 20].forEach(lx => {
    roundRect(lx - 8, sy - 70, 14, 14, 3, CLR.benchDark);
  });
}

function roundRect(x, y, w, h, r, color) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

// ─── Rose ───────────────────────────────────────────────────────────────────
function drawRose(rx, ry, scale = 1) {
  ctx.save();
  ctx.translate(rx, ry);
  ctx.scale(scale, scale);

  // Stem
  ctx.strokeStyle = CLR.roseGreen;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 38);
  ctx.stroke();

  // Leaf
  ctx.fillStyle = CLR.roseGreen;
  ctx.beginPath();
  ctx.ellipse(-6, 20, 8, 4, -0.5, 0, Math.PI * 2);
  ctx.fill();

  // Petals
  const petals = [
    { dx: 0,  dy: 0,  rx: 9,  ry: 7  },
    { dx: 6,  dy: -3, rx: 8,  ry: 6  },
    { dx: -6, dy: -3, rx: 8,  ry: 6  },
    { dx: 0,  dy: -7, rx: 7,  ry: 6  },
    { dx: 0,  dy: 0,  rx: 6,  ry: 5  },
  ];
  petals.forEach((p, i) => {
    ctx.fillStyle = i === 4 ? '#f090a8' : CLR.rosePink;
    ctx.beginPath();
    ctx.ellipse(p.dx, p.dy, p.rx, p.ry, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Centre
  ctx.fillStyle = '#c03050';
  ctx.beginPath();
  ctx.arc(0, -2, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ─── Girl character ─────────────────────────────────────────────────────────
/**
 * gx      – character centre x
 * gy      – feet y
 * phase   – 'walk' | 'standbend' | 'sit'
 * walkT   – 0..1 walk cycle progress (for leg swing)
 * sitT    – 0..1 sit-down progress
 * roseT   – 0..1 rose-place progress
 * rosePos – {x,y} current rose position (world coords)
 */
function drawGirl(gx, gy, phase, walkT, sitT, roseT) {
  ctx.save();
  ctx.translate(gx, gy);

  const isWalking   = phase === 'walk';
  const isStandBend = phase === 'standbend';
  const isSitting   = phase === 'sit';

  // ── Leg swing angles ──────────────────────────────────────────────────────
  const legSwing = isWalking ? Math.sin(walkT * Math.PI * 2) * 0.38 : 0;

  // In sit phase legs fold under bench
  const sitFold = isSitting ? sitT : 0;

  // Body bob (only while walking)
  const bodyBob = isWalking ? Math.abs(Math.sin(walkT * Math.PI * 2)) * -4 : 0;

  // Lean forward while standing+bending (transitioning to sit)
  const leanFwd = isStandBend ? sitT * 0.25 : (isSitting ? 0.25 : 0);

  // Vertical offset for sitting (body drops onto bench)
  const sitDrop = isSitting ? sitT * 52 : (isStandBend ? 0 : 0);

  // Body Y base
  const baseY = bodyBob - sitDrop;

  // ── Shoe / feet Y relative to body ───────────────────────────────────────
  const footY = -8;

  // ── Left / right leg ─────────────────────────────────────────────────────
  function drawLeg(side) {
    const sign = side === 'L' ? 1 : -1;
    const sw   = sign * legSwing;

    ctx.save();
    if (isSitting) {
      // Sitting: legs hang forward
      ctx.translate(sign * 14, baseY - 20);
      ctx.rotate(0.3 * sign + sitFold * 0.9 * sign);
      // thigh
      ctx.fillStyle = CLR.jeans;
      ctx.beginPath();
      ctx.ellipse(0, 20, 9, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      // lower leg
      ctx.translate(0, 40);
      ctx.rotate(sitFold * 0.7 * sign);
      ctx.fillStyle = CLR.jeans;
      ctx.beginPath();
      ctx.ellipse(0, 16, 8, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      // shoe
      ctx.fillStyle = CLR.shoe;
      ctx.beginPath();
      ctx.ellipse(sign * 3, 34, 10, 6, 0.2 * sign, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.translate(sign * 12, baseY - 10);
      ctx.rotate(sw);
      // thigh
      ctx.fillStyle = CLR.jeans;
      ctx.beginPath();
      ctx.ellipse(0, 22, 9, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      // knee bend (opposite to swing)
      ctx.translate(0, 44);
      ctx.rotate(-sw * 0.5);
      ctx.fillStyle = CLR.jeans;
      ctx.beginPath();
      ctx.ellipse(0, 16, 8, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      // shoe
      ctx.fillStyle = CLR.shoe;
      ctx.beginPath();
      ctx.ellipse(sign * 4 + sw * 8, footY + 34, 11, 6, 0.2 * sign, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawLeg('R');
  drawLeg('L');

  // ── Torso ─────────────────────────────────────────────────────────────────
  ctx.save();
  ctx.translate(0, baseY);
  ctx.rotate(leanFwd);

  // Hoodie body
  ctx.fillStyle = CLR.hoodie;
  ctx.beginPath();
  ctx.ellipse(0, -68, 22, 38, 0, 0, Math.PI * 2);
  ctx.fill();
  // Hoodie lower (wider hips area)
  ctx.beginPath();
  ctx.ellipse(0, -42, 24, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── Arms ─────────────────────────────────────────────────────────────────
  const armSwing = isWalking ? -legSwing * 0.6 : 0;

  // Rose-holding arm (left arm from our view = right arm of the girl facing away)
  // While sitting, arm lowers to place rose
  const roseArmAngle = isSitting
    ? -0.4 + roseT * 0.9    // lowers toward bench
    : (isStandBend ? -0.3 : armSwing - 0.1);

  // Arms
  function drawArm(side, angle) {
    const sign = side === 'L' ? -1 : 1;
    ctx.save();
    ctx.translate(sign * 20, -88);
    ctx.rotate(angle);
    // upper arm
    ctx.fillStyle = CLR.hoodie;
    ctx.beginPath();
    ctx.ellipse(0, 14, 8, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    // forearm
    ctx.translate(0, 26);
    ctx.rotate(angle * 0.4);
    ctx.fillStyle = CLR.hoodie;
    ctx.beginPath();
    ctx.ellipse(0, 12, 7, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    // hand
    ctx.fillStyle = CLR.skin;
    ctx.beginPath();
    ctx.arc(0, 26, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawArm('R', armSwing + 0.15);   // right arm (our left)
  drawArm('L', roseArmAngle);      // left arm holds/places rose

  // ── Neck + Head ───────────────────────────────────────────────────────────
  // Neck
  ctx.fillStyle = CLR.skin;
  ctx.beginPath();
  ctx.ellipse(0, -108, 7, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.fillStyle = CLR.skin;
  ctx.beginPath();
  ctx.ellipse(0, -130, 19, 22, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── Curly hair ────────────────────────────────────────────────────────────
  ctx.fillStyle = CLR.hair;
  // Main hair mass (back)
  ctx.beginPath();
  ctx.ellipse(0, -128, 23, 26, 0, 0, Math.PI * 2);
  ctx.fill();

  // Flowing curls (long hair down the back)
  const curlOffsets = [
    { dx: -14, dy: -120, rx: 9,  ry: 30, a: -0.3 },
    { dx:  0,  dy: -112, rx: 11, ry: 34, a:  0   },
    { dx:  14, dy: -118, rx: 9,  ry: 28, a:  0.3 },
    { dx: -8,  dy: -98,  rx: 8,  ry: 22, a: -0.2 },
    { dx:  8,  dy: -95,  rx: 8,  ry: 22, a:  0.2 },
  ];
  curlOffsets.forEach(c => {
    ctx.save();
    ctx.translate(c.dx, c.dy);
    ctx.rotate(c.a);
    ctx.fillStyle = CLR.hair;
    ctx.beginPath();
    ctx.ellipse(0, 0, c.rx, c.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // Hair highlight
  ctx.fillStyle = '#e8c070';
  ctx.beginPath();
  ctx.ellipse(-4, -140, 10, 12, -0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore(); // torso transform
  ctx.restore(); // character transform
}

// ─── Rose world position ─────────────────────────────────────────────────────
/**
 * Returns the rose {x, y} given the current animation state.
 * While walking, rose is held at the girl's side.
 * While sitting+placing, rose transitions from hand to bench surface.
 */
function roseWorldPos(gx, gy, phase, walkT, sitT, roseT) {
  // Hand position approximation (left arm)
  const baseY  = phase === 'sit' ? -sitT * 52 : 0;
  const leanFwd = (phase === 'standbend' || phase === 'sit') ? 0.25 : 0;

  // Rough hand x,y in world space while carrying
  const handX = gx - 28;
  const handY = gy + baseY - 65;

  if (phase !== 'sit') return { x: handX, y: handY };

  // Bench placement target
  const benchRoseX = BX - 50;
  const benchRoseY = BY - 4;

  return {
    x: handX + (benchRoseX - handX) * roseT,
    y: handY + (benchRoseY - handY) * roseT,
  };
}

// ─── Main render ─────────────────────────────────────────────────────────────
function render(time) {
  ctx.clearRect(0, 0, W, H);

  // ── Background layers
  drawBackground();
  drawTreeFog();
  drawPetals();

  // ── Bench (drawn before girl so girl sits "on top")
  drawBench();

  // ── Compute girl state from time ─────────────────────────────────────────
  const GY = H * 0.77;   // feet ground Y

  let gx, phase, walkT = 0, sitT = 0, roseT = 0;

  // Walk phase: 0 → 2.5 s
  // Girl starts at right edge and walks to bench centre
  if (time <= 2.5) {
    const p = smoothstep(0, 2.5, time);
    const startX = W * 0.88;
    const endX   = BX + 30;   // stops just to the right of the bench
    gx    = startX + (endX - startX) * p;
    phase = 'walk';
    walkT = time * 2.2;        // walk cycle freq
  }

  // Stand-and-bend phase: 2.5 → 4.0 s (transition to sit)
  else if (time <= 4.0) {
    gx    = BX + 30;
    phase = 'standbend';
    sitT  = smoothstep(2.5, 4.0, time);
    walkT = 2.5 * 2.2;
  }

  // Sit + place rose phase: 4.0 → 5.5 s
  else if (time <= 5.5) {
    gx    = BX + 10;
    phase = 'sit';
    sitT  = 1;
    roseT = smoothstep(4.0, 5.5, time);
    walkT = 2.5 * 2.2;
  }

  // Hold: 5.5 → 6.0 s
  else {
    gx    = BX + 10;
    phase = 'sit';
    sitT  = 1;
    roseT = 1;
    walkT = 2.5 * 2.2;
  }

  // Rose position
  const rp = roseWorldPos(gx, GY, phase, walkT, sitT, roseT);

  // Draw rose behind the girl while walking, in front while placing
  const roseInFront = phase === 'sit' && roseT > 0.5;
  if (!roseInFront) drawRose(rp.x, rp.y, 1);

  // Draw girl
  drawGirl(gx, GY, phase, walkT, sitT, roseT);

  if (roseInFront) drawRose(rp.x, rp.y, 1);

  // ── Foreground fog veil
  const fgFog = ctx.createLinearGradient(0, H * 0.75, 0, H);
  fgFog.addColorStop(0,   'rgba(180,80,100,0)');
  fgFog.addColorStop(0.6, 'rgba(160,60,80,0.3)');
  fgFog.addColorStop(1,   'rgba(140,50,70,0.6)');
  ctx.fillStyle = fgFog;
  ctx.fillRect(0, H * 0.75, W, H * 0.25);

  // ── Fade-out overlay at end
  if (time > 5.5) {
    const alpha = smoothstep(5.5, 6.0, time);
    ctx.fillStyle = `rgba(180,80,100,${alpha * 0.7})`;
    ctx.fillRect(0, 0, W, H);
  }
}

// ─── Loop ────────────────────────────────────────────────────────────────────
function loop(ts) {
  if (!playing) return;
  if (lastTS !== null) {
    const dt = (ts - lastTS) / 1000;
    t = Math.min(t + dt, DURATION);
  }
  lastTS = ts;
  render(t);
  if (t < DURATION) {
    rafId = requestAnimationFrame(loop);
  } else {
    playing = false;
    lastTS  = null;
  }
}

function play() {
  if (playing) return;
  if (t >= DURATION) t = 0;
  playing = true;
  lastTS  = null;
  rafId   = requestAnimationFrame(loop);
}

function reset() {
  playing = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId  = null;
  lastTS = null;
  t      = 0;
  render(0);
}

// ─── Controls ────────────────────────────────────────────────────────────────
document.getElementById('btnPlay').addEventListener('click', play);
document.getElementById('btnReset').addEventListener('click', reset);

// Initial frame
render(0);
