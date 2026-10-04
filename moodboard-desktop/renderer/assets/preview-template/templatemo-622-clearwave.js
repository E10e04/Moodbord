/*
TemplateMo 622 Clearwave
https://templatemo.com/tm-622-clearwave
Free for personal and commercial use
*/

/* ── Smooth Scroll (JS-driven, overrides CSS) ── */
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    const href = link.getAttribute('href');
    if (href === '#') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    }
  });
});

    /* ── NAV SCROLL ── */
    const nav = document.getElementById('mainNav');
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 40);
    }, { passive: true });

    /* ── MOBILE MENU ── */
    const hamburger = document.getElementById('hamburger');
    const mobileMenu = document.getElementById('mobileMenu');

    function openMobileMenu() {
      hamburger.classList.add('open');
      mobileMenu.classList.add('open');
      hamburger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }
    function closeMobileMenu() {
      hamburger.classList.remove('open');
      mobileMenu.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
    hamburger.addEventListener('click', () => {
      mobileMenu.classList.contains('open') ? closeMobileMenu() : openMobileMenu();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMobileMenu(); });
    // Close menu when a link is clicked — smooth scroll handled by global handler above
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => closeMobileMenu());
    });

    /* ── SCROLL REVEAL ── */
    const revealEls = document.querySelectorAll('.reveal');
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(el => revealObserver.observe(el));

    /* ── STAT COUNTERS ── */
    function animateCounter(el) {
      const target = parseFloat(el.dataset.target);
      const decimal = el.dataset.decimal;
      const duration = 1800;
      const start = performance.now();
      function step(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 4);
        const val = eased * target;
        el.textContent = decimal ? val.toFixed(1) : Math.floor(val);
        if (progress < 1) requestAnimationFrame(step);
        else el.textContent = decimal ? target.toFixed(1) : target;
      }
      requestAnimationFrame(step);
    }
    const statObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.querySelectorAll('.stat-num').forEach(animateCounter);
          statObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    document.querySelectorAll('.stats-grid').forEach(el => statObserver.observe(el));

    /* ── 3D CAROUSEL ── */
    const cards = Array.from(document.querySelectorAll('.phone-card'));
    const totalCards = cards.length;
    let currentCenter = 2;
    let autoTimer = null;
    let isAnimating = false;

    // Zoom steps
    const zoomSteps = [
      { pw: 160, g1: 178, g2: 316, gh: 450, sh: 420 },
      { pw: 200, g1: 222, g2: 395, gh: 560, sh: 520 },
      { pw: 240, g1: 266, g2: 474, gh: 670, sh: 620 },
      { pw: 280, g1: 310, g2: 553, gh: 780, sh: 720 },
      { pw: 320, g1: 354, g2: 632, gh: 890, sh: 820 },
    ];
    let zoomLevel = 2;

    // Per-position config: [translateX multiplier, rotateY, scale, opacity]
    const posConfig = {
      'center':       [  0,    0,    1,    1   ],
      'left1':        [ -1,   28,  0.82,  1   ],
      'right1':       [  1,  -28,  0.82,  1   ],
      'left2':        [ -1,   45,  0.64,  0.55],
      'right2':       [  1,  -45,  0.64,  0.55],
      'hidden-left':  [ -1,   60,  0.48,  0   ],
      'hidden-right': [  1,  -60,  0.48,  0   ],
    };
    const posGap = {
      'center': 0, 'left1': 'g1', 'right1': 'g1',
      'left2': 'g2', 'right2': 'g2',
      'hidden-left': 'gh', 'hidden-right': 'gh',
    };

    // Single function: apply width + transform + opacity to all cards atomically
    function applyCardStyles(suppressTransition) {
      const s = zoomSteps[zoomLevel];
      cards.forEach(card => {
        const pos = card.dataset.pos;
        const cfg = posConfig[pos];
        if (!cfg) return;
        const gapKey = posGap[pos];
        const tx = cfg[0] * (gapKey ? s[gapKey] : 0);
        const shell = card.querySelector('.phone-shell');

        if (suppressTransition) {
          card.style.transition = 'none';
          if (shell) shell.style.transition = 'none';
        }

        card.style.width   = s.pw + 'px';
        card.style.transform = `translateX(${tx}px) rotateY(${cfg[1]}deg) scale(${cfg[2]})`;
        card.style.opacity = cfg[3];
        if (shell) {
          shell.style.width = s.pw + 'px';
          // Update center shadow via JS too
          if (pos === 'center') {
            /* [Moodboard Preview] lueur du téléphone central : suit la couleur
               d'accent du moodboard (variables injectées par le moteur). */
            shell.style.boxShadow = '0 0 0 1px rgba(var(--preview-extra-6-rgb, 150,175,170), 0.6), 0 40px 80px rgba(var(--preview-ink-rgb, 13,30,28), 0.22), 0 0 48px rgba(var(--preview-accent-rgb, 26,122,110), 0.12), inset 0 1px 0 rgba(255,255,255,0.6)';
          } else {
            shell.style.boxShadow = '';
          }
        }

        if (suppressTransition) {
          // Re-enable transitions next frame
          requestAnimationFrame(() => {
            card.style.transition = '';
            if (shell) shell.style.transition = '';
          });
        }
      });
      carouselStageEl.style.height = s.sh + 'px';
    }

    function getPositionForOffset(cardIndex, centerIndex, total) {
      let offset = cardIndex - centerIndex;
      while (offset > Math.floor(total / 2)) offset -= total;
      while (offset < -Math.floor(total / 2)) offset += total;
      const posMap = { '-2': 'left2', '-1': 'left1', '0': 'center', '1': 'right1', '2': 'right2' };
      return posMap[String(offset)] || (offset < 0 ? 'hidden-left' : 'hidden-right');
    }

    function updatePositions() {
      cards.forEach((card, i) => {
        card.dataset.pos = getPositionForOffset(i, currentCenter, totalCards);
      });
      document.querySelectorAll('.carousel-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === currentCenter);
      });
      applyCardStyles(false); // allow transitions for sliding
    }

    function goTo(index) {
      if (isAnimating) return;
      isAnimating = true;
      currentCenter = ((index % totalCards) + totalCards) % totalCards;
      updatePositions();
      setTimeout(() => { isAnimating = false; }, 700);
    }

    function next() { goTo((currentCenter + 1) % totalCards); }
    function prev() { goTo((currentCenter - 1 + totalCards) % totalCards); }

    // Build dots
    const dotsContainer = document.getElementById('carouselDots');
    cards.forEach((_, i) => {
      const dot = document.createElement('div');
      dot.className = 'carousel-dot' + (i === currentCenter ? ' active' : '');
      dot.addEventListener('click', () => goTo(i));
      dotsContainer.appendChild(dot);
    });

    document.getElementById('carouselNext').addEventListener('click', () => { next(); resetAuto(); });
    document.getElementById('carouselPrev').addEventListener('click', () => { prev(); resetAuto(); });

    cards.forEach((card, i) => {
      card.addEventListener('click', () => {
        if (card.dataset.pos !== 'center') { goTo(i); resetAuto(); }
      });
    });

    function startAuto() { autoTimer = setInterval(next, 3500); }
    function stopAuto()  { clearInterval(autoTimer); }
    function resetAuto() { stopAuto(); startAuto(); }

    const stage = document.getElementById('carouselStage');
    stage.addEventListener('mouseenter', stopAuto);
    stage.addEventListener('mouseleave', startAuto);

    let touchStartX = 0;
    stage.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener('touchend', e => {
      const diff = touchStartX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 40) { diff > 0 ? next() : prev(); resetAuto(); }
    });

    /* ── CAROUSEL ZOOM ── */
    const zoomPipsEl      = document.getElementById('zoomPips');
    const zoomInBtn       = document.getElementById('zoomIn');
    const zoomOutBtn      = document.getElementById('zoomOut');
    const carouselStageEl = document.getElementById('carouselStage');

    zoomSteps.forEach((_, i) => {
      const pip = document.createElement('div');
      pip.className = 'zoom-pip' + (i === zoomLevel ? ' active' : '');
      pip.addEventListener('click', () => setZoom(i));
      zoomPipsEl.appendChild(pip);
    });

    function setZoom(level) {
      zoomLevel = Math.max(0, Math.min(zoomSteps.length - 1, level));
      applyCardStyles(true); // suppress transition so width snaps, then transform animates
      zoomPipsEl.querySelectorAll('.zoom-pip').forEach((p, i) => {
        p.classList.toggle('active', i === zoomLevel);
      });
      zoomOutBtn.disabled = zoomLevel === 0;
      zoomInBtn.disabled  = zoomLevel === zoomSteps.length - 1;
    }

    zoomInBtn.addEventListener('click',  () => setZoom(zoomLevel + 1));
    zoomOutBtn.addEventListener('click', () => setZoom(zoomLevel - 1));

    // Init
    updatePositions();
    setZoom(zoomLevel);
    startAuto();

    /* ── PRICING TOGGLE ── */
    const prices = { starter: [20, 13], pro: [60, 39], ent: [150, 98] };
    const annualTotals = { starter: 156, pro: 468, ent: 1176 };
    let isAnnual = false;
    const pricingToggle = document.getElementById('pricingToggle');
    const monthlyLabel = document.getElementById('monthlyLabel');
    const annualLabel = document.getElementById('annualLabel');

    function updatePricing() {
      const idx = isAnnual ? 1 : 0;
      document.getElementById('price-starter').textContent = prices.starter[idx];
      document.getElementById('price-pro').textContent = prices.pro[idx];
      document.getElementById('price-ent').textContent = prices.ent[idx];
      document.getElementById('annual-note-starter').textContent = isAnnual ? `$${annualTotals.starter} billed annually` : '\u00a0';
      document.getElementById('annual-note-pro').textContent     = isAnnual ? `$${annualTotals.pro} billed annually` : '\u00a0';
      document.getElementById('annual-note-ent').textContent     = isAnnual ? `$${annualTotals.ent} billed annually` : '\u00a0';
      monthlyLabel.classList.toggle('active', !isAnnual);
      annualLabel.classList.toggle('active', isAnnual);
      pricingToggle.classList.toggle('annual', isAnnual);
      pricingToggle.setAttribute('aria-checked', isAnnual);
    }

    pricingToggle.addEventListener('click', () => { isAnnual = !isAnnual; updatePricing(); });
    pricingToggle.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); isAnnual = !isAnnual; updatePricing(); }
    });

    /* ── FAQ ACCORDION ── */
    const faqItems = document.querySelectorAll('.faq-item');
    let allOpen = false;

    faqItems.forEach(item => {
      const question = item.querySelector('.faq-question');
      question.addEventListener('click', () => toggleFaq(item));
      question.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleFaq(item); }
      });
    });

    function toggleFaq(item) {
      const isOpen = item.classList.contains('open');
      item.classList.toggle('open', !isOpen);
      item.querySelector('.faq-question').setAttribute('aria-expanded', !isOpen);
    }

    const faqToggleAllBtn = document.getElementById('faqToggleAll');
    const faqToggleIcon  = document.getElementById('faqToggleIcon');
    faqToggleAllBtn.addEventListener('click', () => {
      allOpen = !allOpen;
      faqItems.forEach(item => {
        item.classList.toggle('open', allOpen);
        item.querySelector('.faq-question').setAttribute('aria-expanded', String(allOpen));
      });
      faqToggleIcon.textContent = allOpen ? '−' : '+';
      faqToggleAllBtn.lastChild.textContent = allOpen ? ' Collapse all' : ' Expand all';
    });
