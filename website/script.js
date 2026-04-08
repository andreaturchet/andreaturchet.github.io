(() => {
  'use strict';

  /* ============================================
     PAPEL MARKETING WEBSITE — INTERACTIVITY
     ============================================ */

  // ---- DOM refs ----

  const nav = document.getElementById('nav');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  const heroPhoneWrap = document.querySelector('.hero-phone-wrap');
  const heroPhone = heroPhoneWrap?.querySelector('.phone-device');
  const phoneSplash = document.getElementById('phoneSplash');
  let isMobile = window.innerWidth <= 768;
  let heroAnimDone = false;
  window.addEventListener('resize', () => { isMobile = window.innerWidth <= 768; });

  // ---- Mobile menu ----

  mobileMenuBtn?.addEventListener('click', () => {
    mobileMenu.classList.toggle('open');
  });

  document.querySelectorAll('.mobile-menu a').forEach(a => {
    a.addEventListener('click', () => mobileMenu.classList.remove('open'));
  });

  // ---- Scroll-driven updates (RAF-throttled) ----

  let ticking = false;

  function onScroll() {
    const sy = window.scrollY;

    // Nav background
    if (sy > 80) {
      nav.style.background = 'rgba(10, 6, 16, 0.75)';
      nav.style.borderColor = 'rgba(255,255,255,0.08)';
    } else {
      nav.style.background = '';
      nav.style.borderColor = '';
    }

    // 3D scroll animation on hero phone — one-shot, locks at end state
    if (heroPhone && !heroAnimDone && heroPhoneWrap) {
      const rect = heroPhoneWrap.getBoundingClientRect();
      const winH = window.innerHeight;
      
      // Start animating when the phone's top is at 80% of viewport
      // End when the phone's center reaches the middle of the viewport
      const startTrigger = winH * 0.85;
      const endTrigger = winH * 0.35;
      
      let progress = 0;
      if (rect.top <= startTrigger) {
        progress = Math.min(Math.max((startTrigger - rect.top) / (startTrigger - endTrigger), 0), 1);
      }

      const rotateX = 20 * (1 - progress);
      // On mobile skip scale animation — phone should fill the glass wrapper
      const scaleFrom = isMobile ? 1 : 1.05;
      const scaleTo = isMobile ? 1 : 1;
      const scale = scaleFrom + (scaleTo - scaleFrom) * progress;

      heroPhone.style.transform =
        `rotateX(${rotateX}deg) scale(${scale})`;

      // Fade out splash and lock final state once animation completes
      if (progress >= 1) {
        heroAnimDone = true;
        heroPhone.style.transform = `rotateX(0deg) scale(${scaleTo})`;
        if (phoneSplash) phoneSplash.classList.add('fade-out');
      }
    }

    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(onScroll);
      ticking = true;
    }
  }, { passive: true });

  // ---- Scroll Reveal ----

  const revealEls = document.querySelectorAll('.reveal');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  revealEls.forEach(el => revealObserver.observe(el));

  // ---- Smooth Nav Links ----

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const href = anchor.getAttribute('href');
      if (href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        const y = target.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top: y, behavior: 'smooth' });
        history.pushState(null, '', href);
      }
    });
  });

  // ---- Animated Counter for Hero Stats ----

  const statNums = document.querySelectorAll('.stat-num');
  const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const text = el.textContent;
        if (text.includes('+')) {
          const num = parseInt(text);
          animateCounter(el, 0, num, 1500, '+');
        } else if (text.includes('%')) {
          const num = parseInt(text);
          animateCounter(el, 0, num, 1500, '%');
        }
        statsObserver.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  statNums.forEach(el => {
    if (el.textContent !== 'Free') statsObserver.observe(el);
  });

  function animateCounter(el, start, end, duration, suffix) {
    const startTime = performance.now();
    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const val = Math.round(start + (end - start) * eased);
      el.textContent = val + (val >= end && suffix === '+' ? 'M+' : suffix === '%' ? '%' : 'M+');
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // ---- Waitlist (Supabase RPC with anti-spam) ----

  const SUPABASE_URL = 'https://sbjagbilaweoimgnmlje.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNiamFnYmlsYXdlb2ltZ25tbGplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNjUxMDQsImV4cCI6MjA3Nzg0MTEwNH0.URPSiuvygUmpoN6OMVYKoAqCFnZ8rWXJWc_EhYF0oQ4';

  const waitlistForm = document.getElementById('waitlistForm');
  const waitlistStage = document.getElementById('waitlistStage');
  const waitlistActive = document.getElementById('waitlistActive');
  const waitlistDone = document.getElementById('waitlistDone');
  const waitlistEmail = document.getElementById('waitlistEmail');
  const waitlistMsg = document.getElementById('waitlistMsg');
  const waitlistBtn = document.getElementById('waitlistBtn');
  const waitlistHp = document.getElementById('waitlistHp');
  let waitlistCooldown = 0;

  waitlistForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = waitlistEmail.value.trim();
    if (!email) return;

    if (waitlistCooldown > Date.now()) {
      waitlistMsg.textContent = 'Please wait a moment before trying again.';
      waitlistMsg.className = 'waitlist-msg error';
      return;
    }

    waitlistBtn.disabled = true;
    waitlistBtn.textContent = 'Joining\u2026';
    waitlistMsg.textContent = '';
    waitlistMsg.className = 'waitlist-msg';

    let submitSucceeded = false;

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/join_waitlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          p_email: email,
          p_hp: waitlistHp?.value || ''
        })
      });

      if (!res.ok) throw new Error(res.statusText);

      const data = await res.json();

      if (data.ok) {
        submitSucceeded = true;
        waitlistStage?.classList.add('is-success');
        if (waitlistDone) {
          waitlistDone.hidden = false;
          waitlistDone.setAttribute('aria-hidden', 'false');
        }
        waitlistActive?.setAttribute('aria-hidden', 'true');

        waitlistMsg.textContent = data.existing
          ? "You\u2019re already on the waitlist!"
          : "You\u2019re on the list! We\u2019ll email you on launch day.";
        waitlistMsg.className = 'waitlist-msg success waitlist-msg--enter';
        waitlistEmail.value = '';
        waitlistCooldown = Date.now() + 30000;
      } else if (data.error === 'rate_limit') {
        waitlistMsg.textContent = 'Too many signups right now. Please try again in a few minutes.';
        waitlistMsg.className = 'waitlist-msg error';
        waitlistCooldown = Date.now() + 60000;
      } else if (data.error === 'disposable_email') {
        waitlistMsg.textContent = 'Please use a non-disposable email address.';
        waitlistMsg.className = 'waitlist-msg error';
      } else if (data.error === 'invalid_email') {
        waitlistMsg.textContent = 'Please enter a valid email address.';
        waitlistMsg.className = 'waitlist-msg error';
      } else {
        throw new Error('unexpected');
      }
    } catch {
      waitlistMsg.textContent = 'Something went wrong. Please try again.';
      waitlistMsg.className = 'waitlist-msg error';
    } finally {
      if (!submitSucceeded) {
        waitlistBtn.disabled = false;
        waitlistBtn.textContent = 'Join Waitlist';
      }
    }
  });

  // ---- Analytics (under the hood) ----

  function trackEvent(event, meta = {}) {
    const payload = {
      event,
      meta,
      path: location.pathname + location.hash,
      referrer: document.referrer || null,
      screen: `${screen.width}x${screen.height}`
    };
    fetch(`${SUPABASE_URL}/rest/v1/site_events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => {});
  }

  trackEvent('page_view', {
    ua: navigator.userAgent,
    lang: navigator.language
  });

  const sections = document.querySelectorAll('section[id]');
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        trackEvent('section_view', { section: entry.target.id });
        sectionObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });
  sections.forEach(s => sectionObserver.observe(s));

  document.querySelectorAll('.btn, .app-store-btn, .testflight-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      trackEvent('cta_click', {
        text: btn.textContent.trim().substring(0, 60),
        href: btn.getAttribute('href') || null
      });
    });
  });

  // ============================================
  // ACADEMIC BIRD GAME (Flappy Bird clone)
  // Bird + obstacles use PNG exports of arXiv PDF first pages (assets/game/).
  // ============================================

  const gameModal = document.getElementById('gameModal');
  const gameOverlay = document.getElementById('gameOverlay');
  const gameCloseBtn = document.getElementById('gameCloseBtn');
  const gameCanvas = document.getElementById('gameCanvas');
  const gameStartScreen = document.getElementById('gameStartScreen');
  const gameStartBtn = document.getElementById('gameStartBtn');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const gameRestartBtn = document.getElementById('gameRestartBtn');
  const gameScoreEl = document.getElementById('gameScore');
  const finalScoreEl = document.getElementById('finalScore');
  const bestScoreEl = document.getElementById('bestScore');
  const waitlistThanksPillow = document.getElementById('waitlistThanksPillow');

  const GAME_ASSET_BASE = 'assets/game/';
  const birdPageImg = new Image();
  const obstaclePages = [
    { img: new Image(), file: 'covers/bert.png', name: 'BERT' },
    { img: new Image(), file: 'covers/resnet.png', name: 'ResNet' },
    { img: new Image(), file: 'covers/gpt3.png', name: 'GPT-3' }
  ];
  birdPageImg.src = GAME_ASSET_BASE + 'bird-attention.png';
  obstaclePages.forEach((o) => { o.img.src = GAME_ASSET_BASE + o.file; });

  let gameCtx = null;
  let gameRunning = false;
  let gameScore = 0;
  let bestScore = parseInt(localStorage.getItem('academicBirdBest') || '0');
  let animationId = null;

  const GRAVITY = 0.5;
  const FLAP_FORCE = -8;
  const PIPE_SPEED = 3;
  const PIPE_GAP = 168;
  const PIPE_WIDTH = 88;
  const PIPE_SPAWN_INTERVAL = 1500;
  const BIRD_W = 56;
  const BIRD_H = 42;

  let bird = { x: 80, y: 200, velocity: 0 };
  let pipes = [];
  let lastPipeTime = 0;
  let canvasWidth = 0;
  let canvasHeight = 0;

  function imgReady(img) {
    return img && img.complete && img.naturalWidth > 0;
  }

  function openGame() {
    if (!gameModal) return;
    gameModal.hidden = false;
    gameModal.classList.add('active');
    gameModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    if (!gameCtx && gameCanvas) {
      gameCtx = gameCanvas.getContext('2d');
    }
    requestAnimationFrame(() => {
      resizeCanvas();
      showStartScreen();
    });
  }

  function closeGame() {
    if (!gameModal) return;
    stopGame();
    gameModal.classList.remove('active');
    gameModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    setTimeout(() => { gameModal.hidden = true; }, 300);
  }

  function resizeCanvas() {
    if (!gameCanvas || !gameCtx) return;
    const rect = gameCanvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    gameCanvas.width = Math.floor(w * dpr);
    gameCanvas.height = Math.floor(h * dpr);
    gameCtx.setTransform(1, 0, 0, 1, 0, 0);
    gameCtx.scale(dpr, dpr);
    canvasWidth = w;
    canvasHeight = h;
  }

  function showStartScreen() {
    if (gameStartScreen) gameStartScreen.hidden = false;
    if (gameOverScreen) gameOverScreen.hidden = true;
    if (gameScoreEl) gameScoreEl.classList.remove('visible');
    drawIdleBackground();
  }

  function drawIdleBackground() {
    if (!gameCtx || !canvasWidth) return;
    gameCtx.fillStyle = '#1a1428';
    gameCtx.fillRect(0, 0, canvasWidth, canvasHeight);
    gameCtx.globalAlpha = 0.2;
    for (let i = 0; i < 5; i++) {
      const x = (canvasWidth / 6) * (i + 1);
      const y = canvasHeight * 0.3 + Math.sin(Date.now() / 1000 + i) * 30;
      if (imgReady(birdPageImg)) {
        const s = 36;
        gameCtx.drawImage(birdPageImg, x - s / 2, y - s * 0.35, s, s * 0.75);
      } else {
        drawPaperIcon(x, y, 40, '#667eea');
      }
    }
    gameCtx.globalAlpha = 1;
  }

  function startGame() {
    if (gameStartScreen) gameStartScreen.hidden = true;
    if (gameOverScreen) gameOverScreen.hidden = true;
    if (gameScoreEl) gameScoreEl.classList.add('visible');

    bird = { x: canvasWidth * 0.18, y: canvasHeight / 2, velocity: 0 };
    pipes = [];
    gameScore = 0;
    lastPipeTime = Date.now();
    gameRunning = true;
    updateScoreDisplay();

    if (animationId) cancelAnimationFrame(animationId);
    gameLoop();
  }

  function stopGame() {
    gameRunning = false;
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  function gameLoop() {
    if (!gameRunning) return;
    update();
    draw();
    animationId = requestAnimationFrame(gameLoop);
  }

  function update() {
    bird.velocity += GRAVITY;
    bird.y += bird.velocity;

    if (bird.y < 0 || bird.y + BIRD_H > canvasHeight) {
      gameOver();
      return;
    }

    if (Date.now() - lastPipeTime > PIPE_SPAWN_INTERVAL) {
      spawnPipe();
      lastPipeTime = Date.now();
    }

    for (let i = pipes.length - 1; i >= 0; i--) {
      pipes[i].x -= PIPE_SPEED;

      if (pipes[i].x + PIPE_WIDTH < 0) {
        pipes.splice(i, 1);
        continue;
      }

      if (checkCollision(bird, pipes[i])) {
        gameOver();
        return;
      }

      if (!pipes[i].scored && pipes[i].x + PIPE_WIDTH < bird.x) {
        pipes[i].scored = true;
        gameScore++;
        updateScoreDisplay();
      }
    }
  }

  function spawnPipe() {
    const minY = 72;
    const maxY = canvasHeight - PIPE_GAP - 72;
    const topHeight = Math.random() * (maxY - minY) + minY;
    const pick = obstaclePages[Math.floor(Math.random() * obstaclePages.length)];

    pipes.push({
      x: canvasWidth,
      topHeight,
      bottomY: topHeight + PIPE_GAP,
      scored: false,
      label: pick.name,
      img: pick.img
    });
  }

  function checkCollision(b, pipe) {
    const birdLeft = b.x;
    const birdRight = b.x + BIRD_W;
    const birdTop = b.y;
    const birdBottom = b.y + BIRD_H;
    const pipeLeft = pipe.x;
    const pipeRight = pipe.x + PIPE_WIDTH;
    const pad = 6;

    if (birdRight > pipeLeft + pad && birdLeft < pipeRight - pad) {
      if (birdTop < pipe.topHeight - pad || birdBottom > pipe.bottomY + pad) {
        return true;
      }
    }
    return false;
  }

  function gameOver() {
    gameRunning = false;

    if (gameScore > bestScore) {
      bestScore = gameScore;
      localStorage.setItem('academicBirdBest', bestScore.toString());
    }

    if (finalScoreEl) finalScoreEl.textContent = gameScore;
    if (bestScoreEl) bestScoreEl.textContent = bestScore;
    if (gameOverScreen) gameOverScreen.hidden = false;
    if (gameScoreEl) gameScoreEl.classList.remove('visible');
  }

  function updateScoreDisplay() {
    if (gameScoreEl) gameScoreEl.textContent = gameScore;
  }

  function flap() {
    if (!gameRunning) return;
    bird.velocity = FLAP_FORCE;
  }

  function draw() {
    if (!gameCtx || !canvasWidth) return;

    gameCtx.fillStyle = '#1a1428';
    gameCtx.fillRect(0, 0, canvasWidth, canvasHeight);

    gameCtx.strokeStyle = 'rgba(102, 126, 234, 0.06)';
    gameCtx.lineWidth = 1;
    for (let x = 0; x < canvasWidth; x += 40) {
      gameCtx.beginPath();
      gameCtx.moveTo(x, 0);
      gameCtx.lineTo(x, canvasHeight);
      gameCtx.stroke();
    }
    for (let y = 0; y < canvasHeight; y += 40) {
      gameCtx.beginPath();
      gameCtx.moveTo(0, y);
      gameCtx.lineTo(canvasWidth, y);
      gameCtx.stroke();
    }

    pipes.forEach((pipe) => drawPipe(pipe));
    drawBird(bird);
  }

  function drawPipe(pipe) {
    const bottomH = canvasHeight - pipe.bottomY;
    drawObstacleColumn(pipe.x, 0, PIPE_WIDTH, pipe.topHeight, pipe.img, pipe.label, true);
    drawObstacleColumn(pipe.x, pipe.bottomY, PIPE_WIDTH, bottomH, pipe.img, pipe.label, false);
  }

  function drawObstacleColumn(x, y, w, h, img, label, isTop) {
    if (!gameCtx || h <= 0) return;

    if (imgReady(img)) {
      gameCtx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, x, y, w, h);
      gameCtx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      gameCtx.lineWidth = 2;
      gameCtx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    } else {
      drawObstacleFallback(x, y, w, h, label, isTop);
    }
  }

  function drawObstacleFallback(x, y, w, h, title, isTop) {
    const g = gameCtx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#4a5568');
    g.addColorStop(1, '#2d3748');
    gameCtx.fillStyle = g;
    gameCtx.fillRect(x, y, w, h);
    gameCtx.strokeStyle = '#667eea';
    gameCtx.lineWidth = 2;
    gameCtx.strokeRect(x, y, w, h);
    gameCtx.save();
    gameCtx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    gameCtx.font = 'bold 11px "DM Sans", sans-serif';
    gameCtx.textAlign = 'center';
    if (isTop) {
      gameCtx.translate(x + w / 2, y + h - 16);
      gameCtx.rotate(-Math.PI / 2);
    } else {
      gameCtx.translate(x + w / 2, y + 16);
      gameCtx.rotate(Math.PI / 2);
    }
    gameCtx.fillText(title, 0, 0);
    gameCtx.restore();
  }

  function drawBird(b) {
    if (!gameCtx) return;

    gameCtx.save();
    gameCtx.translate(b.x + BIRD_W / 2, b.y + BIRD_H / 2);
    const rotation = Math.min(Math.max(b.velocity * 0.05, -0.55), 0.55);
    gameCtx.rotate(rotation);

    if (imgReady(birdPageImg)) {
      gameCtx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      gameCtx.shadowBlur = 8;
      gameCtx.shadowOffsetY = 3;
      gameCtx.drawImage(birdPageImg, -BIRD_W / 2, -BIRD_H / 2, BIRD_W, BIRD_H);
      gameCtx.shadowBlur = 0;
      gameCtx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      gameCtx.lineWidth = 1.5;
      gameCtx.strokeRect(-BIRD_W / 2, -BIRD_H / 2, BIRD_W, BIRD_H);
    } else {
      gameCtx.fillStyle = 'rgba(102, 126, 234, 0.35)';
      gameCtx.fillRect(-BIRD_W / 2 + 2, -BIRD_H / 2 + 2, BIRD_W, BIRD_H);
      gameCtx.fillStyle = '#667eea';
      gameCtx.fillRect(-BIRD_W / 2, -BIRD_H / 2, BIRD_W, BIRD_H);
      gameCtx.strokeStyle = '#764ba2';
      gameCtx.lineWidth = 2;
      gameCtx.strokeRect(-BIRD_W / 2, -BIRD_H / 2, BIRD_W, BIRD_H);
      gameCtx.fillStyle = '#ffffff';
      gameCtx.font = 'bold 7px "DM Sans", sans-serif';
      gameCtx.textAlign = 'center';
      gameCtx.textBaseline = 'middle';
      gameCtx.fillText('Attention', 0, -3);
      gameCtx.font = '6px "DM Sans", sans-serif';
      gameCtx.fillText('paper', 0, 5);
    }

    gameCtx.restore();
  }

  function drawPaperIcon(cx, cy, size, color) {
    gameCtx.fillStyle = color;
    gameCtx.fillRect(cx - size / 2, cy - size / 2, size, size);
    gameCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    gameCtx.lineWidth = 1;
    gameCtx.strokeRect(cx - size / 2, cy - size / 2, size, size);
  }

  // Event listeners for game

  // Open game when clicking on thanks pillow (using event delegation)
  document.addEventListener('click', (e) => {
    const pillow = document.getElementById('waitlistThanksPillow');
    if (pillow && (e.target === pillow || pillow.contains(e.target))) {
      e.preventDefault();
      e.stopPropagation();
      openGame();
    }
  });

  // Close game
  gameCloseBtn?.addEventListener('click', closeGame);
  gameOverlay?.addEventListener('click', closeGame);

  // Start/restart game
  gameStartBtn?.addEventListener('click', startGame);
  gameRestartBtn?.addEventListener('click', startGame);

  // Flap on canvas click/tap
  gameCanvas?.addEventListener('click', (e) => {
    if (gameRunning) {
      e.preventDefault();
      flap();
    }
  });

  // Flap on spacebar
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && gameModal && !gameModal.hidden) {
      e.preventDefault();
      if (gameRunning) {
        flap();
      } else if (gameStartBtn && !gameStartScreen?.hidden) {
        startGame();
      } else if (gameRestartBtn && !gameOverScreen?.hidden) {
        startGame();
      }
    }
  });

  // Handle window resize
  window.addEventListener('resize', () => {
    if (gameModal && !gameModal.hidden) {
      resizeCanvas();
      if (!gameRunning) drawIdleBackground();
    }
  });

  const scrollMarks = new Set();
  window.addEventListener('scroll', () => {
    const scrollPct = Math.round(
      (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight * 100
    );
    [25, 50, 75, 100].forEach(mark => {
      if (scrollPct >= mark && !scrollMarks.has(mark)) {
        scrollMarks.add(mark);
        trackEvent('scroll_depth', { depth: mark });
      }
    });
  }, { passive: true });

  const timeMarks = [10, 30, 60, 120];
  let timeIdx = 0;
  const pageStart = Date.now();
  const timeInterval = setInterval(() => {
    if (timeIdx >= timeMarks.length) { clearInterval(timeInterval); return; }
    const elapsed = Math.round((Date.now() - pageStart) / 1000);
    if (elapsed >= timeMarks[timeIdx]) {
      trackEvent('time_on_page', { seconds: timeMarks[timeIdx] });
      timeIdx++;
    }
  }, 5000);

  let exitTracked = false;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && !exitTracked) {
      exitTracked = true;
      const totalSeconds = Math.round((Date.now() - pageStart) / 1000);
      trackEvent('page_exit', { total_seconds: totalSeconds });
    }
  });

})();
