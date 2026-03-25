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

})();
