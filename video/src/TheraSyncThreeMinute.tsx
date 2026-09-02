import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { LiveTheraSyncReplay } from "./LiveTheraSyncReplay";

const FPS = 30;
// The scene windows follow the measured, natural narration durations. The
// cut stays exactly three minutes without time-compressing ElevenLabs audio.
const INTRO = 1045; // 34.83s
const CRISIS = 1192; // 39.73s
const TRIAGE = 1355; // 45.17s
const BOOKING = 1351; // 45.03s
const CLOSE = 457; // 15.23s
export const THREE_MINUTE_FRAMES = INTRO + CRISIS + TRIAGE + BOOKING + CLOSE;

const COLORS = {
  ink: "#0f172a",
  muted: "#64748b",
  blue: "#0877e8",
  blueSoft: "#e8f2ff",
  red: "#ef4444",
  redSoft: "#fff1f0",
  green: "#16803d",
  greenSoft: "#e9f9ee",
  slate: "#111827",
  slate2: "#1e293b",
  line: "rgba(148, 163, 184, 0.28)",
};

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

const fade = (frame: number, duration: number): React.CSSProperties => ({
  opacity: interpolate(frame, [0, 16, duration - 16, duration], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  }),
});

const Narration: React.FC<{ src: string }> = ({ src }) => (
  <Audio src={staticFile(src)} volume={0.98} />
);

const Progress: React.FC<{ current: number; label: string; dark?: boolean }> = ({ current, label, dark = false }) => (
  <div style={{ position: "absolute", left: 72, right: 72, bottom: 28, display: "flex", alignItems: "center", gap: 16, color: dark ? "#94a3b8" : COLORS.muted, fontFamily: FONT, fontSize: 13 }}>
    <div style={{ flex: 1, height: 3, borderRadius: 999, background: dark ? "#334155" : "#dbe4ef" }}>
      <div style={{ width: `${(current / 5) * 100}%`, height: "100%", borderRadius: 999, background: dark ? "#60a5fa" : COLORS.blue }} />
    </div>
    <div style={{ minWidth: 146, textAlign: "right", letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</div>
  </div>
);

const Scene: React.FC<{ duration: number; children: React.ReactNode; background: string }> = ({ duration, children, background }) => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ ...fade(frame, duration), background, fontFamily: FONT }}>{children}</AbsoluteFill>;
};

const Pill: React.FC<{ children: React.ReactNode; tone?: "blue" | "red" | "green" | "dark" }> = ({ children, tone = "blue" }) => {
  const palette = {
    blue: { background: COLORS.blueSoft, color: "#0056b3" },
    red: { background: COLORS.redSoft, color: COLORS.red },
    green: { background: COLORS.greenSoft, color: COLORS.green },
    dark: { background: "rgba(255,255,255,0.12)", color: "#dbeafe" },
  }[tone];
  return <span style={{ display: "inline-flex", alignItems: "center", padding: "8px 13px", borderRadius: 999, background: palette.background, color: palette.color, fontSize: 14, fontWeight: 800, letterSpacing: "0.05em" }}>{children}</span>;
};

const SectionHeader: React.FC<{ kicker: string; title: string; description: string; dark?: boolean }> = ({ kicker, title, description, dark = false }) => (
  <div style={{ position: "absolute", left: 72, top: 40, right: 72, color: dark ? "#f8fafc" : COLORS.ink }}>
    <div style={{ color: dark ? "#93c5fd" : COLORS.blue, fontSize: 13, fontWeight: 850, letterSpacing: "0.14em", textTransform: "uppercase" }}>{kicker}</div>
    <div style={{ marginTop: 8, fontSize: 31, fontWeight: 780, letterSpacing: "-0.035em", lineHeight: 1.08 }}>{title}</div>
    <div style={{ maxWidth: 1020, marginTop: 8, color: dark ? "#cbd5e1" : COLORS.muted, fontSize: 16, lineHeight: 1.42 }}>{description}</div>
  </div>
);

