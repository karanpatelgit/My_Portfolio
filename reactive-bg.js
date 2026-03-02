// Reactive Background Feature (extracted from Index.html)
const reactiveContainer = document.createElement('div');
reactiveContainer.classList.add('reactive-bg');
document.body.insertBefore(reactiveContainer, document.body.firstChild);

let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;
let mathElements = [];

// Math formulas and symbols
const mathSymbols = ['∫', '∑', 'π', '√', '∞', '∂', 'Δ', '∇', '±', '≈', '≠', '≤', '≥', '×', '÷', 'α', 'β', 'γ', 'δ', 'θ', 'λ', 'μ', 'σ', 'ω', 'φ', '∈', '∉', '⊂', '∪', '∩'];
const mathFormulas = ['f(x)', 'e^x', 'log x', 'sin θ', 'cos θ', 'tan θ', 'x²', 'xⁿ', '√x', '∛x', 'lim', 'dy/dx', '∫f(x)dx', 'Σxᵢ', '∏xᵢ'];
const mathSmall = ['x', 'y', 'z', 'n', 'i', 'j', 'k', 'a', 'b', 'c', 'r', 't'];

// Create math formula elements
function createMathElements() {
    // Create 15 large math formulas
    for (let i = 0; i < 15; i++) {
        const formula = document.createElement('div');
        formula.classList.add('math-element', 'math-formula');
        formula.textContent = mathFormulas[Math.floor(Math.random() * mathFormulas.length)];
        
        const x = Math.random() * window.innerWidth;
        const y = Math.random() * window.innerHeight;
        
        formula.style.left = x + 'px';
        formula.style.top = y + 'px';
        
        reactiveContainer.appendChild(formula);
        
        mathElements.push({
            element: formula,
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 2.5,
            vy: (Math.random() - 0.5) * 2.5,
            rotation: Math.random() * 360,
            rotSpeed: (Math.random() - 0.5) * 1.2
        });
    }
    
    // Create 20 medium math symbols
    for (let i = 0; i < 20; i++) {
        const symbol = document.createElement('div');
        symbol.classList.add('math-element', 'math-symbol');
        symbol.textContent = mathSymbols[Math.floor(Math.random() * mathSymbols.length)];
        
        const x = Math.random() * window.innerWidth;
        const y = Math.random() * window.innerHeight;
        
        symbol.style.left = x + 'px';
        symbol.style.top = y + 'px';
        
        reactiveContainer.appendChild(symbol);
        
        mathElements.push({
            element: symbol,
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 3,
            vy: (Math.random() - 0.5) * 3,
            rotation: Math.random() * 360,
            rotSpeed: (Math.random() - 0.5) * 1.5
        });
    }
    
    // Create 15 small math notation
    for (let i = 0; i < 15; i++) {
        const small = document.createElement('div');
        small.classList.add('math-element', 'math-small');
        small.textContent = mathSmall[Math.floor(Math.random() * mathSmall.length)];
        
        const x = Math.random() * window.innerWidth;
        const y = Math.random() * window.innerHeight;
        
        small.style.left = x + 'px';
        small.style.top = y + 'px';
        
        reactiveContainer.appendChild(small);
        
        mathElements.push({
            element: small,
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 1.8,
            vy: (Math.random() - 0.5) * 1.8,
            rotation: 0,
            rotSpeed: (Math.random() - 0.5) * 0.8
        });
    }
    
    // Create 8 sine wave charts
    for (let i = 0; i < 8; i++) {
        const waveContainer = document.createElement('div');
        waveContainer.classList.add('sine-wave-container');
        
        // Create SVG sine wave
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '200');
        svg.setAttribute('height', '80');
        svg.setAttribute('viewBox', '0 0 200 80');
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        let d = 'M 0 40';
        for (let j = 0; j <= 200; j += 5) {
            const y = 40 + Math.sin(j * 0.05 + i) * 25;
            d += ` L ${j} ${y}`;
        }
        path.setAttribute('d', d);
        path.setAttribute('stroke', '#e9c46a');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        path.setAttribute('opacity', '0.6');
        
        svg.appendChild(path);
        waveContainer.appendChild(svg);
        
        const x = Math.random() * window.innerWidth;
        const y = Math.random() * window.innerHeight;
        
        waveContainer.style.left = x + 'px';
        waveContainer.style.top = y + 'px';
        
        reactiveContainer.appendChild(waveContainer);
        
        mathElements.push({
            element: waveContainer,
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 1.5,
            vy: (Math.random() - 0.5) * 1.5,
            rotation: 0,
            rotSpeed: 0,
            isChart: true
        });
    }
    
    // Create 6 graph containers
    for (let i = 0; i < 6; i++) {
        const graphContainer = document.createElement('div');
        graphContainer.classList.add('graph-container');
        
        const graphLine = document.createElement('div');
        graphLine.classList.add('graph-line');
        
        // Create bar chart inside
        const bars = document.createElement('div');
        bars.style.cssText = 'position: absolute; bottom: 2px; left: 10px; right: 10px; height: 80%; display: flex; align-items: flex-end; justify-content: space-around;';
        
        for (let b = 0; b < 5; b++) {
            const bar = document.createElement('div');
            bar.style.cssText = `width: 12px; background: rgba(233, 196, 106, ${0.4 + Math.random() * 0.4}); border-radius: 2px 2px 0 0; height: ${30 + Math.random() * 60}%; animation: graphShimmer ${1 + Math.random()}s ease-in-out infinite; animation-delay: ${b * 0.2}s;`;
            bars.appendChild(bar);
        }
        
        graphLine.appendChild(bars);
        graphContainer.appendChild(graphLine);
        
        const x = Math.random() * window.innerWidth;
        const y = Math.random() * window.innerHeight;
        
        graphContainer.style.left = x + 'px';
        graphContainer.style.top = y + 'px';
        
        reactiveContainer.appendChild(graphContainer);
        
        mathElements.push({
            element: graphContainer,
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 1.2,
            vy: (Math.random() - 0.5) * 1.2,
            rotation: 0,
            rotSpeed: 0,
            isGraph: true
        });
    }
}

