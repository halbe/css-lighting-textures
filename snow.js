const defaults = {
  count: 2400,
  size: 1,
  sizeVariance: .65,
  opacity: 1,
  fallSpeed: 1,
  wind: -.22,
  sway: 1,
  swayRate: 1,
  depthContrast: 1
};

const bounds = {
  count:[150,9000], size:[.35,2.5], sizeVariance:[0,1], opacity:[.1,1.4], fallSpeed:[.25,2.5],
  wind:[-1,1], sway:[0,2.5], swayRate:[.3,2.5], depthContrast:[0,1.8]
};

const stored = (() => {
  try { return JSON.parse(localStorage.getItem('snow-circle-settings')) || {}; }
  catch { return {}; }
})();
const settings = {...defaults};
for (const [key,value] of Object.entries(stored)) {
  if (key in defaults && Number.isFinite(Number(value))) settings[key]=Math.min(bounds[key][1],Math.max(bounds[key][0],Number(value)));
}

let patternSeed=Number(localStorage.getItem('snow-circle-seed'))||8363;
let paused=false;
let rebuildTimer;
const depthLayers=7;
const mount=document.querySelector('#snow-mount');
const controls=[...document.querySelectorAll('[data-setting]')];
const structuralSettings=new Set(['count','sizeVariance']);

function seeded(seed) {
  let value=Math.abs(Math.trunc(seed))%2147483647||1;
  return ()=>(value=value*16807%2147483647)/2147483647;
}

function saveSettings() {
  localStorage.setItem('snow-circle-settings',JSON.stringify(settings));
  localStorage.setItem('snow-circle-seed',String(patternSeed));
}

function formatValue(key,value) {
  if(key==='count') return Math.round(value).toLocaleString();
  if(key==='wind') return `${value>0?'+':''}${Number(value).toFixed(2).replace(/\.?0+$/,'')}`;
  return `${Number(value).toFixed(2).replace(/\.?0+$/,'')}×`;
}

function syncControl(control) {
  const key=control.dataset.setting;
  control.value=settings[key];
  const output=control.closest('label')?.querySelector('output');
  if(output) output.value=formatValue(key,settings[key]);
}

controls.forEach(control=>{
  syncControl(control);
  control.addEventListener('input',()=>{
    const key=control.dataset.setting;
    settings[key]=Number(control.value);
    syncControl(control);
    saveSettings();
    structuralSettings.has(key)?scheduleRender():updateDynamicStyles();
  });
});

function makeSnow(count,depth) {
  const rnd=seeded(patternSeed+107+depth*2017);
  const z=depth/(depthLayers-1);
  const baseRadius=.9+2.65*Math.pow(z,.82);
  const circles=[];
  for(let i=0;i<count;i++) {
    const x=-100+rnd()*1200;
    const y=rnd()*700;
    const scale=1-settings.sizeVariance+rnd()*settings.sizeVariance*1.65;
    const radius=Math.max(.25,baseRadius*scale);
    circles.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(2)}" data-radius="${radius.toFixed(2)}"/>`);
  }
  return circles.join('');
}

function staggeredSnow(id,depth) {
  const z=depth/(depthLayers-1);
  const duration=19-12*Math.pow(z,.86);
  return Array.from({length:4},(_,index)=>`<g class="snow-depth" data-depth="${depth}" data-z="${z.toFixed(4)}" data-duration="${duration.toFixed(3)}" style="animation-delay:${(-duration*index/4).toFixed(3)}s"><use href="#${id}" style="animation-delay:${(-depth*.61-index*.37).toFixed(3)}s"/></g>`).join('');
}

function renderSnow() {
  clearTimeout(rebuildTimer);
  const perDepth=Math.floor(settings.count/depthLayers);
  const counts=Array.from({length:depthLayers},(_,depth)=>depth===depthLayers-1?settings.count-perDepth*(depthLayers-1):perDepth);
  const definitions=counts.map((count,depth)=>`<g id="snow-tile-${depth}" class="snow-tile" data-depth="${depth}" data-z="${(depth/(depthLayers-1)).toFixed(4)}">${makeSnow(count,depth)}</g>`).join('');
  const movingLayers=counts.map((_,depth)=>staggeredSnow(`snow-tile-${depth}`,depth)).join('');
  mount.innerHTML=`<svg class="svg-rain snow-svg" viewBox="0 0 1000 700" preserveAspectRatio="none" aria-hidden="true"><defs>
    ${definitions}
  </defs>
  ${movingLayers}
  </svg>`;
  updateDynamicStyles();
  updateNodeCount();
}

