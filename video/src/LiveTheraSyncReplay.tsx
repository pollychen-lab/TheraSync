import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame } from "remotion";

const FPS = 30;
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

export type ReplayState = "landing" | "crisis" | "match" | "approval" | "confirmed";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const FadeUp: React.FC<{ delay?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ delay = 0, children, style }) => {
  const frame = useCurrentFrame();
  const enter = spring({ frame: Math.max(0, frame - delay), fps: FPS, config: { damping: 22, stiffness: 150, mass: 0.7 } });
  return <div style={{ opacity: enter, transform: `translateY(${(1 - enter) * 14}px)`, ...style }}>{children}</div>;
};

const MicroPulse: React.FC<{ color: string; size?: number }> = ({ color, size = 8 }) => {
  const frame = useCurrentFrame();
  const scale = 1 + ((frame % 45) / 45) * 1.25;
  const opacity = 0.42 * (1 - (frame % 45) / 45);
  return <span style={{ position: "relative", display: "inline-flex", width: size, height: size, borderRadius: "50%", background: color }}><span style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `2px solid ${color}`, transform: `scale(${scale})`, opacity }} /></span>;
};

const StatusPill: React.FC<{ label: string; tone?: "blue" | "green" | "red" }> = ({ label, tone = "blue" }) => {
  const palette = {
    blue: { bg: "#eaf3ff", border: "#b8d8ff", text: "#075eb8", dot: "#0877e8" },
    green: { bg: "#eaf8ee", border: "#a6e2ba", text: "#14733a", dot: "#16803d" },
    red: { bg: "#fff0ef", border: "#fecaca", text: "#c1362e", dot: "#ef4444" },
  }[tone];
  return <div style={{ display: "inline-flex", alignItems: "center", gap: 7, border: `1px solid ${palette.border}`, borderRadius: 999, padding: "6px 10px", background: palette.bg, color: palette.text, fontFamily: MONO, fontSize: 9, fontWeight: 800, letterSpacing: "0.06em", whiteSpace: "nowrap" }}><MicroPulse color={palette.dot} size={6} />{label}</div>;
};

const AgentCursor: React.FC<{ target: "intake" | "slot" | "approve" }> = ({ target }) => {
  const frame = useCurrentFrame();
  const positions = {
    intake: { x: 256, y: 257 },
    slot: { x: 561, y: 359 },
    approve: { x: 514, y: 412 },
  }[target];
  const arrive = spring({ frame: Math.max(0, frame - 68), fps: FPS, config: { damping: 18, stiffness: 115 } });
  return <div style={{ position: "absolute", left: positions.x, top: positions.y, zIndex: 12, transform: `translate(${(1 - arrive) * 38}px, ${(1 - arrive) * 18}px) rotate(-18deg)`, filter: "drop-shadow(0 3px 4px rgba(15,23,42,0.25))" }}><div style={{ width: 0, height: 0, borderTop: "11px solid #0f172a", borderRight: "8px solid transparent", borderLeft: "3px solid transparent" }} /><div style={{ marginLeft: 6, marginTop: 1, padding: "3px 6px", borderRadius: 5, background: "#0f172a", color: "#fff", fontFamily: MONO, fontSize: 7, fontWeight: 700, whiteSpace: "nowrap" }}>agent</div></div>;
};

const DataRail: React.FC<{ tone?: "blue" | "green" | "red" }> = ({ tone = "blue" }) => {
  const frame = useCurrentFrame();
  const color = tone === "red" ? "#ef4444" : tone === "green" ? "#22a556" : "#0877e8";
  const labels = tone === "red" ? ["Narrative", "safety check", "intercept"] : tone === "green" ? ["lock token", "consent", "commit"] : ["typed input", "match", "render"];
  return <div style={{ position: "absolute", bottom: 14, left: 22, right: 22, height: 27, display: "flex", alignItems: "center", gap: 9, color: "#64748b", fontFamily: MONO, fontSize: 8 }}>
    <span style={{ color, fontWeight: 800, letterSpacing: "0.08em" }}>LIVE FLOW</span>
    <div style={{ position: "relative", flex: 1, height: 2, borderRadius: 999, background: "#dce6f1", overflow: "hidden" }}>
      <div style={{ position: "absolute", width: 54, height: "100%", borderRadius: 999, background: color, transform: `translateX(${((frame * 2.3) % 160) - 55}px)`, boxShadow: `0 0 10px ${color}` }} />
    </div>
    {labels.map((label, index) => <span key={label} style={{ color: index === 2 ? color : "#64748b", fontWeight: index === 2 ? 800 : 500 }}>{label}</span>)}
  </div>;
};

