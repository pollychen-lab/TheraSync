import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const COLORS = {
  ink: "#111827",
  muted: "#64748b",
  blue: "#0877e8",
  blueSoft: "#e8f2ff",
  red: "#d92d20",
  redSoft: "#fff1f0",
  green: "#137a3d",
  greenSoft: "#e9f9ee",
  line: "rgba(148, 163, 184, 0.28)",
};

const FPS = 30;
const DURATIONS = [4, 6, 7, 8, 6, 7, 6, 5].map((seconds) => seconds * FPS);
export const TOTAL_FRAMES = DURATIONS.reduce((sum, duration) => sum + duration, 0);

const pageFont = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif';

const fadeStyle = (frame: number, duration: number): React.CSSProperties => ({
  opacity: interpolate(frame, [0, 18, duration - 18, duration], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  }),
});

const textShadow = "0 2px 20px rgba(15, 23, 42, 0.12)";

const Pill: React.FC<{ children: React.ReactNode; tone?: "blue" | "dark" | "red" | "green" }> = ({
  children,
  tone = "blue",
}) => {
  const palette = {
    blue: { background: COLORS.blueSoft, color: "#0056b3" },
    dark: { background: "rgba(255,255,255,0.12)", color: "#e2e8f0" },
    red: { background: COLORS.redSoft, color: COLORS.red },
    green: { background: COLORS.greenSoft, color: COLORS.green },
  }[tone];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "7px 12px",
        borderRadius: 999,
        background: palette.background,
        color: palette.color,
        fontSize: 15,
        fontWeight: 700,
        letterSpacing: "0.01em",
      }}
    >
      {children}
    </span>
  );
};

const Footer: React.FC<{ index: number; total: number; dark?: boolean }> = ({ index, total, dark = false }) => (
  <div
    style={{
      position: "absolute",
      left: 82,
      right: 82,
      bottom: 34,
      display: "flex",
      alignItems: "center",
      gap: 18,
      color: dark ? "#94a3b8" : COLORS.muted,
      fontFamily: pageFont,
      fontSize: 14,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
    }}
  >
    <div style={{ height: 3, flex: 1, borderRadius: 999, background: dark ? "#334155" : "#dbe4ef" }}>
      <div
        style={{
          height: "100%",
          width: `${(index / total) * 100}%`,
          borderRadius: 999,
          background: dark ? "#60a5fa" : COLORS.blue,
        }}
      />
    </div>
    <span>
      {String(index).padStart(2, "0")} / {String(total).padStart(2, "0")}
    </span>
  </div>
);

const Scene: React.FC<{ duration: number; children: React.ReactNode; background?: string }> = ({
  duration,
  children,
  background = "#f8fafc",
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ ...fadeStyle(frame, duration), background, fontFamily: pageFont }}>
      {children}
    </AbsoluteFill>
  );
};

const ScreenshotCard: React.FC<{ src: string; children?: React.ReactNode; zoom?: number }> = ({
  src,
  children,
  zoom = 1,
}) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 36], [1.01 * zoom, 1 * zoom], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: 90,
        top: 155,
        width: 1420,
        height: 580,
        overflow: "hidden",
        borderRadius: 28,
        background: "#fff",
        boxShadow: "0 26px 70px rgba(15, 23, 42, 0.18), 0 2px 8px rgba(15,23,42,0.08)",
      }}
    >
      <Img
        src={staticFile(src)}
        style={{
          display: "block",
          width: "100%",
          height: "auto",
          transform: `scale(${scale})`,
          transformOrigin: "50% 8%",
        }}
      />
      {children}
    </div>
  );
};

const Label: React.FC<{ eyebrow: string; title: string; description: string; light?: boolean }> = ({
  eyebrow,
  title,
  description,
  light = false,
}) => (
  <div
    style={{
      position: "absolute",
      left: 88,
      top: 42,
      color: light ? "#f8fafc" : COLORS.ink,
      fontFamily: pageFont,
    }}
  >
    <div
      style={{
        marginBottom: 8,
        color: light ? "#93c5fd" : COLORS.blue,
        fontSize: 14,
        fontWeight: 800,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
      }}
    >
      {eyebrow}
    </div>
    <div style={{ fontSize: 34, fontWeight: 750, letterSpacing: "-0.025em", lineHeight: 1.08, textShadow }}>
      {title}
    </div>
    <div
      style={{
        maxWidth: 890,
        marginTop: 9,
        color: light ? "#cbd5e1" : COLORS.muted,
        fontSize: 17,
        lineHeight: 1.4,
      }}
    >
      {description}
    </div>
  </div>
);

