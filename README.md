# Luma Lab

An interactive collection of lighting, texture, glass, shadow, and distortion experiments built with HTML, CSS, SVG filters, and lightweight vanilla JavaScript.

No frameworks, Canvas, WebGL, or WebGPU.

The companion `pbr.html` experiment deliberately crosses that boundary: WebGL 2 shades a mapped metal surface while semantic HTML above it mirrors the same light with CSS.

`multi.html` demonstrates two independently resizable WebGL canvases fed by one shared decode of the same PBR source maps. Each context still owns its own GPU texture allocations.

## Run locally

Open `index.html` in a modern browser.

## Included experiments

- SVG height-field diffuse and specular lighting
- CSS radial point lighting
- Per-character dynamic projected shadows
- Brushed-metal reflections
- Glass and known-background refraction cheats
- Animated SVG displacement
