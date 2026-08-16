const defaults = {
  dropCount: 4500,
  dropLength: .8,
  dropWidth: .75,
  dropOpacity: .75,
  dropSpeed: 1,
  slant: 12,
  wavesEnabled: true,
  waveCount: 2,
  waveWidth: 1,
  waveOpacity: .65,
  waveVariance: 1,
  waveCore: 1,
  waveSpeed: 1
};

const bounds = {
  dropCount:[300,12000], dropLength:[.4,2], dropWidth:[.4,2.2], dropOpacity:[.1,1.4], dropSpeed:[.35,2.5], slant:[0,30],
  waveCount:[1,4], waveWidth:[.35,2], waveOpacity:[.1,2], waveVariance:[.15,2.2], waveCore:[0,2], waveSpeed:[.35,2.5]
};

const stored = (() => {
  try { return JSON.parse(localStorage.getItem('rain-wave-settings')) || {}; }
  catch { return {}; }
})();

const settings = {...defaults};
for (const [key,value] of Object.entries(stored)) {
  if (!(key in defaults)) continue;
  if (typeof defaults[key] === 'boolean') settings[key] = Boolean(value);
  else if (Number.isFinite(Number(value))) settings[key] = Math.min(bounds[key][1],Math.max(bounds[key][0],Number(value)));
}

let patternSeed = Number(localStorage.getItem('rain-wave-seed')) || 4179;
let paused = false;
let rebuildTimer;
const mount = document.querySelector('#rain-mount');
const controls = [...document.querySelectorAll('[data-setting]')];
const structuralSettings = new Set(['dropCount','dropLength','waveCount','waveWidth','waveVariance']);

function seeded(seed) {
  let value = Math.abs(Math.trunc(seed)) % 2147483647 || 1;
  return () => (value = value * 16807 % 2147483647) / 2147483647;
}

function saveSettings() {
  localStorage.setItem('rain-wave-settings',JSON.stringify(settings));
  localStorage.setItem('rain-wave-seed',String(patternSeed));
}

function formatValue(key,value) {
  if (key === 'dropCount') return Math.round(value).toLocaleString();
  if (key === 'waveCount') return String(Math.round(value));
  if (key === 'slant') return `${Math.round(value)}°`;
  return `${Number(value).toFixed(2).replace(/\.?0+$/,'')}×`;
}

function syncControl(control) {
  const key = control.dataset.setting;
  if (control.type === 'checkbox') control.checked = settings[key];
  else control.value = settings[key];
  const output = control.closest('label')?.querySelector('output');
  if (output) output.value = formatValue(key,settings[key]);
}

controls.forEach(control => {
  syncControl(control);
  control.addEventListener('input',() => {
    const key = control.dataset.setting;
    settings[key] = control.type === 'checkbox' ? control.checked : Number(control.value);
    syncControl(control);
    saveSettings();
    if (structuralSettings.has(key)) scheduleRender();
    else updateDynamicStyles();
  });
});

function makeDrops(count,depth) {
  const rnd = seeded(patternSeed + 101 + depth * 1009);
  const baseLengths = [[8,15],[14,24],[23,38]][depth];
  const lines = [];
  for (let i=0;i<count;i++) {
    const y = rnd()*700;
    const x = -80+rnd()*1160;
    const length = (baseLengths[0]+rnd()*(baseLengths[1]-baseLengths[0]))*settings.dropLength;
    lines.push(`<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x-length*.2126).toFixed(1)}" y2="${(y+length).toFixed(1)}"/>`);
  }
  return lines.join('');
}

function makeSheets(depth,tile) {
  const rnd = seeded(patternSeed + 5003 + depth*10007 + tile*503);
  const paths = [];
  const outer = [250,310,370][depth]*settings.waveWidth;
  const inner = [35,42,50][depth]*settings.waveWidth;
  const alpha = [.7,.86,1][depth];
  const baseBody = [.028,.034,.04][depth];
  const baseCore = [.006,.008,.01][depth];
  for (let i=0;i<settings.waveCount;i++) {
    const y = 80+rnd()*540;
    const amplitude = (90+depth*30)*settings.waveVariance;
    const points = [-220,140,500,860,1220].map((x,index)=>({x,y:y+(index===0?0:(rnd()-.5)*amplitude*2)}));
    let d = `M ${points[0].x} ${points[0].y.toFixed(1)}`;
    for (let p=1;p<points.length;p++) {
      const previous=points[p-1],next=points[p];
      const handle=(next.x-previous.x)*.38;
      const liftA=(rnd()-.5)*amplitude;
      const liftB=(rnd()-.5)*amplitude;
      d+=` C ${(previous.x+handle).toFixed(1)} ${(previous.y+liftA).toFixed(1)}, ${(next.x-handle).toFixed(1)} ${(next.y+liftB).toFixed(1)}, ${next.x} ${next.y.toFixed(1)}`;
    }
    const falloff = Array.from({length:26},(_,layer)=>{
      const t=layer/25;
      const width=outer+(inner-outer)*t;
      const opacity=(.0028+.0042*t*t)*alpha;
      return `<path class="sheet-aura" data-base-opacity="${opacity.toFixed(4)}" style="stroke-width:${width.toFixed(1)}px;opacity:${opacity.toFixed(4)}" d="${d}"/>`;
    }).join('');
    paths.push(`<g class="sheet sheet-${depth}">${falloff}<path class="sheet-body" data-base-opacity="${baseBody}" d="${d}"/><path class="sheet-core" data-base-opacity="${baseCore}" d="${d}"/></g>`);
  }
  return paths.join('');
}

