'use client';

/**
 * IdeaM Seminar — "Idea Engineering" full-screen web keynote.
 *
 * A self-contained, keyboard-navigable deck built from the seminar outline
 * (~/Documents/IDM Outlines/IdeaM Seminar — Idea Engineering.idm). It fills the
 * browser viewport like a native keynote: Arrow / Space / PageDown advance,
 * Arrow-Left / PageUp go back, Esc toggles the overview grid, F toggles the
 * browser's real full-screen. Brand: IdeaM dark navy (#0b1533 / #060a1a) with
 * the blue→indigo accent ramp and the bar-chart logo mark. Numbers animate
 * (count-ups + growing bar charts) so the data lands as a reveal, not a bullet.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight, ArrowLeft, FileText, ScrollText, Mail, Mic, Video,
  Presentation as PresentationIcon, Share2, Globe, Languages, ShieldCheck,
  ShieldAlert, Sparkles, Layers, Search, PenTool, Send, Rocket, Wand2,
  CircleCheck, GitBranch, Repeat, Eye, Target, GraduationCap, Users,
  Building2, Maximize2, Grid3x3, ChevronRight, BrainCircuit,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Brand tokens                                                        */
/* ------------------------------------------------------------------ */
const C = {
  ink: '#f8fafc',
  sub: '#c3cede',
  muted: '#8b98b3',
  blue: '#2563eb',
  sky: '#38bdf8',
  indigo: '#6366f1',
  amber: '#f59e0b',
  rose: '#fb7185',
  green: '#34d399',
};

/* ------------------------------------------------------------------ */
/* Small animation helpers                                             */
/* ------------------------------------------------------------------ */

// Count-up from 0 → value once the slide mounts.
function useCountUp(value: number, duration = 1400, start = true) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!start) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(value * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setN(value);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, start]);
  return n;
}

// Flips true a beat after mount so CSS transitions (bar growth, fades) fire.
function useMountedFlag(delay = 60) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setOn(true), delay);
    return () => clearTimeout(id);
  }, [delay]);
  return on;
}

function CountNumber({
  value, suffix = '', prefix = '', decimals = 0, format,
}: { value: number; suffix?: string; prefix?: string; decimals?: number; format?: boolean }) {
  const n = useCountUp(value);
  const shown = format
    ? Math.round(n).toLocaleString('en-US')
    : n.toFixed(decimals);
  return <>{prefix}{shown}{suffix}</>;
}

/* ------------------------------------------------------------------ */
/* Reusable bits                                                       */
/* ------------------------------------------------------------------ */

function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <defs>
        <linearGradient id="lm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#4f46e5" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="22" fill="url(#lm)" />
      <rect x="20" y="56" width="12" height="20" rx="6" fill="#fff" />
      <rect x="38" y="42" width="12" height="34" rx="6" fill="#fff" />
      <rect x="56" y="28" width="12" height="48" rx="6" fill="#fff" />
      <rect x="74" y="14" width="12" height="62" rx="6" fill="#fff" />
    </svg>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--font-plex-mono), monospace',
      fontSize: 'clamp(11px, 1.1vw, 15px)',
      letterSpacing: '0.22em',
      textTransform: 'uppercase',
      color: C.sky,
      fontWeight: 600,
      marginBottom: '1.1rem',
    }}>
      {children}
    </div>
  );
}