const BrowserChrome: React.FC<{ children: React.ReactNode; title?: string }> = ({ children, title = "TheraSync Co-Pilot" }) => (
  <div style={{ position: "absolute", left: 782, top: 198, width: 746, height: 574, overflow: "hidden", borderRadius: 18, background: "#fff", boxShadow: "0 24px 65px rgba(15,23,42,0.2)", border: "1px solid rgba(15,23,42,0.14)" }}>
    <div style={{ height: 40, display: "flex", alignItems: "center", gap: 9, padding: "0 14px", background: "#eef2f7", borderBottom: "1px solid #d8e0eb" }}>
      <i style={{ width: 10, height: 10, borderRadius: "50%", background: "#fb7185" }} />
      <i style={{ width: 10, height: 10, borderRadius: "50%", background: "#fbbf24" }} />
      <i style={{ width: 10, height: 10, borderRadius: "50%", background: "#4ade80" }} />
      <div style={{ flex: 1, marginLeft: 12, padding: "6px 12px", borderRadius: 8, background: "#fff", color: "#64748b", fontFamily: MONO, fontSize: 11 }}>http://localhost:3000</div>
      <div style={{ color: "#64748b", fontSize: 12 }}>{title}</div>
    </div>
    {children}
  </div>
);

const ConsoleWindow: React.FC<{ children: React.ReactNode; accent?: "blue" | "red" | "green" }> = ({ children, accent = "blue" }) => (
  <div style={{ position: "absolute", left: 72, top: 198, width: 676, height: 574, overflow: "hidden", borderRadius: 18, background: COLORS.slate, boxShadow: "0 24px 65px rgba(15,23,42,0.2)", border: `1px solid ${accent === "red" ? "#7f1d1d" : accent === "green" ? "#14532d" : "#1e40af"}` }}>
    <div style={{ height: 40, display: "flex", alignItems: "center", gap: 9, padding: "0 14px", background: COLORS.slate2, color: "#cbd5e1", fontFamily: FONT, fontSize: 12 }}>
      <i style={{ width: 10, height: 10, borderRadius: "50%", background: "#fb7185" }} />
      <i style={{ width: 10, height: 10, borderRadius: "50%", background: "#fbbf24" }} />
      <i style={{ width: 10, height: 10, borderRadius: "50%", background: "#4ade80" }} />
      <span style={{ marginLeft: 8, fontWeight: 700 }}>Chrome DevTools</span>
      <span style={{ color: "#64748b" }}>›</span>
      <span>Console</span>
    </div>
    {children}
  </div>
);

