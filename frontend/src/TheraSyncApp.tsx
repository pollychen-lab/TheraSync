import React, { useCallback, useEffect, useRef, useState } from "react";
import { Therapist, BookingIntent, WebMCPTool } from "./types";

// Client-side crisis screening. This mirrors the backend's screening so the
// UI can react immediately, but the backend re-checks every request as the
// authoritative safety net (the frontend check can always be bypassed).
const CRISIS_KEYWORDS = [
  "suicide",
  "suicidal",
  "kill myself",
  "want to die",
  "end my life",
  "self-harm",
  "hurt myself",
  "no reason to live",
];

const CRISIS_HOTLINES = [
  "988 Suicide & Crisis Lifeline (call or text 988)",
  "Emergency services: 911",
  "Crisis Text Line: text HOME to 741741",
];

// A small Apple-inspired token set: soft neutrals, a single blue accent,
// generous rounding, and shadow-led depth instead of heavy borders.
const theme = {
  bg: "#f5f5f7",
  surface: "#ffffff",
  surfaceMuted: "#fbfbfd",
  border: "rgba(0, 0, 0, 0.08)",
  textPrimary: "#1d1d1f",
  textSecondary: "#6e6e73",
  accent: "#0071e3",
  // A darker variant for accent-colored *text*: #0071e3 on accentSoft (or
  // white) only reaches ~4.15-4.70:1, below the 4.5:1 WCAG AA minimum for
  // normal text. accentText keeps a clear safety margin (6.2:1 / 7.0:1)
  // wherever accent color is used as a foreground rather than a fill.
  accentText: "#0056b3",
  accentSoft: "#e8f2ff",
  danger: "#ff3b30",
  dangerSoft: "#fff1f0",
  success: "#1e7a3d",
  successSoft: "#e9f9ee",
  shadowSm: "0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.04)",
  shadowMd: "0 2px 6px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.08)",
  shadowLg: "0 24px 60px rgba(0,0,0,0.28)",
  radiusSm: 10,
  radiusMd: 14,
  radiusLg: 20,
  radiusPill: 980,
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/[,.]/g, ""))
    .filter((part) => !["dr"].includes(part.toLowerCase()))
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function TheraSyncApp() {
  const [matchedTherapists, setMatchedTherapists] = useState<Therapist[]>([]);
  const [selectedTherapist, setSelectedTherapist] = useState<Therapist | null>(null);
  const [activeSlot, setActiveSlot] = useState<string>("");

  const [crisisDetected, setCrisisDetected] = useState<boolean>(false);
  const [pendingApproval, setPendingApproval] = useState<BookingIntent | null>(null);
  const [bookedSuccess, setBookedSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [narrative, setNarrative] = useState<string>("");
  const [modalityInput, setModalityInput] = useState<string>("");
  const [focusInput, setFocusInput] = useState<string>("");
  const [isTriaging, setIsTriaging] = useState<boolean>(false);
  const [formCollapsed, setFormCollapsed] = useState<boolean>(false);
  const [isBooking, setIsBooking] = useState<boolean>(false);
  const [approvalSummaryDraft, setApprovalSummaryDraft] = useState<string>("");

  // Resolver for the promise the WebMCP tool handler is awaiting while the
  // human approval modal is open.
  const approvalResolverRef = useRef<((approved: boolean) => void) | null>(null);
  const summaryDraftRef = useRef<string>("");

  const runTriage = useCallback(
    async (args: { rawNarrative: string; focusAreas?: string[]; preferredModality?: string }) => {
      setErrorMessage(null);
      setBookedSuccess(null);

      const normalized = (args.rawNarrative || "").toLowerCase();
      if (CRISIS_KEYWORDS.some((kw) => normalized.includes(kw))) {
        setCrisisDetected(true);
        return {
          status: "CRISIS_INTERCEPTED",
          message:
            "A crisis signal was detected. The safety circuit breaker has been triggered and emergency hotlines are now displayed; normal scheduling has been paused.",
        };
      }

      try {
        const response = await fetch("/api/triage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rawNarrative: args.rawNarrative,
            preferredModality: args.preferredModality,
            focusAreas: args.focusAreas,
          }),
        });
        const data = await response.json();

        if (data.status === "CRISIS_INTERCEPTED") {
          setCrisisDetected(true);
          return { status: "CRISIS_INTERCEPTED", hotlines: data.crisisHotlines };
        }

        if (data.status !== "SUCCESS") {
          const message = data.message || "Triage request failed.";
          setErrorMessage(message);
          return { status: "ERROR", message };
        }

        const matches: Therapist[] = data.matches || [];
        setMatchedTherapists(matches);
        if (matches.length > 0) {
          setSelectedTherapist(matches[0]);
          setActiveSlot(matches[0].slots[0]);
        }

        return {
          status: "SUCCESS",
          matched_count: matches.length,
          therapists: matches.map((t) => ({ id: t.id, name: t.name, slots: t.slots })),
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setErrorMessage(`Triage request failed: ${message}`);
        return { status: "ERROR", message };
      }
    },
    []
  );

  const startBooking = useCallback(
    async (args: { therapistId: string; selectedSlot: string; intakeSummary?: string }) => {
      setErrorMessage(null);
      setBookedSuccess(null);

      const therapist =
        matchedTherapists.find((t) => t.id === args.therapistId) ||
        (selectedTherapist?.id === args.therapistId ? selectedTherapist : null);

      if (!therapist) {
        return { status: "ERROR", error_code: "THERAPIST_NOT_FOUND" };
      }

      // Hold the slot before showing the approval modal so it can't be
      // taken by another request while the human is deciding.
      const lockResponse = await fetch("/api/book/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ therapistId: therapist.id, slot: args.selectedSlot }),
      });

      if (!lockResponse.ok) {
        let lockError: { error?: string; message?: string } = {};
        try {
          lockError = await lockResponse.json();
        } catch {
          // Response body wasn't JSON; fall back to the generic message below.
        }
        const message = lockError.message || "Unable to reserve this slot.";
        setErrorMessage(message);
        return { status: lockError.error || "ERROR", message };
      }

      const { lockToken } = await lockResponse.json();
      const intakeSummary = args.intakeSummary || "Intake summary generated by the agent";

      return new Promise<{ status: string; booking_id?: string; message?: string }>((resolve) => {
        setPendingApproval({
          therapistId: therapist.id,
          therapistName: therapist.name,
          slot: args.selectedSlot,
          intakeSummary,
        });
        summaryDraftRef.current = intakeSummary;
        setApprovalSummaryDraft(intakeSummary);

        approvalResolverRef.current = async (approved: boolean) => {
          setPendingApproval(null);

          if (!approved) {
            try {
              await fetch("/api/book/release", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ therapistId: therapist.id, slot: args.selectedSlot, lockToken }),
              });
            } catch {
              // Best-effort: the lock still expires on its own via its TTL.
            }
            resolve({ status: "REJECTED_BY_USER", message: "The user declined to approve this booking." });
            return;
          }

          try {
            const commitResponse = await fetch("/api/book/commit", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                therapistId: therapist.id,
                slot: args.selectedSlot,
                intakeSummary: summaryDraftRef.current,
                userConsent: true,
                lockToken,
              }),
            });
            const data = await commitResponse.json();

            if (data.status !== "SUCCESS") {
              setErrorMessage(data.message || "Booking could not be confirmed.");
              resolve({ status: "ERROR", message: data.message });
              return;
            }

            setBookedSuccess(
              `${therapist.name} has been booked for ${args.selectedSlot}. The recurring slot is now locked.`
            );
            resolve({ status: "SUCCESS", booking_id: data.booking.bookingId });
          } catch (err) {
            const message = err instanceof Error ? err.message : "Unknown error";
            setErrorMessage(`Booking request failed: ${message}`);
            resolve({ status: "ERROR", message });
          }
        };
      });
    },
    [matchedTherapists, selectedTherapist]
  );

  const handleFindTherapists = useCallback(async () => {
    if (!narrative.trim() || isTriaging) return;

    setIsTriaging(true);
    const focusAreas = focusInput
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    try {
      const result = await runTriage({
        rawNarrative: narrative,
        focusAreas: focusAreas.length > 0 ? focusAreas : undefined,
        preferredModality: modalityInput.trim() || undefined,
      });
      if (result.status === "SUCCESS") {
        setFormCollapsed(true);
      }
    } finally {
      setIsTriaging(false);
    }
  }, [focusInput, isTriaging, modalityInput, narrative, runTriage]);

  const handleBookSlot = useCallback(async () => {
    if (!selectedTherapist || !activeSlot || isBooking) return;

    setIsBooking(true);
    try {
      await startBooking({
        therapistId: selectedTherapist.id,
        selectedSlot: activeSlot,
        intakeSummary: narrative.trim() || undefined,
      });
    } finally {
      setIsBooking(false);
    }
  }, [activeSlot, isBooking, narrative, selectedTherapist, startBooking]);

  useEffect(() => {
    const registerWebMCPTools = () => {
      const tools: WebMCPTool[] = [
        {
          name: "triage_and_match_therapists",
          description:
            "Assess a client's stated concerns, run crisis safety screening, and retrieve matching therapists.",
          input_schema: {
            type: "object",
            properties: {
              raw_narrative: { type: "string", description: "The client's own description of what they're struggling with" },
              focus_areas: {
                type: "array",
                items: { type: "string" },
                description: "Concern tags, e.g. ['anxiety', 'burnout']",
              },
              preferred_modality: { type: "string", description: "Preferred therapy modality, e.g. CBT" },
            },
            required: ["raw_narrative"],
          },
          handler: async (args: { raw_narrative: string; focus_areas?: string[]; preferred_modality?: string }) => {
            return runTriage({
              rawNarrative: args.raw_narrative,
              focusAreas: args.focus_areas,
              preferredModality: args.preferred_modality,
            });
          },
        },
        {
          name: "commit_intake_booking",
          description:
            "Lock a recurring intake slot and record informed consent. This action has legal and financial consequences and must be explicitly confirmed by a human.",
          input_schema: {
            type: "object",
            properties: {
              therapist_id: { type: "string" },
              selected_slot: { type: "string" },
              intake_summary: { type: "string", description: "De-identified summary of the intake concern" },
            },
            required: ["therapist_id", "selected_slot"],
          },
          handler: async (args: { therapist_id: string; selected_slot: string; intake_summary?: string }) => {
            return startBooking({
              therapistId: args.therapist_id,
              selectedSlot: args.selected_slot,
              intakeSummary: args.intake_summary,
            });
          },
        },
      ];

      if (typeof window !== "undefined") {
        // Fallback registry: consumed by this demo's own UI and by any host
        // that reads this conventional global directly.
        (window as any).__WEBMCP_TOOLS__ = tools;

        // Progressive enhancement: the WebMCP browser API is still an
        // evolving proposal, and different hosts/origin trials have exposed
        // it under different shapes (a batch `registerTools`, the documented
        // `provideContext({ tools })`, or a per-tool `registerTool`). Every
        // one of these expects the browser API descriptor shape
        // (`inputSchema` + `execute`), not this app's internal tool shape
        // (`input_schema` + `handler`), so normalize once and reuse the
        // result for whichever entry point the host actually implements.
        const modelContext = (window.navigator as any).modelContext;
        if (modelContext) {
          const registeredTools = tools.map(({ name, description, input_schema, handler }) => ({
            name,
            description,
            inputSchema: input_schema,
            execute: handler,
          }));

          if (typeof modelContext.registerTools === "function") {
            modelContext.registerTools(registeredTools);
          } else if (typeof modelContext.provideContext === "function") {
            modelContext.provideContext({ tools: registeredTools });
          } else if (typeof modelContext.registerTool === "function") {
            registeredTools.forEach((tool) => modelContext.registerTool(tool));
          }
        }

        console.log(
          "[WebMCP] Tools registered:",
          tools.map((t) => t.name)
        );
      }
    };

    registerWebMCPTools();
    // Re-register whenever the matched therapist list changes, so the
    // booking tool handler always sees the latest matches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runTriage, startBooking]);

  return (
    <div
      className="thera-app-shell"
      style={{
        color: theme.textPrimary,
        fontFamily: theme.fontFamily,
      }}
    >
      <header className="thera-hero">
        <h1 className="thera-hero-title">
          TheraSync Co-Pilot
          <span className="thera-status-pill">WebMCP Connected</span>
        </h1>
        <p className="thera-hero-subtitle">
          A clinical-triage-aware intake scheduling hub built on the WebMCP contract
        </p>
      </header>

      {bookedSuccess && (
        <div
          className="thera-banner"
          style={{
            backgroundColor: theme.successSoft,
            color: theme.success,
          }}
        >
          <strong>Booking confirmed.</strong> {bookedSuccess}
        </div>
      )}

      {errorMessage && (
        <div
          className="thera-banner"
          style={{
            backgroundColor: theme.dangerSoft,
            color: "#c0271d",
          }}
        >
          <strong>Something went wrong.</strong> {errorMessage}
        </div>
      )}

      <section className="thera-intake-panel">
        {formCollapsed && matchedTherapists.length > 0 ? (
          <div className="thera-intake-summary-row">
            <div className="thera-intake-summary-copy">
              Showing matches for <strong>{narrative}</strong>
            </div>
            <button
              className="thera-secondary-button"
              type="button"
              onClick={() => setFormCollapsed(false)}
            >
              Edit Search
            </button>
          </div>
        ) : (
          <div className="thera-intake-form">
            <label className="thera-field-label" htmlFor="intake-narrative">
              What are you looking for help with?
            </label>
            <textarea
              id="intake-narrative"
              className="thera-textarea"
              value={narrative}
              onChange={(event) => setNarrative(event.target.value)}
              rows={3}
              placeholder="Describe what you have been struggling with..."
            />

            <div className="thera-form-grid">
              <input
                className="thera-input"
                value={modalityInput}
                onChange={(event) => setModalityInput(event.target.value)}
                placeholder="Preferred modality, e.g. CBT"
              />
              <input
                className="thera-input"
                value={focusInput}
                onChange={(event) => setFocusInput(event.target.value)}
                placeholder="Focus areas, comma-separated"
              />
            </div>

            <button
              className="thera-primary-button"
              type="button"
              onClick={handleFindTherapists}
              disabled={!narrative.trim() || isTriaging}
            >
              {isTriaging ? "Finding..." : "Find Therapists"}
            </button>
          </div>
        )}
      </section>

      <div className="thera-content-grid">
        <section>
          <h2 className="thera-section-title">
            Matched Therapists ({matchedTherapists.length})
          </h2>
          {matchedTherapists.length === 0 ? (
            <div className="thera-empty-panel">
              <div>
                <div className="thera-empty-mark">TS</div>
                Describe your needs above, or let the agent run triage, to see matched therapists.
              </div>
            </div>
          ) : (
            matchedTherapists.map((t) => {
              const isSelected = selectedTherapist?.id === t.id;
              return (
                <button
                  className="thera-therapist-card"
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setSelectedTherapist(t);
                    setActiveSlot(t.slots[0]);
                  }}
                  style={{
                    border: isSelected ? `1.5px solid ${theme.accent}` : `1px solid ${theme.border}`,
                    backgroundColor: isSelected ? theme.accentSoft : theme.surface,
                    boxShadow: isSelected ? theme.shadowMd : theme.shadowSm,
                  }}
                >
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: "50%",
                      backgroundColor: theme.accent,
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 600,
                      fontSize: 17,
                      flexShrink: 0,
                    }}
                  >
                    {initials(t.name)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 16, color: theme.textPrimary }}>{t.name}</div>
                    <div style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 8 }}>{t.title}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {t.modalities.map((m) => (
                        <span
                          key={m}
                          style={{
                            fontSize: 11,
                            fontWeight: 500,
                            backgroundColor: "rgba(0,0,0,0.05)",
                            color: theme.textSecondary,
                            padding: "3px 9px",
                            borderRadius: theme.radiusPill,
                          }}
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </section>

        <section>
          <h2 className="thera-section-title">
            Recurring Schedule
          </h2>
          {selectedTherapist ? (
            <div className="thera-schedule-panel">
              <p style={{ fontSize: 14, color: theme.textSecondary, marginTop: 0, marginBottom: 16 }}>
                Selected therapist: <strong style={{ color: theme.textPrimary }}>{selectedTherapist.name}</strong>
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {selectedTherapist.slots.map((slot) => {
                  const isActive = activeSlot === slot;
                  return (
                    <button
                      className="thera-slot-button"
                      key={slot}
                      onClick={() => setActiveSlot(slot)}
                      style={{
                        padding: "14px 16px",
                        textAlign: "left",
                        borderRadius: theme.radiusMd,
                        border: isActive ? `1.5px solid ${theme.accent}` : `1px solid ${theme.border}`,
                        backgroundColor: isActive ? theme.accentSoft : theme.surface,
                        color: isActive ? theme.accentText : theme.textPrimary,
                        cursor: "pointer",
                        fontSize: 14,
                        fontWeight: isActive ? 600 : 400,
                      }}
                    >
                      {slot} · recurring, locked for 8 weeks
                    </button>
                  );
                })}
              </div>
              <button
                className="thera-primary-button"
                type="button"
                onClick={handleBookSlot}
                disabled={!activeSlot || isBooking}
                style={{ width: "100%", marginTop: 16 }}
              >
                {isBooking ? "Reserving..." : "Book This Slot"}
              </button>
            </div>
          ) : (
            <div className="thera-empty-panel">
              <div>
                <div className="thera-empty-mark">8w</div>
                Select a therapist to view their recurring schedule
              </div>
            </div>
          )}
        </section>
      </div>

      {crisisDetected && (
        <div className="thera-modal-overlay">
          <div
            className="thera-modal-card"
            style={{
              maxWidth: 480,
              fontFamily: theme.fontFamily,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                backgroundColor: theme.dangerSoft,
                color: theme.danger,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                fontWeight: 700,
                marginBottom: 16,
              }}
            >
              !
            </div>
            <h3 style={{ color: theme.textPrimary, marginTop: 0, marginBottom: 8, fontSize: 19, fontWeight: 600 }}>
              Support is available right now
            </h3>
            <p style={{ color: theme.textSecondary, fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
              Your message contains language associated with severe distress or crisis. Routine scheduling cannot
              provide immediate crisis intervention, so please reach out to a 24/7 support line right away:
            </p>
            <div
              style={{
                backgroundColor: theme.dangerSoft,
                padding: 16,
                borderRadius: theme.radiusMd,
                marginBottom: 24,
                fontSize: 14,
                fontWeight: 600,
                color: "#c0271d",
                lineHeight: 1.8,
              }}
            >
              {CRISIS_HOTLINES.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
            <button
              className="thera-modal-button"
              onClick={() => setCrisisDetected(false)}
              style={{
                width: "100%",
                padding: "13px 0",
                backgroundColor: theme.textPrimary,
                color: "#fff",
                border: "none",
                cursor: "pointer",
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              Acknowledge and return to safe mode
            </button>
          </div>
        </div>
      )}

      {pendingApproval && (
        <div className="thera-modal-overlay">
          <div
            className="thera-modal-card"
            style={{
              maxWidth: 460,
              fontFamily: theme.fontFamily,
            }}
          >
            <div
              style={{
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: theme.accentText,
                fontWeight: 700,
                marginBottom: 6,
              }}
            >
              WebMCP Approval Guard
            </div>
            <h3 style={{ marginTop: 0, marginBottom: 18, fontSize: 19, fontWeight: 600, color: theme.textPrimary }}>
              Confirm intake booking and informed consent
            </h3>

            <div
              style={{
                backgroundColor: theme.surfaceMuted,
                padding: 16,
                borderRadius: theme.radiusMd,
                fontSize: 13,
                marginBottom: 18,
                border: `1px solid ${theme.border}`,
                lineHeight: 1.7,
                color: theme.textPrimary,
              }}
            >
              <div>
                <span style={{ color: theme.textSecondary }}>Therapist</span> · {pendingApproval.therapistName}
              </div>
              <div>
                <span style={{ color: theme.textSecondary }}>Slot to lock</span> · {pendingApproval.slot}
              </div>
              <div style={{ marginTop: 6 }}>
                <label className="thera-inline-label" htmlFor="approval-summary">
                  Intake summary
                </label>
                <textarea
                  id="approval-summary"
                  className="thera-textarea thera-summary-textarea"
                  value={approvalSummaryDraft}
                  onChange={(event) => {
                    setApprovalSummaryDraft(event.target.value);
                    summaryDraftRef.current = event.target.value;
                  }}
                  rows={3}
                />
              </div>
            </div>

            <p style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 1.6, marginBottom: 24 }}>
              Clicking "Approve & sign" confirms you have read the informed consent agreement and authorize the
              system to lock this recurring slot.
            </p>

            <div className="thera-modal-actions">
              <button
                className="thera-modal-button"
                onClick={() => approvalResolverRef.current?.(false)}
                style={{
                  flex: 1,
                  padding: "13px 0",
                  backgroundColor: theme.surfaceMuted,
                  color: theme.textPrimary,
                  border: `1px solid ${theme.border}`,
                  cursor: "pointer",
                  fontSize: 15,
                  fontWeight: 500,
                }}
              >
                Decline
              </button>
              <button
                className="thera-modal-button"
                onClick={() => approvalResolverRef.current?.(true)}
                style={{
                  flex: 2,
                  padding: "13px 0",
                  backgroundColor: theme.accent,
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: 15,
                }}
              >
                Approve & sign intake
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