function scheduleRender() {
  clearTimeout(rebuildTimer);
  document.querySelector('#status').textContent='REBUILDING';
  rebuildTimer=setTimeout(renderSnow,100);
}

function updateDynamicStyles() {
  const backOpacity=.14,frontOpacity=.86;
  const neutral=.48;
  mount.querySelectorAll('.snow-tile').forEach(tile=>{
    const z=Number(tile.dataset.z);
    const baseOpacity=backOpacity+(frontOpacity-backOpacity)*Math.pow(z,.88);
    const depthOpacity=neutral+(baseOpacity-neutral)*settings.depthContrast;
    tile.style.opacity=String(Math.max(.03,Math.min(1,depthOpacity*settings.opacity)));
  });
  mount.querySelectorAll('.snow-tile circle').forEach(circle=>circle.setAttribute('r',(Number(circle.dataset.radius)*settings.size).toFixed(2)));
  mount.querySelectorAll('.snow-depth').forEach(group=>{
    const z=Number(group.dataset.z);
    group.style.setProperty('--fall-duration',`${Number(group.dataset.duration)/settings.fallSpeed}s`);
    group.style.setProperty('--sway-duration',`${(6.4-2.9*z)/settings.swayRate}s`);
    group.style.setProperty('--snow-wind-layer',`${settings.wind*(360+300*z)}px`);
    group.style.setProperty('--snow-sway-layer',`${settings.sway*(25+25*z)}px`);
  });
}

function updateNodeCount() {
  document.querySelector('#nodes').textContent=mount.querySelectorAll('*').length.toLocaleString();
}

document.querySelector('#pause').addEventListener('click',event=>{
  paused=!paused;
  mount.classList.toggle('paused',paused);
  event.currentTarget.setAttribute('aria-pressed',String(paused));
  event.currentTarget.textContent=paused?'Resume':'Pause';
});

document.querySelector('#new-pattern').addEventListener('click',()=>{
  patternSeed=(patternSeed+104729)%2147483647||1;
  saveSettings();
  renderSnow();
});

document.querySelector('#reset-controls').addEventListener('click',()=>{
  Object.assign(settings,defaults);
  patternSeed=8363;
  controls.forEach(syncControl);
  saveSettings();
  renderSnow();
});

function estimateVisualMemory() {
  const r=mount.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);
  const bytes=r.width*r.height*d*d*4*3;
  document.querySelector('#visual-memory').textContent=bytes>=1048576?`~${(bytes/1048576).toFixed(1)} MB`:`~${Math.round(bytes/1024)} KB`;
}

const samples=[];
let lastFrame=performance.now(),lastReport=lastFrame,longCount=0,frames=0;
function meter(now) {
  const dt=now-lastFrame;
  lastFrame=now;
  samples.push(dt);
  if(samples.length>180)samples.shift();
  frames++;
  if(dt>20)longCount++;
  if(now-lastReport>=1000) {
    const elapsed=now-lastReport;
    const fps=Math.round(frames*1000/elapsed);
    const sorted=[...samples].sort((a,b)=>a-b);
    const p95=sorted[Math.floor(sorted.length*.95)]||0;
    document.querySelector('#fps').textContent=fps;
    document.querySelector('#p95').textContent=p95.toFixed(1);
    document.querySelector('#long-frames').textContent=(longCount*1000/elapsed).toFixed(1);
    document.querySelector('#fps-bar').style.width=`${Math.min(fps/60*100,100)}%`;
    document.querySelector('#heap').textContent=performance.memory?`${(performance.memory.usedJSHeapSize/1048576).toFixed(1)} MB`:'N/A';
    document.querySelector('#status').textContent=paused?'PAUSED':'MEASURING';
    frames=0;longCount=0;lastReport=now;
  }
  requestAnimationFrame(meter);
}

renderSnow();
estimateVisualMemory();
addEventListener('resize',estimateVisualMemory);
requestAnimationFrame(meter);
