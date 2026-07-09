(() => {
  "use strict";

  const canvas = document.querySelector("[data-hero-shader]");
  if (!canvas) return;

  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const gl =
    canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: false, antialias: false }) ||
    canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false, antialias: false });

  if (!gl) {
    canvas.remove();
    return;
  }

  const vertSrc = `
    attribute vec2 aPos;
    void main() {
      gl_Position = vec4(aPos, 0.0, 1.0);
    }
  `;

  // Brand-led glow that drifts through the hero with a slow, organic breath.
  const fragSrc = `
    precision highp float;
    uniform vec2 uResolution;
    uniform vec2 uGlow;
    uniform float uTime;
    uniform float uIntensity;

    const vec3 BASE   = vec3(0.002, 0.002, 0.003);
    const vec3 EMBER  = vec3(1.0, 0.48, 0.16);     // brighter amber
    const vec3 ORANGE = vec3(1.0, 0.74, 0.32);     // vivid orange
    const vec3 RUST   = vec3(0.86, 0.34, 0.24);    // softer rust

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }

    float fbm(vec2 p) {
      float total = 0.0;
      float amp = 0.5;
      for (int i = 0; i < 4; i++) {
        total += noise(p) * amp;
        p *= 2.02;
        amp *= 0.55;
      }
      return total;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / uResolution.xy;
      float aspect = uResolution.x / uResolution.y;
      vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
      vec2 g = (uGlow / uResolution - 0.5) * vec2(aspect, 1.0);

      float dist = length(p - g);

      float flicker = fbm(p * 2.6 + vec2(uTime * 0.06, -uTime * 0.045));
      float edgeNoise = (flicker - 0.5) * 0.16;

      float glow = smoothstep(0.74, 0.0, dist + edgeNoise * 0.7);
      glow = pow(glow, 1.85);

      float halo = smoothstep(0.92, 0.0, dist + edgeNoise * 0.35);

      vec3 col = mix(BASE, EMBER, clamp(glow * 0.8, 0.0, 1.0));
      col = mix(col, ORANGE, halo * 0.7);
      col = mix(col, RUST, clamp(glow * 0.14, 0.0, 1.0));

      float alpha = glow * 0.6 * uIntensity;

      gl_FragColor = vec4(col * alpha, alpha);
    }
  `;

  function compile(type, src) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn("UVCP shader compile error:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  const vert = compile(gl.VERTEX_SHADER, vertSrc);
  const frag = compile(gl.FRAGMENT_SHADER, fragSrc);
  if (!vert || !frag) {
    canvas.remove();
    return;
  }

  const program = gl.createProgram();
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn("UVCP shader link error:", gl.getProgramInfoLog(program));
    canvas.remove();
    return;
  }
  gl.useProgram(program);

  const quad = new Float32Array([-1, -1, 3, -1, -1, 3]);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uResolution = gl.getUniformLocation(program, "uResolution");
  const uGlow = gl.getUniformLocation(program, "uGlow");
  const uTime = gl.getUniformLocation(program, "uTime");
  const uIntensity = gl.getUniformLocation(program, "uIntensity");

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const hero = canvas.closest(".hero");
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

  let width = 0;
  let height = 0;
  let pointer = { x: 0, y: 0 };
  let glowPos = { x: 0, y: 0 };
  let intensity = 0;
  let targetIntensity = 0;
  let hasPointer = false;
  let rafId = null;
  let startTime = performance.now();

  function resize() {
    const rect = hero.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width * dpr));
    height = Math.max(1, Math.round(rect.height * dpr));
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
    if (!hasPointer) {
      pointer = { x: rect.width * dpr * 0.72, y: rect.height * dpr * 0.32 };
      glowPos = { ...pointer };
    }
  }

  function onPointerMove(e) {
    const rect = hero.getBoundingClientRect();
    hasPointer = true;
    targetIntensity = 1;
    pointer.x = (e.clientX - rect.left) * dpr;
    pointer.y = (rect.height - (e.clientY - rect.top)) * dpr;
  }

  function onPointerLeave() {
    targetIntensity = 0.08;
  }

  function render(now) {
    const t = (now - startTime) / 1000;

    if (!reducedMotionQuery.matches && !hasPointer) {
      const rect = hero.getBoundingClientRect();
      const drift = 0.1;
      pointer.x = (0.5 + Math.sin(t * drift) * 0.28) * rect.width * dpr;
      pointer.y = (0.42 + Math.cos(t * drift * 0.8) * 0.18) * rect.height * dpr;
      targetIntensity = 0.15;
    }

    glowPos.x += (pointer.x - glowPos.x) * 0.08;
    glowPos.y += (pointer.y - glowPos.y) * 0.08;
    intensity += (targetIntensity - intensity) * 0.06;

    gl.uniform2f(uResolution, width, height);
    gl.uniform2f(uGlow, glowPos.x, glowPos.y);
    gl.uniform1f(uTime, reducedMotionQuery.matches ? 0 : t);
    gl.uniform1f(uIntensity, intensity);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    rafId = requestAnimationFrame(render);
  }

  function start() {
    if (rafId) return;
    resize();
    targetIntensity = reducedMotionQuery.matches ? 0.12 : 0.15;
    rafId = requestAnimationFrame(render);
  }

  function stop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  window.addEventListener("resize", resize, { passive: true });

  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => (e.isIntersecting ? start() : stop())),
    { threshold: 0 }
  );
  io.observe(hero);
})();