function Fade({ children, delay = 0, on }: { children: React.ReactNode; delay?: number; on: boolean }) {
  return (
    <div style={{
      opacity: on ? 1 : 0,
      transform: on ? 'translateY(0)' : 'translateY(18px)',
      transition: `opacity 0.7s ease ${delay}ms, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
    }}>
      {children}
    </div>
  );
}

/* ================================================================== */
/* SLIDES                                                              */
/* ================================================================== */

// 1 — TITLE
function SlideTitle() {
  const on = useMountedFlag();
  return (
    <div style={{ textAlign: 'center', maxWidth: '1100px' }}>
      <Fade on={on}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
          <LogoMark size={64} />
        </div>
      </Fade>
      <Fade on={on} delay={120}>
        <h1 style={{
          fontSize: 'clamp(2.8rem, 6.6vw, 6rem)',
          fontWeight: 700,
          lineHeight: 1.02,
          letterSpacing: '-0.03em',
          color: C.ink,
          margin: 0,
        }}>
          Idea Engineering
        </h1>
      </Fade>
      <Fade on={on} delay={240}>
        <p style={{
          fontSize: 'clamp(1.15rem, 2.4vw, 2rem)',
          color: C.sub,
          fontWeight: 500,
          marginTop: '1.4rem',
          letterSpacing: '-0.01em',
        }}>
          A New Class of AI App
        </p>
      </Fade>
      <Fade on={on} delay={380}>
        <div style={{
          marginTop: '2.6rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.9rem',
          padding: '0.7rem 1.4rem',
          borderRadius: '999px',
          border: '1px solid rgba(148,163,184,0.25)',
          background: 'rgba(255,255,255,0.03)',
          color: C.muted,
          fontSize: 'clamp(0.85rem, 1.3vw, 1.05rem)',
          fontWeight: 500,
        }}>
          <LogoMark size={20} />
          <span style={{ color: C.sub }}>IdeaM</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>SecondBrainWare</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>Western Washington University</span>
        </div>
      </Fade>
    </div>
  );
}

// 2 — THE NEW CATEGORY
function SlideCategory() {
  const on = useMountedFlag();
  const steps = ['Raw thought', 'Real idea', 'Finished, published work'];
  return (
    <div style={{ maxWidth: '1150px', width: '100%' }}>
      <Fade on={on}><Eyebrow>The Lead · A New Category</Eyebrow></Fade>
      <Fade on={on} delay={100}>
        <h2 style={{
          fontSize: 'clamp(2.2rem, 5vw, 4.4rem)',
          fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.025em',
          color: C.ink, margin: 0,
        }}>
          The engineering of thought.
        </h2>
      </Fade>
      <Fade on={on} delay={220}>
        <p style={{
          fontSize: 'clamp(1.05rem, 1.9vw, 1.6rem)', color: C.sub,
          lineHeight: 1.5, marginTop: '1.6rem', maxWidth: '900px', fontWeight: 400,
        }}>
          Chatbots answer. Copilots autocomplete. A new class of software does something bigger:
          it carries a single thought all the way from spark to published work — and everything it makes stays <em style={{ color: C.sky, fontStyle: 'normal', fontWeight: 600 }}>yours</em>.
        </p>
      </Fade>

      <Fade on={on} delay={360}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'clamp(0.5rem, 1.5vw, 1.4rem)',
          flexWrap: 'wrap', marginTop: '2.8rem',
        }}>
          {steps.map((s, i) => (
            <React.Fragment key={s}>
              <div style={{
                padding: 'clamp(0.8rem,1.6vw,1.3rem) clamp(1.1rem,2.2vw,1.9rem)',
                borderRadius: '16px',
                border: '1px solid rgba(56,189,248,0.28)',
                background: i === 2
                  ? 'linear-gradient(135deg, rgba(37,99,235,0.28), rgba(79,70,229,0.28))'
                  : 'rgba(255,255,255,0.04)',
                color: i === 2 ? '#fff' : C.sub,
                fontWeight: i === 2 ? 700 : 600,
                fontSize: 'clamp(0.95rem, 1.7vw, 1.5rem)',
                whiteSpace: 'nowrap',
              }}>
                {s}
              </div>
              {i < steps.length - 1 && (
                <ArrowRight style={{ color: C.sky, width: 'clamp(20px,2.5vw,34px)', height: 'auto', flexShrink: 0 }} />
              )}
            </React.Fragment>
          ))}
        </div>
      </Fade>

      <Fade on={on} delay={520}>
        <p style={{
          marginTop: '2.6rem', fontSize: 'clamp(1rem, 1.7vw, 1.4rem)',
          color: C.ink, fontWeight: 600,
        }}>
          <span style={{ color: C.sky }}>IdeaM</span> is the first tool of its class.
        </p>
      </Fade>
    </div>
  );
}

// 3 — THE ARC
function SlideArc() {
  const on = useMountedFlag();
  const arc = [
    { icon: Layers, label: 'Bring in', note: 'video · PDF · web · audio · email' },
    { icon: Search, label: 'Research', note: 'synthesize across sources' },
    { icon: PenTool, label: 'Develop', note: 'engineer the idea' },
    { icon: Wand2, label: 'Produce', note: 'write · podcast · video' },
    { icon: Send, label: 'Publish', note: 'everywhere, in your voice' },
  ];
  return (
    <div style={{ maxWidth: '1250px', width: '100%' }}>
      <Fade on={on}><Eyebrow>The Tool · What It Looks Like</Eyebrow></Fade>
      <Fade on={on} delay={100}>
        <h2 style={{
          fontSize: 'clamp(2rem, 4.4vw, 3.9rem)', fontWeight: 700,
          lineHeight: 1.05, letterSpacing: '-0.025em', color: C.ink, margin: 0,
        }}>
          One continuous pipeline — source to published work.
        </h2>
      </Fade>

      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${arc.length}, 1fr)`,
        gap: 'clamp(0.6rem, 1.2vw, 1.1rem)',
        marginTop: '3rem',
      }}>
        {arc.map((s, i) => (
          <Fade key={s.label} on={on} delay={260 + i * 120}>
            <div style={{
              padding: 'clamp(0.9rem,1.6vw,1.5rem) clamp(0.6rem,1vw,1rem)',
              borderRadius: '18px',
              border: '1px solid rgba(148,163,184,0.18)',
              background: 'rgba(255,255,255,0.035)',
              height: '100%',
              textAlign: 'center',
            }}>
              <div style={{
                width: 'clamp(40px,4.4vw,58px)', height: 'clamp(40px,4.4vw,58px)',
                margin: '0 auto 0.9rem', borderRadius: '14px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, rgba(56,189,248,0.2), rgba(79,70,229,0.2))',
                border: '1px solid rgba(56,189,248,0.3)',
              }}>
                <s.icon style={{ color: C.sky, width: '52%', height: '52%' }} />
              </div>
              <div style={{ color: C.ink, fontWeight: 700, fontSize: 'clamp(0.9rem,1.5vw,1.35rem)' }}>{s.label}</div>
              <div style={{ color: C.muted, fontSize: 'clamp(0.68rem,1vw,0.92rem)', marginTop: '0.4rem', lineHeight: 1.35 }}>{s.note}</div>
            </div>
          </Fade>
        ))}
      </div>

      <Fade on={on} delay={880}>
        <div style={{
          marginTop: '2.6rem', display: 'flex', gap: '1.2rem', flexWrap: 'wrap',
          alignItems: 'center',
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.7rem',
            padding: '0.7rem 1.2rem', borderRadius: '999px',
            border: '1px solid rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.08)',
            color: C.green, fontWeight: 600, fontSize: 'clamp(0.85rem,1.3vw,1.1rem)',
          }}>
            <ShieldCheck style={{ width: 20, height: 20 }} />
            Privacy-first · on-device AI · bring-your-own-key
          </div>
          <div style={{ color: C.muted, fontSize: 'clamp(0.85rem,1.3vw,1.1rem)', fontWeight: 500 }}>
            Your ideas never leave your control — the difference between a toy and a serious instrument.
          </div>
        </div>
      </Fade>
    </div>
  );
}