// Track mouse position
document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    
    // Update background gradient to follow cursor
    const gradientX = (mouseX / window.innerWidth) * 100;
    const gradientY = (mouseY / window.innerHeight) * 100;
    reactiveContainer.style.background = `radial-gradient(circle at ${gradientX}% ${gradientY}%, rgba(42, 157, 143, 0.4) 0%, rgba(38, 70, 83, 0.8) 50%, #264653 100%), linear-gradient(135deg, #264653, #2a9d8f)`;
});

// Animate math elements
function animateMathElements() {
    mathElements.forEach(elem => {
        // React to mouse - REPULSION/SPLITTING effect (opposite of attraction)
        const dx = mouseX - elem.x;
        const dy = mouseY - elem.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Math elements SPLIT/REPEL away from mouse when close
        if (distance < 300) {
            const angle = Math.atan2(dy, dx);
            const force = (300 - distance) / 300;
            // Repel: negative force pushes elements away (opposite of attraction)
            elem.vx -= Math.cos(angle) * force * 0.8;
            elem.vy -= Math.sin(angle) * force * 0.8;
            
            // Add splitting/stretching visual effect when being repelled
            const stretchFactor = 1 + (force * 0.5);
            elem.element.style.transform = `rotate(${elem.rotation}deg) scale(${stretchFactor}, ${1/stretchFactor})`;
        } else {
            // Continuous floating motion - add constant gentle drift
            elem.vx += (Math.random() - 0.5) * 0.1;
            elem.vy += (Math.random() - 0.5) * 0.1;
            
            // Reset scale when not being affected by mouse
            if (!elem.isChart && !elem.isGraph) {
                elem.element.style.transform = `rotate(${elem.rotation}deg) scale(1, 1)`;
            }
        }
        
        // Apply velocity
        elem.x += elem.vx;
        elem.y += elem.vy;
        
        // Boundary check with bounce
        if (elem.x < 0 || elem.x > window.innerWidth) elem.vx *= -1;
        if (elem.y < 0 || elem.y > window.innerHeight) elem.vy *= -1;
        
        // Clamp position
        elem.x = Math.max(0, Math.min(window.innerWidth, elem.x));
        elem.y = Math.max(0, Math.min(window.innerHeight, elem.y));
        
        // Maintain velocity for continuous movement - reduced damping
        const maxSpeed = elem.isChart ? 1.5 : (elem.isGraph ? 1 : 3);
        const speed = Math.sqrt(elem.vx ** 2 + elem.vy ** 2);
        if (speed > maxSpeed) {
            elem.vx = (elem.vx / speed) * maxSpeed;
            elem.vy = (elem.vy / speed) * maxSpeed;
        }
        
        // Much lighter damping to allow continuous movement
        elem.vx *= 0.995;
        elem.vy *= 0.995;
        
        // Update position
        elem.element.style.left = elem.x + 'px';
        elem.element.style.top = elem.y + 'px';
        
        // Update rotation for symbols - continuous rotation
        if (!elem.isChart && !elem.isGraph) {
            elem.rotation += elem.rotSpeed;
            elem.element.style.transform = `rotate(${elem.rotation}deg)`;
        }
    });
    
    requestAnimationFrame(animateMathElements);
}

// Handle window resize
window.addEventListener('resize', () => {
    reactiveContainer.style.width = window.innerWidth + 'px';
    reactiveContainer.style.height = window.innerHeight + 'px';
});

// Initialize
createMathElements();
animateMathElements();

// Cursor-tracking label for menu (only in menu bar area)
(() => {
  const tracker = document.querySelector('.menu-tracker');
  const navDots = document.querySelector('.nav-dots');
  const dots = document.querySelectorAll('.dot');
  
  if (!tracker || !navDots) return;

  let mouseX = 0, mouseY = 0;
  
  // Track global mouse movement
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    
    // Get menu bar position
    const navRect = navDots.getBoundingClientRect();
    
    // Only update tracker if cursor is over menu area
    if (mouseX >= navRect.left && mouseX <= navRect.right &&
        mouseY >= navRect.top && mouseY <= navRect.bottom) {
      tracker.style.left = mouseX + 'px';
      tracker.style.top = (mouseY - 30) + 'px';
    }
  });

  // Hover behavior for each menu item
  dots.forEach(dot => {
    dot.addEventListener('mouseenter', () => {
      const label = dot.getAttribute('data-label');
      tracker.textContent = label;
      tracker.classList.add('active');
    });

    dot.addEventListener('mouseleave', () => {
      tracker.classList.remove('active');
    });
  });

  // Hide tracker when leaving menu
  navDots.addEventListener('mouseleave', () => {
    tracker.classList.remove('active');
  });
})();
