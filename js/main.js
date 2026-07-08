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
