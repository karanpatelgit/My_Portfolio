/**
 * reactive-bg.js
 * Handles the animated math-symbols background and nav cursor tracker.
 * Extracted from index.html and refactored for clarity & performance.
 */
 
(() => {
  /* ─────────────────────────────────────────────
     1. REACTIVE BACKGROUND SETUP
  ───────────────────────────────────────────── */
  const reactiveContainer = document.createElement('div');
  reactiveContainer.classList.add('reactive-bg');
  document.body.insertBefore(reactiveContainer, document.body.firstChild);
 
  // Shared mouse position (single source of truth — fixes the shadowing bug)
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
 
  const mathElements = [];
 
  /* ── Symbol / formula pools ── */
  const mathSymbols  = ['∫','∑','π','√','∞','∂','Δ','∇','±','≈','≠','≤','≥','×','÷','α','β','γ','δ','θ','λ','μ','σ','ω','φ','∈','∉','⊂','∪','∩'];
  const mathFormulas = ['f(x)','e^x','log x','sin θ','cos θ','tan θ','x²','xⁿ','√x','∛x','lim','dy/dx','∫f(x)dx','Σxᵢ','∏xᵢ'];
  const mathSmall    = ['x','y','z','n','i','j','k','a','b','c','r','t'];
 
  /* ─── Helpers ─────────────────────────────── */
  function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function randBetween(min, max) { return min + Math.random() * (max - min); }
 
  // Reduce element count on small screens for performance
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const scale    = isMobile ? 0.5 : 1;
 
  /* ─── Element factory ─────────────────────── */
  function spawnElement({ className, text, vMax }) {
    const el = document.createElement('div');
    el.classList.add('math-element', className);
    el.textContent = text;
 
    const x = Math.random() * window.innerWidth;
    const y = Math.random() * window.innerHeight;
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    reactiveContainer.appendChild(el);
 
    mathElements.push({
      element:   el,
      x, y,
      vx:        (Math.random() - 0.5) * vMax,
      vy:        (Math.random() - 0.5) * vMax,
      rotation:  Math.random() * 360,
      rotSpeed:  (Math.random() - 0.5) * 1.5,
      maxSpeed:  vMax,
    });
  }
 
  function createSineWave() {
    const container = document.createElement('div');
    container.classList.add('sine-wave-container');
 
    const svg  = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width',   '200');
    svg.setAttribute('height',  '80');
    svg.setAttribute('viewBox', '0 0 200 80');
 
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const offset = Math.random() * Math.PI * 2;
    let d = 'M 0 40';
    for (let j = 0; j <= 200; j += 5) {
      d += ` L ${j} ${40 + Math.sin(j * 0.05 + offset) * 25}`;
    }
    path.setAttribute('d',            d);
    path.setAttribute('stroke',       '#e9c46a');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill',         'none');
    path.setAttribute('opacity',      '0.6');
    svg.appendChild(path);
    container.appendChild(svg);
 
    const x = Math.random() * window.innerWidth;
    const y = Math.random() * window.innerHeight;
    container.style.left = x + 'px';
    container.style.top  = y + 'px';
    reactiveContainer.appendChild(container);
 
    mathElements.push({
      element: container,
      x, y,
      vx: (Math.random() - 0.5) * 1.5,
      vy: (Math.random() - 0.5) * 1.5,
      rotation: 0, rotSpeed: 0,
      maxSpeed: 1.5,
      isChart: true,
    });
  }
 
  function createBarGraph() {
    const container = document.createElement('div');
    container.classList.add('graph-container');
 
    const line = document.createElement('div');
    line.classList.add('graph-line');
 
    const bars = document.createElement('div');
    bars.style.cssText = 'position:absolute;bottom:2px;left:10px;right:10px;height:80%;display:flex;align-items:flex-end;justify-content:space-around;';
 
    for (let b = 0; b < 5; b++) {
      const bar = document.createElement('div');
      const h   = (30 + Math.random() * 60).toFixed(0);
      const op  = (0.4 + Math.random() * 0.4).toFixed(2);
      const dur = (1 + Math.random()).toFixed(2);
      bar.style.cssText = `width:12px;background:rgba(233,196,106,${op});border-radius:2px 2px 0 0;height:${h}%;animation:graphShimmer ${dur}s ease-in-out infinite;animation-delay:${b * 0.2}s;`;
      bars.appendChild(bar);
    }
    line.appendChild(bars);
    container.appendChild(line);
 
    const x = Math.random() * window.innerWidth;
    const y = Math.random() * window.innerHeight;
    container.style.left = x + 'px';
    container.style.top  = y + 'px';
    reactiveContainer.appendChild(container);
 
    mathElements.push({
      element: container,
      x, y,
      vx: (Math.random() - 0.5) * 1.2,
      vy: (Math.random() - 0.5) * 1.2,
      rotation: 0, rotSpeed: 0,
      maxSpeed: 1.2,
      isGraph: true,
    });
  }
 
  /* ─── Populate scene ──────────────────────── */
  function createMathElements() {
    const n = (count) => Math.round(count * scale);
 
    for (let i = 0; i < n(15); i++) spawnElement({ className: 'math-formula', text: rand(mathFormulas), vMax: 2.5 });
    for (let i = 0; i < n(20); i++) spawnElement({ className: 'math-symbol',  text: rand(mathSymbols),  vMax: 3   });
    for (let i = 0; i < n(15); i++) spawnElement({ className: 'math-small',   text: rand(mathSmall),    vMax: 1.8 });
    for (let i = 0; i < n(8);  i++) createSineWave();
    for (let i = 0; i < n(6);  i++) createBarGraph();
  }
 
  /* ─── Animation loop ──────────────────────── */
  function animateMathElements() {
    for (const elem of mathElements) {
      const dx       = mouseX - elem.x;
      const dy       = mouseY - elem.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
 
      if (distance < 300) {
        // Repel away from cursor
        const angle = Math.atan2(dy, dx);
        const force = (300 - distance) / 300;
        elem.vx -= Math.cos(angle) * force * 0.8;
        elem.vy -= Math.sin(angle) * force * 0.8;
 
        if (!elem.isChart && !elem.isGraph) {
          const s = 1 + force * 0.5;
          elem.element.style.transform = `rotate(${elem.rotation}deg) scale(${s}, ${1 / s})`;
        }
      } else {
        // Gentle drift when out of mouse range
        elem.vx += (Math.random() - 0.5) * 0.1;
        elem.vy += (Math.random() - 0.5) * 0.1;
        if (!elem.isChart && !elem.isGraph) {
          elem.element.style.transform = `rotate(${elem.rotation}deg) scale(1,1)`;
        }
      }
 
      // Move
      elem.x += elem.vx;
      elem.y += elem.vy;
 
      // Bounce off edges
      if (elem.x < 0 || elem.x > window.innerWidth)  elem.vx *= -1;
      if (elem.y < 0 || elem.y > window.innerHeight)  elem.vy *= -1;
      elem.x = Math.max(0, Math.min(window.innerWidth,  elem.x));
      elem.y = Math.max(0, Math.min(window.innerHeight, elem.y));
 
      // Speed cap + light damping
      const speed = Math.sqrt(elem.vx ** 2 + elem.vy ** 2);
      if (speed > elem.maxSpeed) {
        elem.vx = (elem.vx / speed) * elem.maxSpeed;
        elem.vy = (elem.vy / speed) * elem.maxSpeed;
      }
      elem.vx *= 0.995;
      elem.vy *= 0.995;
 
      // Update DOM
      elem.element.style.left = elem.x + 'px';
      elem.element.style.top  = elem.y + 'px';
 
      if (!elem.isChart && !elem.isGraph) {
        elem.rotation += elem.rotSpeed;
        elem.element.style.transform = `rotate(${elem.rotation}deg)`;
      }
    }
    requestAnimationFrame(animateMathElements);
  }
 
  /* ─── Mouse + resize listeners ─────────────── */
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
 
    const gx = (mouseX / window.innerWidth)  * 100;
    const gy = (mouseY / window.innerHeight) * 100;
    reactiveContainer.style.background =
      `radial-gradient(circle at ${gx}% ${gy}%, rgba(42,157,143,0.4) 0%, rgba(38,70,83,0.8) 50%, #264653 100%),
       linear-gradient(135deg, #264653, #2a9d8f)`;
  });
 
  window.addEventListener('resize', () => {
    reactiveContainer.style.width  = window.innerWidth  + 'px';
    reactiveContainer.style.height = window.innerHeight + 'px';
  });
 
  /* ─── Boot ────────────────────────────────── */
  createMathElements();
  animateMathElements();
 
 
  /* ─────────────────────────────────────────────
     2. NAV CURSOR TRACKER
  ───────────────────────────────────────────── */
  (() => {
    const tracker = document.querySelector('.menu-tracker');
    const navDots = document.querySelector('.nav-dots');
    const dots    = document.querySelectorAll('.dot');
 
    if (!tracker || !navDots) return;
 
    // Use the shared mouseX/mouseY from outer scope
    document.addEventListener('mousemove', (e) => {
      const navRect = navDots.getBoundingClientRect();
      if (
        e.clientX >= navRect.left && e.clientX <= navRect.right &&
        e.clientY >= navRect.top  && e.clientY <= navRect.bottom
      ) {
        tracker.style.left = e.clientX + 'px';
        tracker.style.top  = (e.clientY - 30) + 'px';
      }
    });
 
    dots.forEach(dot => {
      dot.addEventListener('mouseenter', () => {
        tracker.textContent = dot.getAttribute('data-label');
        tracker.classList.add('active');
      });
      dot.addEventListener('mouseleave', () => {
        tracker.classList.remove('active');
      });
    });
 
    navDots.addEventListener('mouseleave', () => {
      tracker.classList.remove('active');
    });
  })();
 /* ── DARK / LIGHT MODE TOGGLE ── */
const themeToggle = document.getElementById('themeToggle');
const themeIcon   = document.getElementById('themeIcon');

// Remember user's preference
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'light') {
  document.body.classList.add('light-mode');
  themeIcon.className = 'fas fa-sun';
}

themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('light-mode');

  const isLight = document.body.classList.contains('light-mode');
  themeIcon.className = isLight ? 'fas fa-sun' : 'fas fa-moon';
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
});
 init();
  animate();

  // Active dot on scroll
  const sections = document.querySelectorAll('section[id]');
  const dotLinks = document.querySelectorAll('.dot');

  window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(sec => {
      const top = sec.offsetTop - window.innerHeight / 2;
      if (window.scrollY >= top) current = sec.getAttribute('id');
    });
    dotLinks.forEach(d => {
      d.classList.remove('active');
      if (d.getAttribute('href') === '#' + current) d.classList.add('active');
    });
  }, { passive: true });
})();
 
