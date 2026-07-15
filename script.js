const root = document.documentElement;
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

document.querySelectorAll('.pointer-stage').forEach((stage) => {
  let frame = 0;
  const update = (event) => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      const box = stage.getBoundingClientRect();
      const px = clamp((event.clientX - box.left) / box.width, 0, 1);
      const py = clamp((event.clientY - box.top) / box.height, 0, 1);
      const surface = stage.querySelector('.hero-orb, .rough-surface, .gradient-plate, .metal-card, .glass-lens');
      const surfaceBox = surface?.getBoundingClientRect() ?? box;
      const localX = event.clientX - surfaceBox.left;
      const localY = event.clientY - surfaceBox.top;
      stage.style.setProperty('--stage-x', `${event.clientX - box.left}px`);
      stage.style.setProperty('--stage-y', `${event.clientY - box.top}px`);
      stage.style.setProperty('--x', `${localX}px`);
      stage.style.setProperty('--y', `${localY}px`);
      stage.style.setProperty('--dx', (px - .5).toFixed(3));
      stage.style.setProperty('--dy', (py - .5).toFixed(3));
      const shadowWord = stage.querySelector('.shadow-word');
      if (shadowWord) {
        const wordBox = shadowWord.getBoundingClientRect();
        stage.style.setProperty('--word-light-x', `${event.clientX - wordBox.left}px`);
        stage.style.setProperty('--word-light-y', `${event.clientY - wordBox.top}px`);
        shadowWord.querySelectorAll('.shadow-char').forEach((char) => {
          const charBox = char.getBoundingClientRect();
          const awayX = charBox.left + charBox.width / 2 - event.clientX;
          const awayY = charBox.top + charBox.height / 2 - event.clientY;
          const distance = Math.hypot(awayX, awayY) || 1;
          const cast = clamp(distance * 0.15, 34, 115);
          const blur = clamp(distance * 0.022, 2, 18);
          const scale = clamp(1 + distance * 0.00055, 1.03, 1.34);
          char.style.setProperty('--char-light-x', `${event.clientX - charBox.left}px`);
          char.style.setProperty('--char-light-y', `${event.clientY - charBox.top}px`);
          char.style.setProperty('--char-shadow-x', `${(awayX / distance * cast).toFixed(1)}px`);
          char.style.setProperty('--char-shadow-y', `${(awayY / distance * cast).toFixed(1)}px`);
          char.style.setProperty('--char-shadow-blur', `${blur.toFixed(1)}px`);
          char.style.setProperty('--char-shadow-scale', scale.toFixed(3));
        });
      }
      stage.querySelector('[data-readout-x]')?.replaceChildren(String(Math.round(px * 100)));
      stage.querySelector('[data-readout-y]')?.replaceChildren(String(Math.round(py * 100)));
      if (stage.hasAttribute('data-svg-light')) {
        document.querySelectorAll('.svg-light').forEach((light) => {
          light.setAttribute('x', String(Math.round(localX)));
          light.setAttribute('y', String(Math.round(localY)));
        });
      }
      frame = 0;
    });
  };
  stage.addEventListener('pointermove', update, { passive: true });
});

document.querySelectorAll('.details-toggle').forEach((button) => {
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(open));
    button.querySelector('span').textContent = open ? '−' : '+';
    button.nextElementSibling.classList.toggle('open', open);
  });
});

const depth = document.querySelector('#depth');
depth?.addEventListener('input', () => {
  document.querySelector('#depth-output').value = depth.value;
  document.querySelectorAll('#rough-surface feDiffuseLighting, #rough-surface feSpecularLighting')
    .forEach((node) => node.setAttribute('surfaceScale', depth.value));
});

document.querySelector('.motion-toggle').addEventListener('click', (event) => {
  const paused = document.body.classList.toggle('paused');
  event.currentTarget.setAttribute('aria-pressed', String(paused));
  event.currentTarget.textContent = paused ? 'Resume motion' : 'Pause motion';
});
