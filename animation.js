/* ============================================================================
 *  THE ROSE ON THE BENCH — manga/anime style canvas animation
 *  Back-view girl: cel-shading, bold outlines, speed lines, sparkles
 * ============================================================================ */

const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

/* ─── Timeline ─────────────────────────────────────────────────────────── */
const T = {
  walkEnd:  2.6,
  sitStart: 3.15,
  sitEnd:   4.35,
  reachA:   4.30,
  reachB:   5.15,
  retreatA: 5.20,
  retreatB: 5.85,
  end:      6.2,
};
const HOLD  = 0.9;
const CYCLE = T.end + HOLD;

/* ─── Scene geometry ───────────────────────────────────────────────────── */
const GROUND   = H * 0.85;
const BX       = W * 0.50;
const SEAT_Y   = H * 0.74;
const BENCH_HW = 158;
const STAND_PY = GROUND - 132;
const SEAT_PY  = SEAT_Y + 10;

/* ─── Character scale + bone lengths ──────────────────────────────────── */
const S = 1.30;
const L = {
  thigh: 58*S, shin: 56*S,
  uArm: 40*S,  fArm: 38*S,
  hipHW: 12*S, shHW: 18*S,
  torso: 74*S, neckHead: 18*S, headR: 24*S,
  bodyHipHW: 23*S, bodyChestHW: 25*S, shOuter: 25*S,
};
const STRIDE = 44, LIFT = 14, BOB = 7, STEP_F = 1.9;

/* ─── Manga palette ────────────────────────────────────────────────────── */
const MC = {
  outline:      '#16100e',
  hoodieBase:   '#595a6c',
  hoodieShadow: '#30303e',
  hoodieHood:   '#2a2a38',
  jeansBase:    '#88aed4',
  jeansShadow:  '#5e84ae',
  shoeBase:     '#f0e8d8',
  shoeShadow:   '#c4b89a',
  hairBase:     '#e8c464',
  hairShadow:   '#b49038',
  hairHi:       '#fffae0',
  skinBase:     '#f5c8a0',
  skinShadow:   '#d4966c',
  roseBase:     '#f06878',
  roseShadow:   '#c83858',
  roseHi:       '#ffb8c4',
  stemCol:      '#5aae48',
};

/* ─── Math helpers ─────────────────────────────────────────────────────── */
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const lerp   = (a,b,t) => a + (b-a)*t;
const lerpP  = (a,b,t) => ({x: lerp(a.x,b.x,t), y: lerp(a.y,b.y,t)});
const easeInOutCubic = x => x<0.5 ? 4*x*x*x : 1-Math.pow(-2*x+2,3)/2;
const easeInOutSine  = x => -(Math.cos(Math.PI*x)-1)/2;
function smooth(a,b,x){ const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); }
const add = (a,b) => ({x:a.x+b.x, y:a.y+b.y});
const sub = (a,b) => ({x:a.x-b.x, y:a.y-b.y});
function unit(v){ const m=Math.hypot(v.x,v.y)||1; return {x:v.x/m, y:v.y/m}; }
function perp(a,b){ const d=unit(sub(b,a)); return {x:-d.y, y:d.x}; }

/* ─── Manga outline helper ─────────────────────────────────────────────── */
function oline(w){
  w = w||2.8;
  ctx.strokeStyle = MC.outline;
  ctx.lineWidth   = w;
  ctx.lineJoin    = 'round';
  ctx.lineCap     = 'round';
  ctx.stroke();
}

/* ─── 2-bone IK ─────────────────────────────────────────────────────────── */
function ik(root, target, l1, l2, bendSign){
  let d = Math.hypot(target.x-root.x, target.y-root.y);
  d = clamp(d, Math.abs(l1-l2)+0.001, (l1+l2)*0.999);
  const a  = Math.atan2(target.y-root.y, target.x-root.x);
  const ca = clamp((l1*l1+d*d-l2*l2)/(2*l1*d), -1, 1);
  const ang = a + bendSign*Math.acos(ca);
  const joint = {x:root.x+Math.cos(ang)*l1, y:root.y+Math.sin(ang)*l1};
  const end   = {x:root.x+Math.cos(a)*d,    y:root.y+Math.sin(a)*d};
  return {joint, end};
}