// 4 — THE SHOWCASE (one outline → ~13 formats)
function SlideShowcase() {
  const on = useMountedFlag();
  const formats = [
    { icon: FileText, label: 'Article' },
    { icon: ScrollText, label: 'Summary' },
    { icon: Mail, label: 'Email' },
    { icon: Mic, label: 'Podcast' },
    { icon: Video, label: 'Video' },
    { icon: PresentationIcon, label: 'Slide deck' },
    { icon: Share2, label: 'X' },
    { icon: Share2, label: 'LinkedIn' },
    { icon: Share2, label: 'Facebook' },
    { icon: Share2, label: 'Instagram' },
    { icon: Share2, label: 'Threads' },
    { icon: Share2, label: 'Bluesky' },
    { icon: Share2, label: 'YouTube' },
  ];
  return (
    <div style={{ maxWidth: '1280px', width: '100%' }}>
      <Fade on={on}><Eyebrow>The Showcase</Eyebrow></Fade>
      <Fade on={on} delay={90}>
        <h2 style={{
          fontSize: 'clamp(1.9rem, 4.2vw, 3.7rem)', fontWeight: 700,
          lineHeight: 1.04, letterSpacing: '-0.025em', color: C.ink, margin: 0,
        }}>
          One outline → <span style={{ color: C.sky }}>~13 finished formats.</span>
        </h2>
      </Fade>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(220px, 0.9fr) 2.4fr',
        gap: 'clamp(1.2rem, 2.4vw, 2.6rem)',
        alignItems: 'center',
        marginTop: '2.6rem',
      }}>
        {/* Source card */}
        <Fade on={on} delay={220}>
          <div style={{
            borderRadius: '22px', padding: 'clamp(1.2rem,2.4vw,2rem)',
            background: 'linear-gradient(160deg, rgba(37,99,235,0.28), rgba(79,70,229,0.22))',
            border: '1px solid rgba(56,189,248,0.35)', textAlign: 'center',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <LogoMark size={44} />
            </div>
            <div style={{
              fontSize: 'clamp(2.6rem,5vw,4.4rem)', fontWeight: 700, color: '#fff', lineHeight: 1,
            }}>1</div>
            <div style={{ color: C.sub, fontWeight: 600, fontSize: 'clamp(0.9rem,1.4vw,1.2rem)', marginTop: '0.4rem' }}>
              outline
            </div>
            <div style={{
              marginTop: '1rem', color: C.sky, fontSize: 'clamp(0.72rem,1vw,0.9rem)',
              fontWeight: 600, letterSpacing: '0.05em',
            }}>
              each in one click →
            </div>
          </div>
        </Fade>

        {/* Format chips */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(120px,13vw,160px), 1fr))',
          gap: 'clamp(0.5rem, 1vw, 0.85rem)',
        }}>
          {formats.map((f, i) => (
            <Fade key={f.label} on={on} delay={360 + i * 55}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                padding: 'clamp(0.55rem,1vw,0.85rem) clamp(0.7rem,1.1vw,1rem)',
                borderRadius: '12px', border: '1px solid rgba(148,163,184,0.2)',
                background: 'rgba(255,255,255,0.04)',
              }}>
                <f.icon style={{ color: C.sky, width: 'clamp(16px,1.5vw,20px)', height: 'auto', flexShrink: 0 }} />
                <span style={{ color: C.sub, fontWeight: 600, fontSize: 'clamp(0.78rem,1.1vw,1rem)' }}>{f.label}</span>
              </div>
            </Fade>
          ))}
        </div>
      </div>

      {/* Underline facts */}
      <Fade on={on} delay={1100}>
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 'clamp(0.6rem,1.4vw,1.2rem)',
          marginTop: '2.4rem',
        }}>
          {[
            { icon: Sparkles, t: 'In your own voice' },
            { icon: Languages, t: '21 languages' },
            { icon: ShieldCheck, t: 'Opt-in privacy · BYOK' },
            { icon: Eye, t: 'Always-on verifier' },
          ].map((p) => (
            <div key={p.t} style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.55rem',
              padding: '0.55rem 1.05rem', borderRadius: '999px',
              border: '1px solid rgba(148,163,184,0.22)', background: 'rgba(255,255,255,0.03)',
              color: C.sub, fontWeight: 600, fontSize: 'clamp(0.8rem,1.2vw,1.05rem)',
            }}>
              <p.icon style={{ width: 18, height: 18, color: C.green }} />
              {p.t}
            </div>
          ))}
        </div>
      </Fade>
    </div>
  );
}