const ToolChip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "10px 14px",
      border: `1px solid ${COLORS.line}`,
      borderRadius: 12,
      background: "rgba(255,255,255,0.9)",
      color: COLORS.ink,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: 14,
      boxShadow: "0 8px 22px rgba(15,23,42,0.08)",
    }}
  >
    {children}
  </div>
);

const TitleScene: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const rise = spring({ frame, fps: FPS, config: { damping: 200 } });
  return (
    <Scene duration={duration} background="linear-gradient(135deg, #0b1220 0%, #12233f 55%, #0f3765 100%)">
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            width: 760,
            height: 760,
            right: -160,
            top: -200,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(96,165,250,0.32), rgba(96,165,250,0) 68%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 620,
            height: 620,
            left: -250,
            bottom: -330,
            borderRadius: "50%",
            border: "1px solid rgba(147,197,253,0.18)",
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: 118,
          top: 210,
          transform: `translateY(${(1 - rise) * 22}px)`,
          fontFamily: pageFont,
        }}
      >
        <Pill tone="dark">OPENAI WEBMCP CHALLENGE</Pill>
        <div style={{ marginTop: 30, color: "#f8fafc", fontSize: 84, fontWeight: 780, letterSpacing: "-0.055em" }}>
          TheraSync
        </div>
        <div style={{ marginTop: 4, color: "#93c5fd", fontSize: 35, fontWeight: 600, letterSpacing: "-0.025em" }}>
          human-first care, agent-native access
        </div>
        <div style={{ maxWidth: 670, marginTop: 28, color: "#cbd5e1", fontSize: 21, lineHeight: 1.5 }}>
          A therapist-matching and intake-booking demo where an AI agent accelerates the workflow — and a human keeps the decision.
        </div>
      </div>
      <Footer index={1} total={8} dark />
    </Scene>
  );
};

const HomeScene: React.FC<{ duration: number }> = ({ duration }) => (
  <Scene duration={duration}>
    <Label
      eyebrow="The starting point"
      title="A client can begin in plain language."
      description="The same surface works manually or through a WebMCP-enabled agent."
    />
    <ScreenshotCard src="assets/00-home.png" />
    <div style={{ position: "absolute", left: 110, bottom: 76 }}>
      <ToolChip>triage_and_match_therapists(…)</ToolChip>
    </div>
    <Footer index={2} total={8} />
  </Scene>
);

const MatchScene: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const x = interpolate(frame, [0, 30], [40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <Scene duration={duration} background="#f1f5f9">
      <Label
        eyebrow="Structured matching"
        title="Narrative in. Useful options out."
        description="A single tool call applies the client’s modality and focus preferences against the seeded therapist directory."
      />
      <div style={{ transform: `translateX(${x}px)` }}>
        <ScreenshotCard src="assets/01-matched.png" zoom={1.005} />
      </div>
      <div style={{ position: "absolute", left: 110, bottom: 76, display: "flex", gap: 10 }}>
        <ToolChip>CBT + burnout</ToolChip>
        <div style={{ alignSelf: "center", color: COLORS.blue, fontSize: 22 }}>→</div>
        <ToolChip>Dr. Sarah Chen · Thu 18:00</ToolChip>
      </div>
      <Footer index={3} total={8} />
    </Scene>
  );
};

const ApprovalModal: React.FC = () => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(15, 23, 42, 0.36)",
      backdropFilter: "blur(8px)",
    }}
  >
    <div
      style={{
        width: 650,
        padding: 30,
        borderRadius: 24,
        background: "rgba(255,255,255,0.97)",
        boxShadow: "0 26px 80px rgba(15,23,42,0.35)",
        fontFamily: pageFont,
      }}
    >
      <div style={{ color: COLORS.blue, fontSize: 13, fontWeight: 800, letterSpacing: "0.12em" }}>
        WEBMCP APPROVAL GUARD
      </div>
      <div style={{ marginTop: 9, color: COLORS.ink, fontSize: 25, fontWeight: 750, lineHeight: 1.15 }}>
        Confirm intake booking and informed consent
      </div>
      <div
        style={{
          marginTop: 20,
          padding: 18,
          border: `1px solid ${COLORS.line}`,
          borderRadius: 15,
          color: COLORS.ink,
          fontSize: 15,
          lineHeight: 1.7,
          background: "#fbfbfd",
        }}
      >
        <div><span style={{ color: COLORS.muted }}>Therapist</span> · Dr. Sarah Chen, Ph.D.</div>
        <div><span style={{ color: COLORS.muted }}>Slot to lock</span> · Thursday 18:00</div>
        <div><span style={{ color: COLORS.muted }}>Intake summary</span> · Demo request for CBT therapist matching</div>
      </div>
      <div style={{ marginTop: 17, color: COLORS.muted, fontSize: 13, lineHeight: 1.55 }}>
        The summary stays editable. Nothing is committed until the human explicitly approves.
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 23 }}>
        <div style={{ flex: 1, padding: "14px 12px", border: `1px solid ${COLORS.line}`, borderRadius: 13, textAlign: "center", color: COLORS.ink, fontSize: 15 }}>Decline</div>
        <div style={{ flex: 2, padding: "14px 12px", borderRadius: 13, textAlign: "center", color: "#fff", background: COLORS.blue, fontSize: 15, fontWeight: 700 }}>Approve &amp; sign intake</div>
      </div>
    </div>
  </div>
);

