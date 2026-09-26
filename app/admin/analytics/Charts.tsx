"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import styles from "./analytics.module.css";

/* The three charts on /admin/analytics. Plain SVG sized to the measured
   width, so text is never stretched. Every chart has a hover/focus readout,
   and every value is also in a table on the page - the tooltip never gates. */

const fmt = new Intl.NumberFormat("en");

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** 0 → a clean round ceiling (1, 2, 5 × 10ⁿ) split into four ticks. */
function scale(max: number) {
  const raw = Math.max(max, 4) / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const top = step * 4;
  return { top, ticks: [0, 1, 2, 3, 4].map((i) => Math.round(step * i * 100) / 100) };
}

/* ---------------------------------------------------------------- trend */

export type TrendPoint = { label: string; long: string; visitors: number; views: number };

const T = { h: 240, top: 14, bottom: 30, left: 44, right: 16 };

export function TrendChart({ points }: { points: TrendPoint[] }) {
  const [ref, w] = useWidth();
  const [i, setI] = useState<number | null>(null);

  const n = points.length;
  const { top, ticks } = scale(Math.max(0, ...points.map((p) => Math.max(p.views, p.visitors))));
  const width = w ?? 0;
  const plotW = Math.max(0, width - T.left - T.right);
  const plotH = T.h - T.top - T.bottom;
  const x = (k: number) => T.left + (n <= 1 ? plotW / 2 : (k * plotW) / (n - 1));
  const y = (v: number) => T.top + plotH - (v / top) * plotH;

  const line = (key: "visitors" | "views") =>
    points.map((p, k) => `${k ? "L" : "M"}${x(k).toFixed(1)},${y(p[key]).toFixed(1)}`).join("");
  const area = n
    ? `${line("visitors")}L${x(n - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`
    : "";

  // about six x labels, whatever the range
  const every = Math.max(1, Math.ceil(n / 6));

  function pick(e: PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const k = n <= 1 ? 0 : Math.round(((px - T.left) / plotW) * (n - 1));
    setI(Math.min(n - 1, Math.max(0, k)));
  }
  function key(e: KeyboardEvent<SVGSVGElement>) {
    if (e.key === "ArrowLeft") setI((v) => Math.max(0, (v ?? n) - 1));
    else if (e.key === "ArrowRight") setI((v) => Math.min(n - 1, (v ?? -1) + 1));
    else return;
    e.preventDefault();
  }

  const hot = i !== null ? points[i] : null;
  const tipLeft = i !== null ? Math.min(Math.max(x(i) + 12, 0), width - 170) : 0;

  return (
    <div className={styles.chart}>
      <div className={styles.legend}>
        <span><i className={styles.lineKey} style={{ background: "var(--series-1)" }} />Visitors</span>
        <span><i className={styles.lineKey} style={{ background: "var(--series-2)" }} />Page views</span>
      </div>
      <div ref={ref} className={styles.plot} style={{ height: T.h }}>
        {w !== null && (
          <svg
            width={width}
            height={T.h}
            role="img"
            aria-label="Visitors and page views over time. Use the arrow keys to read each point."
            tabIndex={0}
            onPointerMove={pick}
            onPointerLeave={() => setI(null)}
            onFocus={() => setI(n - 1)}
            onBlur={() => setI(null)}
            onKeyDown={key}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={T.left} x2={width - T.right} y1={y(t)} y2={y(t)} className={t ? styles.grid : styles.baseline} />
                <text x={T.left - 8} y={y(t)} className={styles.tickY}>{fmt.format(t)}</text>
              </g>
            ))}
            {points.map((p, k) =>
              k % every === 0 || k === n - 1 ? (
                <text key={k} x={x(k)} y={T.h - 8} className={styles.tickX}
                      textAnchor={n > 1 && k === n - 1 ? "end" : n > 1 && k === 0 ? "start" : "middle"}>
                  {p.label}
                </text>
              ) : null,
            )}

            <path d={area} fill="var(--series-1-wash)" />
            <path d={line("views")} className={styles.line} stroke="var(--series-2)" />
            <path d={line("visitors")} className={styles.line} stroke="var(--series-1)" />

            {i !== null && hot && (
              <g>
                <line x1={x(i)} x2={x(i)} y1={T.top} y2={y(0)} className={styles.crosshair} />
                <circle cx={x(i)} cy={y(hot.views)} r={4} fill="var(--series-2)" className={styles.dot} />
                <circle cx={x(i)} cy={y(hot.visitors)} r={4} fill="var(--series-1)" className={styles.dot} />
              </g>
            )}
          </svg>
        )}
        {hot && (
          <div className={styles.tip} style={{ left: tipLeft, top: 8 }} aria-hidden>
            <div className={styles.tipHead}>{hot.long}</div>
            <div className={styles.tipRow}>
              <i className={styles.lineKey} style={{ background: "var(--series-1)" }} />
              <strong>{fmt.format(hot.visitors)}</strong> visitors
            </div>
            <div className={styles.tipRow}>
              <i className={styles.lineKey} style={{ background: "var(--series-2)" }} />
              <strong>{fmt.format(hot.views)}</strong> page views
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- columns */

export type ColumnPoint = { label: string; long: string; value: number };

const K = { h: 180, top: 18, bottom: 30, left: 36, right: 8 };

/** One series, so one colour and no legend - the card title names it. */
export function ColumnChart({ points, unit }: { points: ColumnPoint[]; unit: string }) {
  const [ref, w] = useWidth();
  const [i, setI] = useState<number | null>(null);

  const n = points.length;
  const max = Math.max(0, ...points.map((p) => p.value));
  const { top, ticks } = scale(max);
  const width = w ?? 0;
  const plotW = Math.max(0, width - K.left - K.right);
  const plotH = K.h - K.top - K.bottom;
  const slot = n ? plotW / n : 0;
  const bw = Math.max(2, Math.min(24, slot - 2)); // capped thin, 2px surface gap
  const y = (v: number) => K.top + plotH - (v / top) * plotH;
  const every = Math.max(1, Math.ceil(n / 6));
  const peak = points.findIndex((p) => p.value === max && max > 0);

  /** square at the baseline, 4px rounded data end */
  function bar(k: number, v: number) {
    const x0 = K.left + k * slot + (slot - bw) / 2;
    const y0 = y(v);
    const base = y(0);
    const r = Math.min(4, bw / 2, base - y0);
    if (v <= 0) return "";
    return `M${x0},${base}V${y0 + r}Q${x0},${y0} ${x0 + r},${y0}H${x0 + bw - r}Q${x0 + bw},${y0} ${x0 + bw},${y0 + r}V${base}Z`;
  }

  const hot = i !== null ? points[i] : null;
  const tipLeft = i !== null ? Math.min(Math.max(K.left + i * slot + slot / 2 + 10, 0), width - 150) : 0;

  return (
    <div className={styles.chart}>
      <div ref={ref} className={styles.plot} style={{ height: K.h }}>
        {w !== null && (
          <svg width={width} height={K.h} role="img"
               aria-label={`${unit} per period. Hover or focus a column to read it.`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={K.left} x2={width - K.right} y1={y(t)} y2={y(t)} className={t ? styles.grid : styles.baseline} />
                <text x={K.left - 8} y={y(t)} className={styles.tickY}>{fmt.format(t)}</text>
              </g>
            ))}
            {points.map((p, k) => (
              <g key={k}>
                <path d={bar(k, p.value)} fill="var(--series-1)" opacity={i === null || i === k ? 1 : 0.55} />
                {k === peak && (
                  <text x={K.left + k * slot + slot / 2} y={y(p.value) - 6} className={styles.peak}>
                    {fmt.format(p.value)}
                  </text>
                )}
                {(k % every === 0 || k === n - 1) && (
                  <text x={K.left + k * slot + slot / 2} y={K.h - 8} className={styles.tickX} textAnchor="middle">
                    {p.label}
                  </text>
                )}
                {/* the hit target is the whole slot, not the painted pixels */}
                <rect
                  x={K.left + k * slot} y={K.top} width={slot} height={plotH} fill="transparent"
                  tabIndex={0}
                  aria-label={`${p.long}: ${fmt.format(p.value)} ${unit}`}
                  onPointerEnter={() => setI(k)} onPointerLeave={() => setI(null)}
                  onFocus={() => setI(k)} onBlur={() => setI(null)}
                />
              </g>
            ))}
          </svg>
        )}
        {hot && (
          <div className={styles.tip} style={{ left: tipLeft, top: 4 }} aria-hidden>
            <div className={styles.tipHead}>{hot.long}</div>
            <div className={styles.tipRow}><strong>{fmt.format(hot.value)}</strong> {unit}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- heatmap */

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** sequential blue, light → dark; validated as an ordinal ramp on white */
const RAMP = ["var(--seq-250)", "var(--seq-350)", "var(--seq-450)", "var(--seq-550)", "var(--seq-650)"];

/** `grid[day][hour]`, Monday first. */
export function Heatmap({ grid }: { grid: number[][] }) {
  const [hot, setHot] = useState<{ d: number; h: number } | null>(null);
  const max = Math.max(0, ...grid.flat());
  const step = (v: number) => (v <= 0 || max === 0 ? null : RAMP[Math.min(RAMP.length - 1, Math.floor((v / max) * RAMP.length - 1e-9))]);
  const hour = (h: number) => `${String(h).padStart(2, "0")}:00`;

  return (
    <div className={styles.heatWrap}>
      <div className={styles.heat} onPointerLeave={() => setHot(null)}>
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className={styles.heatHour}>{h % 3 === 0 ? String(h).padStart(2, "0") : ""}</span>
        ))}
        {grid.map((row, d) => (
          <div key={d} className={styles.heatRow}>
            <span className={styles.heatDay}>{DAYS[d]}</span>
            {row.map((v, h) => (
              <span
                key={h}
                className={styles.cell}
                data-on={hot?.d === d && hot.h === h || undefined}
                style={{ background: step(v) ?? "var(--empty)" }}
                tabIndex={0}
                aria-label={`${DAYS[d]} ${hour(h)}–${hour((h + 1) % 24)}: ${v} page views`}
                onPointerEnter={() => setHot({ d, h })}
                onFocus={() => setHot({ d, h })}
                onBlur={() => setHot(null)}
              />
            ))}
          </div>
        ))}
      </div>
      <div className={styles.heatFoot}>
        <span className={styles.heatRead} aria-live="polite">
          {hot
            ? `${DAYS[hot.d]} ${hour(hot.h)}–${hour((hot.h + 1) % 24)} · ${fmt.format(grid[hot.d][hot.h])} page views`
            : "Hover a square to read it"}
        </span>
        <span className={styles.scale}>
          Fewer
          {RAMP.map((c) => <i key={c} style={{ background: c }} />)}
          More
        </span>
      </div>
    </div>
  );
}
