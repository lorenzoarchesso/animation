/* =============================================================================
 *  THE ROSE ON THE BENCH  —  cinematic 2D canvas animation
 *  A girl walks in, sits on a park bench and lays a rose beside her.
 *  Inspired by the reference frames: backlit pink mist, curly blonde hair,
 *  charcoal hoodie, baggy light jeans, white sneakers, a single pink rose.
 *
 *  Techniques used (the "professional" part):
 *   · skeletal rig + 2-bone inverse kinematics for limbs
 *   · tapered vector ribbons (smooth silhouettes, not stacked ellipses)
 *   · back-light rim glow on every body part
 *   · curly hair with delayed secondary motion
 *   · choreography driven by eased keyframes (anticipation / settle / breathe)
 *   · layered atmosphere: volumetric god-rays, drifting fog, depth-blurred trees
 *   · wet-ground mirror reflection of the whole character + bench
 *   · floating + grounded petals, soft contact shadows
 *   · slow cinematic camera push-in
 * ========================================================================== */

const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');
const W = canvas.width;    // 1280
const H = canvas.height;   // 720

/* ─── Timeline ─────────────────────────────────────────────────────────── */
const T = {
  walkEnd:  2.6,   // arrives at the bench
  sitStart: 3.15,
  sitEnd:   4.35,  // fully seated
  reachA:   4.30,  // start lowering the rose
  reachB:   5.15,  // rose touches the seat
  retreatA: 5.20,  // hand comes back
  retreatB: 5.85,
  end:      6.2,
};
const HOLD = 0.9;                       // freeze before the loop restarts
const CYCLE = T.end + HOLD;

/* ─── Scene geometry ───────────────────────────────────────────────────── */
const GROUND   = H * 0.85;              // standing foot line
const BX       = W * 0.50;             // bench centre x
const SEAT_Y   = H * 0.74;             // bench seat top
const BENCH_HW = 158;                  // bench half width
const STAND_PY = GROUND - 132;         // standing pelvis y
const SEAT_PY  = SEAT_Y + 10;          // seated pelvis y

/* ─── Character scale + bone lengths (already scaled) ──────────────────── */
const S = 1.30;
const L = {
  thigh: 58*S, shin: 56*S,
  uArm: 40*S,  fArm: 38*S,
  hipHW: 12*S, shHW: 18*S,
  torso: 74*S, neckHead: 18*S, headR: 20*S,
  bodyHipHW: 23*S, bodyChestHW: 25*S, shOuter: 25*S,
};
const STRIDE = 44, LIFT = 14, BOB = 7, STEP_F = 1.9;

/* ─── Palette ──────────────────────────────────────────────────────────── */
const C = {
  hoodieHi: '#4a4a57', hoodieLo: '#2a2a33',
  jeansHi:  '#9fb6d2', jeansLo:  '#6f8aac',
  shoe:     '#ece4d7', shoeLo: '#cdbfa8',
  skin:     '#e7bd9f',
  hairHi:   '#e7c074', hairMid: '#c79a4f', hairLo: '#8f6630',
  hairGlow: '#ffe6a0',
  rose:     '#e9637f', roseHi: '#f4a0b0', roseCore: '#b23a57',
  stem:     '#4f7f3f', stemHi: '#6fa45a',
  rim:      'rgba(255,206,220,0.55)',
  rimGlow:  'rgba(255,190,210,0.85)',
};

/* ─── Math helpers ─────────────────────────────────────────────────────── */
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const lerp  = (a,b,t)=>a+(b-a)*t;
const lerpP = (a,b,t)=>({x:lerp(a.x,b.x,t), y:lerp(a.y,b.y,t)});
const easeInOutCubic = x => x<0.5 ? 4*x*x*x : 1-Math.pow(-2*x+2,3)/2;
const easeOutCubic   = x => 1-Math.pow(1-x,3);
const easeInOutSine  = x => -(Math.cos(Math.PI*x)-1)/2;
function smooth(a,b,x){ const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); }
const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y});
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
function unit(v){ const m=Math.hypot(v.x,v.y)||1; return {x:v.x/m,y:v.y/m}; }
function perp(a,b){ const d=unit(sub(b,a)); return {x:-d.y,y:d.x}; }

/* 2-bone inverse kinematics: root → joint → end, bendSign picks the elbow */
function ik(root, target, l1, l2, bendSign){
  let d = Math.hypot(target.x-root.x, target.y-root.y);
  d = clamp(d, Math.abs(l1-l2)+0.001, (l1+l2)*0.999);
  const a = Math.atan2(target.y-root.y, target.x-root.x);
  const ca = clamp((l1*l1 + d*d - l2*l2)/(2*l1*d), -1, 1);
  const ang = a + bendSign*Math.acos(ca);
  const joint = { x: root.x+Math.cos(ang)*l1, y: root.y+Math.sin(ang)*l1 };
  const end   = { x: root.x+Math.cos(a)*d,    y: root.y+Math.sin(a)*d };
  return { joint, end };
}

