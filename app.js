(() => {
  const $ = id => document.getElementById(id);
  const sim = $('simCanvas'), ctx = sim.getContext('2d');
  const control = $('controlCanvas'), cctx = control.getContext('2d');
  const params = { speed:20, angle:45, mass:1, gravity:9.8 };
  const specs = {
    speed:{label:'초기 속도 (m/s)',min:1,max:50,step:.1,unit:'m/s',map:'착지 거리가 초기 속도 값으로 변환됩니다.'},
    angle:{label:'초기 각도 (°)',min:5,max:85,step:1,unit:'°',map:'착지 거리가 발사 각도 값으로 변환됩니다.'},
    mass:{label:'물체의 질량 (kg)',min:.1,max:10,step:.1,unit:'kg',map:'착지 거리가 물체의 질량 값으로 변환됩니다.'},
    gravity:{label:'중력가속도 (m/s²)',min:1,max:25,step:.1,unit:'m/s²',map:'착지 거리가 중력가속도 값으로 변환됩니다.'}
  };
  let selected='speed', running=false, t=0, last=0, animation=0, calibrationFrame=0, trials=[], drag=null, shot=null;
  const colors={mint:'#9cf0cb',cyan:'#70c9ef',yellow:'#ffd27d',grid:'#26384d',muted:'#8fa1b8'};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const round=(v,n=1)=>Number(v.toFixed(n));
  function metrics(p=params){
    const rad=p.angle*Math.PI/180, vx=p.speed*Math.cos(rad), vy=p.speed*Math.sin(rad);
    const flight=2*vy/p.gravity, range=vx*flight, height=vy*vy/(2*p.gravity);
    return {vx,vy,flight,range,height,peakTime:vy/p.gravity};
  }
  function setValue(key,value){
    const s=specs[key]; params[key]=clamp(Number(value),s.min,s.max);
    $('numberInput').value=params[key];
    updateLabels(); drawSim(); drawControl();
  }
  function updateLabels(){
    $('speedValue').textContent=`${round(params.speed,1)} m/s`;
    $('angleValue').textContent=`${round(params.angle,0)}°`;
    $('massValue').textContent=`${round(params.mass,1)} kg`;
    $('gravityValue').textContent=`${round(params.gravity,1)} m/s²`;
    const s=specs[selected]; $('numberLabel').textContent=s.label;
    $('numberInput').min=s.min; $('numberInput').max=s.max; $('numberInput').step=s.step; $('numberInput').value=params[selected];
    $('minLabel').textContent=s.min; $('maxLabel').textContent=s.max;
    $('mappingNote').textContent=s.map;
    const m=metrics(); $('heightOut').innerHTML=`${round(m.height,2)} <small>m</small>`;
    $('timeOut').innerHTML=`${round(m.flight,2)} <small>s</small>`;
    $('rangeOut').innerHTML=`${round(m.range,2)} <small>m</small>`;
    $('peakTimeOut').innerHTML=`${round(m.peakTime,2)} <small>s</small>`;
    $('insight').textContent=`현재 질량은 ${round(params.mass,1)} kg입니다. 공기 저항을 무시하므로 질량을 바꿔도 같은 초기 속도·각도·중력에서는 궤적이 동일합니다.`;
  }
  function fitCanvas(canvas,context){
    const dpr=Math.min(devicePixelRatio||1,2), rect=canvas.getBoundingClientRect();
    const w=Math.max(1,rect.width),h=Math.max(1,rect.height);
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    context.setTransform(dpr,0,0,dpr,0,0); return {w,h};
  }
  function drawSim(){
    const {w,h}=fitCanvas(sim,ctx), m=metrics();
    ctx.clearRect(0,0,w,h);
    const left=45,right=20,top=35,bottom=35, pw=w-left-right, ph=h-top-bottom;
    const maxX=Math.max(10,m.range*1.18), maxY=Math.max(5,m.height*1.5);
    const sx=pw/maxX, sy=ph/maxY;
    ctx.strokeStyle=colors.grid;ctx.lineWidth=1;
    for(let x=0;x<=maxX;x+=Math.max(1,Math.ceil(maxX/8))){let px=left+x*sx;ctx.beginPath();ctx.moveTo(px,top);ctx.lineTo(px,h-bottom);ctx.stroke();ctx.fillStyle=colors.muted;ctx.font='9px DM Mono';ctx.fillText(`${round(x,0)}`,px-5,h-15);}
    for(let y=0;y<=maxY;y+=Math.max(1,Math.ceil(maxY/5))){let py=h-bottom-y*sy;ctx.beginPath();ctx.moveTo(left,py);ctx.lineTo(w-right,py);ctx.stroke();ctx.fillStyle=colors.muted;ctx.font='9px DM Mono';ctx.fillText(`${round(y,0)}`,8,py+3);}
    ctx.strokeStyle='#8fa1b8';ctx.beginPath();ctx.moveTo(left,top);ctx.lineTo(left,h-bottom);ctx.lineTo(w-right,h-bottom);ctx.stroke();
    const point=time=>({x:left+m.vx*time*sx,y:h-bottom-(m.vy*time-.5*params.gravity*time*time)*sy});
    ctx.beginPath();for(let i=0;i<=100;i++){const p=point(m.flight*i/100);if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);}
    ctx.strokeStyle=colors.mint;ctx.lineWidth=2.5;ctx.shadowColor=colors.mint;ctx.shadowBlur=12;ctx.stroke();ctx.shadowBlur=0;
    const peak=point(m.peakTime);ctx.setLineDash([4,4]);ctx.strokeStyle='#ffd27d88';ctx.beginPath();ctx.moveTo(peak.x,peak.y);ctx.lineTo(peak.x,h-bottom);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle=colors.yellow;ctx.beginPath();ctx.arc(peak.x,peak.y,4,0,Math.PI*2);ctx.fill();
    const current=running?point(t):point(0);
    ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(current.x,current.y,6,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=colors.yellow;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(current.x,current.y);ctx.lineTo(current.x+m.vx*2,current.y-m.vy*2);ctx.stroke();
    ctx.fillStyle=colors.muted;ctx.font='10px Manrope';ctx.fillText('x (m)',w-48,h-9);ctx.fillText('y (m)',8,18);
    $('canvasHint').textContent=running?`경과 시간 ${round(t,2)} s`:'궤적 미리보기 · 변인을 바꾸면 즉시 갱신됩니다';
  }
  function drawControl(){
    const {w,h}=fitCanvas(control,cctx);cctx.clearRect(0,0,w,h);
    cctx.strokeStyle='#26384d';cctx.lineWidth=1;
    for(let x=12;x<w;x+=24){cctx.beginPath();cctx.moveTo(x,8);cctx.lineTo(x,h-10);cctx.stroke();}
    const origin={x:28,y:h-22};cctx.strokeStyle='#6d849e';cctx.lineWidth=4;cctx.beginPath();cctx.moveTo(10,h-15);cctx.lineTo(48,h-15);cctx.stroke();
    cctx.fillStyle=colors.mint;cctx.beginPath();cctx.arc(origin.x,origin.y,7,0,Math.PI*2);cctx.fill();
    const aim=drag?drag:{x:origin.x+65*Math.cos(-Math.PI/4),y:origin.y-65*Math.sin(Math.PI/4)};
    cctx.strokeStyle=colors.yellow;cctx.lineWidth=2;cctx.beginPath();cctx.moveTo(origin.x,origin.y);cctx.lineTo(aim.x,aim.y);cctx.stroke();
    cctx.fillStyle=colors.yellow;cctx.beginPath();cctx.arc(aim.x,aim.y,5,0,Math.PI*2);cctx.fill();
    if(shot){const q=Math.min(1,(performance.now()-shot.start)/shot.duration);const px=origin.x+q*shot.dx;const py=origin.y-q*shot.dy+4*shot.dy*q*q;cctx.fillStyle='#ffffff';cctx.beginPath();cctx.arc(px,py,5,0,Math.PI*2);cctx.fill();cctx.strokeStyle=colors.mint;cctx.setLineDash([3,4]);cctx.beginPath();cctx.moveTo(origin.x,origin.y);cctx.lineTo(px,py);cctx.stroke();cctx.setLineDash([]);}
    cctx.fillStyle=colors.muted;cctx.font='10px Manrope';cctx.fillText('드래그 방향과 길이로 발사 조건 설정',62,18);
    cctx.fillStyle='#9cf0cb';cctx.font='10px DM Mono';cctx.fillText('LAUNCH',w-65,h-10);
  }
  function chooseFromLanding(distance){
    const s=specs[selected], normalized=clamp(distance/260,0,1);
    const value=s.min+normalized*(s.max-s.min);
    setValue(selected,Math.round(value/s.step)*s.step);
    $('canvasHint').textContent=`설정 발사 착지 거리 ${round(distance/10,1)} m → ${s.label}: ${round(params[selected],1)} ${s.unit}`;
  }
  function fireControl(){
    const {w,h}=fitCanvas(control,cctx), origin={x:28,y:h-22};
    const target=drag||{x:origin.x+75,y:origin.y-60};
    const dx=target.x-origin.x,dy=origin.y-target.y;
    const distance=Math.hypot(dx,dy);
    const angle=clamp(Math.atan2(dy,dx)*180/Math.PI,5,85);
    const power=clamp(distance/110,.15,1);
    const v=8+power*22,g=9.8,rad=angle*Math.PI/180;
    const flight=2*v*Math.sin(rad)/g, range=v*Math.cos(rad)*flight;
    const s=specs[selected],normalized=clamp(range/92,0,1);
    const value=s.min+normalized*(s.max-s.min);
    shot={start:performance.now(),duration:850,dx:Math.min(w-48,range/92*(w-55)),dy:Math.min(78,Math.max(12,range/92*78))};
    drag=null;drawControl();
    cancelAnimationFrame(calibrationFrame);
    const animateShot=()=>{
      drawControl();
      if(performance.now()-shot.start<shot.duration){calibrationFrame=requestAnimationFrame(animateShot);}
      else{shot=null;setValue(selected,Math.round(value/s.step)*s.step);$('canvasHint').textContent=`조절 발사 완료 · 착지 지점으로 ${s.label} 설정`;
        const live=$('.live-label');live.textContent='● VALUE SET';setTimeout(()=>live.textContent='● READY',1300);drawControl();}
    };
    calibrationFrame=requestAnimationFrame(animateShot);
  }
  control.addEventListener('pointerdown',e=>{const r=control.getBoundingClientRect();drag={x:e.clientX-r.left,y:e.clientY-r.top};control.setPointerCapture(e.pointerId);drawControl();});
  control.addEventListener('pointermove',e=>{if(!drag)return;const r=control.getBoundingClientRect();drag={x:clamp(e.clientX-r.left,35,r.width-12),y:clamp(e.clientY-r.top,12,r.height-12)};drawControl();});
  control.addEventListener('pointerup',()=>{if(drag)fireControl();});
  control.addEventListener('pointercancel',()=>{drag=null;drawControl();});
  document.querySelectorAll('.variable').forEach(btn=>btn.addEventListener('click',()=>{
    selected=btn.dataset.variable;document.querySelectorAll('.variable').forEach(b=>b.classList.toggle('active',b===btn));updateLabels();
  }));
  $('numberInput').addEventListener('change',e=>setValue(selected,e.target.value));
  function frame(now){
    if(!running)return;const dt=Math.min((now-last)/1000,.04);last=now;t+=dt;
    const m=metrics();if(t>=m.flight){t=m.flight;running=false;$('playBtn').textContent='▶ 다시 재생';}
    drawSim();if(running)animation=requestAnimationFrame(frame);
  }
  $('playBtn').addEventListener('click',()=>{
    if(running){running=false;cancelAnimationFrame(animation);$('playBtn').textContent='▶ 이어서 시작';return;}
    if(t>=metrics().flight)t=0;running=true;last=performance.now();$('playBtn').textContent='Ⅱ 일시정지';animation=requestAnimationFrame(frame);
  });
  $('resetBtn').addEventListener('click',()=>{running=false;cancelAnimationFrame(animation);t=0;$('playBtn').textContent='▶ 시작';drawSim();});
  $('saveTrialBtn').addEventListener('click',()=>{
    const m=metrics();trials.push({...params,range:m.range});renderTrials();
  });
  $('clearTrialsBtn').addEventListener('click',()=>{trials=[];renderTrials();});
  function renderTrials(){
    $('trialRows').innerHTML=trials.length?trials.map((p,i)=>`<tr><td>#${i+1}</td><td>${round(p.speed,1)}</td><td>${round(p.angle,0)}°</td><td>${round(p.mass,1)}</td><td>${round(p.gravity,1)}</td><td>${round(p.range,2)} m</td></tr>`).join(''):'<tr class="empty-row"><td colspan="6">아직 저장된 실험이 없습니다.</td></tr>';
  }
  window.addEventListener('resize',()=>{drawSim();drawControl();});
  updateLabels();drawSim();drawControl();
})();
// ---- Arcade mode: 10-stage projectile target challenge ----
(() => {
  const $ = id => document.getElementById(id);
  const tabs = document.querySelectorAll('.mode-tab');
  tabs.forEach(tab => tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.mode-view').forEach(v => v.classList.remove('active'));
    $(tab.dataset.mode === 'lab' ? 'labMode' : 'gameMode').classList.add('active');
    if (tab.dataset.mode === 'game') { resizeGame(); drawGame(); }
  }));

  const canvas=$('gameCanvas'), ctx=canvas.getContext('2d');
  const angleInput=$('gameAngle'), powerInput=$('gamePower');
  const levels=[
    {name:'첫 발사',desc:'기본 조작 익히기',target:[.72,.72],blocks:[]},
    {name:'조금 더 멀리',desc:'발사 세기 조절',target:[.83,.72],blocks:[]},
    {name:'높이 넘기',desc:'낮은 장애물 통과',target:[.78,.66],blocks:[[.48,.78,.07,.18]]},
    {name:'언덕 너머',desc:'장애물 위로 포물선 만들기',target:[.76,.55],blocks:[[.48,.72,.09,.24]]},
    {name:'좁은 틈',desc:'각도를 섬세하게 조절',target:[.82,.60],blocks:[[.48,.70,.06,.30],[.65,.82,.06,.18]]},
    {name:'높은 표적',desc:'수직 성분을 활용',target:[.72,.42],blocks:[[.46,.78,.08,.22]]},
    {name:'계단 지형',desc:'지형을 피해 목표에 도달',target:[.86,.55],blocks:[[.40,.82,.08,.18],[.57,.74,.08,.26]]},
    {name:'멀고 높은 곳',desc:'속도와 각도 조합',target:[.88,.43],blocks:[[.52,.82,.07,.18],[.69,.73,.07,.27]]},
    {name:'움푹한 길',desc:'장애물 사이 궤적 찾기',target:[.82,.56],blocks:[[.43,.75,.07,.25],[.64,.84,.07,.16]]},
    {name:'마지막 도전',desc:'최종 포물선 퍼즐',target:[.88,.38],blocks:[[.37,.80,.07,.20],[.55,.72,.07,.28],[.73,.82,.06,.18]]}
  ];
  let level=0,unlocked=1,shots=0,hit=false,started=false,ball=null,aim=null,dragging=false,trail=[],raf=0,frameTime=0;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const targetRadius=13;
  function size(){const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,Math.round(r.width*d));canvas.height=Math.max(1,Math.round(r.height*d));ctx.setTransform(d,0,0,d,0,0);return {w:r.width,h:r.height};}
  let W=0,H=0;
  function resizeGame(){const s=size();W=s.w;H=s.h;}
  function geometry(){return {ox:W*.10,oy:H*.79,ground:H*.84};}
  function targetPos(){const l=levels[level],g=geometry();return {x:W*l.target[0],y:H*l.target[1]};}
  function drawGame(){
    if(!W||!H)resizeGame();
    ctx.clearRect(0,0,W,H);
    const g=geometry();
    // starry sky and subtle grid
    ctx.fillStyle='#0a1728';ctx.fillRect(0,0,W,H);
    for(let i=0;i<48;i++){const x=(i*97+23)%W,y=(i*53+17)%(H*.7);ctx.fillStyle=i%4===0?'#9cf0cb55':'#ffffff30';ctx.fillRect(x,y,2,2);}
    ctx.strokeStyle='#243950';ctx.lineWidth=1;
    for(let x=0;x<W;x+=42){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,g.ground);ctx.stroke();}
    for(let y=0;y<g.ground;y+=42){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    // ground
    ctx.fillStyle='#203d43';ctx.fillRect(0,g.ground,W,H-g.ground);
    ctx.fillStyle='#37665b';ctx.fillRect(0,g.ground,W,7);
    // friendly slingshot launcher
    ctx.strokeStyle='#b98759';ctx.lineWidth=8;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(g.ox-7,g.ground);ctx.lineTo(g.ox,H*.53);ctx.moveTo(g.ox+8,g.ground);ctx.lineTo(g.ox+2,H*.57);ctx.stroke();
    ctx.strokeStyle='#d7b17a';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(g.ox-7,H*.56);ctx.lineTo(g.ox+2,H*.57);ctx.stroke();
    // blocks
    levels[level].blocks.forEach((b,i)=>{const x=W*b[0],y=H*b[1],bw=W*b[2],bh=H*b[3];ctx.fillStyle=i%2?'#59738a':'#71899a';ctx.fillRect(x,y,bw,bh);ctx.strokeStyle='#a7bdc8';ctx.strokeRect(x,y,bw,bh);ctx.fillStyle='#ffffff22';ctx.fillRect(x+4,y+4,bw-8,4);});
    // target
    const tp=targetPos();ctx.save();ctx.shadowColor='#ffd27d';ctx.shadowBlur=hit?24:12;ctx.fillStyle=hit?'#9cf0cb':'#ffd27d';ctx.beginPath();ctx.arc(tp.x,tp.y,targetRadius,0,Math.PI*2);ctx.fill();ctx.restore();
    ctx.strokeStyle='#fff4d4';ctx.lineWidth=2;ctx.beginPath();ctx.arc(tp.x,tp.y,targetRadius+5,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='#26384d';ctx.beginPath();ctx.arc(tp.x-4,tp.y-3,2,0,Math.PI*2);ctx.arc(tp.x+4,tp.y-3,2,0,Math.PI*2);ctx.fill();
    // trajectory trail
    if(trail.length){ctx.beginPath();trail.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle='#9cf0cb';ctx.lineWidth=2;ctx.setLineDash([5,5]);ctx.stroke();ctx.setLineDash([]);}
    // aiming guide
    if(aim&&!ball){ctx.strokeStyle='#ffd27d';ctx.lineWidth=2;ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(g.ox,g.oy);ctx.lineTo(aim.x,aim.y);ctx.stroke();ctx.setLineDash([]);}
    // projectile
    const p=ball||{x:g.ox,y:g.oy};ctx.fillStyle='#9cf0cb';ctx.shadowColor='#9cf0cb';ctx.shadowBlur=12;ctx.beginPath();ctx.arc(p.x,p.y,9,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle='#18313a';ctx.beginPath();ctx.arc(p.x-3,p.y-2,1.7,0,Math.PI*2);ctx.arc(p.x+3,p.y-2,1.7,0,Math.PI*2);ctx.fill();
    updateHud();
  }
  function updateHud(){
    $('levelTitle').textContent=`LEVEL ${level+1}`;
    $('levelSubtitle').textContent=levels[level].desc;
    $('shotCount').textContent=`발사 ${shots}회`;
    $('targetCount').textContent=`목표 ${hit?1:0} / 1`;
    $('nextLevel').disabled=!hit||level>=9;
    $('gameMessage').textContent=hit?'성공! 목표를 찾았어요. 다음 레벨로 가세요.':'목표물을 모두 맞혀 보세요!';
    $('levelProgress').innerHTML=levels.map((_,i)=>`<i class="${i<unlocked?'done':''}"></i>`).join('');
    $('levelGrid').innerHTML=levels.map((_,i)=>`<button class="level-button ${i<unlocked?'unlocked':''} ${i===level?'current':''}" data-level="${i}" ${i>=unlocked?'disabled':''}>${i+1}</button>`).join('');
    document.querySelectorAll('.level-button').forEach(b=>b.addEventListener('click',()=>loadLevel(Number(b.dataset.level))));
  }
  function loadLevel(n){
    level=n;shots=0;hit=false;ball=null;aim=null;trail=[];started=true;
    $('gameOverlay').classList.add('hidden');$('gameMessage').textContent='목표물을 모두 맞혀 보세요!';
    updateHud();drawGame();
  }
  function startShot(){
    if(!started||hit||ball)return;
    const g=geometry(),ang=Number(angleInput.value)*Math.PI/180,power=Number(powerInput.value)/100;
    const speed=H*(.78*power),vx=speed*Math.cos(ang),vy=-speed*Math.sin(ang);
    ball={x:g.ox,y:g.oy,vx,vy};shots++;trail=[];frameTime=performance.now();
    $('gameMessage').textContent='날아가는 중…';updateHud();raf=requestAnimationFrame(tick);
  }
  function tick(now){
    if(!ball)return;const dt=Math.min((now-frameTime)/1000,.035);frameTime=now;
    const g=geometry(),tp=targetPos();
    ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;ball.vy+=H*1.45*dt;
    trail.push({x:ball.x,y:ball.y});if(trail.length>150)trail.shift();
    const targetHit=Math.hypot(ball.x-tp.x,ball.y-tp.y)<targetRadius+9;
    let blockHit=false;
    levels[level].blocks.forEach(b=>{const x=W*b[0],y=H*b[1],bw=W*b[2],bh=H*b[3];if(ball.x>x-8&&ball.x<x+bw+8&&ball.y>y-8&&ball.y<y+bh+8)blockHit=true;});
    if(targetHit){hit=true;unlocked=Math.max(unlocked,Math.min(10,level+2));ball=null;$('gameMessage').textContent='정확히 명중!';$('gameOverlay').classList.remove('hidden');$('gameOverlay').querySelector('b').textContent='LEVEL CLEAR!';$('gameOverlay').querySelector('span').textContent=`${shots}번 발사해서 목표를 맞혔습니다.`;$('startGame').textContent='현재 레벨 다시 보기';$('startGame').onclick=()=>loadLevel(level);updateHud();drawGame();return;}
    if(blockHit||ball.y>g.ground+8||ball.x>W+20||ball.x<0){ball=null;$('gameMessage').textContent=blockHit?'장애물에 닿았어요. 각도나 세기를 바꿔 보세요.':'다시 조준해 보세요!';drawGame();return;}
    drawGame();raf=requestAnimationFrame(tick);
  }
  function pointerPos(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
  canvas.addEventListener('pointerdown',e=>{if(!started||hit||ball)return;dragging=true;aim=pointerPos(e);canvas.setPointerCapture(e.pointerId);drawGame();});
  canvas.addEventListener('pointermove',e=>{if(!dragging)return;aim=pointerPos(e);const g=geometry();aim.x=clamp(aim.x,g.ox-15,g.ox+130);aim.y=clamp(aim.y,g.oy-130,g.oy+25);drawGame();});
  canvas.addEventListener('pointerup',()=>{if(!dragging)return;dragging=false;if(aim){const g=geometry(),dx=g.ox-aim.x,dy=aim.y-g.oy;angleInput.value=clamp(Math.round(Math.atan2(dy,Math.max(1,dx))*180/Math.PI),15,75);powerInput.value=clamp(Math.round(Math.hypot(dx,dy)/1.25),20,100);updateControlLabels();}aim=null;startShot();});
  function updateControlLabels(){$('gameAngleValue').textContent=`${angleInput.value}°`;$('gamePowerValue').textContent=`${powerInput.value}%`;}
  angleInput.addEventListener('input',updateControlLabels);powerInput.addEventListener('input',updateControlLabels);
  $('startGame').addEventListener('click',()=>loadLevel(level));
  $('restartLevel').addEventListener('click',()=>loadLevel(level));
  $('nextLevel').addEventListener('click',()=>{if(hit&&level<9)loadLevel(level+1);});
  window.addEventListener('resize',()=>{if($('gameMode').classList.contains('active')){resizeGame();drawGame();}});
  updateControlLabels();resizeGame();updateHud();drawGame();
})();