/* ─── Petals ────────────────────────────────────────────────────────────── */
const PETALS = Array.from({length:36}, () => {
  const ground = Math.random() < 0.55;
  return {
    ground,
    x: Math.random()*W,
    y: ground ? GROUND+Math.random()*(H-GROUND)*0.9 : Math.random()*H*0.7,
    z: 0.4+Math.random()*0.9,
    rot: Math.random()*Math.PI*2,
    spin: (Math.random()-0.5)*0.6,
    sway: Math.random()*Math.PI*2,
    fall: 12+Math.random()*18,
  };
});

/* ─── Sparkles (for rose placement moment) ──────────────────────────────── */
const SPARKLES = Array.from({length:8}, (_,i) => ({
  a: (i/8)*Math.PI*2,
  r: 18+i%3*8,
}));

/* ==========================================================================
 *  ENVIRONMENT
 * ========================================================================== */
function drawSky(){
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,   '#fce6ef');
  g.addColorStop(0.45,'#f8cede');
  g.addColorStop(0.8, '#e8aabe');
  g.addColorStop(1,   '#d48aaa');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,W,H);

  // Manga radial burst from light source
  const cx=W*0.5, cy=H*0.28;
  ctx.save();
  for(let i=0;i<32;i++){
    const a = i/32*Math.PI*2;
    ctx.globalAlpha  = i%2===0 ? 0.17 : 0.08;
    ctx.strokeStyle  = '#fff5f8';
    ctx.lineWidth    = i%2===0 ? 2.2 : 1;
    ctx.beginPath();
    ctx.moveTo(cx+Math.cos(a)*38, cy+Math.sin(a)*38);
    ctx.lineTo(cx+Math.cos(a)*W,  cy+Math.sin(a)*W);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Central bloom
  const glow = ctx.createRadialGradient(cx,cy,10,cx,cy,W*0.46);
  glow.addColorStop(0,'rgba(255,252,240,0.92)');
  glow.addColorStop(0.3,'rgba(255,232,242,0.36)');
  glow.addColorStop(1,'rgba(255,208,226,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0,0,W,H);
}

function drawSpeedLines(gx, walkAmt){
  if(walkAmt < 0.06) return;
  ctx.save();
  const y0=STAND_PY-70, y1=GROUND;
  for(let i=0;i<20;i++){
    const y   = y0 + (i/19)*(y1-y0);
    const len = 55 + (i%4)*35;
    ctx.globalAlpha = walkAmt * (i%3===0 ? 0.38 : 0.20);
    ctx.strokeStyle = i%3===0 ? '#fff0f4' : '#ffffff';
    ctx.lineWidth   = i%3===0 ? 1.5 : 0.8;
    ctx.beginPath();
    ctx.moveTo(gx+22, y);
    ctx.lineTo(Math.min(W-10, gx+22+len), y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawTrees(){
  ctx.save();
  ctx.filter = 'blur(12px)';
  ctx.fillStyle = 'rgba(138,50,78,0.52)';
  [[W*0.04,H*0.24,115],[W*0.13,H*0.19,82],
   [W*0.96,H*0.24,115],[W*0.87,H*0.19,82]].forEach(([x,y,r])=>{
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
  });
  ctx.filter = 'none';
  ctx.restore();
}

function drawGround(){
  const g = ctx.createLinearGradient(0,GROUND-20,0,H);
  g.addColorStop(0,'rgba(195,85,108,0)');
  g.addColorStop(0.3,'rgba(175,78,100,0.58)');
  g.addColorStop(1,'rgba(118,48,66,0.94)');
  ctx.fillStyle = g;
  ctx.fillRect(0,GROUND-20,W,H-GROUND+20);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = 'rgba(255,218,232,0.20)';
  ctx.fillRect(0,GROUND-5,W,10);
  ctx.restore();
}

function drawPetals(now){
  PETALS.forEach(p=>{
    if(!p.ground){
      p.y += p.fall*0.016*p.z;
      p.x += Math.sin(now*0.001+p.sway)*0.5;
      p.rot += p.spin*0.02;
      if(p.y > H+10){ p.y=-10; p.x=Math.random()*W; }
    }
    const sz = 4.5*p.z + (p.ground?2:0);
    ctx.save();
    ctx.translate(p.x,p.y); ctx.rotate(p.rot);
    ctx.globalAlpha = p.ground ? 0.90 : 0.76;
    ctx.fillStyle   = p.ground ? '#e06078' : '#f0789a';
    ctx.beginPath(); ctx.ellipse(0,0,sz,sz*0.55,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = 'rgba(168,44,66,0.55)'; ctx.lineWidth=0.8; ctx.stroke();
    ctx.restore();
  });
}

/* ─── Bench ─────────────────────────────────────────────────────────────── */
function roundRect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

function drawBench(){
  const x0=BX-BENCH_HW, x1=BX+BENCH_HW;
  ctx.fillStyle = '#4e2e18';
  [x0+26,x1-26].forEach(lx=>{
    roundRect(lx-6,SEAT_Y-86,12,88,3); ctx.fill(); oline(2);
  });
  [[SEAT_Y-88,'#7a4e2e'],[SEAT_Y-62,'#5a3a20']].forEach(([y,col])=>{
    roundRect(x0,y,BENCH_HW*2,18,4); ctx.fillStyle=col; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle='rgba(255,200,160,0.10)'; roundRect(x0,y,BENCH_HW*2,5,4); ctx.fill();
    ctx.restore(); oline(2.4);
  });
  ctx.fillStyle = '#3e2414';
  [x0+30,x1-30].forEach(lx=>{
    roundRect(lx-6,SEAT_Y+14,12,70,3); ctx.fill(); oline(2);
  });
  [['#9a6840',SEAT_Y],['#7a4e2e',SEAT_Y+16]].forEach(([col,y])=>{
    roundRect(x0,y,BENCH_HW*2,16,4); ctx.fillStyle=col; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle='rgba(255,210,170,0.14)'; roundRect(x0,y,BENCH_HW*2,5,4); ctx.fill();
    ctx.restore(); oline(2.4);
  });
}

/* ─── Rose ───────────────────────────────────────────────────────────────── */
function drawRose(x,y,ang,scale){
  ctx.save();
  ctx.translate(x,y); ctx.rotate(ang); ctx.scale(scale,scale);

  ctx.strokeStyle=MC.stemCol; ctx.lineWidth=4.5; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(0,8); ctx.quadraticCurveTo(2,28,0,50); ctx.stroke();
  ctx.strokeStyle=MC.outline; ctx.lineWidth=1.8; ctx.stroke();

  [[-1,26,-0.7],[1,38,0.7]].forEach(([sx,sy,r])=>{
    ctx.save(); ctx.translate(sx*0.5,sy); ctx.rotate(r);
    ctx.fillStyle=MC.stemCol;
    ctx.beginPath(); ctx.ellipse(sx*7,0,10,4.5,0,0,Math.PI*2); ctx.fill(); oline(1.6);
    ctx.restore();
  });

  for(let i=0;i<6;i++){
    ctx.save(); ctx.rotate(i/6*Math.PI*2+0.3);
    ctx.fillStyle=MC.roseShadow;
    ctx.beginPath(); ctx.ellipse(0,-12*0.52,12*0.60,12,0,0,Math.PI*2); ctx.fill(); oline(1.5);
    ctx.restore();
  }
  for(let i=0;i<6;i++){
    ctx.save(); ctx.rotate(i/6*Math.PI*2);
    ctx.fillStyle=MC.roseBase;
    ctx.beginPath(); ctx.ellipse(0,-11*0.52,11*0.60,11,0,0,Math.PI*2); ctx.fill(); oline(1.4);
    ctx.restore();
  }
  for(let i=0;i<5;i++){
    ctx.save(); ctx.rotate(i/5*Math.PI*2+0.5);
    ctx.fillStyle=MC.roseHi;
    ctx.beginPath(); ctx.ellipse(0,-8*0.52,8*0.60,8,0,0,Math.PI*2); ctx.fill(); oline(1.2);
    ctx.restore();
  }
  ctx.fillStyle=MC.roseShadow;
  ctx.beginPath(); ctx.arc(0,-1,5.5,0,Math.PI*2); ctx.fill(); oline(1.8);
  ctx.restore();
}

/* ─── Sparkles ───────────────────────────────────────────────────────────── */
function drawSparkles(rx,ry,t){
  const appear = smooth(T.reachB-0.05,T.reachB+0.25,t);
  const fade   = smooth(T.retreatA,T.retreatA+0.6,t);
  const alpha  = appear*(1-fade);
  if(alpha < 0.02) return;
  ctx.save(); ctx.globalAlpha=alpha;
  SPARKLES.forEach((sp,i)=>{
    const px=rx+Math.cos(sp.a)*sp.r, py=ry+Math.sin(sp.a)*sp.r;
    const sz=5+i%3*3;
    ctx.fillStyle   = i%2===0 ? '#ffe844' : '#ff88aa';
    ctx.strokeStyle = MC.outline; ctx.lineWidth=1.3;
    ctx.beginPath();
    for(let k=0;k<4;k++){
      const a1=sp.a+k*Math.PI*0.5, a2=sp.a+k*Math.PI*0.5+Math.PI*0.25;
      if(k===0) ctx.moveTo(px+Math.cos(a1)*sz,py+Math.sin(a1)*sz);
      else      ctx.lineTo(px+Math.cos(a1)*sz,py+Math.sin(a1)*sz);
      ctx.lineTo(px+Math.cos(a2)*sz*0.38,py+Math.sin(a2)*sz*0.38);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  });
  ctx.restore();
}

/* ==========================================================================
 *  SKELETON RIG
 * ========================================================================== */
function buildState(t){
  const X_START=W*0.96, X_SIT=BX+34;
  const wp      = easeInOutCubic(smooth(0,T.walkEnd,t));
  const gx      = lerp(X_START,X_SIT,wp);
  const walkAmt = 1-smooth(T.walkEnd-0.2,T.walkEnd+0.15,t);
  const phase   = Math.min(t,T.walkEnd)*STEP_F;
  const th      = phase*Math.PI*2;

  const sit     = easeInOutCubic(smooth(T.sitStart,T.sitEnd,t));
  const bob     = -BOB*walkAmt*Math.abs(Math.sin(th));
  const antic   = 5*Math.sin(Math.PI*smooth(T.sitStart-0.28,T.sitStart,t))*(1-sit);
  const pelvisY = lerp(STAND_PY+bob-antic, SEAT_PY, sit);
  const breathe = Math.sin(t*1.8)*1.4*sit;
  const pelvis  = {x:gx, y:pelvisY+breathe};

  const walkLean  = 0.05*walkAmt;
  const sitLean   = 0.20*Math.sin(Math.PI*sit);
  const reach     = easeInOutCubic(smooth(T.reachA,T.reachB,t));
  const reachLean = 0.12*Math.sin(Math.PI*reach);
  const lean      = walkLean+sitLean+reachLean;

  const rot=(p,a)=>({
    x: pelvis.x+p.x*Math.cos(a)-p.y*Math.sin(a),
    y: pelvis.y+p.x*Math.sin(a)+p.y*Math.cos(a),
  });
  const neck  = rot({x:0,y:-L.torso},lean);
  const chest = rot({x:0,y:-L.torso*0.5},lean);
  const shL   = rot({x: L.shHW,y:-L.torso*0.92},lean);
  const shR   = rot({x:-L.shHW,y:-L.torso*0.92},lean);
  const headC = rot({x:0,y:-L.torso-L.neckHead},lean);

  function legFn(sgn,off){
    const hip={x:pelvis.x+sgn*L.hipHW, y:pelvis.y+3};
    const s=Math.sin(th+off);
    const lift=LIFT*Math.max(0,-Math.cos(th+off));
    const walkFoot ={x:pelvis.x+sgn*14*S+walkAmt*s*STRIDE*0.5, y:GROUND-walkAmt*lift};
    const standFoot={x:pelvis.x+sgn*14*S, y:GROUND};
    const wFoot=lerpP(standFoot,walkFoot,walkAmt);
    const rW=ik(hip,wFoot,L.thigh,L.shin,-1);
    const seatKnee ={x:pelvis.x+sgn*11*S, y:pelvis.y+34*S};
    const seatAnkle={x:pelvis.x+sgn*12*S, y:GROUND};
    const knee =lerpP(rW.joint,seatKnee, sit);
    const ankle=lerpP(rW.end,  seatAnkle,sit);
    return {hip,knee,ankle,foot:ankle,sgn};
  }
  const legFar  = legFn(+1,Math.PI);
  const legNear = legFn(-1,0);

  const carryR   = add(shR,{x:4+6*walkAmt*Math.sin(th+Math.PI), y:(L.uArm+L.fArm)*0.94});
  const seatRose = {x:BX-58, y:SEAT_Y-3};
  const restR    = add(shR,{x:10, y:(L.uArm+L.fArm)*0.72});
  const retreat  = easeInOutCubic(smooth(T.retreatA,T.retreatB,t));
  let handR = lerpP(carryR,seatRose,reach);
  handR = lerpP(handR,restR,retreat);
  const armR = ik(shR,handR,L.uArm,L.fArm,+1);

  const carryL = add(shL,{x:-4+6*walkAmt*Math.sin(th), y:(L.uArm+L.fArm)*0.95});
  const restL  = add(shL,{x:-8, y:(L.uArm+L.fArm)*0.72});
  const handL  = lerpP(carryL,restL,sit);
  const armL   = ik(shL,handL,L.uArm,L.fArm,-1);

  const placed = reach > 0.985;
  const rose = placed
    ? {x:seatRose.x, y:SEAT_Y-1, ang:1.35, scale:1}
    : {x:handR.x,    y:handR.y-2,ang:lean*0.3,scale:1};

  const hairSway = Math.sin(t*2.1-0.6)*0.10*walkAmt+Math.sin(t*1.3)*0.04+lean*0.5;

  return {pelvis,chest,neck,shL,shR,headC,legFar,legNear,
          armL,armR,handL,handR,lean,sit,hairSway,rose,walkAmt};
}

/* ─── Manga limb: flat fill + cel-shadow strip + bold outline ────────────── */
function mangaLimb(a,b,c, wa,wb,wc, baseCol,shadowCol){
  const pa=perp(a,b), pc=perp(b,c);
  const pb=unit(add(pa,pc));
  const aL=add(a,{x:pa.x*wa,y:pa.y*wa}), aR=sub(a,{x:pa.x*wa,y:pa.y*wa});
  const bL=add(b,{x:pb.x*wb,y:pb.y*wb}), bR=sub(b,{x:pb.x*wb,y:pb.y*wb});
  const cL=add(c,{x:pc.x*wc,y:pc.y*wc}), cR=sub(c,{x:pc.x*wc,y:pc.y*wc});

  ctx.beginPath();
  ctx.moveTo(aL.x,aL.y);
  ctx.quadraticCurveTo(bL.x,bL.y,cL.x,cL.y);
  ctx.lineTo(cR.x,cR.y);
  ctx.quadraticCurveTo(bR.x,bR.y,aR.x,aR.y);
  ctx.closePath();
  ctx.fillStyle=baseCol; ctx.fill();

  // Cel shadow strip on the right edge
  const sw=wa*0.52;
  ctx.save(); ctx.clip();
  ctx.fillStyle=shadowCol;
  const aI={x:aR.x+pa.x*sw, y:aR.y+pa.y*sw};
  const cI={x:cR.x+pc.x*sw, y:cR.y+pc.y*sw};
  const bI={x:(aI.x+cI.x)/2, y:(aI.y+cI.y)/2};
  ctx.beginPath();
  ctx.moveTo(aR.x,aR.y);
  ctx.quadraticCurveTo(bR.x,bR.y,cR.x,cR.y);
  ctx.lineTo(cI.x,cI.y);
  ctx.quadraticCurveTo(bI.x,bI.y,aI.x,aI.y);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  oline(2.6);
}

/* ==========================================================================
 *  CHARACTER DRAWING — manga style, back view
 * ========================================================================== */
function drawCharacter(st){
  const {shL,shR,legFar,legNear,armL,armR}=st;
  drawLeg(legFar,  MC.jeansShadow, MC.jeansShadow, true);
  drawArm(armL, shL, st.handL, false);
  drawLeg(legNear, MC.jeansBase,   MC.jeansShadow, false);
  drawHoodie(st);
  drawHair(st);
  drawArm(armR, shR, st.handR, true);
  drawRose(st.rose.x, st.rose.y, st.rose.ang, st.rose.scale);
}

function drawLeg(leg,baseCol,shadowCol,far){
  const {hip,knee,ankle,sgn}=leg;
  mangaLimb(hip,knee,ankle, 14*S,12*S,10*S, baseCol, far?baseCol:shadowCol);

  ctx.save();
  ctx.translate(ankle.x, ankle.y+1);
  ctx.scale(sgn<0?1:-1,1);

  ctx.fillStyle = far ? '#d8d0c0' : MC.shoeBase;
  ctx.beginPath();
  ctx.moveTo(10,-7); ctx.quadraticCurveTo(14,-1,12,5);
  ctx.lineTo(-12,5); ctx.quadraticCurveTo(-16,6,-14,8);
  ctx.lineTo(9,9);   ctx.quadraticCurveTo(13,9,12,5);
  ctx.closePath(); ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle=MC.shoeShadow; ctx.fillRect(-16,-8,28,7);
  ctx.restore();
  oline(2.4);
  ctx.fillStyle='#ffffff';
  ctx.beginPath();
  ctx.moveTo(-14,8); ctx.lineTo(9,9);
  ctx.quadraticCurveTo(13,10,11,13); ctx.lineTo(-14,12);
  ctx.quadraticCurveTo(-17,11,-14,8); ctx.closePath(); ctx.fill(); oline(2);
  ctx.restore();
}

function drawArm(arm,sh,hand,front){
  const base=front?MC.hoodieBase:MC.hoodieShadow;
  const shad=front?MC.hoodieShadow:'#222230';
  mangaLimb(sh,arm.joint,hand, 8.5*S,7*S,5.5*S, base,shad);
  ctx.fillStyle=front?MC.skinBase:MC.skinShadow;
  ctx.beginPath(); ctx.arc(hand.x,hand.y,5.5*S,0,Math.PI*2); ctx.fill(); oline(2.2);
}

function drawHoodie(st){
  const {pelvis,chest,neck,lean}=st;
  const u=unit(sub(neck,pelvis));
  const s={x:-u.y,y:u.x};
  const P=(pt,sx,uy)=>({x:pt.x+s.x*sx+u.x*uy, y:pt.y+s.y*sx+u.y*uy});

  const HHW=L.bodyHipHW+4, CHW=L.bodyChestHW+7;
  const hipL=P(pelvis,HHW,6),   hipR=P(pelvis,-HHW,6);
  const shlL=P(neck,CHW,0),     shlR=P(neck,-CHW,0);
  const nkL =P(neck,9,-3),      nkR =P(neck,-9,-3);

  function hoodyPath(){
    ctx.beginPath();
    ctx.moveTo(hipL.x,hipL.y);
    ctx.quadraticCurveTo(P(chest,CHW+3,0).x,P(chest,CHW+3,0).y, shlL.x,shlL.y);
    ctx.quadraticCurveTo(P(neck,CHW+1,-7).x,P(neck,CHW+1,-7).y, nkL.x,nkL.y);
    ctx.quadraticCurveTo(P(neck,0,-1).x,P(neck,0,-1).y, nkR.x,nkR.y);
    ctx.quadraticCurveTo(P(neck,-CHW-1,-7).x,P(neck,-CHW-1,-7).y, shlR.x,shlR.y);
    ctx.quadraticCurveTo(P(chest,-CHW-3,0).x,P(chest,-CHW-3,0).y, hipR.x,hipR.y);
    ctx.quadraticCurveTo(P(pelvis,0,12).x,P(pelvis,0,12).y, hipL.x,hipL.y);
    ctx.closePath();
  }

  hoodyPath(); ctx.fillStyle=MC.hoodieBase; ctx.fill();

  // Cel shadow — right side band
  ctx.save(); ctx.clip();
  ctx.fillStyle=MC.hoodieShadow;
  ctx.beginPath();
  ctx.moveTo(hipR.x,hipR.y);
  ctx.quadraticCurveTo(P(chest,-CHW-3,0).x,P(chest,-CHW-3,0).y, shlR.x,shlR.y);
  ctx.quadraticCurveTo(P(neck,-CHW-1,-7).x,P(neck,-CHW-1,-7).y, nkR.x,nkR.y);
  ctx.lineTo(P(neck,-4,-1).x,P(neck,-4,-1).y);
  ctx.lineTo(P(chest,-CHW*0.28,0).x,P(chest,-CHW*0.28,0).y);
  ctx.lineTo(P(pelvis,-HHW*0.28,6).x,P(pelvis,-HHW*0.28,6).y);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  hoodyPath(); oline(3.2);

  // Folded hood between shoulder blades
  const hoodCtr=P(neck,0,14*S);
  ctx.fillStyle=MC.hoodieHood;
  ctx.beginPath(); ctx.ellipse(hoodCtr.x,hoodCtr.y,13*S,9*S,lean,0,Math.PI*2);
  ctx.fill(); oline(2.4);

  // Center back seam (dashed)
  ctx.save();
  ctx.strokeStyle=MC.outline; ctx.lineWidth=1.5; ctx.setLineDash([5,4]);
  ctx.beginPath();
  ctx.moveTo(P(neck,0,-1).x,P(neck,0,-1).y);
  ctx.lineTo(P(pelvis,0,8).x,P(pelvis,0,8).y);
  ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
}

function drawHair(st){
  const {neck,headC,pelvis,lean,hairSway}=st;
  const u=unit(sub(headC,neck));
  const s={x:-u.y,y:u.x};
  const P=(pt,sx,uy)=>({x:pt.x+s.x*sx+u.x*uy, y:pt.y+s.y*sx+u.y*uy});
  const R=L.headR;

  const flowEnd=lerpP(neck,pelvis,0.36+st.sit*0.10);
  const sway=Math.sin(hairSway)*R*0.8;

  const crown=P(headC,0,R*1.08);
  const sideL=P(headC, R*2.1, R*0.25);
  const sideR=P(headC,-R*2.1, R*0.25);
  const midL =P(headC, R*2.35,-R*0.55);
  const midR =P(headC,-R*2.35,-R*0.55);
  const lowL ={x:P(flowEnd, R*1.65,0).x+sway*0.55, y:P(flowEnd, R*1.65,0).y};
  const lowR ={x:P(flowEnd,-R*1.65,0).x+sway*0.55, y:P(flowEnd,-R*1.65,0).y};
  const tipPt={x:P(flowEnd,0,R*0.55).x+sway,        y:P(flowEnd,0,R*0.55).y};
  const ctrl =P(headC,0,0);

  function hairPath(){
    ctx.beginPath();
    ctx.moveTo(crown.x,crown.y);
    ctx.quadraticCurveTo(P(headC,R*2.55,R*0.9).x,P(headC,R*2.55,R*0.9).y, sideL.x,sideL.y);
    ctx.quadraticCurveTo(midL.x,midL.y, lowL.x,lowL.y);
    ctx.quadraticCurveTo(tipPt.x+5,tipPt.y-3, tipPt.x,tipPt.y);
    ctx.quadraticCurveTo(tipPt.x-5,tipPt.y-3, lowR.x,lowR.y);
    ctx.quadraticCurveTo(midR.x,midR.y, sideR.x,sideR.y);
    ctx.quadraticCurveTo(P(headC,-R*2.55,R*0.9).x,P(headC,-R*2.55,R*0.9).y, crown.x,crown.y);
    ctx.closePath();
  }

  hairPath(); ctx.fillStyle=MC.hairBase; ctx.fill();

  // Cel shadow — lower portion
  ctx.save(); ctx.clip();
  ctx.fillStyle=MC.hairShadow;
  ctx.beginPath();
  ctx.moveTo(lowL.x,lowL.y);
  ctx.quadraticCurveTo(tipPt.x+5,tipPt.y-3, tipPt.x,tipPt.y);
  ctx.quadraticCurveTo(tipPt.x-5,tipPt.y-3, lowR.x,lowR.y);
  ctx.quadraticCurveTo(P(headC,-R*1.4,-R*0.35).x,P(headC,-R*1.4,-R*0.35).y,
                       ctrl.x,ctrl.y);
  ctx.quadraticCurveTo(P(headC,R*1.4,-R*0.35).x,P(headC,R*1.4,-R*0.35).y, lowL.x,lowL.y);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  // Bold outline
  hairPath(); oline(3.8);

  // Anime curl bumps at edges
  [
    [sideL.x,     sideL.y,     14],
    [midL.x+7,    midL.y+5,    13],
    [lowL.x+3,    lowL.y-9,    11],
    [sideR.x,     sideR.y,     14],
    [midR.x-7,    midR.y+5,    13],
    [lowR.x-3,    lowR.y-9,    11],
  ].forEach(([cx,cy,r])=>{
    ctx.fillStyle=MC.hairBase;
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill(); oline(2.2);
  });

  // Anime shine blob at crown
  const shX=P(headC,-R*0.28,R*0.52).x;
  const shY=P(headC,-R*0.28,R*0.52).y;
  ctx.fillStyle=MC.hairHi;
  ctx.beginPath();
  ctx.moveTo(shX,    shY-13);
  ctx.quadraticCurveTo(shX+15,shY-8,  shX+11,shY+3);
  ctx.quadraticCurveTo(shX,   shY+5,  shX-9, shY+3);
  ctx.quadraticCurveTo(shX-13,shY-7,  shX,   shY-13);
  ctx.closePath(); ctx.fill();

  // Strand lines
  ctx.strokeStyle=MC.hairShadow; ctx.lineWidth=1.6; ctx.lineCap='round';
  [[-11,R*0.58,lowL.x-2,lowL.y],
   [  0,R*0.72,tipPt.x, tipPt.y],
   [ 11,R*0.58,lowR.x+2,lowR.y]].forEach(([ax,ay,bx,by])=>{
    const a=P(headC,ax,ay);
    ctx.beginPath(); ctx.moveTo(a.x,a.y);
    ctx.quadraticCurveTo((a.x+bx)/2+Math.sin(hairSway)*4,(a.y+by)/2,bx,by);
    ctx.stroke();
  });
}

function drawContactShadow(st){
  const cx=st.pelvis.x, fy=GROUND+6;
  ctx.save(); ctx.globalCompositeOperation='multiply';
  const w=lerp(40,70,st.sit);
  const g=ctx.createRadialGradient(cx,fy,2,cx,fy,w);
  g.addColorStop(0,'rgba(55,20,30,0.45)'); g.addColorStop(1,'rgba(55,20,30,0)');
  ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(cx,fy,w,10,0,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

/* ==========================================================================
 *  RENDER
 * ========================================================================== */
function render(t,now){
  ctx.clearRect(0,0,W,H);

  const cam=easeInOutSine(clamp(t/T.end,0,1));
  const scale=1+0.055*cam;
  const cx=BX, cy=H*0.58;
  ctx.save();
  ctx.translate(cx,cy); ctx.scale(scale,scale); ctx.translate(-cx,-cy+6*cam);

  drawSky();

  const st=buildState(t);
  drawSpeedLines(st.pelvis.x, st.walkAmt);
  drawTrees();
  drawGround();

  // Reflection
  ctx.save();
  ctx.beginPath(); ctx.rect(0,GROUND,W,H-GROUND); ctx.clip();
  ctx.translate(0,2*GROUND); ctx.scale(1,-1);
  ctx.globalAlpha=0.10; ctx.filter='blur(1.5px)';
  drawBench(); drawCharacter(st);
  ctx.filter='none';
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation='multiply';
  const rt=ctx.createLinearGradient(0,GROUND,0,H);
  rt.addColorStop(0,'rgba(148,58,80,0.08)'); rt.addColorStop(1,'rgba(106,40,58,0.62)');
  ctx.fillStyle=rt; ctx.fillRect(0,GROUND,W,H-GROUND);
  ctx.restore();

  drawPetals(now);
  drawContactShadow(st);
  drawBench();
  drawCharacter(st);
  drawSparkles(st.rose.x,st.rose.y,t);

  // Foreground veil
  const veil=ctx.createLinearGradient(0,H*0.78,0,H);
  veil.addColorStop(0,'rgba(185,78,106,0)');
  veil.addColorStop(1,'rgba(148,54,78,0.32)');
  ctx.fillStyle=veil; ctx.fillRect(0,H*0.78,W,H*0.22);

  ctx.restore();

  // Vignette
  const vig=ctx.createRadialGradient(W/2,H*0.5,H*0.38,W/2,H*0.5,H*0.82);
  vig.addColorStop(0,'rgba(0,0,0,0)'); vig.addColorStop(1,'rgba(28,10,18,0.40)');
  ctx.fillStyle=vig; ctx.fillRect(0,0,W,H);
}

/* ==========================================================================
 *  LOOP + CONTROLS
 * ========================================================================== */
let playing=true, startTS=null, pausedAt=0;

function frame(ts){
  if(startTS===null) startTS=ts;
  const elapsed=(ts-startTS)/1000+pausedAt;
  const t=Math.min(elapsed%CYCLE,T.end);
  render(t,ts);
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
