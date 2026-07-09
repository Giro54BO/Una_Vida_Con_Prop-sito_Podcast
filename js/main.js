(() => {
  "use strict";

  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---- Nav scroll state ---- */
  const nav = document.querySelector(".nav");
  if (nav) {
    const onScroll = () => {
      nav.classList.toggle("is-scrolled", window.scrollY > 24);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---- Scroll reveal ---- */
  const revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    revealEls.forEach((el, i) => {
      el.style.setProperty("--reveal-delay", `${(i % 3) * 90}ms`);
      io.observe(el);
    });
  } else {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  }

  /* ---- Metric count-up (Comunidad section) ---- */
  const statFigures = document.querySelectorAll(".stat__figure[data-count-to]");
  if (statFigures.length) {
    const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

    const animateCount = (el, delay) => {
      const target = parseInt(el.dataset.countTo, 10);
      const suffix = el.dataset.suffix || "";
      const locale = el.dataset.locale;
      const format = (n) => (locale ? n.toLocaleString(locale) : String(n));

      if (reducedMotionQuery.matches) {
        el.textContent = format(target) + suffix;
        el.classList.add("is-counted");
        return;
      }

      el.style.setProperty("--stat-delay", `${delay}ms`);
      const duration = 1400;
      let start = null;

      const tick = (now) => {
        if (start === null) start = now;
        const elapsed = now - start - delay;
        if (elapsed < 0) {
          requestAnimationFrame(tick);
          return;
        }
        const progress = Math.min(elapsed / duration, 1);
        const value = Math.round(easeOutExpo(progress) * target);
        el.textContent = format(value) + suffix;
        if (progress < 1) {
          requestAnimationFrame(tick);
        } else {
          el.classList.add("is-counted");
        }
      };
      requestAnimationFrame(tick);
    };

    if ("IntersectionObserver" in window) {
      const statIo = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const figures = entry.target.querySelectorAll(".stat__figure[data-count-to]");
            figures.forEach((figure, i) => animateCount(figure, i * 180));
            statIo.unobserve(entry.target);
          });
        },
        { threshold: 0.5 }
      );
      const metricsBlock = document.querySelector(".comunidad__stats");
      if (metricsBlock) statIo.observe(metricsBlock);
    } else {
      statFigures.forEach((el) => animateCount(el, 0));
    }
  }

  /* ---- Hero video: skip entirely under reduced motion ---- */
  const heroVideo = document.querySelector("[data-hero-video]");
  if (heroVideo) {
    const applyMotionPreference = () => {
      if (reducedMotionQuery.matches) {
        heroVideo.pause();
        heroVideo.removeAttribute("autoplay");
        heroVideo.style.display = "none";
      } else {
        heroVideo.style.display = "";
        heroVideo.play().catch(() => {});
      }
    };
    applyMotionPreference();
    reducedMotionQuery.addEventListener("change", applyMotionPreference);
  }

  /* ---- Image slider (Episodios) ---- */
  document.querySelectorAll("[data-slider]").forEach((slider) => {
    const track = slider.querySelector("[data-slider-track]");
    const prevBtn = slider.querySelector("[data-slider-prev]");
    const nextBtn = slider.querySelector("[data-slider-next]");
    if (!track || !prevBtn || !nextBtn) return;

    const stepSize = () => {
      const first = track.querySelector(".slider__item");
      if (!first) return track.clientWidth;
      const gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 0;
      return first.getBoundingClientRect().width + gap;
    };

    const updateButtons = () => {
      const maxScroll = track.scrollWidth - track.clientWidth - 1;
      prevBtn.disabled = track.scrollLeft <= 0;
      nextBtn.disabled = track.scrollLeft >= maxScroll;
    };

    const scrollByStep = (dir) => {
      track.scrollBy({
        left: dir * stepSize(),
        behavior: reducedMotionQuery.matches ? "auto" : "smooth",
      });
    };

    prevBtn.addEventListener("click", () => scrollByStep(-1));
    nextBtn.addEventListener("click", () => scrollByStep(1));
    track.addEventListener("scroll", updateButtons, { passive: true });
    window.addEventListener("resize", updateButtons, { passive: true });
    updateButtons();
  });

  /* ---- Smooth-scroll CTAs to #episodios with fixed-nav offset ---- */
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      const id = link.getAttribute("href").slice(1);
      const target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({
        behavior: reducedMotionQuery.matches ? "auto" : "smooth",
        block: "start",
      });
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    });
  });
})();
