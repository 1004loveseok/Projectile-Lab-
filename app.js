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