const ConsoleLine: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = "#cbd5e1" }) => (
  <div style={{ color, fontFamily: MONO, fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{children}</div>
);

const CommandBlock: React.FC<{ command: string; frame: number; start: number; color?: string }> = ({ command, frame, start, color = "#bfdbfe" }) => {
  const chars = Math.floor(interpolate(frame, [start, start + 52], [0, command.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const text = command.slice(0, chars);
  return (
    <div style={{ padding: "20px 20px 0" }}>
      <ConsoleLine color="#60a5fa">❯</ConsoleLine>
      <ConsoleLine color={color}>{text}<span style={{ opacity: frame % 20 < 10 ? 1 : 0 }}>▋</span></ConsoleLine>
    </div>
  );
};

const OutputBlock: React.FC<{ children: React.ReactNode; frame: number; start: number; tone?: "blue" | "red" | "green" }> = ({ children, frame, start, tone = "blue" }) => {
  const opacity = interpolate(frame, [start, start + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const color = tone === "red" ? "#fca5a5" : tone === "green" ? "#86efac" : "#bfdbfe";
  return <div style={{ margin: "19px 20px 0", padding: 14, borderRadius: 10, background: "rgba(2,6,23,0.58)", opacity, color, fontFamily: MONO, fontSize: 12, lineHeight: 1.55 }}>{children}</div>;
};

const Callout: React.FC<{ children: React.ReactNode; top: number; left: number; tone?: "blue" | "red" | "green" }> = ({ children, top, left, tone = "blue" }) => {
  const frame = useCurrentFrame();
  const scale = spring({ frame: Math.max(0, frame - 18), fps: FPS, config: { damping: 180 } });
  const palette = tone === "red" ? { background: COLORS.redSoft, color: COLORS.red, border: "#fecaca" } : tone === "green" ? { background: COLORS.greenSoft, color: COLORS.green, border: "#bbf7d0" } : { background: COLORS.blueSoft, color: "#0056b3", border: "#bfdbfe" };
  return <div style={{ position: "absolute", top, left, transform: `scale(${scale})`, transformOrigin: "left center", padding: "10px 14px", border: `1px solid ${palette.border}`, borderRadius: 10, background: palette.background, color: palette.color, fontFamily: MONO, fontSize: 12, fontWeight: 800, boxShadow: "0 10px 26px rgba(15,23,42,0.12)" }}>{children}</div>;
};

const SystemDiagram: React.FC = () => {
  const frame = useCurrentFrame();
  const packetPosition = (offset: number) => `${((frame * 1.5 + offset) % 100)}%`;
  return <div style={{ position: "absolute", left: 72, top: 215, width: 660, display: "grid", gridTemplateColumns: "1fr 72px 1fr 72px 1fr", alignItems: "center", gap: 0 }}>
    {[
      { label: "BROWSER", title: "WebMCP tools", body: "triage · booking", color: "#60a5fa" },
      { label: "EXPRESS API", title: "Safety + locks", body: "/api/triage · /api/book/*", color: "#a78bfa" },
      { label: "POSTGRES", title: "Durable state", body: "therapists · bookings", color: "#34d399" },
    ].map((item, index) => (
      <React.Fragment key={item.label}>
        <div style={{ minHeight: 156, padding: 20, borderRadius: 17, border: `1px solid ${item.color}66`, background: "rgba(15,23,42,0.74)", boxShadow: "0 18px 36px rgba(0,0,0,0.18)" }}>
          <div style={{ color: item.color, fontFamily: FONT, fontSize: 11, fontWeight: 800, letterSpacing: "0.12em" }}>{item.label}</div>
          <div style={{ marginTop: 17, color: "#f8fafc", fontFamily: FONT, fontSize: 20, fontWeight: 750 }}>{item.title}</div>
          <div style={{ marginTop: 11, color: "#cbd5e1", fontFamily: MONO, fontSize: 11, lineHeight: 1.4 }}>{item.body}</div>
        </div>
        {index < 2 && <div style={{ position: "relative", height: 2, overflow: "visible", background: "linear-gradient(90deg, #60a5fa, #a78bfa)", opacity: 0.9 }}><div style={{ position: "absolute", top: "50%", left: packetPosition(index * 48), width: 9, height: 9, borderRadius: "50%", transform: "translate(-50%, -50%)", background: index === 0 ? "#dbeafe" : "#bbf7d0", boxShadow: "0 0 14px rgba(255,255,255,0.9)" }} /></div>}
      </React.Fragment>
    ))}
  </div>;
};

const ToolInspector: React.FC = () => {
  const frame = useCurrentFrame();
  const tools = [
    {
      name: "triage_and_match_therapists",
      inputs: "raw_narrative · focus_areas[] · preferred_modality",
      badge: "safe read",
      color: "#60a5fa",
    },
    {
      name: "commit_intake_booking",
      inputs: "therapist_id · selected_slot · intake_summary",
      badge: "approval required",
      color: "#fbbf24",
    },
  ];
  return (
    <div style={{ position: "absolute", left: 72, top: 416, width: 660, height: 312, padding: "18px 20px", boxSizing: "border-box", borderRadius: 17, border: "1px solid rgba(96,165,250,0.35)", background: "rgba(15,23,42,0.82)", boxShadow: "0 18px 36px rgba(0,0,0,0.18)", fontFamily: MONO }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 13, borderBottom: "1px solid rgba(148,163,184,0.24)" }}>
        <div style={{ color: "#f8fafc", fontFamily: FONT, fontSize: 16, fontWeight: 760 }}>WebMCP Inspect</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#86efac", fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}><span style={{ position: "relative", width: 7, height: 7, borderRadius: "50%", background: "#86efac" }}><span style={{ position: "absolute", inset: 0, border: "1px solid #86efac", borderRadius: "50%", transform: `scale(${1 + ((frame % 36) / 36) * 1.9})`, opacity: 0.45 * (1 - (frame % 36) / 36) }} /></span>2 tools registered</div>
      </div>
      {tools.map((tool, index) => {
        const reveal = interpolate(frame, [28 + index * 18, 48 + index * 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div key={tool.name} style={{ opacity: reveal, transform: `translateY(${(1 - reveal) * 8}px)`, display: "grid", gridTemplateColumns: "12px 1fr auto", columnGap: 11, alignItems: "center", marginTop: 16 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: tool.color, boxShadow: `0 0 0 4px ${tool.color}22` }} />
            <div>
              <div style={{ color: "#dbeafe", fontSize: 13, fontWeight: 750 }}>{tool.name}</div>
              <div style={{ marginTop: 6, color: "#94a3b8", fontSize: 11 }}>{tool.inputs}</div>
            </div>
            <div style={{ padding: "6px 9px", borderRadius: 999, border: `1px solid ${tool.color}66`, color: tool.color, fontSize: 10, fontWeight: 800, whiteSpace: "nowrap" }}>{tool.badge}</div>
          </div>
        );
      })}
      <div style={{ position: "absolute", left: 20, right: 20, bottom: 16, paddingTop: 12, borderTop: "1px solid rgba(148,163,184,0.18)", color: "#64748b", fontSize: 10.5 }}>window.__WEBMCP_TOOLS__ · navigator.modelContext · typed inputSchema + handler</div>
    </div>
  );
};

const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const rise = spring({ frame, fps: FPS, config: { damping: 190 } });
  return (
    <Scene duration={INTRO} background="linear-gradient(135deg, #0b1220 0%, #12233f 56%, #0f3765 100%)">
      <Narration src="audio/01-intro.mp3" />
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -200, top: -280, width: 760, height: 760, borderRadius: "50%", background: "radial-gradient(circle, rgba(96,165,250,0.3), rgba(96,165,250,0) 70%)" }} />
      </div>
      <div style={{ position: "absolute", left: 72, top: 54, transform: `translateY(${(1 - rise) * 18}px)` }}>
        <Pill tone="dark">OPENAI WEBMCP CHALLENGE</Pill>
        <div style={{ marginTop: 20, color: "#f8fafc", fontSize: 53, fontWeight: 800, letterSpacing: "-0.055em" }}>TheraSync</div>
        <div style={{ marginTop: 3, color: "#93c5fd", fontSize: 24, fontWeight: 650 }}>agent-native access, human-held decisions</div>
      </div>
      <SystemDiagram />
      <ToolInspector />
      <BrowserChrome>
        <LiveTheraSyncReplay state="landing" />
      </BrowserChrome>
      <Callout top={788} left={72}>2 tools · 3 services · 1 human decision</Callout>
      <Progress current={1} label="00:00 · overview" dark />
    </Scene>
  );
};

const CrisisModal: React.FC = () => (
  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,0.46)", backdropFilter: "blur(8px)" }}>
    <div style={{ width: 580, padding: 25, borderRadius: 20, background: "rgba(255,255,255,0.97)", boxShadow: "0 28px 80px rgba(15,23,42,0.36)", fontFamily: FONT }}>
      <div style={{ width: 36, height: 36, display: "grid", placeItems: "center", borderRadius: "50%", background: COLORS.redSoft, color: COLORS.red, fontSize: 20, fontWeight: 850 }}>!</div>
      <div style={{ marginTop: 12, color: COLORS.ink, fontSize: 22, fontWeight: 780 }}>Support is available right now</div>
      <div style={{ marginTop: 10, color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>Routine scheduling is paused so immediate support options can be shown.</div>
      <div style={{ marginTop: 13, padding: "13px 15px", borderRadius: 13, background: COLORS.redSoft, color: COLORS.red, fontSize: 13, fontWeight: 750, lineHeight: 1.75 }}>
        <div>988 Suicide &amp; Crisis Lifeline (call or text 988)</div>
        <div>Emergency services: 911</div>
        <div>Crisis Text Line: text HOME to 741741</div>
      </div>
      <div style={{ marginTop: 14, padding: "11px 13px", borderRadius: 10, background: COLORS.ink, color: "#fff", textAlign: "center", fontSize: 13, fontWeight: 700 }}>Acknowledge and return to safe mode</div>
    </div>
  </div>
);

const CrisisScene: React.FC = () => {
  const frame = useCurrentFrame();
  const showModal = frame > 145;
  const command = `window.__WEBMCP_TOOLS__.find(t => t.name ===\n  'triage_and_match_therapists').handler({\n  raw_narrative: "I have been feeling deeply hopeless\n  and having suicidal thoughts lately."\n})`;
  return (
    <Scene duration={CRISIS} background="#fff8f7">
      <Narration src="audio/02-crisis.mp3" />
      <SectionHeader kicker="0:35 · safety circuit-breaker" title="Crisis signals take a different path." description="The browser reacts immediately; the server repeats the check as the authoritative safety net." />
      <ConsoleWindow accent="red">
        <CommandBlock command={command} frame={frame} start={35} color="#fecaca" />
        <OutputBlock frame={frame} start={130} tone="red">
          <div>status: <strong>"CRISIS_INTERCEPTED"</strong></div>
          <div style={{ marginTop: 7 }}>routine scheduling paused</div>
          <div style={{ marginTop: 7, color: "#f87171" }}>hotlines displayed in the page</div>
        </OutputBlock>
        <div style={{ position: "absolute", left: 20, right: 20, bottom: 23, color: "#64748b", fontFamily: MONO, fontSize: 11 }}>backend: POST /api/triage · frontend guard + server guard</div>
      </ConsoleWindow>
      <BrowserChrome title="Safety response">
        <LiveTheraSyncReplay state="crisis" />
      </BrowserChrome>
      {showModal && <Callout top={715} left={804} tone="red">CRISIS_INTERCEPTED · no slot lock</Callout>}
      <Progress current={2} label="00:35 · safety" />
    </Scene>
  );
};

const TriageScene: React.FC = () => {
  const frame = useCurrentFrame();
  const command = `window.__WEBMCP_TOOLS__.find(t => t.name ===\n  'triage_and_match_therapists').handler({\n  raw_narrative: "Workplace burnout and insomnia.\n  Looking for CBT on Thursday evening.",\n  focus_areas: ["workplace_burnout", "insomnia"],\n  preferred_modality: "CBT"\n})`;
  return (
    <Scene duration={TRIAGE} background="#f3f8ff">
      <Narration src="audio/03-triage.mp3" />
      <SectionHeader kicker="1:15 · structured matching" title="Narrative in. Useful options out." description="Typed fields replace DOM scraping: the agent sends the narrative, focus areas, and preferred modality as a contract." />
      <ConsoleWindow>
        <CommandBlock command={command} frame={frame} start={28} />
        <OutputBlock frame={frame} start={138}>
          <div>status: <strong>"SUCCESS"</strong></div>
          <div>matched_count: <strong>1</strong></div>
          <div style={{ marginTop: 7 }}>therapist: <strong>"Dr. Sarah Chen, Ph.D."</strong></div>
          <div>slots: ["Thursday 18:00", "Saturday 10:00"]</div>
        </OutputBlock>
        <div style={{ position: "absolute", left: 20, right: 20, bottom: 23, color: "#64748b", fontFamily: MONO, fontSize: 11 }}>backend: SELECT * FROM therapists ORDER BY rating DESC</div>
      </ConsoleWindow>
      <BrowserChrome title="Matched therapist">
        <LiveTheraSyncReplay state="match" />
      </BrowserChrome>
      <Callout top={355} left={1040}>CBT · Dr. Sarah Chen</Callout>
      <Callout top={570} left={1040} tone="green">Thursday 18:00 · recurring · 8 weeks</Callout>
      <Progress current={3} label="01:15 · matching" />
    </Scene>
  );
};

const ApprovalModal: React.FC<{ success: boolean }> = ({ success }) => {
  if (success) {
    return <div style={{ position: "absolute", left: 48, right: 48, top: 30, padding: "17px 20px", borderRadius: 14, background: COLORS.greenSoft, color: COLORS.green, fontFamily: FONT, fontSize: 14, fontWeight: 700, boxShadow: "0 10px 22px rgba(22,128,61,0.12)" }}><strong>Booking confirmed.</strong> Dr. Sarah Chen, Ph.D. · Thursday 18:00 · recurring slot locked.</div>;
  }
  return <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,0.4)", backdropFilter: "blur(8px)" }}><div style={{ width: 585, padding: 25, borderRadius: 20, background: "rgba(255,255,255,0.97)", boxShadow: "0 28px 80px rgba(15,23,42,0.36)", fontFamily: FONT }}><div style={{ color: COLORS.blue, fontSize: 12, fontWeight: 850, letterSpacing: "0.12em" }}>WEBMCP APPROVAL GUARD</div><div style={{ marginTop: 10, color: COLORS.ink, fontSize: 22, fontWeight: 780, lineHeight: 1.15 }}>Confirm intake booking and informed consent</div><div style={{ marginTop: 16, padding: 15, border: `1px solid ${COLORS.line}`, borderRadius: 13, color: COLORS.ink, fontSize: 13, lineHeight: 1.7, background: "#fbfbfd" }}><div><span style={{ color: COLORS.muted }}>Therapist</span> · Dr. Sarah Chen, Ph.D.</div><div><span style={{ color: COLORS.muted }}>Slot to lock</span> · Thursday 18:00</div><div><span style={{ color: COLORS.muted }}>Summary</span> · de-identified demo intake</div></div><div style={{ marginTop: 13, color: COLORS.muted, fontSize: 12, lineHeight: 1.5 }}>Editable summary. Nothing is committed until the human approves.</div><div style={{ display: "flex", gap: 10, marginTop: 18 }}><div style={{ flex: 1, padding: "12px 8px", border: `1px solid ${COLORS.line}`, borderRadius: 11, textAlign: "center", color: COLORS.ink, fontSize: 13 }}>Decline</div><div style={{ flex: 2, padding: "12px 8px", borderRadius: 11, textAlign: "center", color: "#fff", background: COLORS.blue, fontSize: 13, fontWeight: 700 }}>Approve &amp; sign intake</div></div></div></div>;
};

const BookingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const success = frame > 790;
  const command = `window.__WEBMCP_TOOLS__.find(t => t.name ===\n  'commit_intake_booking').handler({\n  therapist_id: "th_01",\n  selected_slot: "Thursday 18:00",\n  intake_summary: "de-identified demo intake"\n})`;
  return (
    <Scene duration={BOOKING} background="#f2f8f4">
      <Narration src="audio/04-booking.mp3" />
      <SectionHeader kicker="2:00 · human-in-the-loop commitment" title="The agent can prepare. It cannot consent." description="The slot is locked while a person reviews the summary. Only explicit approval sends userConsent: true to the server." />
      <ConsoleWindow accent={success ? "green" : "blue"}>
        <CommandBlock command={command} frame={frame} start={28} color="#bfdbfe" />
        <OutputBlock frame={frame} start={success ? 800 : 170} tone={success ? "green" : "blue"}>
          {success ? <><div>status: <strong>"SUCCESS"</strong></div><div>booking_id: <strong>"BK_…"</strong></div><div>consent_acknowledged: <strong>true</strong></div></> : <><div>lock: <strong>"active"</strong></div><div>expiresInSeconds: <strong>600</strong></div><div style={{ marginTop: 7 }}>waiting for human approval…</div></>}
        </OutputBlock>
        <div style={{ position: "absolute", left: 20, right: 20, bottom: 23, color: "#64748b", fontFamily: MONO, fontSize: 11 }}>{success ? "backend: INSERT INTO bookings · unique confirmed-slot guard" : "backend: POST /api/book/lock · exact lock token required"}</div>
      </ConsoleWindow>
      <BrowserChrome title={success ? "Booking confirmed" : "Approval required"}>
        <LiveTheraSyncReplay state={success ? "confirmed" : "approval"} />
      </BrowserChrome>
      {!success && <Callout top={708} left={804}>lock → review → approve or decline</Callout>}
      {success && <Callout top={708} left={804} tone="green">userConsent: true · persisted</Callout>}
      <Progress current={4} label="02:00 · consent" />
    </Scene>
  );
};

const ClosingNetwork: React.FC = () => {
  const frame = useCurrentFrame();
  const dots = [
    { x: 0, y: 210, delay: 0 },
    { x: 125, y: 120, delay: 47 },
    { x: 275, y: 215, delay: 94 },
    { x: 430, y: 90, delay: 141 },
  ];
  return <div style={{ position: "absolute", right: 0, bottom: 50, width: 540, height: 310, opacity: 0.48, overflow: "hidden" }}>
    <svg width="540" height="310" viewBox="0 0 540 310" style={{ position: "absolute", inset: 0 }}>
      <path d="M 0 210 L 125 120 L 275 215 L 430 90" fill="none" stroke="#60a5fa" strokeWidth="2" />
      <path d="M 125 120 L 430 90" fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeDasharray="6 8" />
    </svg>
    {dots.map((dot) => <div key={dot.delay} style={{ position: "absolute", left: dot.x - 8, top: dot.y - 8, width: 16, height: 16, borderRadius: "50%", background: "#fff", border: "2px solid #0877e8", boxShadow: "0 0 0 7px rgba(96,165,250,0.12)" }} />)}
    {[0, 1, 2].map((index) => <div key={index} style={{ position: "absolute", left: `${((frame * 1.2 + index * 34) % 100)}%`, top: 175 - index * 20, width: 9, height: 9, borderRadius: "50%", background: index === 1 ? "#8b5cf6" : "#0877e8", boxShadow: "0 0 18px rgba(8,119,232,0.65)" }} />)}
  </div>;
};

const ClosingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const rise = spring({ frame, fps: FPS, config: { damping: 190 } });
  return (
    <Scene duration={CLOSE} background="linear-gradient(135deg, #f8fafc 0%, #e8f2ff 100%)">
      <Narration src="audio/05-close.mp3" />
      <ClosingNetwork />
      <div style={{ position: "absolute", left: 72, top: 142, transform: `translateY(${(1 - rise) * 18}px)` }}>
        <Pill>THERASYNC CO-PILOT</Pill>
        <div style={{ marginTop: 24, color: COLORS.ink, fontSize: 57, fontWeight: 800, letterSpacing: "-0.055em", lineHeight: 1.03 }}>The agent accelerates the workflow.<br />The human keeps the decision.</div>
        <div style={{ marginTop: 22, maxWidth: 840, color: COLORS.muted, fontSize: 17, lineHeight: 1.5 }}>A fictional therapist directory with real browser-to-server safety gates, two-phase slot locking, and explicit approval.</div>
        <div style={{ marginTop: 24, display: "inline-flex", padding: "13px 17px", borderRadius: 12, background: COLORS.ink, color: "#bfdbfe", fontFamily: MONO, fontSize: 14, boxShadow: "0 14px 28px rgba(15,23,42,0.18)" }}>docker compose up -d --build</div>
      </div>
      <div style={{ position: "absolute", top: 145, right: 90, width: 345, padding: 23, borderRadius: 19, background: "#fff", boxShadow: "0 20px 50px rgba(15,23,42,0.12)" }}>
        <div style={{ color: COLORS.blue, fontSize: 12, fontWeight: 850, letterSpacing: "0.12em" }}>TRY IT LOCALLY</div>
        <div style={{ marginTop: 16, color: COLORS.ink, fontFamily: MONO, fontSize: 13, lineHeight: 1.8 }}>http://localhost:3000<br />triage_and_match_therapists<br />commit_intake_booking</div>
        <div style={{ marginTop: 15, paddingTop: 14, borderTop: `1px solid ${COLORS.line}`, color: COLORS.muted, fontSize: 12, lineHeight: 1.5 }}>Test in ChatGPT’s in-app browser or a WebMCP-enabled Chrome build.</div>
      </div>
      <Progress current={5} label="02:45 · close" />
    </Scene>
  );
};

export const TheraSyncThreeMinute: React.FC = () => {
  const scenes: Array<{ duration: number; Component: React.FC }> = [
    { duration: INTRO, Component: IntroScene },
    { duration: CRISIS, Component: CrisisScene },
    { duration: TRIAGE, Component: TriageScene },
    { duration: BOOKING, Component: BookingScene },
    { duration: CLOSE, Component: ClosingScene },
  ];
  let from = 0;
  return <AbsoluteFill style={{ background: "#f8fafc" }}>{scenes.map(({ duration, Component }, index) => { const sequence = <Sequence key={index} from={from} durationInFrames={duration}><Component /></Sequence>; from += duration; return sequence; })}</AbsoluteFill>;
};