const ApprovalScene: React.FC<{ duration: number }> = ({ duration }) => (
  <Scene duration={duration} background="#eaf0f7">
    <Label
      eyebrow="Human in the loop"
      title="The agent can prepare. It cannot consent."
      description="The slot is temporarily locked while a person reviews the therapist, time, and editable de-identified summary."
    />
    <ScreenshotCard src="assets/01-matched.png">
      <ApprovalModal />
    </ScreenshotCard>
    <div style={{ position: "absolute", left: 110, bottom: 76 }}>
      <ToolChip>lock → wait for approval → commit</ToolChip>
    </div>
    <Footer index={4} total={8} />
  </Scene>
);

const SuccessScene: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const slide = spring({ frame: Math.max(0, frame - 20), fps: FPS, config: { damping: 180 } });
  return (
    <Scene duration={duration} background="#f1f7f3">
      <Label
        eyebrow="Explicit consent"
        title="Only then does the backend commit."
        description="The booking is persisted with the slot, summary, consent flag, and a unique booking identifier."
      />
      <ScreenshotCard src="assets/01-matched.png">
        <div
          style={{
            position: "absolute",
            left: 62,
            right: 62,
            top: 23,
            padding: "18px 24px",
            borderRadius: 15,
            background: COLORS.greenSoft,
            color: COLORS.green,
            fontSize: 16,
            fontWeight: 650,
            boxShadow: "0 8px 24px rgba(19,122,61,0.12)",
            transform: `translateY(${(1 - slide) * -32}px)`,
          }}
        >
          <strong>Booking confirmed.</strong> Dr. Sarah Chen, Ph.D. has been booked for Thursday 18:00. The recurring slot is now locked.
        </div>
      </ScreenshotCard>
      <div style={{ position: "absolute", left: 110, bottom: 76, display: "flex", gap: 10 }}>
        <Pill tone="green">userConsent: true</Pill>
        <Pill tone="green">status: CONFIRMED</Pill>
      </div>
      <Footer index={5} total={8} />
    </Scene>
  );
};

const CrisisModal: React.FC = () => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(15, 23, 42, 0.46)",
      backdropFilter: "blur(9px)",
    }}
  >
    <div
      style={{
        width: 620,
        padding: 30,
        borderRadius: 24,
        background: "rgba(255,255,255,0.97)",
        boxShadow: "0 26px 80px rgba(15,23,42,0.35)",
        fontFamily: pageFont,
      }}
    >
      <div style={{ width: 43, height: 43, display: "grid", placeItems: "center", borderRadius: "50%", background: COLORS.redSoft, color: "#ff3b30", fontSize: 23, fontWeight: 800 }}>!</div>
      <div style={{ marginTop: 17, color: COLORS.ink, fontSize: 25, fontWeight: 750 }}>Support is available right now</div>
      <div style={{ marginTop: 13, color: COLORS.muted, fontSize: 15, lineHeight: 1.6 }}>
        Crisis language stops routine scheduling and surfaces 24/7 support options instead.
      </div>
      <div style={{ marginTop: 17, padding: "16px 18px", borderRadius: 15, background: COLORS.redSoft, color: COLORS.red, fontSize: 15, fontWeight: 700, lineHeight: 1.8 }}>
        <div>988 Suicide &amp; Crisis Lifeline (call or text 988)</div>
        <div>Emergency services: 911</div>
        <div>Crisis Text Line: text HOME to 741741</div>
      </div>
    </div>
  </div>
);