/* ---- Bar chart primitive (vertical) ---- */
function BarChart({
  bars, on, maxHeight = 340,
}: {
  bars: { label: string; value: number; color: string; caption?: string }[];
  on: boolean; maxHeight?: number;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      gap: 'clamp(1.4rem, 5vw, 4.5rem)', height: maxHeight, marginTop: '1rem',
    }}>
      {bars.map((b, i) => (
        <div key={b.label} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          height: '100%', justifyContent: 'flex-end', width: 'clamp(90px, 12vw, 160px)',
        }}>
          <div style={{
            fontSize: 'clamp(1.8rem, 4vw, 3.4rem)', fontWeight: 700, color: b.color,
            marginBottom: '0.6rem', opacity: on ? 1 : 0,
            transition: `opacity 0.5s ease ${400 + i * 180}ms`,
          }}>
            {on ? <CountNumber value={b.value} suffix="%" /> : '0%'}
          </div>
          <div style={{
            width: '100%',
            height: on ? `${(b.value / 100) * 100}%` : '0%',
            minHeight: on ? 8 : 0,
            borderRadius: '12px 12px 4px 4px',
            background: `linear-gradient(180deg, ${b.color}, ${b.color}bb)`,
            boxShadow: `0 0 40px ${b.color}55`,
            transition: `height 1.1s cubic-bezier(0.16,1,0.3,1) ${i * 180}ms`,
          }} />
          <div style={{
            marginTop: '1rem', color: C.sub, fontWeight: 600,
            fontSize: 'clamp(0.85rem, 1.3vw, 1.2rem)', textAlign: 'center', lineHeight: 1.25,
          }}>
            {b.label}
          </div>
          {b.caption && (
            <div style={{ color: C.muted, fontSize: 'clamp(0.7rem,1vw,0.9rem)', marginTop: '0.25rem', textAlign: 'center' }}>
              {b.caption}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// 5 — THE AI PARADOX (chart)
function SlideParadox() {
  const on = useMountedFlag();
  return (
    <div style={{ maxWidth: '1150px', width: '100%', textAlign: 'center' }}>
      <Fade on={on}><Eyebrow>The AI Paradox · 2025 Stack Overflow Developer Survey</Eyebrow></Fade>
      <Fade on={on} delay={100}>
        <h2 style={{
          fontSize: 'clamp(1.9rem, 4.2vw, 3.6rem)', fontWeight: 700,
          lineHeight: 1.05, letterSpacing: '-0.025em', color: C.ink, margin: 0,
        }}>
          Everyone uses it. Almost nobody trusts it.
        </h2>
      </Fade>
      <BarChart on={on} bars={[
        { label: 'Use AI', value: 80, color: C.sky },
        { label: 'Trust its accuracy', value: 29, color: C.rose },
        { label: 'Lose time debugging it', value: 45, color: C.amber },
      ]} />
      <Fade on={on} delay={900}>
        <p style={{
          marginTop: '2.2rem', fontSize: 'clamp(1rem, 1.8vw, 1.5rem)',
          color: C.sub, fontWeight: 500,
        }}>
          That gap — <span style={{ color: C.sky, fontWeight: 700 }}>use without trust</span> — is the whole talk.
        </p>
      </Fade>
    </div>
  );
}

// 6 — THE FRONTIER (assisted vs driven)
function SlideFrontier() {
  const on = useMountedFlag();
  return (
    <div style={{ maxWidth: '1150px', width: '100%', textAlign: 'center' }}>
      <Fade on={on}><Eyebrow>The Frontier · Assisted vs. Driven</Eyebrow></Fade>
      <Fade on={on} delay={100}>
        <h2 style={{
          fontSize: 'clamp(1.9rem, 4.2vw, 3.6rem)', fontWeight: 700,
          lineHeight: 1.05, letterSpacing: '-0.025em', color: C.ink, margin: 0,
        }}>
          Most use AI as an <span style={{ color: C.muted }}>assistant</span>.
          Few are truly <span style={{ color: C.sky }}>AI-driven</span>.
        </h2>
      </Fade>
      <BarChart on={on} bars={[
        { label: 'AI-assisted', value: 80, color: C.muted, caption: 'human writes most of it' },
        { label: 'Truly AI-driven', value: 15, color: C.sky, caption: '“vibe coding”' },
      ]} maxHeight={320} />
      <Fade on={on} delay={900}>
        <div style={{
          marginTop: '2rem', display: 'inline-flex', alignItems: 'center', gap: '0.7rem',
          padding: '0.8rem 1.5rem', borderRadius: '999px',
          border: '1px solid rgba(56,189,248,0.4)',
          background: 'linear-gradient(135deg, rgba(37,99,235,0.22), rgba(79,70,229,0.22))',
          color: '#fff', fontWeight: 700, fontSize: 'clamp(0.95rem, 1.6vw, 1.35rem)',
        }}>
          <Rocket style={{ width: 22, height: 22, color: C.sky }} />
          This project lives in that ~15% frontier.
        </div>
      </Fade>
    </div>
  );
}

// 7 — THE CASE STUDY (big stat reveal)
function SlideCaseStudy() {
  const on = useMountedFlag();
  const stats = [
    { value: '388', label: 'files' },
    { value: 'B', label: 'audit grade · above median' },
    { value: '0', label: 'circular dependencies' },
  ];
  return (
    <div style={{ maxWidth: '1150px', width: '100%', textAlign: 'center' }}>
      <Fade on={on}><Eyebrow>The Case Study · Building IdeaM with AI</Eyebrow></Fade>
      <Fade on={on} delay={120}>
        <div style={{
          fontSize: 'clamp(4.5rem, 15vw, 12rem)', fontWeight: 700, lineHeight: 0.95,
          letterSpacing: '-0.04em',
          background: 'linear-gradient(120deg, #fff 20%, #38bdf8 60%, #6366f1 100%)',
          WebkitBackgroundClip: 'text', backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          <CountNumber value={135000} format />
        </div>
      </Fade>
      <Fade on={on} delay={260}>
        <p style={{
          fontSize: 'clamp(1.1rem, 2.2vw, 1.9rem)', color: C.sub, fontWeight: 600,
          marginTop: '0.4rem',
        }}>
          lines of code · solo founder · largely AI-built
        </p>
      </Fade>
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 'clamp(1rem, 3vw, 2.6rem)',
        marginTop: '2.8rem', flexWrap: 'wrap',
      }}>
        {stats.map((s, i) => (
          <Fade key={s.label} on={on} delay={520 + i * 160}>
            <div style={{
              padding: 'clamp(1rem,2vw,1.6rem) clamp(1.4rem,3vw,2.4rem)',
              borderRadius: '18px', border: '1px solid rgba(148,163,184,0.2)',
              background: 'rgba(255,255,255,0.04)', minWidth: 'clamp(150px,18vw,220px)',
            }}>
              <div style={{
                fontSize: 'clamp(2rem, 4.5vw, 3.6rem)', fontWeight: 700,
                color: s.value === '0' ? C.green : C.sky, lineHeight: 1,
              }}>{s.value}</div>
              <div style={{ color: C.muted, fontWeight: 600, fontSize: 'clamp(0.8rem,1.2vw,1.05rem)', marginTop: '0.6rem' }}>
                {s.label}
              </div>
            </div>
          </Fade>
        ))}
      </div>
      <Fade on={on} delay={1050}>
        <p style={{ marginTop: '2rem', color: C.muted, fontSize: 'clamp(0.85rem,1.3vw,1.1rem)', fontWeight: 500 }}>
          Independent-style architecture audit. The one honest blemish: a few oversized files — the universal debt of fast development.
        </p>
      </Fade>
    </div>
  );
}

// 8 — WHY IT WORKS (the discipline)
function SlideDiscipline() {
  const on = useMountedFlag();
  const items = [
    { icon: Repeat, t: 'Tiered testing', d: 'Deterministic code once; AI features 5× with invariant checks.' },
    { icon: ShieldAlert, t: 'Adversarial guardrails', d: 'Assume the AI tries the wrong thing on money & privacy — block it.' },
    { icon: Eye, t: 'Always-on verifier', d: 'Every draft checked for invented facts.' },
    { icon: CircleCheck, t: 'Review before you trust', d: 'A human reads the output before it counts.' },
    { icon: GitBranch, t: 'Low coupling', d: 'Periodic refactoring keeps the codebase healthy as it grows.' },
  ];
  return (
    <div style={{ maxWidth: '1220px', width: '100%' }}>
      <Fade on={on}><Eyebrow>Why It Works · The Discipline</Eyebrow></Fade>
      <Fade on={on} delay={100}>
        <h2 style={{
          fontSize: 'clamp(2rem, 4.6vw, 4rem)', fontWeight: 700, lineHeight: 1.03,
          letterSpacing: '-0.025em', color: C.ink, margin: 0,
        }}>
          AI + discipline = <span style={{ color: C.sky }}>trustworthy output.</span>
        </h2>
      </Fade>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(clamp(220px,20vw,320px), 1fr))',
        gap: 'clamp(0.8rem, 1.4vw, 1.2rem)', marginTop: '2.4rem',
      }}>
        {items.map((it, i) => (
          <Fade key={it.t} on={on} delay={240 + i * 110}>
            <div style={{
              padding: 'clamp(1.1rem,1.8vw,1.6rem)', borderRadius: '16px',
              border: '1px solid rgba(148,163,184,0.18)', background: 'rgba(255,255,255,0.035)',
              height: '100%',
            }}>
              <div style={{
                width: 'clamp(38px,3.6vw,48px)', height: 'clamp(38px,3.6vw,48px)',
                borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, rgba(56,189,248,0.2), rgba(79,70,229,0.2))',
                border: '1px solid rgba(56,189,248,0.3)', marginBottom: '1rem',
              }}>
                <it.icon style={{ color: C.sky, width: '52%', height: '52%' }} />
              </div>
              <div style={{ color: C.ink, fontWeight: 700, fontSize: 'clamp(1rem,1.5vw,1.3rem)' }}>{it.t}</div>
              <div style={{ color: C.muted, fontSize: 'clamp(0.82rem,1.1vw,1rem)', marginTop: '0.5rem', lineHeight: 1.45 }}>{it.d}</div>
            </div>
          </Fade>
        ))}
      </div>
      <Fade on={on} delay={860}>
        <p style={{
          marginTop: '2rem', fontSize: 'clamp(1rem,1.7vw,1.5rem)', color: C.sub, fontWeight: 500,
        }}>
          The skill shifts from writing every line to <span style={{ color: C.ink, fontWeight: 700 }}>directing and verifying</span>.
          Don&rsquo;t just prompt — <span style={{ color: C.sky, fontWeight: 700 }}>direct and verify.</span>
        </p>
      </Fade>
    </div>
  );
}

