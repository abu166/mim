import React, { useEffect, useMemo, useRef, useState } from "react";

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}
function rand(min, max) {
  return Math.random() * (max - min) + min;
}
function pick(arr) {
  return arr[(Math.random() * arr.length) | 0];
}

// Draw a heart on canvas at (0,0) with size s.
function drawHeart(ctx, s, fill) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, -0.35 * s);
  ctx.bezierCurveTo(0.5 * s, -0.85 * s, 1.15 * s, -0.15 * s, 0, 0.8 * s);
  ctx.bezierCurveTo(
    -1.15 * s,
    -0.15 * s,
    -0.5 * s,
    -0.85 * s,
    0,
    -0.35 * s
  );
  ctx.closePath();

  ctx.fillStyle = fill;
  ctx.fill();

  // soft highlight
  ctx.globalAlpha *= 0.22;
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.ellipse(
    -0.15 * s,
    -0.22 * s,
    0.18 * s,
    0.12 * s,
    -0.5,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.restore();
}

export default function LoveHeartsCard() {
  const [opened, setOpened] = useState(false);
  const [started, setStarted] = useState(false);

  // cinematic entrance
  const [mounted, setMounted] = useState(false);
  const [showOpenText, setShowOpenText] = useState(false);

  // music
  const [musicOn, setMusicOn] = useState(false);
  const [, setMusicNeedsTap] = useState(false);
  const audioRef = useRef(null);

  // secret line + hug toast
  const [secretUnlocked, setSecretUnlocked] = useState(false);
  const [hugToast, setHugToast] = useState(false);

  // heartbeat / hug intensity
  const bpm = 60; // change if you want
  const [beatTick, setBeatTick] = useState(0); // increments each beat (for CSS remounting)
  const hugRef = useRef({
    holding: false,
    intensity: 0, // eased 0..1
    holdStart: 0,
  });

  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const lastRef = useRef(0);
  const particlesRef = useRef([]);

  // pointer tracking (spiral + bursts)
  const pointerRef = useRef({
    active: false,
    x: 0,
    y: 0,
    justBurst: false,

    lastMoveAt: 0,
    spiralUntil: 0, // timestamp in ms
  });

  const palette = useMemo(
    () => [
      "rgba(220, 20, 60, 0.95)",
      "rgba(255, 64, 129, 0.85)",
      "rgba(255, 105, 180, 0.65)",
      "rgba(255, 0, 85, 0.75)",
      "rgba(255, 170, 200, 0.55)",
    ],
    []
  );

  // --- MUSIC (GitHub Pages safe path) ---
  const musicSrc = `${process.env.PUBLIC_URL}/music.mp3`;

  useEffect(() => {
    setMounted(true);
    const t = setTimeout(() => setShowOpenText(true), 700);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.loop = true;
    a.volume = 0.5;
    a.preload = "auto";
  }, []);

  const tryPlayMusic = async () => {
    const a = audioRef.current;
    if (!a) return;

    try {
      a.muted = false;
      a.load();
      await a.play();
      setMusicOn(true);
      setMusicNeedsTap(false);
    } catch {
      setMusicOn(false);
      setMusicNeedsTap(true);
    }
  };

  const toggleMusic = async () => {
    const a = audioRef.current;
    if (!a) return;

    if (musicOn) {
      a.pause();
      setMusicOn(false);
      return;
    }
    try {
      a.muted = false;
      a.load();
      await a.play();
      setMusicOn(true);
      setMusicNeedsTap(false);
    } catch {
      setMusicOn(false);
      setMusicNeedsTap(true);
    }
  };

  // Resize canvas for crisp rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    window.addEventListener("resize", resize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, []);

  // Start everything when opened
  useEffect(() => {
    if (!opened) return;
    setStarted(true);
    tryPlayMusic();

    // secret unlock after delay
    setSecretUnlocked(false);
    const unlockDelayMs = 5200;
    const t = setTimeout(() => setSecretUnlocked(true), unlockDelayMs);
    return () => clearTimeout(t);
  }, [opened]);

  // Heartbeat timer (BPM)
  useEffect(() => {
    if (!opened) return;
    const interval = Math.round(60000 / bpm);
    const id = setInterval(() => setBeatTick((v) => v + 1), interval);
    return () => clearInterval(id);
  }, [opened, bpm]);

  // Pause animation when tab hidden (performance)
  const pausedRef = useRef(false);
  const stepRef = useRef(() => {});
  useEffect(() => {
    const onVis = () => {
      const hidden = document.visibilityState === "hidden";
      pausedRef.current = hidden;
      if (hidden) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
        lastRef.current = 0;
      } else if (started && !rafRef.current) {
        rafRef.current = requestAnimationFrame(stepRef.current);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [started]);

  // Pointer + click/tap burst + spiral window after move
  useEffect(() => {
    if (!opened) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rectOf = () => canvas.getBoundingClientRect();
    const setXY = (clientX, clientY) => {
      const r = rectOf();
      const dpr = window.devicePixelRatio || 1;
      pointerRef.current.x = (clientX - r.left) * dpr;
      pointerRef.current.y = (clientY - r.top) * dpr;
      pointerRef.current.active = true;

      const now = performance.now();
      pointerRef.current.lastMoveAt = now;
      pointerRef.current.spiralUntil = now + 1000; // 1 second magic orbit
    };

    const onMove = (e) => setXY(e.clientX, e.clientY);
    const onTouchMove = (e) => {
      const t = e.touches && e.touches[0];
      if (!t) return;
      setXY(t.clientX, t.clientY);
    };

    const burstAt = (clientX, clientY) => {
      setXY(clientX, clientY);
      pointerRef.current.justBurst = true;
    };

    const onClick = (e) => burstAt(e.clientX, e.clientY);
    const onTouchStart = (e) => {
      const t = e.touches && e.touches[0];
      if (!t) return;
      burstAt(t.clientX, t.clientY);
    };

    const onLeave = () => {
      pointerRef.current.active = false;
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("click", onClick, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("mouseleave", onLeave);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("click", onClick);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, [opened]);

  // Hold-to-hug (press & hold anywhere)
  useEffect(() => {
    if (!opened) return;

    const down = () => {
      hugRef.current.holding = true;
      hugRef.current.holdStart = performance.now();
    };
    const up = () => {
      const wasHolding = hugRef.current.holding;
      hugRef.current.holding = false;
      if (!wasHolding) return;

      // on release -> big burst + toast
      pointerRef.current.justBurst = true;
      setHugToast(true);
      setTimeout(() => setHugToast(false), 1200);
    };

    window.addEventListener("mousedown", down);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchstart", down, { passive: true });
    window.addEventListener("touchend", up);

    return () => {
      window.removeEventListener("mousedown", down);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchstart", down);
      window.removeEventListener("touchend", up);
    };
  }, [opened]);

  // Canvas animation: cinematic still before open; then hearts + interactions
  useEffect(() => {
    if (!started) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // performance controls
    const MAX_PARTICLES = 650;
    const BASE_SPAWN = 48;
    let spawnPerSec = BASE_SPAWN;

    // heartbeat pulse on particles (small scale modulation)
    const beatPhase = (t) => {
      const period = 60000 / bpm;
      const x = (t % period) / period; // 0..1
      // two-beat feel: quick bump + small second bump
      const bump1 = Math.exp(-Math.pow((x - 0.08) / 0.055, 2));
      const bump2 = 0.55 * Math.exp(-Math.pow((x - 0.22) / 0.085, 2));
      return clamp(bump1 + bump2, 0, 1);
    };

    const spawnOne = (w, h, dpr, xOverride = null, yOverride = null, burst = false) => {
      const depth = rand(0.35, 1); // depth layer
      const x = xOverride ?? rand(0, w);
      const y = yOverride ?? rand(-0.18 * h, 0);
      const size = rand(5, burst ? 18 : 16) * dpr * depth;

      const vy = rand(70, 200) * dpr * depth * (burst ? 0.5 : 1);
      const vx = rand(-10, 10) * dpr + (burst ? rand(-120, 120) * dpr : 0);

      const sway = rand(0.8, 1.8);
      const wobble = rand(0, Math.PI * 2);

      const rot = rand(-0.6, 0.6);
      const vr = rand(-1.4, 1.4);

      const alpha = rand(0.25, 0.95) * (0.55 + 0.45 * depth);
      const fill = pick(palette);
      const life = rand(burst ? 1.0 : 4.0, burst ? 2.0 : 7.0);

      particlesRef.current.push({
        x,
        y,
        vx,
        vy,
        s: size,
        sway,
        wobble,
        rot,
        vr,
        a: alpha,
        fill,
        age: 0,
        life,
        burst,
        depth,
      });

      // cap particles
      const p = particlesRef.current;
      if (p.length > MAX_PARTICLES) {
        p.splice(0, p.length - MAX_PARTICLES);
      }
    };

    const burst = (w, h, dpr, x, y, strength = 1) => {
      const base = 18;
      const count = Math.floor(base + 18 * strength);
      for (let i = 0; i < count; i++) {
        spawnOne(
          w,
          h,
          dpr,
          x + rand(-8, 8) * dpr,
          y + rand(-8, 8) * dpr,
          true
        );
      }
    };

    const step = (t) => {
      if (pausedRef.current) return;
      rafRef.current = requestAnimationFrame(step);

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width;
      const h = canvas.height;

      const dt = lastRef.current ? (t - lastRef.current) / 1000 : 0;
      lastRef.current = t;
      const delta = clamp(dt, 0, 1 / 20);

      // hug intensity easing
      const target = hugRef.current.holding ? 1 : 0;
      hugRef.current.intensity += (target - hugRef.current.intensity) * (1 - Math.pow(0.001, delta));
      const hug = hugRef.current.intensity;

      // adaptive spawn based on FPS
      const fps = delta > 0 ? 1 / delta : 60;
      if (fps < 45) spawnPerSec = Math.max(18, spawnPerSec - 40 * delta);
      else spawnPerSec = Math.min(BASE_SPAWN, spawnPerSec + 25 * delta);

      // softer trail (more romantic)
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = "rgba(255,255,255,1)";
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      // click / hug release burst
      if (pointerRef.current.justBurst) {
        pointerRef.current.justBurst = false;
        const strength = clamp(0.65 + hug * 0.9, 0.65, 1.6);
        const bx = pointerRef.current.x || w / 2;
        const by = pointerRef.current.y || h / 2;
        burst(w, h, dpr, bx, by, strength);
      }

      // spawn from sky (slightly reduced)
      const toSpawn = spawnPerSec * delta;
      const whole = Math.floor(toSpawn);
      const extra = Math.random() < toSpawn - whole ? 1 : 0;
      const spawnCount = whole + extra;

      for (let i = 0; i < spawnCount; i++) {
        spawnOne(w, h, dpr);
      }

      // update & draw
      const p = particlesRef.current;

      const now = performance.now();
      const hasPointer = pointerRef.current.active;
      const tx = pointerRef.current.x;
      const ty = pointerRef.current.y;

      // spiral magic window (1s after moving)
      const spiralActive = hasPointer && now < pointerRef.current.spiralUntil;

      // beat pulse (0..1)
      const beat = beatPhase(t);

      for (let i = p.length - 1; i >= 0; i--) {
        const o = p[i];
        o.age += delta;

        if (o.age > o.life || o.y > h + 0.25 * h) {
          p.splice(i, 1);
          continue;
        }

        o.wobble += delta * o.sway;
        const wind = Math.sin(o.wobble) * 12 * dpr;

        // base drift
        o.x += (o.vx + wind) * delta;
        o.y += o.vy * delta;
        o.rot += o.vr * delta;

        // interaction forces
        // interaction forces
if (hasPointer) {
  const dx = tx - o.x;
  const dy = ty - o.y;
  const dist = Math.hypot(dx, dy) + 0.0001;

  // If holding: FOLLOW cursor strongly (no orbit/spiral),
  // and add damping so particles "stick" instead of overshooting.
  if (hug > 0.01) {
    const influence = clamp(1 - dist / (520 * dpr), 0, 1);

    // strong attraction
    const pull = 520 * dpr * influence * hug;
    o.vx += (dx / dist) * pull * delta;
    o.vy += (dy / dist) * pull * delta;

    // extra damping while holding (prevents escape)
    o.vx *= 1 - 0.55 * influence * hug * delta;
    o.vy *= 1 - 0.55 * influence * hug * delta;

    // clamp speed to keep them near cursor
    const maxV = 520 * dpr * (0.35 + 0.65 * influence);
    o.vx = clamp(o.vx, -maxV, maxV);
    o.vy = clamp(o.vy, -maxV, maxV);

  } else {
    // Not holding: allow brief spiral magic after move
    if (spiralActive) {
      const influence = clamp(1 - dist / (360 * dpr), 0, 1);
      const orbit = 260 * dpr * influence;

      o.vx += (-dy / dist) * orbit * delta;
      o.vy += (dx / dist) * orbit * 0.12 * delta;

      // still keep a light pull so it doesn't "run away"
      const pull = 70 * dpr * influence;
      o.vx += (dx / dist) * pull * delta;
      o.vy += (dy / dist) * pull * 0.18 * delta;

    } else {
      // normal subtle follow
      const influence = clamp(1 - dist / (280 * dpr), 0, 1);
      const pull = 70 * dpr * influence;

      o.vx += (dx / dist) * pull * delta;
      o.vy += (dy / dist) * pull * 0.16 * delta;
    }
  }
}


        // damping
        o.vx *= 0.994;
        o.vy *= o.burst ? 0.994 : 0.9985;

        // wrap sideways
        if (o.x < -0.2 * w) o.x = w + 0.2 * w;
        if (o.x > w + 0.2 * w) o.x = -0.2 * w;

        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.rotate(o.rot);

        // heartbeat pulse: tiny size bump (subtle)
        const beatScale = 1 + 0.06 * beat;

        const fade = 1 - o.age / o.life;
        ctx.globalAlpha = o.a * (0.35 + 0.65 * fade);

        drawHeart(ctx, o.s * beatScale, o.fill);
        ctx.restore();
      }
    };

    stepRef.current = step;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    lastRef.current = 0;
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [started, palette, bpm]);

  // Letter lines (stagger reveal)
  const lines = useMemo(
    () => [
      "Hey mimikun,",
      "I just wanted to say something simple but true…",
      "I love you a lot 💗",
      "You make my days softer, brighter, and better.",
      "Thank you for being you.",
      "— Abu",
    ],
    []
  );


  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-white overflow-hidden relative">
      {/* Cinematic: background hearts are still before open */}
      <BackgroundHearts still={!opened} />

      {/* audio */}
      <audio ref={audioRef} src={musicSrc} preload="auto" />

      {/* canvas for falling hearts */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full transition-opacity duration-700 ${
          opened ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden="true"
      />

      <div className="relative z-10 w-[min(560px,92vw)]">
        <div
          className={`rounded-3xl border border-black/5 bg-white/80 backdrop-blur-xl overflow-hidden
          shadow-[0_18px_60px_rgba(0,0,0,0.12)]
          transition-all duration-1000 ease-out
          ${mounted ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-3 scale-[0.985]"}`}
        >
          <div className="p-6 sm:p-8">
            {/* top controls */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-black/50">{opened ? "tap / hold anywhere" : ""}</span>

              <div className="flex flex-col items-end">
                <button
                  onClick={opened ? toggleMusic : undefined}
                  disabled={!opened}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold border border-black/10 transition
                    ${
                      opened
                        ? "bg-white/70 hover:bg-white opacity-100"
                        : "opacity-0 pointer-events-none translate-y-1"
                    }`}
                  aria-label="Toggle music"
                >
                  <span aria-hidden="true">{musicOn ? "🎵" : "🔇"}</span>
                  <span className="text-black/70">{musicOn ? "Music on" : "Music off"}</span>
                  {musicOn && <span className="ml-1 inline-block w-2 h-2 rounded-full bg-pink-400/70 animate-pulse" />}
                </button>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center">
              <Envelope opened={opened} />
            </div>

            {!opened ? (
              <div className="mt-6 text-center">
                <div
                  className={`text-sm tracking-wide text-black/60 transition-opacity duration-700 ${
                    showOpenText ? "opacity-100" : "opacity-0"
                  }`}
                >
                  I made something for you
                </div>

                <div
                  className={`mt-2 text-2xl sm:text-3xl font-semibold text-black transition-all duration-700 ${
                    showOpenText ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
                  }`}
                >
                  Open it 💌
                </div>

                <button
                  onClick={() => setOpened(true)}
                  className={`mt-5 inline-flex items-center justify-center rounded-2xl px-6 py-3 font-semibold text-white shadow-lg active:scale-[0.98] transition-transform
                    ${showOpenText ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(255,0,85,0.95), rgba(255,105,180,0.85))",
                  }}
                >
                  Open
                </button>
              </div>
            ) : (
              <div className="mt-6">
                {/* heartbeat glow wrapper */}
                <div className="relative">
                  <div
                    className="pointer-events-none absolute -inset-8 -z-10 rounded-[2.2rem] blur-2xl"
                    style={{
                      background:
                        "radial-gradient(closest-side, rgba(255,105,180,0.28), rgba(255,255,255,0))",
                      opacity: musicOn ? 1 : 0.75,
                    }}
                  />

                  <PaperReveal>
                    <div
                      className="text-center text-3xl sm:text-4xl font-extrabold"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(220,20,60,1), rgba(255,105,180,1))",
                        WebkitBackgroundClip: "text",
                        backgroundClip: "text",
                        color: "transparent",
                      }}
                    >
                      I love you 💗
                    </div>

                    <div className="mt-4 space-y-2">
                      {lines.map((txt, i) => (
                        <Line
                          key={i}
                          i={i}
                          className="text-sm sm:text-base text-black/70 text-center"
                        >
                          {txt}
                        </Line>
                      ))}

                      {/* secret unlock line */}
                      <div className="pt-2">
                        <Line
                          i={lines.length + 1}
                          className={`text-sm sm:text-base text-black/70 text-center ${
                            secretUnlocked ? "" : "hidden"
                          }`}
                        >
                        </Line>
                      </div>
                    </div>

                    {/* Hug toast */}
                    <div
                      className={`mt-4 text-center text-sm font-semibold text-pink-600/80 transition-all duration-300 ${
                        hugToast ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1 pointer-events-none"
                      }`}
                    >
                      hug sent 💗
                    </div>
                  </PaperReveal>
                </div>
              </div>
            )}
          </div>

          <div
            className="h-2 w-full"
            style={{
              background:
                "linear-gradient(90deg, rgba(255,170,200,0.0), rgba(255,0,85,0.35), rgba(255,105,180,0.35), rgba(255,170,200,0.0))",
            }}
          />
        </div>

        <div
          className="pointer-events-none absolute -inset-6 -z-10 rounded-[2.25rem] blur-2xl"
          style={{
            background:
              "radial-gradient(closest-side, rgba(255,105,180,0.22), rgba(255,255,255,0))",
          }}
        />
      </div>
    </div>
  );
}

function Envelope({ opened }) {
  return (
    <div className="relative w-[180px] h-[120px]">
      <div className="absolute inset-0 rounded-2xl bg-white border border-black/10 shadow-sm" />

      <div
        className={`absolute left-0 right-0 top-0 mx-auto w-full h-full origin-top transition-transform duration-700 ease-out ${
          opened ? "-rotate-180" : "rotate-0"
        }`}
        style={{
          clipPath: "polygon(0 0, 100% 0, 50% 55%)",
          background:
            "linear-gradient(135deg, rgba(255,0,85,0.15), rgba(255,105,180,0.18))",
          borderTopLeftRadius: "1rem",
          borderTopRightRadius: "1rem",
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          clipPath: "polygon(0 100%, 50% 45%, 100% 100%, 0 100%)",
          background:
            "linear-gradient(135deg, rgba(255,0,85,0.12), rgba(255,105,180,0.14))",
          borderBottomLeftRadius: "1rem",
          borderBottomRightRadius: "1rem",
        }}
      />

      <div
        className={`absolute left-1/2 top-[56%] -translate-x-1/2 -translate-y-1/2 transition-transform duration-700 ${
          opened ? "scale-0 rotate-12" : "scale-100 rotate-0"
        }`}
      >
        <div
          className="w-10 h-10 rounded-2xl shadow-md flex items-center justify-center"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,0,85,0.95), rgba(255,105,180,0.9))",
          }}
        >
          <span className="text-white text-lg" aria-hidden="true">
            ❤
          </span>
        </div>
      </div>
    </div>
  );
}