const CrisisScene: React.FC<{ duration: number }> = ({ duration }) => (
  <Scene duration={duration} background="#fff7f6">
    <Label
      eyebrow="Safety circuit breaker"
      title="Crisis signals take a different path."
      description="The same check runs in the browser for immediate UI response and again on the server as the authoritative safety net."
    />
    <ScreenshotCard src="assets/01-matched.png">
      <CrisisModal />
    </ScreenshotCard>
    <div style={{ position: "absolute", left: 110, bottom: 76 }}>
      <Pill tone="red">CRISIS_INTERCEPTED · routine scheduling paused</Pill>
    </div>
    <Footer index={6} total={8} />
  </Scene>
);

const ArchitectureScene: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const reveal = spring({ frame, fps: FPS, config: { damping: 180 } });
  const cards = [
    { label: "BROWSER", title: "WebMCP tools", body: "triage + booking", accent: "#60a5fa" },
    { label: "EXPRESS API", title: "Safety + locks", body: "/api/triage · /api/book/*", accent: "#a78bfa" },
    { label: "POSTGRESQL", title: "Durable state", body: "therapists · bookings", accent: "#34d399" },
  ];
  return (
    <Scene duration={duration} background="linear-gradient(135deg, #0b1220 0%, #16253d 100%)">
      <Label
        eyebrow="Under the surface"
        title="Agent-native on the front. Server-authoritative underneath."
        description="The browser exposes structured tools; the backend owns crisis checks, slot validation, locking, consent, and persistence."
        light
      />
      <div style={{ position: "absolute", top: 305, left: 120, right: 120, display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: pageFont }}>
        {cards.map((card, index) => (
          <React.Fragment key={card.label}>
            <div
              style={{
                width: 360,
                minHeight: 175,
                padding: 25,
                border: `1px solid ${card.accent}55`,
                borderRadius: 22,
                background: "rgba(15, 23, 42, 0.76)",
                boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
                transform: `translateY(${(1 - reveal) * 30}px)`,
                opacity: reveal,
              }}
            >
              <div style={{ color: card.accent, fontSize: 13, fontWeight: 800, letterSpacing: "0.14em" }}>{card.label}</div>
              <div style={{ marginTop: 20, color: "#f8fafc", fontSize: 27, fontWeight: 740 }}>{card.title}</div>
              <div style={{ marginTop: 10, color: "#cbd5e1", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 15 }}>{card.body}</div>
            </div>
            {index < cards.length - 1 && <div style={{ width: 72, height: 2, background: "linear-gradient(90deg, #60a5fa, #a78bfa)", opacity: reveal }} />}
          </React.Fragment>
        ))}
      </div>
      <div style={{ position: "absolute", left: 120, bottom: 96, color: "#93c5fd", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 15 }}>
        human approval is the boundary between reservation and commitment
      </div>
      <Footer index={7} total={8} dark />
    </Scene>
  );
};

const CloseScene: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const rise = spring({ frame, fps: FPS, config: { damping: 190 } });
  return (
    <Scene duration={duration} background="linear-gradient(135deg, #f8fafc 0%, #e8f2ff 100%)">
      <div style={{ position: "absolute", left: 118, top: 196, transform: `translateY(${(1 - rise) * 18}px)`, fontFamily: pageFont }}>
        <Pill>THERASYNC CO-PILOT</Pill>
        <div style={{ marginTop: 30, maxWidth: 1120, color: COLORS.ink, fontSize: 68, fontWeight: 780, letterSpacing: "-0.055em", lineHeight: 1.03 }}>
          The agent accelerates the workflow.
          <br />
          The human keeps the decision.
        </div>
        <div style={{ maxWidth: 850, marginTop: 28, color: COLORS.muted, fontSize: 20, lineHeight: 1.55 }}>
          Fictional therapist directory · illustrative demo data · crisis screening and consent gates enforced in the local stack.
        </div>
        <div style={{ marginTop: 30, padding: "16px 20px", borderRadius: 15, background: "#0f172a", color: "#bfdbfe", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 16, boxShadow: "0 16px 36px rgba(15,23,42,0.18)" }}>
          docker compose up -d --build
        </div>
      </div>
      <Footer index={8} total={8} />
    </Scene>
  );
};

export const TheraSyncDemo: React.FC = () => {
  let from = 0;
  const scenes = [
    TitleScene,
    HomeScene,
    MatchScene,
    ApprovalScene,
    SuccessScene,
    CrisisScene,
    ArchitectureScene,
    CloseScene,
  ];

  return (
    <AbsoluteFill style={{ background: "#f8fafc", fontFamily: pageFont }}>
      {scenes.map((Component, index) => {
        const duration = DURATIONS[index];
        const sequence = (
          <Sequence key={Component.name} from={from} durationInFrames={duration}>
            <Component duration={duration} />
          </Sequence>
        );
        from += duration;
        return sequence;
      })}
    </AbsoluteFill>
  );
};