// 9 — TAKEAWAYS
function SlideTakeaways() {
  const on = useMountedFlag();
  const cols = [
    { icon: GraduationCap, who: 'Students & researchers', d: 'Think faster, produce more, publish in your own voice — and keep it private. Leverage on the exact work a degree is made of.' },
    { icon: Users, who: 'CS students', d: 'AI-first development is a discipline to master — architecture, testing, verification — not a shortcut to fear.' },
    { icon: Building2, who: 'The institution', d: 'A new category of software is being born. Be the university that understands and adopts it early — a student & faculty pilot of IdeaM.' },
  ];
  return (
    <div style={{ maxWidth: '1250px', width: '100%' }}>
      <Fade on={on}><Eyebrow>Takeaways for the University</Eyebrow></Fade>
      <Fade on={on} delay={100}>
        <h2 style={{
          fontSize: 'clamp(2rem, 4.6vw, 4rem)', fontWeight: 700, lineHeight: 1.03,
          letterSpacing: '-0.025em', color: C.ink, margin: 0,
        }}>
          Something for every seat in the room.
        </h2>
      </Fade>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(clamp(260px,26vw,360px), 1fr))',
        gap: 'clamp(1rem, 2vw, 1.8rem)', marginTop: '2.8rem',
      }}>
        {cols.map((c, i) => (
          <Fade key={c.who} on={on} delay={280 + i * 160}>
            <div style={{
              padding: 'clamp(1.4rem,2.4vw,2.2rem)', borderRadius: '20px',
              border: '1px solid rgba(148,163,184,0.18)',
              background: i === 2
                ? 'linear-gradient(160deg, rgba(37,99,235,0.22), rgba(79,70,229,0.18))'
                : 'rgba(255,255,255,0.035)',
              height: '100%',
            }}>
              <div style={{
                width: 'clamp(46px,4.4vw,60px)', height: 'clamp(46px,4.4vw,60px)',
                borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, rgba(56,189,248,0.22), rgba(79,70,229,0.22))',
                border: '1px solid rgba(56,189,248,0.32)', marginBottom: '1.2rem',
              }}>
                <c.icon style={{ color: C.sky, width: '50%', height: '50%' }} />
              </div>
              <div style={{ color: C.ink, fontWeight: 700, fontSize: 'clamp(1.05rem,1.7vw,1.5rem)' }}>{c.who}</div>
              <div style={{ color: C.sub, fontSize: 'clamp(0.85rem,1.2vw,1.1rem)', marginTop: '0.8rem', lineHeight: 1.5 }}>{c.d}</div>
            </div>
          </Fade>
        ))}
      </div>
    </div>
  );
}

