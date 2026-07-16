const canvas = document.querySelector('#material');
const stage = document.querySelector('#stage');
const statusEl = document.querySelector('#status');
const detailEl = document.querySelector('#detail');
const gl = canvas.getContext('webgl2', {
  alpha: false,
  antialias: false,
  depth: false,
  stencil: false,
  powerPreference: 'low-power',
  preserveDrawingBuffer: false
});

const state = {
  light: [0.72, 0.64, 0.42],
  exposure: 1.15,
  mode: 0,
  pending: false,
  ready: false,
  program: null,
  textures: []
};

const vertexSource = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const fragmentSource = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uAlbedo;
uniform sampler2D uNormal;
uniform sampler2D uRoughness;
uniform sampler2D uMetalness;
uniform sampler2D uHeight;
uniform vec3 uLight;
uniform vec2 uResolution;
uniform float uExposure;
uniform int uMode;
const float PI = 3.14159265359;

float distributionGGX(vec3 N, vec3 H, float roughness) {
  float a = roughness * roughness;
  float a2 = a * a;
  float nDotH = max(dot(N, H), 0.0);
  float d = nDotH * nDotH * (a2 - 1.0) + 1.0;
  return a2 / max(PI * d * d, 0.0001);
}

float geometrySchlick(float nDotV, float roughness) {
  float r = roughness + 1.0;
  float k = (r * r) / 8.0;
  return nDotV / (nDotV * (1.0 - k) + k);
}