const Header: React.FC<{ state: ReplayState }> = ({ state }) => {
  const status = state === "crisis" ? { label: "SAFETY MODE", tone: "red" as const } : state === "confirmed" ? { label: "BOOKING CONFIRMED", tone: "green" as const } : { label: "WEBMCP CONNECTED", tone: "blue" as const };
  return <div style={{ height: 54, padding: "0 22px", borderBottom: "1px solid #e4ebf3", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.92)" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}><div style={{ width: 25, height: 25, display: "grid", placeItems: "center", borderRadius: 8, background: "#0877e8", color: "#fff", fontSize: 14, fontWeight: 900 }}>T</div><div style={{ color: "#0f172a", fontSize: 14, fontWeight: 800, letterSpacing: "-0.02em" }}>TheraSync</div><div style={{ color: "#94a3b8", fontSize: 9 }}>Clinical intake co-pilot</div></div>
    <StatusPill label={status.label} tone={status.tone} />
  </div>;
};

const IntakeCard: React.FC<{ active?: boolean }> = ({ active = false }) => {
  const frame = useCurrentFrame();
  const narrative = "Workplace burnout and insomnia. Looking for CBT on Thursday evening.";
  const count = Math.floor(clamp((frame - 55) * 1.25, 0, narrative.length));
  return <div style={{ width: 370, margin: "18px 0 0 22px", padding: 16, border: `1px solid ${active ? "#8cc5ff" : "#dce6f1"}`, borderRadius: 14, background: "#fff", boxShadow: active ? "0 10px 24px rgba(8,119,232,0.12)" : "none" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ color: "#0f172a", fontSize: 12, fontWeight: 800 }}>Fictional intake</div><span style={{ color: "#0877e8", fontFamily: MONO, fontSize: 9, fontWeight: 800 }}>structured input</span></div>
    <div style={{ minHeight: 47, marginTop: 10, padding: 10, borderRadius: 9, background: "#f8fafc", color: "#475569", fontSize: 10, lineHeight: 1.45 }}>{narrative.slice(0, count)}<span style={{ opacity: active && frame % 22 < 11 ? 1 : 0, color: "#0877e8" }}>▋</span></div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>{["workplace burnout", "insomnia", "CBT"].map((tag) => <span key={tag} style={{ padding: "4px 7px", borderRadius: 999, background: "#eaf3ff", color: "#075eb8", fontFamily: MONO, fontSize: 8, fontWeight: 750 }}>{tag}</span>)}</div>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 13 }}><div style={{ color: "#64748b", fontSize: 9 }}>No DOM scraping required</div><div style={{ padding: "7px 10px", borderRadius: 8, background: "#0877e8", color: "#fff", fontSize: 9, fontWeight: 800 }}>Find therapists</div></div>
  </div>;
};