// 10 — MIC DROP
function SlideMicDrop() {
  const on = useMountedFlag();
  return (
    <div style={{ maxWidth: '1100px', width: '100%', textAlign: 'center' }}>
      <Fade on={on}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
          <BrainCircuit style={{ width: 'clamp(48px,6vw,80px)', height: 'auto', color: C.sky }} />
        </div>
      </Fade>
      <Fade on={on} delay={140}>
        <h2 style={{
          fontSize: 'clamp(2.2rem, 5.4vw, 5rem)', fontWeight: 700, lineHeight: 1.05,
          letterSpacing: '-0.03em', color: C.ink, margin: 0,
        }}>
          This entire talk was built in <span style={{
            background: 'linear-gradient(120deg, #38bdf8, #6366f1)',
            WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>IdeaM</span>.
        </h2>
      </Fade>
      <Fade on={on} delay={320}>
        <p style={{
          fontSize: 'clamp(1.2rem, 2.6vw, 2.2rem)', color: C.sub, fontWeight: 500,
          marginTop: '1.6rem',
        }}>
          And you&rsquo;re watching it in a browser.
        </p>
      </Fade>
      <Fade on={on} delay={520}>
        <p style={{
          marginTop: '2.2rem', color: C.sky, fontWeight: 700,
          fontSize: 'clamp(0.95rem, 1.6vw, 1.4rem)', letterSpacing: '0.02em',
        }}>
          The medium is the message.
        </p>
      </Fade>
    </div>
  );
}

// 11 — CLOSE / SOURCES
function SlideClose() {
  const on = useMountedFlag();
  const sources = [
    '2025 Stack Overflow Developer Survey — ~80% AI adoption · ~29% trust · ~45% lose time debugging AI output',
    'IdeaM architecture / modularity audit — Grade B, above median, zero circular dependencies across 388 files',
    '~135,000 lines of code · solo founder · largely AI-built',
    'Assisted vs. driven — ~80% AI-assisted · ~10–25% truly AI-driven · IdeaM in the ~15% frontier',
  ];
  return (
    <div style={{ maxWidth: '1050px', width: '100%' }}>
      <Fade on={on}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.8rem' }}>
          <LogoMark size={44} />
          <div>
            <div style={{ color: C.ink, fontWeight: 700, fontSize: 'clamp(1.4rem,2.6vw,2.2rem)' }}>Thank you.</div>
            <div style={{ color: C.muted, fontWeight: 500, fontSize: 'clamp(0.85rem,1.3vw,1.1rem)' }}>
              IdeaM · SecondBrainWare · 2ndbrainware.com
            </div>
          </div>
        </div>
      </Fade>
      <Fade on={on} delay={160}>
        <div style={{
          fontFamily: 'var(--font-plex-mono), monospace', fontSize: 'clamp(11px,1.1vw,14px)',
          letterSpacing: '0.2em', textTransform: 'uppercase', color: C.sky, fontWeight: 600,
          marginBottom: '1.2rem',
        }}>
          The numbers &amp; the sources
        </div>
      </Fade>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        {sources.map((s, i) => (
          <Fade key={i} on={on} delay={280 + i * 130}>
            <div style={{
              display: 'flex', gap: '0.9rem', alignItems: 'flex-start',
              padding: '0.9rem 1.2rem', borderRadius: '12px',
              border: '1px solid rgba(148,163,184,0.16)', background: 'rgba(255,255,255,0.03)',
            }}>
              <ChevronRight style={{ color: C.sky, width: 20, height: 20, flexShrink: 0, marginTop: 2 }} />
              <span style={{ color: C.sub, fontSize: 'clamp(0.85rem,1.3vw,1.15rem)', lineHeight: 1.45 }}>{s}</span>
            </div>
          </Fade>
        ))}
      </div>
    </div>
  );
}

/* ================================================================== */
/* DECK SHELL                                                          */
/* ================================================================== */

type SlideDef = { id: string; title: string; render: () => React.ReactNode };

const SLIDES: SlideDef[] = [
  { id: 'title', title: 'Idea Engineering', render: () => <SlideTitle /> },
  { id: 'category', title: 'A New Category', render: () => <SlideCategory /> },
  { id: 'arc', title: 'The Tool', render: () => <SlideArc /> },
  { id: 'showcase', title: 'The Showcase', render: () => <SlideShowcase /> },
  { id: 'paradox', title: 'The AI Paradox', render: () => <SlideParadox /> },
  { id: 'frontier', title: 'The Frontier', render: () => <SlideFrontier /> },
  { id: 'casestudy', title: 'The Case Study', render: () => <SlideCaseStudy /> },
  { id: 'discipline', title: 'The Discipline', render: () => <SlideDiscipline /> },
  { id: 'takeaways', title: 'Takeaways', render: () => <SlideTakeaways /> },
  { id: 'micdrop', title: 'Mic Drop', render: () => <SlideMicDrop /> },
  { id: 'close', title: 'Close & Sources', render: () => <SlideClose /> },
];

export default function Deck() {
  const [current, setCurrent] = useState(0);
  const [overview, setOverview] = useState(false);
  const [dir, setDir] = useState(1);
  const touchX = useRef<number | null>(null);

  const go = useCallback((next: number) => {
    setCurrent((c) => {
      const target = Math.max(0, Math.min(SLIDES.length - 1, next));
      setDir(target >= c ? 1 : -1);
      return target;
    });
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (overview) {
        if (e.key === 'Escape') { setOverview(false); e.preventDefault(); }
        return;
      }
      switch (e.key) {
        case 'ArrowRight': case ' ': case 'PageDown': case 'Spacebar':
          go(current + 1); e.preventDefault(); break;
        case 'ArrowLeft': case 'PageUp':
          go(current - 1); e.preventDefault(); break;
        case 'Home': go(0); e.preventDefault(); break;
        case 'End': go(SLIDES.length - 1); e.preventDefault(); break;
        case 'Escape': setOverview(true); e.preventDefault(); break;
        case 'f': case 'F': toggleFullscreen(); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, overview, go, toggleFullscreen]);

  const slide = SLIDES[current];

  return (
    <main
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 60) go(current + (dx < 0 ? 1 : -1));
        touchX.current = null;
      }}
      style={{
        position: 'fixed', inset: 0, overflow: 'hidden',
        background: 'radial-gradient(1200px 800px at 20% 0%, #12204a 0%, #0b1533 42%, #060a1a 100%)',
        color: C.ink,
        fontFamily: 'var(--font-plex-sans), -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      {/* Ambient glows */}
      <div style={{
        position: 'absolute', top: '-15%', right: '-10%', width: '55vw', height: '55vw',
        background: 'radial-gradient(circle, rgba(56,189,248,0.14), transparent 62%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-20%', left: '-10%', width: '50vw', height: '50vw',
        background: 'radial-gradient(circle, rgba(99,102,241,0.14), transparent 62%)',
        pointerEvents: 'none',
      }} />
      {/* Faint grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.4,
        backgroundImage: 'linear-gradient(rgba(148,163,184,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.05) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
        maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 85%)',
        WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 85%)',
      }} />

      {/* Top bar */}
      <header style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 'clamp(1rem, 2.4vw, 1.8rem) clamp(1.2rem, 3vw, 2.6rem)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
          <LogoMark size={26} />
          <span style={{ color: C.sub, fontWeight: 600, fontSize: 'clamp(0.85rem,1.2vw,1.05rem)', letterSpacing: '-0.01em' }}>
            IdeaM
          </span>
          <span style={{ color: C.muted, fontSize: 'clamp(0.7rem,1vw,0.9rem)', fontWeight: 500 }}>
            · Idea Engineering
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <button onClick={() => setOverview((o) => !o)} aria-label="Overview" style={iconBtn}>
            <Grid3x3 style={{ width: 18, height: 18 }} />
          </button>
          <button onClick={toggleFullscreen} aria-label="Full screen" style={iconBtn}>
            <Maximize2 style={{ width: 18, height: 18 }} />
          </button>
        </div>
      </header>

      {/* Slide stage */}
      {!overview && (
        <section
          key={slide.id}
          style={{
            position: 'absolute', inset: 0, zIndex: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 'clamp(3.5rem, 8vh, 6rem) clamp(1.5rem, 6vw, 6rem)',
            animation: `slideIn 0.55s cubic-bezier(0.16,1,0.3,1)`,
          }}
        >
          <style>{`
            @keyframes slideIn {
              from { opacity: 0; transform: translateX(${dir * 40}px); }
              to   { opacity: 1; transform: translateX(0); }
            }
          `}</style>
          {slide.render()}
        </section>
      )}

      {/* Overview grid */}
      {overview && (
        <section style={{
          position: 'absolute', inset: 0, zIndex: 15,
          padding: 'clamp(4.5rem,10vh,6rem) clamp(1.5rem,5vw,4rem) 3rem',
          overflowY: 'auto',
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '1rem', maxWidth: '1400px', margin: '0 auto',
          }}>
            {SLIDES.map((s, i) => (
              <button key={s.id} onClick={() => { go(i); setOverview(false); }} style={{
                textAlign: 'left', cursor: 'pointer',
                padding: '1.1rem 1.2rem', borderRadius: '14px',
                border: i === current ? `1px solid ${C.sky}` : '1px solid rgba(148,163,184,0.2)',
                background: i === current ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.03)',
                color: C.ink, aspectRatio: '16/9', display: 'flex', flexDirection: 'column',
                justifyContent: 'space-between',
              }}>
                <span style={{
                  fontFamily: 'var(--font-plex-mono), monospace', fontSize: 12,
                  color: C.muted, fontWeight: 600,
                }}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{ fontWeight: 700, fontSize: 'clamp(0.95rem,1.4vw,1.15rem)', lineHeight: 1.2 }}>{s.title}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Bottom controls + progress */}
      {!overview && (
        <footer style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
          padding: 'clamp(1rem,2.4vw,1.8rem) clamp(1.2rem,3vw,2.6rem)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
            <button onClick={() => go(current - 1)} disabled={current === 0} aria-label="Previous" style={{ ...iconBtn, opacity: current === 0 ? 0.3 : 1 }}>
              <ArrowLeft style={{ width: 18, height: 18 }} />
            </button>
            <button onClick={() => go(current + 1)} disabled={current === SLIDES.length - 1} aria-label="Next" style={{ ...iconBtn, opacity: current === SLIDES.length - 1 ? 0.3 : 1 }}>
              <ArrowRight style={{ width: 18, height: 18 }} />
            </button>
          </div>

          <div style={{ flex: 1, margin: '0 clamp(1rem,3vw,2.5rem)', maxWidth: 520 }}>
            <div style={{ height: 4, borderRadius: 999, background: 'rgba(148,163,184,0.18)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 999,
                width: `${((current + 1) / SLIDES.length) * 100}%`,
                background: 'linear-gradient(90deg, #38bdf8, #6366f1)',
                transition: 'width 0.5s cubic-bezier(0.16,1,0.3,1)',
              }} />
            </div>
          </div>

          <div style={{
            fontFamily: 'var(--font-plex-mono), monospace', color: C.muted,
            fontSize: 'clamp(0.75rem,1.1vw,0.95rem)', fontWeight: 600, letterSpacing: '0.05em',
            minWidth: 70, textAlign: 'right',
          }}>
            {String(current + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}
          </div>
        </footer>
      )}
    </main>
  );
}

const iconBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 40, height: 40, borderRadius: 10,
  border: '1px solid rgba(148,163,184,0.22)', background: 'rgba(255,255,255,0.04)',
  color: '#c3cede', cursor: 'pointer',
};
