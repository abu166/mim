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
  ctx.bezierCurveTo(-1.15 * s, -0.15 * s, -0.5 * s, -0.85 * s, 0, -0.35 * s);
  ctx.closePath();

  ctx.fillStyle = fill;
  ctx.fill();

  // soft highlight
  ctx.globalAlpha *= 0.22;
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.ellipse(-0.15 * s, -0.22 * s, 0.18 * s, 0.12 * s, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export default function LoveHeartsCard() {
  const [opened, setOpened] = useState(false);
  const [started, setStarted] = useState(false);

  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const lastRef = useRef(0);
  const particlesRef = useRef([]);

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

  // Start animation when opened
  useEffect(() => {
    if (!opened) return;
    setStarted(true);
  }, [opened]);

  // Infinite falling hearts animation
  useEffect(() => {
    if (!started) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const step = (t) => {
      rafRef.current = requestAnimationFrame(step);

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width;
      const h = canvas.height;

      const dt = lastRef.current ? (t - lastRef.current) / 1000 : 0;
      lastRef.current = t;
      const delta = clamp(dt, 0, 1 / 20);

      // soft clear (slight trail)
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "rgba(255,255,255,1)";
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      // spawn from sky (top) forever
      const spawnPerSec = 90; // increase for denser rain
      const toSpawn = spawnPerSec * delta;
      const whole = Math.floor(toSpawn);
      const extra = Math.random() < toSpawn - whole ? 1 : 0;
      const spawnCount = whole + extra;

      for (let i = 0; i < spawnCount; i++) {
        const x = rand(0, w);
        const y = rand(-0.18 * h, 0);
        const size = rand(5, 16) * dpr;

        const vy = rand(80, 180) * dpr; // falling speed
        const vx = rand(-10, 10) * dpr; // little drift

        const sway = rand(0.8, 1.8);
        const wobble = rand(0, Math.PI * 2);

        const rot = rand(-0.6, 0.6);
        const vr = rand(-1.4, 1.4);

        const alpha = rand(0.35, 0.95);
        const fill = pick(palette);
        const life = rand(4.0, 7.0);

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
        });
      }

      // update & draw
      const p = particlesRef.current;
      for (let i = p.length - 1; i >= 0; i--) {
        const o = p[i];
        o.age += delta;

        if (o.age > o.life || o.y > h + 0.25 * h) {
          p.splice(i, 1);
          continue;
        }

        o.wobble += delta * o.sway;
        const wind = Math.sin(o.wobble) * 14 * dpr;

        o.x += (o.vx + wind) * delta;
        o.y += o.vy * delta;
        o.rot += o.vr * delta;

        // wrap sideways
        if (o.x < -0.2 * w) o.x = w + 0.2 * w;
        if (o.x > w + 0.2 * w) o.x = -0.2 * w;

        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.rotate(o.rot);

        const fade = 1 - o.age / o.life;
        ctx.globalAlpha = o.a * (0.35 + 0.65 * fade);

        drawHeart(ctx, o.s, o.fill);
        ctx.restore();
      }
    };

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    lastRef.current = 0;
    rafRef.current = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [started, palette]);

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-white overflow-hidden relative">
      <BackgroundHearts />

      {/* canvas for falling hearts */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full transition-opacity duration-700 ${
          opened ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden="true"
      />

      <div className="relative z-10 w-[min(520px,92vw)]">
        <div className="rounded-3xl shadow-[0_18px_60px_rgba(0,0,0,0.12)] border border-black/5 bg-white/80 backdrop-blur-xl overflow-hidden">
          <div className="p-6 sm:p-8">
            <div className="flex items-center justify-center">
              <Envelope opened={opened} />
            </div>

            {!opened ? (
              <div className="mt-6 text-center">
                <div className="text-sm tracking-wide text-black/60">
                  A tiny message for you
                </div>
                <div className="mt-2 text-2xl sm:text-3xl font-semibold text-black">
                  Open it
                </div>

                <button
                  onClick={() => setOpened(true)}
                  className="mt-5 inline-flex items-center justify-center rounded-2xl px-6 py-3 font-semibold text-white shadow-lg active:scale-[0.98] transition-transform"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(255,0,85,0.95), rgba(255,105,180,0.85))",
                  }}
                >
                  Open
                </button>
              </div>
            ) : (
              <div className="mt-6 text-center">
                <div
                  className="text-3xl sm:text-4xl font-extrabold"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(220,20,60,1), rgba(255,105,180,1))",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                  }}
                >
                  Love You mimikun :&gt;
                </div>
                <div className="mt-3 text-sm sm:text-base text-black/60">
                  Sending you a whole sky of hearts 💗
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
              "radial-gradient(closest-side, rgba(255,105,180,0.25), rgba(255,255,255,0))",
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

function BackgroundHearts() {
  // subtle static hearts background
  const hearts = useMemo(() => {
    const count = 70;
    return Array.from({ length: count }).map((_, i) => {
      const left = rand(0, 100);
      const top = rand(0, 100);
      const size = rand(8, 22);
      const rot = rand(-25, 25);
      const opacity = rand(0.06, 0.14);
      const blur = rand(0, 1.2);
      const color = Math.random() < 0.55 ? "rgba(220,20,60,1)" : "rgba(255,105,180,1)";
      return { i, left, top, size, rot, opacity, blur, color };
    });
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {hearts.map((h) => (
        <div
          key={h.i}
          className="absolute"
          style={{
            left: `${h.left}%`,
            top: `${h.top}%`,
            transform: `translate(-50%, -50%) rotate(${h.rot}deg)`,
            filter: `blur(${h.blur}px)`,
            opacity: h.opacity,
            fontSize: `${h.size}px`,
            color: h.color,
          }}
        >
          ❤
        </div>
      ))}

      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(closest-side, rgba(255,255,255,0.0), rgba(255,255,255,0.75))",
        }}
      />
    </div>
  );
}