const SlotStrip: React.FC<{ confirmed?: boolean }> = ({ confirmed = false }) => {
  const frame = useCurrentFrame();
  const progress = clamp((frame - 130) / 90, 0, 1);
  return <div style={{ marginTop: 12 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#64748b", fontSize: 9 }}><span>Thursday · 6:00 PM</span><span style={{ color: confirmed ? "#16803d" : "#0877e8", fontFamily: MONO, fontWeight: 800 }}>{confirmed ? "CONFIRMED" : "8-WEEK CYCLE"}</span></div><div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 4, marginTop: 7 }}>{Array.from({ length: 8 }, (_, index) => <div key={index} style={{ height: 20, display: "grid", placeItems: "center", borderRadius: 6, background: index / 7 <= progress ? (confirmed ? "#d9f5e1" : "#dcebff") : "#f1f5f9", color: index / 7 <= progress ? (confirmed ? "#16803d" : "#0877e8") : "#94a3b8", fontFamily: MONO, fontSize: 8, fontWeight: 800, transform: `translateY(${Math.max(0, (index / 7 - progress) * 8)}px)` }}>{index + 1}</div>)}</div></div>;
};

const MatchCard: React.FC<{ compact?: boolean; confirmed?: boolean }> = ({ compact = false, confirmed = false }) => {
  const frame = useCurrentFrame();
  const enter = spring({ frame: Math.max(0, frame - 58), fps: FPS, config: { damping: 19, stiffness: 140 } });
  return <div style={{ width: compact ? 306 : 370, margin: "18px 0 0 22px", padding: compact ? 13 : 16, border: `1px solid ${confirmed ? "#a6e2ba" : "#b8d8ff"}`, borderRadius: 14, background: "#fff", boxShadow: "0 12px 28px rgba(15,23,42,0.09)", opacity: enter, transform: `translateX(${(1 - enter) * -24}px)` }}>
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}><div style={{ width: 34, height: 34, display: "grid", placeItems: "center", borderRadius: 11, background: "linear-gradient(135deg, #38a7f4, #635bff)", color: "#fff", fontSize: 12, fontWeight: 850 }}>SC</div><div><div style={{ color: "#0f172a", fontSize: 12, fontWeight: 800 }}>Dr. Sarah Chen, Ph.D.</div><div style={{ marginTop: 2, color: "#64748b", fontSize: 9 }}>Licensed psychologist · 4.9 ★</div></div></div>
    <div style={{ display: "flex", gap: 6, marginTop: 11 }}>{["CBT", "ACT", "burnout"].map((tag) => <span key={tag} style={{ padding: "4px 7px", borderRadius: 999, background: "#eef6ff", color: "#075eb8", fontFamily: MONO, fontSize: 8, fontWeight: 800 }}>{tag}</span>)}</div>
    <SlotStrip confirmed={confirmed} />
  </div>;
};

const MatchPanel: React.FC<{ confirmed?: boolean }> = ({ confirmed = false }) => {
  const frame = useCurrentFrame();
  const glow = 0.2 + 0.12 * Math.sin(frame / 9);
  return <div style={{ position: "absolute", right: 22, top: 72, width: 270, padding: 14, borderRadius: 14, background: "#fff", border: `1px solid ${confirmed ? "#a6e2ba" : "#b8d8ff"}`, boxShadow: `0 12px 28px rgba(8,119,232,${glow})` }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><div style={{ color: "#0f172a", fontSize: 11, fontWeight: 800 }}>{confirmed ? "Recurring booking" : "Best matching window"}</div><StatusPill label={confirmed ? "COMMITTED" : "MATCHED"} tone={confirmed ? "green" : "blue"} /></div>
    <div style={{ marginTop: 12, padding: 11, borderRadius: 10, background: confirmed ? "#f2fbf5" : "#f4f8ff" }}><div style={{ color: confirmed ? "#16803d" : "#075eb8", fontSize: 12, fontWeight: 800 }}>Thursday · 6:00 PM</div><div style={{ marginTop: 4, color: "#64748b", fontSize: 9, lineHeight: 1.45 }}>{confirmed ? "Slot reserved and saved" : "Eight recurring sessions available"}</div></div>
    <div style={{ marginTop: 12, display: "flex", gap: 6, alignItems: "center" }}><MicroPulse color={confirmed ? "#16803d" : "#0877e8"} size={7} /><span style={{ color: "#64748b", fontFamily: MONO, fontSize: 8 }}>{confirmed ? "booking_id: BK_…" : "agent result → person review"}</span></div>
  </div>;
};

const WorkflowTelemetry: React.FC<{ state: "match" | "approval" | "confirmed" }> = ({ state }) => {
  const frame = useCurrentFrame();
  const confirmed = state === "confirmed";
  const labels = confirmed ? ["lock token verified", "consent recorded", "booking persisted"] : state === "approval" ? ["slot lock active", "human review open", "commit held"] : ["criteria normalized", "therapist ranked", "cycle mapped"];
  const phase = Math.floor(frame / 82) % labels.length;
  const rail = ((frame % (82 * labels.length)) / (82 * labels.length)) * 100;
  const color = confirmed ? "#16803d" : "#0877e8";
  return <div style={{ position: "absolute", left: 22, right: 22, top: 250, padding: 13, borderRadius: 13, border: "1px solid #dce6f1", background: "rgba(255,255,255,0.77)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ color: "#475569", fontFamily: MONO, fontSize: 8, fontWeight: 800, letterSpacing: "0.08em" }}>REAL-TIME FLOW TRACE</div><div style={{ color, fontFamily: MONO, fontSize: 8, fontWeight: 800 }}>EVENT {phase + 1}/3</div></div>
    <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 11 }}>
      <div style={{ position: "absolute", top: 9, left: "15%", right: "15%", height: 2, background: "#dce6f1" }}><div style={{ position: "absolute", top: -3, left: `${rail}%`, width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: `0 0 11px ${color}`, transform: "translateX(-50%)" }} /></div>
      {labels.map((label, index) => <div key={label} style={{ position: "relative", zIndex: 1, paddingTop: 20, color: index === phase ? color : "#64748b", fontSize: 9, lineHeight: 1.25, textAlign: "center", fontWeight: index === phase ? 800 : 500 }}><span style={{ position: "absolute", top: 0, left: "50%", width: 12, height: 12, borderRadius: "50%", transform: "translateX(-50%)", background: index <= phase ? color : "#e2e8f0", boxShadow: index === phase ? `0 0 0 4px ${color}22` : "none" }} />{label}</div>)}
    </div>
  </div>;
};

const CrisisOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const enter = spring({ frame: Math.max(0, frame - 132), fps: FPS, config: { damping: 18, stiffness: 145 } });
  const ring = 1 + ((frame % 52) / 52) * 0.6;
  return <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(15,23,42,0.52)", backdropFilter: "blur(5px)", zIndex: 10 }}>
    <div style={{ position: "absolute", width: 520, height: 520, borderRadius: "50%", border: "2px solid rgba(239,68,68,0.45)", transform: `scale(${1 + ((frame % 96) / 96) * 0.42})`, opacity: 0.34 * (1 - (frame % 96) / 96) }} />
    <div style={{ position: "absolute", width: 340, height: 340, borderRadius: "50%", background: "radial-gradient(circle, rgba(239,68,68,0.18), rgba(239,68,68,0) 68%)", transform: `scale(${0.9 + ((frame % 72) / 72) * 0.25})`, opacity: 0.7 }} />
    <div style={{ width: 500, padding: 20, borderRadius: 17, background: "rgba(255,255,255,0.98)", boxShadow: "0 24px 60px rgba(15,23,42,0.35)", transform: `scale(${enter})`, opacity: enter }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}><div style={{ position: "relative", width: 34, height: 34, display: "grid", placeItems: "center", borderRadius: "50%", background: "#fff0ef", color: "#ef4444", fontSize: 19, fontWeight: 850 }}>!<span style={{ position: "absolute", inset: 0, border: "2px solid #ef4444", borderRadius: "50%", transform: `scale(${ring})`, opacity: 0.32 * (1 - (frame % 52) / 52) }} /></div><div><div style={{ color: "#b91c1c", fontFamily: MONO, fontSize: 9, fontWeight: 800, letterSpacing: "0.1em" }}>CRISIS INTERCEPTED</div><div style={{ marginTop: 3, color: "#0f172a", fontSize: 16, fontWeight: 800 }}>Support is available right now</div></div></div>
      <div style={{ marginTop: 12, color: "#64748b", fontSize: 10, lineHeight: 1.5 }}>Routine scheduling is paused so immediate support options can be shown.</div>
      <div style={{ display: "grid", gap: 6, marginTop: 12 }}>{["988 Suicide & Crisis Lifeline", "Emergency services: 911", "Crisis Text Line: HOME to 741741"].map((item, index) => <FadeUp key={item} delay={151 + index * 10}><div style={{ padding: "8px 10px", borderRadius: 8, background: "#fff2f1", color: "#c1362e", fontSize: 10, fontWeight: 700 }}>{item}</div></FadeUp>)}</div>
      <div style={{ marginTop: 13, padding: "9px 10px", borderRadius: 8, background: "#0f172a", color: "#fff", textAlign: "center", fontSize: 10, fontWeight: 750 }}>Acknowledge and return to safe mode</div>
    </div>
  </div>;
};

const ApprovalOverlay: React.FC<{ confirmed: boolean }> = ({ confirmed }) => {
  const frame = useCurrentFrame();
  const enter = spring({ frame: Math.max(0, frame - 100), fps: FPS, config: { damping: 18, stiffness: 145 } });
  if (confirmed) {
    return <FadeUp delay={42} style={{ position: "absolute", left: 22, right: 22, top: 68, zIndex: 9 }}><div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 11, border: "1px solid #a6e2ba", background: "#effbf3", boxShadow: "0 10px 24px rgba(22,128,61,0.12)" }}><MicroPulse color="#16803d" /><div><div style={{ color: "#16803d", fontSize: 11, fontWeight: 800 }}>Booking confirmed</div><div style={{ marginTop: 2, color: "#64748b", fontSize: 9 }}>Dr. Sarah Chen · Thursday 6:00 PM · recurring slot locked</div></div></div></FadeUp>;
  }
  return <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(15,23,42,0.36)", backdropFilter: "blur(4px)", zIndex: 10 }}><div style={{ width: 490, padding: 19, borderRadius: 17, background: "rgba(255,255,255,0.98)", boxShadow: "0 24px 60px rgba(15,23,42,0.32)", transform: `scale(${enter})`, opacity: enter }}>
    <div style={{ color: "#0877e8", fontFamily: MONO, fontSize: 9, fontWeight: 850, letterSpacing: "0.1em" }}>WEBMCP APPROVAL GUARD</div><div style={{ marginTop: 7, color: "#0f172a", fontSize: 17, fontWeight: 800 }}>Confirm intake booking and informed consent</div>
    <div style={{ display: "grid", gap: 6, marginTop: 13, padding: 11, borderRadius: 10, background: "#f8fafc", color: "#475569", fontSize: 10 }}><div><span style={{ color: "#94a3b8" }}>Therapist</span> · Dr. Sarah Chen, Ph.D.</div><div><span style={{ color: "#94a3b8" }}>Slot to lock</span> · Thursday 6:00 PM</div><div><span style={{ color: "#94a3b8" }}>Summary</span> · de-identified demo intake</div></div>
    <div style={{ marginTop: 11, color: "#64748b", fontSize: 9 }}>Editable summary. Nothing is committed until the human approves.</div><div style={{ display: "flex", gap: 8, marginTop: 14 }}><div style={{ flex: 1, padding: 9, borderRadius: 8, border: "1px solid #dce6f1", color: "#475569", textAlign: "center", fontSize: 9 }}>Decline</div><div style={{ flex: 2, padding: 9, borderRadius: 8, background: "#0877e8", color: "#fff", textAlign: "center", fontSize: 9, fontWeight: 800 }}>Approve &amp; sign intake</div></div>
  </div></div>;
};

