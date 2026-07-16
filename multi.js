const MAP_URLS = ['metal-color.jpg','metal-normal.jpg','metal-roughness.jpg','metal-metalness.jpg','metal-height.jpg'].map(name => `assets/pbr/${name}`);
const panels = [...document.querySelectorAll('[data-panel]')];
const renderers = [];
const light = { x: innerWidth * 0.5, y: innerHeight * 0.32 };
let framePending = false;

const vertexShader = `#version 300 es
precision highp float;
out vec2 vUv;
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);vUv=p;gl_Position=vec4(p*2.0-1.0,0.0,1.0);}`;

const fragmentShader = `#version 300 es
precision highp float;
in vec2 vUv;out vec4 outColor;
uniform sampler2D uColor;uniform sampler2D uNormal;uniform sampler2D uRough;uniform sampler2D uMetal;uniform sampler2D uHeight;
uniform vec2 uResolution;uniform vec3 uLight;uniform float uDpr;
const float PI=3.14159265359;
float D(vec3 n,vec3 h,float r){float a=r*r,a2=a*a,nh=max(dot(n,h),0.0),d=nh*nh*(a2-1.0)+1.0;return a2/max(PI*d*d,.0001);}
float G1(float nv,float r){float k=(r+1.0)*(r+1.0)/8.0;return nv/(nv*(1.0-k)+k);}
vec3 F(float c,vec3 f0){return f0+(1.0-f0)*pow(clamp(1.0-c,0.0,1.0),5.0);}
void main(){
  vec2 uv=gl_FragCoord.xy/(280.0*uDpr);
  float height=texture(uHeight,uv).r;
  uv+=vec2(.012,-.008)*(height-.5);
  vec3 albedo=texture(uColor,uv).rgb;
  vec3 n=normalize(texture(uNormal,uv).rgb*2.0-1.0);
  float rough=clamp(texture(uRough,uv).r,.08,1.0);
  float metal=texture(uMetal,uv).r;
  vec2 fragUv=gl_FragCoord.xy/uResolution;
  vec3 frag=vec3(fragUv,height*.018);
  vec3 Lvec=uLight-frag;float dist=length(Lvec);vec3 l=Lvec/max(dist,.001);
  vec3 v=vec3(0.0,0.0,1.0),h=normalize(v+l);float nl=max(dot(n,l),0.0),nv=max(dot(n,v),0.0);
  vec3 f0=mix(vec3(.04),albedo,metal),f=F(max(dot(h,v),0.0),f0);
  vec3 spec=D(n,h,rough)*G1(nv,rough)*G1(max(dot(n,l),0.0),rough)*f/max(4.0*nv*nl,.001);
  vec3 kd=(1.0-f)*(1.0-metal);vec3 radiance=vec3(1.0,.69,.36)*4.4/(.16+dist*dist*2.1);
  vec3 color=(kd*albedo/PI+spec)*radiance*nl+albedo*vec3(.045,.05,.055);
  color=pow(vec3(1.0)-exp(-color*1.15),vec3(1.0/2.2));outColor=vec4(color,1.0);
}`;

async function loadSharedBitmaps() {
  const blobs = await Promise.all(MAP_URLS.map(async url => {
    const response = await fetch(url, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`Failed to load ${url}`);
    return response.blob();
  }));
  return Promise.all(blobs.map(blob => createImageBitmap(blob, { imageOrientation: 'flipY' })));
}

function compile(gl, type, source) {
  const shader = gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));return shader;
}

function createRenderer(panel, bitmaps) {
  const canvas = panel.querySelector('canvas');
  const gl = canvas.getContext('webgl2',{alpha:false,antialias:false,depth:false,powerPreference:'low-power'});
  if(!gl)throw new Error('WebGL 2 unavailable');
  const program=gl.createProgram();gl.attachShader(program,compile(gl,gl.VERTEX_SHADER,vertexShader));gl.attachShader(program,compile(gl,gl.FRAGMENT_SHADER,fragmentShader));gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
  const textures=bitmaps.map((bitmap,index)=>{const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,index===0?gl.SRGB8_ALPHA8:gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,bitmap);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);return texture;});
  const uniforms=Object.fromEntries(['uColor','uNormal','uRough','uMetal','uHeight','uResolution','uLight','uDpr'].map(name=>[name,gl.getUniformLocation(program,name)]));
  return {panel,canvas,gl,program,textures,uniforms};
}

function draw(renderer) {
  const {panel,canvas,gl,program,textures,uniforms}=renderer;
  const rect=panel.getBoundingClientRect();
  if(rect.bottom<0||rect.top>innerHeight||rect.right<0||rect.left>innerWidth)return;
  const dpr=Math.min(devicePixelRatio||1,1.5),w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
  gl.useProgram(program);textures.forEach((texture,i)=>{gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i([uniforms.uColor,uniforms.uNormal,uniforms.uRough,uniforms.uMetal,uniforms.uHeight][i],i);});
  gl.uniform2f(uniforms.uResolution,w,h);gl.uniform1f(uniforms.uDpr,dpr);
  gl.uniform3f(uniforms.uLight,(light.x-rect.left)/rect.width,1-(light.y-rect.top)/rect.height,.42);
  gl.drawArrays(gl.TRIANGLES,0,3);
}

function updateTextLight(panel) {
  const copy=panel.querySelector('.lit-copy'),rect=copy.getBoundingClientRect();
  copy.style.setProperty('--local-x',`${light.x-rect.left}px`);copy.style.setProperty('--local-y',`${light.y-rect.top}px`);
  const dx=rect.left+rect.width/2-light.x,dy=rect.top+rect.height/2-light.y,d=Math.hypot(dx,dy)||1;
  copy.style.setProperty('--shadow-x',`${(dx/d*16).toFixed(1)}px`);copy.style.setProperty('--shadow-y',`${(dy/d*16).toFixed(1)}px`);
}

function invalidate(){if(framePending||document.hidden)return;framePending=true;requestAnimationFrame(()=>{framePending=false;renderers.forEach(renderer=>{updateTextLight(renderer.panel);draw(renderer);});});}

async function init(){
  try{const bitmaps=await loadSharedBitmaps();panels.forEach(panel=>renderers.push(createRenderer(panel,bitmaps)));bitmaps.forEach(bitmap=>bitmap.close());document.body.classList.add('ready');document.querySelector('#status').textContent='SHARED SOURCE READY';document.querySelector('#detail').textContent='DECODE 1× / GPU TEXTURES 2×';new ResizeObserver(invalidate).observe(panels[0]);new ResizeObserver(invalidate).observe(panels[1]);invalidate();}
  catch(error){console.error(error);document.querySelector('#status').textContent='RENDERER ERROR';document.querySelector('#detail').textContent=error.message.toUpperCase();}
}

addEventListener('pointermove',event=>{light.x=event.clientX;light.y=event.clientY;document.documentElement.style.setProperty('--light-x',`${light.x}px`);document.documentElement.style.setProperty('--light-y',`${light.y}px`);invalidate();},{passive:true});
addEventListener('resize',invalidate,{passive:true});document.addEventListener('visibilitychange',()=>{if(!document.hidden)invalidate();});init();