function staggeredDrops(id,depth) {
  const duration=[7.4,4.7,2.8][depth];
  return Array.from({length:4},(_,index)=>`<g class="drop-depth" data-depth="${depth}" data-duration="${duration}" style="animation-delay:${(-duration*index/4).toFixed(3)}s"><use href="#${id}"/></g>`).join('');
}

function staggeredSheetDeck(depth) {
  const duration=[20,13.2,8.4][depth];
  return Array.from({length:8},(_,index)=>`<g class="sheet-depth" data-depth="${depth}" data-duration="${duration}" style="animation-delay:${(-duration*index/8).toFixed(3)}s">${makeSheets(depth,index)}</g>`).join('');
}

function renderRain() {
  clearTimeout(rebuildTimer);
  const perDepth=Math.floor(settings.dropCount/3);
  const counts=[perDepth,perDepth,settings.dropCount-perDepth*2];
  mount.innerHTML = `<svg class="svg-rain svg-wave-rain" viewBox="0 0 1000 700" preserveAspectRatio="none" aria-hidden="true"><defs>
    <linearGradient id="sheet-fade-back" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#bcd9dc" stop-opacity="0"/><stop offset=".18" stop-color="#bcd9dc" stop-opacity=".6"/><stop offset=".82" stop-color="#d7eaeb" stop-opacity=".52"/><stop offset="1" stop-color="#d7eaeb" stop-opacity="0"/></linearGradient>
    <linearGradient id="sheet-fade-mid" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d3e8e9" stop-opacity="0"/><stop offset=".15" stop-color="#d3e8e9" stop-opacity=".72"/><stop offset=".85" stop-color="#ecf7f6" stop-opacity=".62"/><stop offset="1" stop-color="#ecf7f6" stop-opacity="0"/></linearGradient>
    <linearGradient id="sheet-fade-front" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e7f4f4" stop-opacity="0"/><stop offset=".12" stop-color="#e7f4f4" stop-opacity=".82"/><stop offset=".88" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <g id="drop-tile-back" class="drop-tile drop-tile-back" data-depth="0">${makeDrops(counts[0],0)}</g>
    <g id="drop-tile-mid" class="drop-tile drop-tile-mid" data-depth="1">${makeDrops(counts[1],1)}</g>
    <g id="drop-tile-front" class="drop-tile drop-tile-front" data-depth="2">${makeDrops(counts[2],2)}</g>
  </defs>
  ${staggeredDrops('drop-tile-back',0)}
  ${staggeredDrops('drop-tile-mid',1)}
  ${staggeredDrops('drop-tile-front',2)}
  ${staggeredSheetDeck(0)}
  ${staggeredSheetDeck(1)}
  ${staggeredSheetDeck(2)}
  </svg>`;
  updateDynamicStyles();
  updateNodeCount();
}

function scheduleRender() {
  clearTimeout(rebuildTimer);
  document.querySelector('#status').textContent='REBUILDING';
  rebuildTimer=setTimeout(renderRain,100);
}

function updateDynamicStyles() {
  mount.style.setProperty('--rain-skew',`${-settings.slant}deg`);
  const widths=[.55,.9,1.4],opacities=[.28,.46,.72];
  mount.querySelectorAll('.drop-tile').forEach(tile=>{
    const depth=Number(tile.dataset.depth);
    tile.style.strokeWidth=`${widths[depth]*settings.dropWidth}px`;
    tile.style.opacity=String(Math.min(1,opacities[depth]*settings.dropOpacity));
  });
  mount.querySelectorAll('.drop-depth').forEach(group=>group.style.setProperty('--speed',`${Number(group.dataset.duration)/settings.dropSpeed}s`));
  mount.querySelectorAll('.sheet-depth').forEach(group=>{
    group.style.setProperty('--speed',`${Number(group.dataset.duration)/settings.waveSpeed}s`);
    group.style.display=settings.wavesEnabled?'':'none';
  });
  mount.querySelectorAll('.sheet-aura,.sheet-body').forEach(path=>path.style.opacity=String(Number(path.dataset.baseOpacity)*settings.waveOpacity));
  mount.querySelectorAll('.sheet-core').forEach(core=>core.style.opacity=String(Number(core.dataset.baseOpacity)*settings.waveOpacity*settings.waveCore));
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
  patternSeed=(patternSeed+7919)%2147483647 || 1;
  saveSettings();
  renderRain();
});

document.querySelector('#reset-controls').addEventListener('click',()=>{
  Object.assign(settings,defaults);
  patternSeed=4179;
  controls.forEach(syncControl);
  saveSettings();
  renderRain();
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

renderRain();
estimateVisualMemory();
addEventListener('resize',estimateVisualMemory);
requestAnimationFrame(meter);
