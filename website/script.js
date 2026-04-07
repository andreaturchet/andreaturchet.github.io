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
  const isDesktop = window.matchMedia('(min-width: 1024px)').matches;

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

    // Parallax on hero phone (desktop only)
    if (heroPhoneWrap && isDesktop) {
      const rect = heroPhoneWrap.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;
      const viewCenter = window.innerHeight / 2;
      const offset = (centerY - viewCenter) * 0.06;
      heroPhoneWrap.style.transform = `translateY(${offset}px)`;
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
        waitlistMsg.textContent = data.existing
          ? "You\u2019re already on the waitlist!"
          : "You\u2019re on the list! We\u2019ll email you on launch day.";
        waitlistMsg.className = 'waitlist-msg success';
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
      waitlistBtn.disabled = false;
      waitlistBtn.textContent = 'Join Waitlist';
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