/**
 * A faithful, animated replay of the local product states. It keeps the
 * video visibly alive between narrated actions without inventing a third
 * product surface: the labels and state transitions mirror TheraSyncApp.tsx.
 */
export const LiveTheraSyncReplay: React.FC<{ state: ReplayState }> = ({ state }) => {
  const frame = useCurrentFrame();
  const isMatch = state === "match" || state === "approval" || state === "confirmed";
  const isConfirmed = state === "confirmed";
  const target = state === "landing" ? "intake" : state === "match" ? "slot" : "approve";
  const backgroundShift = Math.sin(frame / 55) * 3;
  return <AbsoluteFill style={{ overflow: "hidden", background: "linear-gradient(145deg, #f7fbff 0%, #eef5fc 100%)", fontFamily: FONT }}>
    <div style={{ position: "absolute", top: -130, right: -90, width: 340, height: 340, borderRadius: "50%", background: "radial-gradient(circle, rgba(96,165,250,0.18), rgba(96,165,250,0) 68%)", transform: `translate(${backgroundShift}px, ${-backgroundShift}px)` }} />
    <Header state={state} />
    {isMatch ? <MatchCard compact={state !== "match"} confirmed={isConfirmed} /> : state !== "crisis" ? <IntakeCard active={state === "landing"} /> : null}
    {isMatch && <MatchPanel confirmed={isConfirmed} />}
    {isMatch && <WorkflowTelemetry state={state as "match" | "approval" | "confirmed"} />}
    {state === "landing" && <div style={{ position: "absolute", right: 22, top: 85, width: 270, padding: 14, borderRadius: 14, background: "#fff", border: "1px solid #dce6f1", boxShadow: "0 12px 28px rgba(15,23,42,0.07)" }}><div style={{ color: "#0f172a", fontSize: 11, fontWeight: 800 }}>How the agent can help</div><div style={{ display: "grid", gap: 8, marginTop: 12 }}>{[["1", "Triage with typed data"], ["2", "Match recurring availability"], ["3", "Request human approval"]].map(([number, label], index) => <FadeUp key={label} delay={index * 13 + 30}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 18, height: 18, display: "grid", placeItems: "center", borderRadius: 6, background: "#eaf3ff", color: "#0877e8", fontFamily: MONO, fontSize: 8, fontWeight: 800 }}>{number}</div><span style={{ color: "#475569", fontSize: 9 }}>{label}</span></div></FadeUp>)}</div></div>}
    {state === "crisis" && <><IntakeCard /><CrisisOverlay /></>}
    {state === "approval" && <ApprovalOverlay confirmed={false} />}
    {state === "confirmed" && <ApprovalOverlay confirmed />}
    {state !== "crisis" && <AgentCursor target={target} />}
    <DataRail tone={state === "crisis" ? "red" : isConfirmed ? "green" : "blue"} />
  </AbsoluteFill>;
};