/* ─── Petals (depth-sorted; some grounded, some drifting) ──────────────── */
const PETALS = Array.from({length: 46}, () => {
  const ground = Math.random() < 0.6;
  return {
    ground,
    x: Math.random()*W,
    y: ground ? GROUND + Math.random()*(H-GROUND)*0.9 : Math.random()*H*0.7,
    z: 0.4 + Math.random()*0.9,                 // depth → size & speed
    rot: Math.random()*Math.PI*2,
    spin: (Math.random()-0.5)*0.6,
    sway: Math.random()*Math.PI*2,
    fall: 14 + Math.random()*22,
  };
});

/* =============================================================================
 *  ENVIRONMENT
 * ========================================================================== */
function drawSky(){
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#f8d3da'); g.addColorStop(0.42,'#f0aebb');
  g.addColorStop(0.72,'#dd8a9c'); g.addColorStop(1,'#b86577');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);

  // warm back-light bloom (the sun behind the mist)
  const glow = ctx.createRadialGradient(W*0.5,H*0.34,20, W*0.5,H*0.34,W*0.62);
  glow.addColorStop(0,'rgba(255,247,236,0.95)');
  glow.addColorStop(0.35,'rgba(255,214,221,0.45)');
  glow.addColorStop(1,'rgba(255,214,221,0)');
  ctx.fillStyle=glow; ctx.fillRect(0,0,W,H);
}