vec3 fresnelSchlick(float cosTheta, vec3 f0) {
  return f0 + (1.0 - f0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

void main() {
  vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
  vec2 tiled = vUv * aspect * 1.45;
  vec3 viewDir = normalize(vec3((vUv - 0.5) * vec2(0.5, -0.35), 1.0));
  float height = texture(uHeight, tiled).r;
  vec2 uv = tiled - viewDir.xy * (height - 0.5) * 0.045;
  vec3 albedo = texture(uAlbedo, uv).rgb;
  vec3 normalTex = texture(uNormal, uv).rgb * 2.0 - 1.0;
  vec3 N = normalize(vec3(normalTex.xy, max(normalTex.z, 0.08)));
  float roughness = clamp(texture(uRoughness, uv).r, 0.08, 1.0);
  float metallic = texture(uMetalness, uv).r;

  if (uMode == 1) { fragColor = vec4(pow(albedo, vec3(1.0 / 2.2)), 1.0); return; }
  if (uMode == 2) { fragColor = vec4(N * 0.5 + 0.5, 1.0); return; }
  if (uMode == 3) { fragColor = vec4(vec3(roughness), 1.0); return; }
  if (uMode == 4) { fragColor = vec4(vec3(metallic), 1.0); return; }
  if (uMode == 5) { fragColor = vec4(vec3(height), 1.0); return; }

  vec3 fragPos = vec3(vUv, height * 0.025);
  vec3 lightPos = vec3(uLight.xy, uLight.z);
  vec3 Lvec = lightPos - fragPos;
  float distance = length(Lvec);
  vec3 L = Lvec / max(distance, 0.001);
  vec3 V = viewDir;
  vec3 H = normalize(V + L);
  float attenuation = 1.0 / (0.12 + distance * distance * 2.2);
  vec3 radiance = vec3(1.0, 0.72, 0.42) * 4.6 * attenuation;

  vec3 f0 = mix(vec3(0.04), albedo, metallic);
  float NDF = distributionGGX(N, H, roughness);
  float G = geometrySchlick(max(dot(N, V), 0.0), roughness) * geometrySchlick(max(dot(N, L), 0.0), roughness);
  vec3 F = fresnelSchlick(max(dot(H, V), 0.0), f0);
  vec3 specular = (NDF * G * F) / max(4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0), 0.001);
  vec3 kD = (1.0 - F) * (1.0 - metallic);
  float nDotL = max(dot(N, L), 0.0);
  vec3 color = (kD * albedo / PI + specular) * radiance * nDotL;
  color += albedo * vec3(0.045, 0.052, 0.06);
  color = vec3(1.0) - exp(-color * uExposure);
  color = pow(color, vec3(1.0 / 2.2));
  fragColor = vec4(color, 1.0);
}`;

function fail(message) {
  document.body.classList.add('webgl-error');
  statusEl.textContent = 'RENDERER ERROR';
  detailEl.textContent = message.toUpperCase();
}

function compile(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

function makeProgram() {
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  return program;
}

async function loadBitmap(url) {
  const response = await fetch(url, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`Unable to load ${url}`);
  return createImageBitmap(await response.blob(), { imageOrientation: 'flipY' });
}

function upload(bitmap, color = false) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, color ? gl.SRGB8_ALPHA8 : gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  bitmap.close();
  return texture;
}

function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  const width = Math.max(1, Math.round(innerWidth * dpr));
  const height = Math.max(1, Math.round(innerHeight * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
  }
}

function render() {
  if (!state.ready || document.hidden) return;
  resize();
  gl.useProgram(state.program);
  state.textures.forEach((texture, index) => {
    gl.activeTexture(gl.TEXTURE0 + index);
    gl.bindTexture(gl.TEXTURE_2D, texture);
  });
  ['uAlbedo','uNormal','uRoughness','uMetalness','uHeight'].forEach((name, i) => gl.uniform1i(gl.getUniformLocation(state.program, name), i));
  gl.uniform3fv(gl.getUniformLocation(state.program, 'uLight'), state.light);
  gl.uniform2f(gl.getUniformLocation(state.program, 'uResolution'), canvas.width, canvas.height);
  gl.uniform1f(gl.getUniformLocation(state.program, 'uExposure'), state.exposure);
  gl.uniform1i(gl.getUniformLocation(state.program, 'uMode'), state.mode);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function invalidate() {
  if (state.pending || document.hidden) return;
  state.pending = true;
  requestAnimationFrame(() => { state.pending = false; render(); });
}

function updateDomLight(clientX, clientY) {
  document.documentElement.style.setProperty('--light-x', `${clientX}px`);
  document.documentElement.style.setProperty('--light-y', `${clientY}px`);
  document.querySelectorAll('.lit').forEach((element) => {
    const box = element.getBoundingClientRect();
    element.style.setProperty('--local-light-x', `${clientX - box.left}px`);
    element.style.setProperty('--local-light-y', `${clientY - box.top}px`);
    const dx = box.left + box.width / 2 - clientX;
    const dy = box.top + box.height / 2 - clientY;
    const distance = Math.hypot(dx, dy) || 1;
    element.style.setProperty('--shadow-x', `${(dx / distance * 18).toFixed(1)}px`);
    element.style.setProperty('--shadow-y', `${(dy / distance * 18).toFixed(1)}px`);
  });
}

async function init() {
  if (!gl) { fail('WebGL 2 unavailable'); return; }
  try {
    state.program = makeProgram();
    const paths = ['metal-color.jpg','metal-normal.jpg','metal-roughness.jpg','metal-metalness.jpg','metal-height.jpg'].map(name => `assets/pbr/${name}`);
    const maps = await Promise.all(paths.map(loadBitmap));
    state.textures = maps.map((bitmap, index) => upload(bitmap, index === 0));
    state.ready = true;
    statusEl.textContent = 'PBR READY';
    detailEl.textContent = '5 MAPS / DRAW ON INVALIDATE';
    render();
  } catch (error) {
    console.error(error);
    fail(error.message || 'Initialization failed');
  }
}

addEventListener('pointermove', (event) => {
  updateDomLight(event.clientX, event.clientY);
  state.light[0] = event.clientX / innerWidth;
  state.light[1] = 1 - event.clientY / innerHeight;
  invalidate();
}, { passive: true });

addEventListener('resize', invalidate, { passive: true });
document.addEventListener('visibilitychange', () => { if (!document.hidden) invalidate(); });

document.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('[data-mode]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  state.mode = Number(button.dataset.mode);
  invalidate();
}));

document.querySelector('#light-height').addEventListener('input', (event) => {
  state.light[2] = Number(event.target.value) / 100;
  document.querySelector('#height-value').value = state.light[2].toFixed(2);
  invalidate();
});

document.querySelector('#exposure').addEventListener('input', (event) => {
  state.exposure = Number(event.target.value) / 100;
  document.querySelector('#exposure-value').value = state.exposure.toFixed(2);
  invalidate();
});

canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); state.ready = false; fail('Context lost'); });
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js');
updateDomLight(innerWidth * 0.72, innerHeight * 0.36);
init();