function PaperReveal({ children, beatKey }) {
  return (
    <div className="relative mx-auto w-full max-w-[480px]">
      {/* paper */}
      <div
        key={beatKey} // re-mount each beat tick => heartbeat CSS restarts cleanly
        className="relative rounded-3xl border border-black/10 bg-white/90 shadow-sm px-5 sm:px-7 py-5 sm:py-6 overflow-hidden
                   animate-[paperUp_900ms_cubic-bezier(.2,.9,.2,1)_both]
                   will-change-transform"
        style={{
          // subtle paper texture-ish
          backgroundImage:
            "radial-gradient(circle at 30% 10%, rgba(255,105,180,0.08), rgba(255,255,255,0) 55%), linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.86))",
        }}
      >
        {/* heartbeat pulse overlay */}
        <div className="pointer-events-none absolute inset-0 animate-[heartbeat_833ms_ease-in-out_both]" />

        <div className="relative">{children}</div>
      </div>

      <style>{`
        @keyframes paperUp {
          0% { transform: translateY(34px) scale(0.98); opacity: 0; }
          100% { transform: translateY(0px) scale(1); opacity: 1; }
        }
        @keyframes heartbeat {
          0% { transform: scale(1); }
          10% { transform: scale(1.03); }
          22% { transform: scale(1.00); }
          32% { transform: scale(1.015); }
          45% { transform: scale(1.00); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

function Line({ i, className = "", children }) {
  return (
    <div
      className={`opacity-0 translate-y-1 ${className}`}
      style={{
        animation: `lineIn 520ms cubic-bezier(.2,.9,.2,1) both`,
        animationDelay: `${240 + i * 140}ms`,
      }}
    >
      {children}
      <style>{`
        @keyframes lineIn {
          0% { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0px); }
        }
      `}</style>
    </div>
  );
}

function BackgroundHearts({ still = false }) {
  const hearts = useMemo(() => {
    const count = 70;
    return Array.from({ length: count }).map((_, i) => {
      const left = rand(0, 100);
      const top = rand(0, 100);
      const size = rand(8, 22);
      const rot = rand(-25, 25);
      const opacity = rand(0.06, 0.14);
      const blur = rand(0, 1.2);
      const color =
        Math.random() < 0.55 ? "rgba(220,20,60,1)" : "rgba(255,105,180,1)";
      return { i, left, top, size, rot, opacity, blur, color };
    });
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {hearts.map((h) => (
        <div
          key={h.i}
          className={`absolute ${still ? "" : "animate-[floaty_6s_ease-in-out_infinite]"}`}
          style={{
            left: `${h.left}%`,
            top: `${h.top}%`,
            transform: `translate(-50%, -50%) rotate(${h.rot}deg)`,
            filter: `blur(${h.blur}px)`,
            opacity: h.opacity,
            fontSize: `${h.size}px`,
            color: h.color,
            animationDelay: `${(h.i % 12) * 0.2}s`,
          }}
        >
          ❤
        </div>
      ))}

      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(closest-side, rgba(255,255,255,0.0), rgba(255,255,255,0.78))",
        }}
      />

      <style>{`
        @keyframes floaty {
          0% { transform: translate(-50%, -50%) translateY(0px) rotate(0deg); }
          50% { transform: translate(-50%, -50%) translateY(-10px) rotate(2deg); }
          100% { transform: translate(-50%, -50%) translateY(0px) rotate(0deg); }
        }
      `}</style>
    </div>
  );
}