function drawGodRays(now){
  ctx.save();
  ctx.globalCompositeOperation='lighter';
  const cx=W*0.5, cy=H*0.30;
  for(let i=0;i<9;i++){
    const a = -Math.PI/2 + (i-4)*0.12 + Math.sin(now*0.0003+i)*0.015;
    const len = H*1.25, spread = 0.045 + (i%2)*0.02;
    const flick = 0.05 + 0.035*Math.sin(now*0.0011 + i*1.7);
    ctx.save();
    ctx.translate(cx,cy); ctx.rotate(a);
    const grd=ctx.createLinearGradient(0,0,0,len);
    grd.addColorStop(0,`rgba(255,246,232,${flick})`);
    grd.addColorStop(1,'rgba(255,246,232,0)');
    ctx.fillStyle=grd;
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.lineTo(-len*spread,len);
    ctx.lineTo( len*spread,len);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawTrees(){
  ctx.save();
  ctx.filter='blur(18px)';
  // left + right blurred foliage masses for depth
  [[W*0.04,'rgba(150,62,80,0.55)'],[W*0.97,'rgba(150,62,80,0.55)']].forEach(([x,col])=>{
    const g=ctx.createRadialGradient(x,H*0.32,10,x,H*0.32,W*0.34);
    g.addColorStop(0,col); g.addColorStop(1,'rgba(150,62,80,0)');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  });
  // a few soft canopy blobs
  ctx.fillStyle='rgba(168,70,90,0.35)';
  const blobs=[[60,120,90],[150,90,70],[1180,130,95],[1110,80,60],[40,260,80]];
  blobs.forEach(([x,y,r])=>{ ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill(); });
  ctx.filter='none';
  ctx.restore();
}

function drawFog(now){
  ctx.save();
  ctx.globalCompositeOperation='screen';
  for(let i=0;i<3;i++){
    const y = H*(0.5+i*0.14);
    const off = (now*0.012*(i+1)) % (W+400) - 200;
    const g=ctx.createRadialGradient(off,y,10,off,y,420);
    g.addColorStop(0,`rgba(255,225,232,${0.18-i*0.03})`);
    g.addColorStop(1,'rgba(255,225,232,0)');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    const g2=ctx.createRadialGradient(W-off,y+30,10,W-off,y+30,460);
    g2.addColorStop(0,`rgba(255,220,228,${0.14-i*0.02})`);
    g2.addColorStop(1,'rgba(255,220,228,0)');
    ctx.fillStyle=g2; ctx.fillRect(0,0,W,H);
  }
  ctx.restore();
}

function drawGround(){
  const g=ctx.createLinearGradient(0,GROUND-40,0,H);
  g.addColorStop(0,'rgba(150,60,78,0)');
  g.addColorStop(0.25,'rgba(150,62,80,0.55)');
  g.addColorStop(1,'rgba(96,40,54,0.92)');
  ctx.fillStyle=g; ctx.fillRect(0,GROUND-40,W,H-GROUND+40);

  // wet sheen highlight near the horizon line
  ctx.save(); ctx.globalCompositeOperation='screen';
  const s=ctx.createLinearGradient(0,GROUND-10,0,GROUND+70);
  s.addColorStop(0,'rgba(255,225,232,0.30)');
  s.addColorStop(1,'rgba(255,225,232,0)');
  ctx.fillStyle=s; ctx.fillRect(0,GROUND-10,W,80);
  ctx.restore();
}

function drawPetals(now){
  PETALS.forEach(p=>{
    if(!p.ground){
      p.y += p.fall*0.016*p.z;
      p.x += Math.sin(now*0.001 + p.sway)*0.5;
      p.rot += p.spin*0.02;
      if(p.y>H+10){ p.y=-10; p.x=Math.random()*W; }
    }
    const sz=4*p.z + (p.ground?2:0);
    ctx.save();
    ctx.translate(p.x,p.y); ctx.rotate(p.rot);
    ctx.globalAlpha = p.ground?0.85:0.7;
    const g=ctx.createLinearGradient(-sz,0,sz,0);
    g.addColorStop(0,'#d85f7c'); g.addColorStop(1,'#f29ab0');
    ctx.fillStyle=g;
    ctx.beginPath();
    ctx.moveTo(0,-sz);
    ctx.bezierCurveTo(sz,-sz, sz, sz*0.6, 0, sz);
    ctx.bezierCurveTo(-sz, sz*0.6, -sz,-sz, 0,-sz);
    ctx.fill();
    ctx.restore();
  });
}

/* ─── Bench ────────────────────────────────────────────────────────────── */
function drawBench(){
  const x0=BX-BENCH_HW, x1=BX+BENCH_HW;
  const wood=(y,h,light)=>{
    const g=ctx.createLinearGradient(0,y,0,y+h);
    g.addColorStop(0, light?'#7a4632':'#5e3625');
    g.addColorStop(0.5,'#4a2a1c');
    g.addColorStop(1,'#341d13');
    ctx.fillStyle=g;
  };
  const plank=(x,y,w,h,light)=>{ wood(y,h,light); roundRect(x,y,w,h,5); ctx.fill();
    // top rim light
    ctx.save(); ctx.globalCompositeOperation='screen';
    ctx.fillStyle='rgba(255,210,200,0.18)'; roundRect(x,y,w,Math.max(2,h*0.28),5); ctx.fill();
    ctx.restore();
  };

  // back legs / posts
  ctx.fillStyle='#311a11';
  [x0+26,x1-26].forEach(lx=>{ roundRect(lx-6,SEAT_Y-86,12,88,3); ctx.fill(); });
  // backrest planks
  plank(x0, SEAT_Y-86, BENCH_HW*2, 16, true);
  plank(x0, SEAT_Y-60, BENCH_HW*2, 16, false);
  // post caps
  ctx.fillStyle='#241008';
  [x0+26,x1-26].forEach(lx=>{ roundRect(lx-9,SEAT_Y-92,18,12,3); ctx.fill(); });

  // front legs
  ctx.fillStyle='#2a1610';
  [x0+30,x1-30].forEach(lx=>{ roundRect(lx-6,SEAT_Y+14,12,70,3); ctx.fill();
    roundRect(lx-6,SEAT_Y+54,12,7,2); ctx.fill(); });

  // seat planks (front-most last)
  plank(x0, SEAT_Y,    BENCH_HW*2, 15, true);
  plank(x0, SEAT_Y+15, BENCH_HW*2, 15, false);
}

function roundRect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

/* =============================================================================
 *  ROSE
 * ========================================================================== */
function drawRose(x,y,ang,scale){
  ctx.save();
  ctx.translate(x,y); ctx.rotate(ang); ctx.scale(scale,scale);

  // stem
  const sg=ctx.createLinearGradient(0,0,0,46);
  sg.addColorStop(0,C.stemHi); sg.addColorStop(1,C.stem);
  ctx.strokeStyle=sg; ctx.lineWidth=3.2; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(0,6); ctx.quadraticCurveTo(2,28,0,48); ctx.stroke();

  // leaves
  ctx.fillStyle=C.stem;
  [[-1,24,-0.7],[1,34,0.7]].forEach(([sx,sy,r])=>{
    ctx.save(); ctx.translate(sx*0.5,sy); ctx.rotate(r);
    ctx.beginPath(); ctx.ellipse(sx*7,0,9,4.2,0,0,7); ctx.fill();
    ctx.restore();
  });

  // bloom — layered petals
  const layer=(rad,col,n,off)=>{
    ctx.fillStyle=col;
    for(let i=0;i<n;i++){
      const a=off+i/n*Math.PI*2;
      ctx.save(); ctx.rotate(a);
      ctx.beginPath(); ctx.ellipse(0,-rad*0.55,rad*0.62,rad,0,0,7); ctx.fill();
      ctx.restore();
    }
  };
  layer(11,C.rose,6,0);
  layer(8, C.roseHi,5,0.5);
  ctx.fillStyle=C.roseCore;
  ctx.beginPath(); ctx.arc(0,-1,4.5,0,7); ctx.fill();
  // soft glow
  ctx.save(); ctx.globalCompositeOperation='screen';
  const rg=ctx.createRadialGradient(0,-2,1,0,-2,16);
  rg.addColorStop(0,'rgba(255,180,200,0.5)'); rg.addColorStop(1,'rgba(255,180,200,0)');
  ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(0,-2,16,0,7); ctx.fill();
  ctx.restore();

  ctx.restore();
}

/* =============================================================================
 *  CHARACTER RIG  (build → draw)
 * ========================================================================== */
function buildState(t){
  /* --- horizontal travel + walk cycle ------------------------------------ */
  const X_START=W*0.96, X_SIT=BX+34;
  const wp = easeInOutCubic(smooth(0,T.walkEnd,t));
  const gx = lerp(X_START, X_SIT, wp);
  const walkAmt = 1 - smooth(T.walkEnd-0.2, T.walkEnd+0.15, t);
  const phase = Math.min(t,T.walkEnd) * STEP_F;
  const th = phase*Math.PI*2;

  /* --- sit + pelvis height ------------------------------------------------ */
  const sit = easeInOutCubic(smooth(T.sitStart,T.sitEnd,t));
  const bob = -BOB*walkAmt*Math.abs(Math.sin(th));
  const antic = 5*Math.sin(Math.PI*smooth(T.sitStart-0.28,T.sitStart,t)) * (1-sit); // tiny counter-rise
  const pelvisY = lerp(STAND_PY+bob-antic, SEAT_PY, sit);
  const breathe = Math.sin(t*1.8)*1.4*sit;     // gentle seated breathing
  const pelvis = { x:gx, y:pelvisY+breathe };

  /* --- torso lean --------------------------------------------------------- */
  const walkLean = 0.05*walkAmt;
  const sitLean  = 0.20*Math.sin(Math.PI*sit);  // lean forward then settle
  const reach    = easeInOutCubic(smooth(T.reachA,T.reachB,t));
  const reachLean= 0.12*Math.sin(Math.PI*reach);
  const lean = walkLean + sitLean + reachLean;

  /* --- upper body FK (rotate about pelvis by lean) ------------------------ */
  const rot=(p,a)=>({ x:pelvis.x + p.x*Math.cos(a)-p.y*Math.sin(a),
                      y:pelvis.y + p.x*Math.sin(a)+p.y*Math.cos(a) });
  const neck   = rot({x:0,y:-L.torso}, lean);
  const chest  = rot({x:0,y:-L.torso*0.5}, lean);
  const shL    = rot({x: L.shHW, y:-L.torso*0.92}, lean);
  const shR    = rot({x:-L.shHW, y:-L.torso*0.92}, lean);
  const headC  = rot({x:0,y:-L.torso-L.neckHead}, lean);

  /* --- legs via IK to foot targets --------------------------------------- */
  function leg(sgn, off){
    const hip = { x:pelvis.x + sgn*L.hipHW, y:pelvis.y+3 };
    // walking foot trajectory + IK (knee bends toward forward = -x)
    const s = Math.sin(th+off);
    const lift = LIFT*Math.max(0,-Math.cos(th+off));
    const walkFoot = { x: pelvis.x + sgn*14*S + walkAmt*s*STRIDE*0.5,
                       y: GROUND - walkAmt*lift };
    const standFoot= { x: pelvis.x + sgn*14*S, y: GROUND };
    const wFoot = lerpP(standFoot, walkFoot, walkAmt);
    const rW = ik(hip, wFoot, L.thigh, L.shin, -1);
    // seated (back view): shins drop ~straight to the floor, thighs hidden by hem
    const seatKnee  = { x: pelvis.x + sgn*11*S, y: pelvis.y + 34*S };
    const seatAnkle = { x: pelvis.x + sgn*12*S, y: GROUND };
    const knee  = lerpP(rW.joint, seatKnee,  sit);
    const ankle = lerpP(rW.end,   seatAnkle, sit);
    return { hip, knee, ankle, foot:ankle, sgn };
  }
  const legFar  = leg(+1, Math.PI);   // far leg (our right) drawn first
  const legNear = leg(-1, 0);

  /* --- arms --------------------------------------------------------------- */
  // right arm carries / places the rose
  const carryR = add(shR, {x: 4+6*walkAmt*Math.sin(th+Math.PI), y: (L.uArm+L.fArm)*0.94});
  const seatRose = { x: BX-58, y: SEAT_Y-3 };
  const restR  = add(shR, {x: 10, y:(L.uArm+L.fArm)*0.72});  // hand on thigh
  const retreat= easeInOutCubic(smooth(T.retreatA,T.retreatB,t));
  let handR = lerpP(carryR, seatRose, reach);
  handR = lerpP(handR, restR, retreat);
  const armR = ik(shR, handR, L.uArm, L.fArm, +1);

  // left arm swings while walking, rests on lap when seated
  const carryL = add(shL, {x:-4+6*walkAmt*Math.sin(th), y:(L.uArm+L.fArm)*0.95});
  const restL  = add(shL, {x:-8, y:(L.uArm+L.fArm)*0.72});
  const handL  = lerpP(carryL, restL, sit);
  const armL   = ik(shL, handL, L.uArm, L.fArm, -1);

  /* --- rose state --------------------------------------------------------- */
  const placed = reach > 0.985;
  const rose = placed
    ? { x: seatRose.x, y: SEAT_Y-1, ang: 1.35, scale: 1 }   // lying on the seat
    : { x: handR.x, y: handR.y-2, ang: lean*0.3, scale: 1 };

  /* --- hair sway (delayed secondary motion) ------------------------------ */
  const hairSway = Math.sin(t*2.1-0.6)*0.10*walkAmt + Math.sin(t*1.3)*0.04 + lean*0.5;

  return { pelvis, chest, neck, shL, shR, headC, legFar, legNear,
           armL, armR, handL, handR, lean, sit, hairSway, rose, walkAmt };
}

/* tapered limb ribbon through a→b→c with widths wa,wb,wc */
function limb(a,b,c, wa,wb,wc, fill, withRim=true){
  const pa=perp(a,b), pc=perp(b,c);
  const pb=unit(add(pa,pc));
  const aL=add(a,{x:pa.x*wa,y:pa.y*wa}), aR=sub(a,{x:pa.x*wa,y:pa.y*wa});
  const bL=add(b,{x:pb.x*wb,y:pb.y*wb}), bR=sub(b,{x:pb.x*wb,y:pb.y*wb});
  const cL=add(c,{x:pc.x*wc,y:pc.y*wc}), cR=sub(c,{x:pc.x*wc,y:pc.y*wc});
  ctx.beginPath();
  ctx.moveTo(aL.x,aL.y);
  ctx.quadraticCurveTo(bL.x,bL.y, cL.x,cL.y);
  ctx.lineTo(cR.x,cR.y);
  ctx.quadraticCurveTo(bR.x,bR.y, aR.x,aR.y);
  ctx.closePath();
  ctx.fillStyle=fill; ctx.fill();
  if(withRim){
    ctx.save();
    ctx.strokeStyle=C.rim; ctx.lineWidth=1.6;
    ctx.shadowColor=C.rimGlow; ctx.shadowBlur=8;
    ctx.stroke();
    ctx.restore();
  }
}

function gradFor(p0,p1,hi,lo){
  const g=ctx.createLinearGradient(p0.x,p0.y,p1.x,p1.y);
  g.addColorStop(0,hi); g.addColorStop(1,lo); return g;
}

function drawCharacter(st){
  const {pelvis,neck,chest,shL,shR,headC,legFar,legNear,armL,armR,lean,hairSway} = st;

  /* far leg (slightly darker for depth) */
  drawLeg(legFar, '#5c7494','#566f8e');
  /* far arm (behind torso) */
  drawArm(armL, shL, st.handL, false);

  /* near leg */
  drawLeg(legNear, C.jeansHi, C.jeansLo);

  /* torso / hoodie */
  drawHoodie(st);

  /* hair over the upper back */
  drawHair(st);

  /* near arm (rose arm, in front) */
  drawArm(armR, shR, st.handR, true);

  /* rose */
  drawRose(st.rose.x, st.rose.y, st.rose.ang, st.rose.scale);
}

function drawLeg(leg, hi, lo){
  const {hip,knee,ankle,sgn}=leg;
  // baggy jeans from behind: wide thighs, slight taper at knee
  limb(hip,knee,ankle, 14*S,12*S,10*S, gradFor(hip,ankle,hi,lo));
  // back-view sneaker: heel faces the viewer
  ctx.save();
  ctx.translate(ankle.x, ankle.y+1);
  ctx.scale(sgn<0?1:-1, 1);
  const g=ctx.createLinearGradient(0,-7,0,9);
  g.addColorStop(0,C.shoe); g.addColorStop(1,C.shoeLo);
  ctx.fillStyle=g;
  ctx.beginPath();
  ctx.moveTo(10,-7);                        // heel top
  ctx.quadraticCurveTo(14,-1,12,5);         // rounded heel (prominent from behind)
  ctx.lineTo(-12,5);                        // toe end
  ctx.quadraticCurveTo(-16,6,-14,8);
  ctx.lineTo(9,9);
  ctx.quadraticCurveTo(13,9,12,5);
  ctx.closePath(); ctx.fill();
  // heel counter detail (stiffened back panel of shoe)
  ctx.fillStyle='rgba(220,210,195,0.52)';
  ctx.beginPath();
  ctx.moveTo(10,-5); ctx.quadraticCurveTo(13,0,11,5);
  ctx.lineTo(7,5); ctx.quadraticCurveTo(10,0,9,-4);
  ctx.closePath(); ctx.fill();
  // white sole edge
  ctx.fillStyle='rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.moveTo(-14,8); ctx.lineTo(9,9);
  ctx.quadraticCurveTo(13,10,11,13); ctx.lineTo(-14,12);
  ctx.quadraticCurveTo(-17,11,-14,8); ctx.closePath(); ctx.fill();
  ctx.strokeStyle=C.rim; ctx.lineWidth=1.2; ctx.shadowColor=C.rimGlow; ctx.shadowBlur=5;
  ctx.stroke();
  ctx.restore();
}

function drawArm(arm, sh, hand, front){
  const hi=front?C.hoodieHi:'#3e3e49', lo=front?C.hoodieLo:'#26262e';
  limb(sh, arm.joint, hand, 8.5*S,7*S,5.5*S, gradFor(sh,hand,hi,lo));
  // hand
  ctx.save();
  ctx.fillStyle=C.skin;
  ctx.beginPath(); ctx.arc(hand.x,hand.y,5.4*S,0,7); ctx.fill();
  ctx.strokeStyle='rgba(255,210,200,0.4)'; ctx.lineWidth=1; ctx.stroke();
  ctx.restore();
}

function drawHoodie(st){
  const {pelvis,chest,neck,shL,shR,lean}=st;
  const u  = unit(sub(neck,pelvis));
  const s  = {x:-u.y, y:u.x};
  const P=(pt,sx,uy)=>({x:pt.x+s.x*sx+u.x*uy, y:pt.y+s.y*sx+u.y*uy});

  // Back-view hoodie — wider shoulders, no pocket, folded hood on upper back
  const HHW=L.bodyHipHW+4, CHW=L.bodyChestHW+7;
  const hipL=P(pelvis, HHW, 6),  hipR=P(pelvis,-HHW, 6);
  const shlL=P(neck,  CHW, 0),   shlR=P(neck, -CHW,  0);
  const nkL =P(neck,  9, -3),    nkR =P(neck, -9,   -3);  // back collar edges

  // ── main back silhouette ───────────────────────────────────────────────
  ctx.beginPath();
  ctx.moveTo(hipL.x,hipL.y);
  ctx.quadraticCurveTo(P(chest,CHW+3,0).x,P(chest,CHW+3,0).y, shlL.x,shlL.y);
  ctx.quadraticCurveTo(P(neck,CHW+1,-7).x,P(neck,CHW+1,-7).y, nkL.x,nkL.y);
  ctx.quadraticCurveTo(P(neck,0,-1).x,P(neck,0,-1).y, nkR.x,nkR.y);
  ctx.quadraticCurveTo(P(neck,-CHW-1,-7).x,P(neck,-CHW-1,-7).y, shlR.x,shlR.y);
  ctx.quadraticCurveTo(P(chest,-CHW-3,0).x,P(chest,-CHW-3,0).y, hipR.x,hipR.y);
  ctx.quadraticCurveTo(P(pelvis,0,12).x,P(pelvis,0,12).y, hipL.x,hipL.y);
  ctx.closePath();

  const g=ctx.createLinearGradient(shlL.x,shlL.y,hipL.x,hipL.y);
  g.addColorStop(0,C.hoodieHi); g.addColorStop(0.65,C.hoodieLo); g.addColorStop(1,'#18181f');
  ctx.fillStyle=g; ctx.fill();

  // ── folded hood hanging between shoulder blades ────────────────────────
  const hoodCtr=P(neck,0,14*S);
  ctx.fillStyle='#2e2e3b';
  ctx.beginPath();
  ctx.ellipse(hoodCtr.x,hoodCtr.y, 13*S,9*S, lean, 0, Math.PI*2);
  ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,0.28)'; ctx.lineWidth=1.3;
  [-1,1].forEach(side=>{
    ctx.beginPath();
    ctx.moveTo(P(neck,side*3,1).x,P(neck,side*3,1).y);
    ctx.quadraticCurveTo(hoodCtr.x+side*3,hoodCtr.y-3, hoodCtr.x+side*2,hoodCtr.y+5);
    ctx.stroke();
  });

  // ── center back seam ──────────────────────────────────────────────────
  ctx.strokeStyle='rgba(0,0,0,0.20)'; ctx.lineWidth=1.4;
  ctx.beginPath();
  ctx.moveTo(P(neck,0,-1).x,P(neck,0,-1).y);
  ctx.lineTo(P(pelvis,0,8).x,P(pelvis,0,8).y);
  ctx.stroke();

  // ── shoulder blade creases ────────────────────────────────────────────
  ctx.strokeStyle='rgba(0,0,0,0.10)'; ctx.lineWidth=1.2;
  [1,-1].forEach(side=>{
    ctx.beginPath();
    ctx.moveTo(P(neck,side*12,-1).x,P(neck,side*12,-1).y);
    ctx.quadraticCurveTo(P(chest,side*16,-6).x,P(chest,side*16,-6).y,
                         P(chest,side*21,6).x,P(chest,side*21,6).y);
    ctx.stroke();
  });

  // ── rim light on back silhouette ──────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(hipL.x,hipL.y);
  ctx.quadraticCurveTo(P(chest,CHW+3,0).x,P(chest,CHW+3,0).y, shlL.x,shlL.y);
  ctx.quadraticCurveTo(P(neck,CHW+1,-7).x,P(neck,CHW+1,-7).y, nkL.x,nkL.y);
  ctx.quadraticCurveTo(P(neck,0,-1).x,P(neck,0,-1).y, nkR.x,nkR.y);
  ctx.quadraticCurveTo(P(neck,-CHW-1,-7).x,P(neck,-CHW-1,-7).y, shlR.x,shlR.y);
  ctx.quadraticCurveTo(P(chest,-CHW-3,0).x,P(chest,-CHW-3,0).y, hipR.x,hipR.y);
  ctx.strokeStyle=C.rim; ctx.lineWidth=2.2;
  ctx.shadowColor=C.rimGlow; ctx.shadowBlur=12;
  ctx.stroke();
  ctx.restore();
}

function drawHair(st){
  const {neck,headC,chest,pelvis,lean,hairSway}=st;
  const u  = unit(sub(headC,neck));
  const s  = {x:-u.y, y:u.x};
  const P=(pt,sx,uy)=>({x:pt.x+s.x*sx+u.x*uy, y:pt.y+s.y*sx+u.y*uy});
  const R=L.headR;

  // Hair flows from crown down to upper-back (the star feature from behind)
  const flowEnd = lerpP(neck, pelvis, 0.36 + st.sit*0.10);
  const sway = Math.sin(hairSway)*R*0.9;

  // Key silhouette points
  const crown = P(headC, 0, R*1.08);
  const sideL = P(headC,  R*2.1, R*0.25);
  const sideR = P(headC, -R*2.1, R*0.25);
  const midL  = P(headC,  R*2.35, -R*0.55);
  const midR  = P(headC, -R*2.35, -R*0.55);
  const lowL  = {x:P(flowEnd, R*1.65,0).x+sway*0.55, y:P(flowEnd, R*1.65,0).y};
  const lowR  = {x:P(flowEnd,-R*1.65,0).x+sway*0.55, y:P(flowEnd,-R*1.65,0).y};
  const tipPt = {x:P(flowEnd,0,R*0.55).x+sway,        y:P(flowEnd,0,R*0.55).y};

  // ── shadow layer (depth illusion) ─────────────────────────────────────
  ctx.beginPath();
  ctx.moveTo(crown.x,crown.y);
  ctx.quadraticCurveTo(P(headC,R*2.55,R*0.9).x,P(headC,R*2.55,R*0.9).y, sideL.x,sideL.y);
  ctx.quadraticCurveTo(midL.x+4,midL.y+4, lowL.x+3,lowL.y+5);
  ctx.quadraticCurveTo(tipPt.x,tipPt.y+7, lowR.x-3,lowR.y+5);
  ctx.quadraticCurveTo(midR.x-4,midR.y+4, sideR.x,sideR.y);
  ctx.quadraticCurveTo(P(headC,-R*2.55,R*0.9).x,P(headC,-R*2.55,R*0.9).y, crown.x,crown.y);
  ctx.closePath();
  ctx.fillStyle=C.hairLo; ctx.fill();

  // ── main hair mass ────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.moveTo(crown.x,crown.y);
  ctx.quadraticCurveTo(P(headC,R*2.55,R*0.9).x,P(headC,R*2.55,R*0.9).y, sideL.x,sideL.y);
  ctx.quadraticCurveTo(midL.x,midL.y, lowL.x,lowL.y);
  ctx.quadraticCurveTo(tipPt.x+5,tipPt.y-3, tipPt.x,tipPt.y);
  ctx.quadraticCurveTo(tipPt.x-5,tipPt.y-3, lowR.x,lowR.y);
  ctx.quadraticCurveTo(midR.x,midR.y, sideR.x,sideR.y);
  ctx.quadraticCurveTo(P(headC,-R*2.55,R*0.9).x,P(headC,-R*2.55,R*0.9).y, crown.x,crown.y);
  ctx.closePath();

  const hg=ctx.createLinearGradient(crown.x,crown.y,tipPt.x,tipPt.y);
  hg.addColorStop(0,C.hairHi); hg.addColorStop(0.42,C.hairMid); hg.addColorStop(1,C.hairLo);
  ctx.fillStyle=hg; ctx.fill();

  // ── golden rim glow (back-light key feature) ──────────────────────────
  ctx.save();
  ctx.strokeStyle='rgba(255,228,148,0.78)'; ctx.lineWidth=2.8;
  ctx.shadowColor='rgba(255,218,120,0.95)'; ctx.shadowBlur=20;
  ctx.stroke();
  ctx.restore();

  // ── curl lobes on the head mass ───────────────────────────────────────
  const headLobes=[
    [0,      R*0.98, 10  ],
    [ R*0.88, R*0.70, 11 ], [-R*0.88, R*0.70, 11],
    [ R*1.58, R*0.08,  9 ], [-R*1.58, R*0.08,  9],
    [ R*1.72,-R*0.52,  8.5],[-R*1.72,-R*0.52,  8.5],
    [ R*0.72,-R*0.38, 10 ], [-R*0.72,-R*0.38, 10],
    [0,      -R*0.22, 10.5],
  ];
  headLobes.forEach(([sx,uy,r])=>{
    const c=P(headC,sx,uy);
    const grd=ctx.createRadialGradient(c.x-r*0.35,c.y-r*0.35,1,c.x,c.y,r);
    grd.addColorStop(0,C.hairHi); grd.addColorStop(0.55,C.hairMid); grd.addColorStop(1,C.hairLo);
    ctx.fillStyle=grd;
    ctx.beginPath(); ctx.arc(c.x,c.y,r,0,Math.PI*2); ctx.fill();
  });

  // ── cascading ringlets down the back ──────────────────────────────────
  const cascStart=P(headC,0,-R*0.22);
  for(let i=0;i<11;i++){
    const f=i/10;
    const cc=lerpP(cascStart,tipPt,f);
    cc.x += Math.sin(hairSway+f*2.8+i*0.85)*sway*0.85 + (i%2===0?12:-12);
    const r=(10.5-f*5)*S;
    const grd=ctx.createRadialGradient(cc.x-r*0.3,cc.y-r*0.3,1,cc.x,cc.y,r);
    grd.addColorStop(0,f<0.45?C.hairHi:C.hairMid); grd.addColorStop(1,C.hairLo);
    ctx.fillStyle=grd;
    ctx.beginPath(); ctx.arc(cc.x,cc.y,r,0,Math.PI*2); ctx.fill();
  }

  // ── crown back-light bloom ────────────────────────────────────────────
  ctx.save(); ctx.globalCompositeOperation='screen';
  const top=P(headC,0,R*0.92);
  const g=ctx.createRadialGradient(top.x,top.y,2,top.x,top.y,R*2.7);
  g.addColorStop(0,'rgba(255,242,190,0.82)'); g.addColorStop(1,'rgba(255,238,180,0)');
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(top.x,top.y,R*2.7,0,Math.PI*2); ctx.fill();
  ctx.restore();

  // ── highlight strands catching the back-light ─────────────────────────
  ctx.strokeStyle='rgba(255,238,178,0.68)'; ctx.lineWidth=1.7; ctx.lineCap='round';
  [[-14,R*0.55,lowL.x-4,lowL.y+2],
   [  0,R*0.78,tipPt.x, tipPt.y+1],
   [ 14,R*0.55,lowR.x+4,lowR.y+2]].forEach(([ax,ay,bx,by])=>{
    const a=P(headC,ax,ay);
    ctx.beginPath(); ctx.moveTo(a.x,a.y);
    ctx.quadraticCurveTo((a.x+bx)/2+Math.sin(hairSway)*5,(a.y+by)/2,bx,by);
    ctx.stroke();
  });
}

/* ─── soft contact shadow under the figure ─────────────────────────────── */
function drawContactShadow(st){
  const cx = st.pelvis.x;
  const fy = GROUND+6;
  ctx.save();
  ctx.globalCompositeOperation='multiply';
  const w = lerp(40, 70, st.sit);
  const g=ctx.createRadialGradient(cx,fy,2,cx,fy,w);
  g.addColorStop(0,'rgba(60,24,34,0.5)'); g.addColorStop(1,'rgba(60,24,34,0)');
  ctx.fillStyle=g;
  ctx.beginPath(); ctx.ellipse(cx,fy,w,12,0,0,7); ctx.fill();
  ctx.restore();
}

/* =============================================================================
 *  RENDER
 * ========================================================================== */
function render(t, now){
  ctx.clearRect(0,0,W,H);

  // cinematic camera push-in
  const cam = easeInOutSine(clamp(t/T.end,0,1));
  const scale = 1 + 0.055*cam;
  const cx=BX, cy=H*0.58;
  ctx.save();
  ctx.translate(cx,cy); ctx.scale(scale,scale); ctx.translate(-cx,-cy + 6*cam);

  drawSky();
  drawGodRays(now);
  drawTrees();
  drawGround();

  const st = buildState(t);

  // ── wet-ground reflection (character + bench, mirrored & faded) ──
  ctx.save();
  ctx.beginPath(); ctx.rect(0,GROUND,W,H-GROUND); ctx.clip();
  ctx.translate(0, 2*GROUND); ctx.scale(1,-1);
  ctx.globalAlpha=0.20; ctx.filter='blur(1.4px)';
  drawBench();
  drawCharacter(st);
  ctx.filter='none';
  ctx.restore();
  // pink tint over the reflection
  ctx.save(); ctx.globalCompositeOperation='multiply';
  const rt=ctx.createLinearGradient(0,GROUND,0,H);
  rt.addColorStop(0,'rgba(150,60,80,0.1)'); rt.addColorStop(1,'rgba(110,44,60,0.7)');
  ctx.fillStyle=rt; ctx.fillRect(0,GROUND,W,H-GROUND);
  ctx.restore();

  drawPetals(now);
  drawContactShadow(st);
  drawBench();
  drawCharacter(st);

  // foreground haze veil
  const veil=ctx.createLinearGradient(0,H*0.7,0,H);
  veil.addColorStop(0,'rgba(190,90,112,0)');
  veil.addColorStop(1,'rgba(150,60,82,0.45)');
  ctx.fillStyle=veil; ctx.fillRect(0,H*0.7,W,H*0.3);

  ctx.restore(); // camera

  // vignette
  const vig=ctx.createRadialGradient(W/2,H*0.5,H*0.4,W/2,H*0.5,H*0.85);
  vig.addColorStop(0,'rgba(0,0,0,0)'); vig.addColorStop(1,'rgba(40,12,22,0.45)');
  ctx.fillStyle=vig; ctx.fillRect(0,0,W,H);
}

/* =============================================================================
 *  LOOP + CONTROLS
 * ========================================================================== */
let playing=true, startTS=null, pausedAt=0;

function frame(ts){
  if(startTS===null) startTS=ts;
  const elapsed=(ts-startTS)/1000 + pausedAt;
  const t=Math.min(elapsed % CYCLE, T.end);   // freeze during HOLD then loop
  render(t, ts);
  if(playing) requestAnimationFrame(frame);
}

const btnPlay=document.getElementById('btnPlay');
const btnReplay=document.getElementById('btnReplay');
btnPlay.addEventListener('click',()=>{
  playing=!playing;
  if(playing){ startTS=null; requestAnimationFrame(frame); btnPlay.textContent='⏸ Pausa'; }
  else { btnPlay.textContent='▶ Play'; }
});
btnReplay.addEventListener('click',()=>{
  startTS=null; pausedAt=0;
  if(!playing){ playing=true; btnPlay.textContent='⏸ Pausa'; requestAnimationFrame(frame); }
});

requestAnimationFrame(frame);
