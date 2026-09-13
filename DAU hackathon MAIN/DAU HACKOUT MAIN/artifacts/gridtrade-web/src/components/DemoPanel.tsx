import React, { useState, useCallback } from "react";

const DEMO_ROLES = [
  { key: "demo:prosumer", label: "☀️ Prosumer", color: "#f59e0b", token: "demo:prosumer" },
  { key: "demo:consumer", label: "🔌 Consumer", color: "#3b82f6", token: "demo:consumer" },
  { key: "demo:utility", label: "⚡ Utility", color: "#10b981", token: "demo:utility" },
  { key: "demo:regulator", label: "🏛 Regulator", color: "#8b5cf6", token: "demo:regulator" },
  { key: "demo:admin", label: "🛡 Admin", color: "#ef4444", token: "demo:admin" },
] as const;

const DEMO_SCENARIOS = [
  { key: "SUNNY_SURPLUS", label: "☀️ Sunny Surplus", color: "#f59e0b" },
  { key: "HIGH_DEMAND", label: "⚡ High Demand", color: "#f97316" },
  { key: "MODERATE_CONGESTION", label: "🔶 Moderate Congestion", color: "#eab308" },
  { key: "SEVERE_CONGESTION", label: "🚨 Severe Congestion", color: "#ef4444" },
  { key: "BALANCED", label: "✅ Balanced", color: "#10b981" },
] as const;

const DEMO_STEPS = [
  "Prosumer produces solar surplus",
  "Surplus appears in marketplace",
  "Consumer creates demand",
  "AI recommends seller",
  "Price dynamically calculated",
  "Grid status is healthy",
  "Trade is approved",
  "Trade executes",
  "Settlement appears",
  "SHA-256 ledger record created",
  "Ledger verification succeeds",
  "Grid simulation → congestion",
  "Trade becomes ADJUSTED/RESTRICTED",
  "Utility control room updates live",
  "Admin receives alert",
  "AI assistant explains event",
  "Ledger remains verifiable",
];

interface DemoPanelProps {
  activeToken: string;
  onTokenChange: (token: string) => void;
}

export function DemoPanel({ activeToken, onTokenChange }: DemoPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [scenarioStatus, setScenarioStatus] = useState<string | null>(null);
  const [resetStatus, setResetStatus] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const triggerScenario = useCallback(async (scenario: string) => {
    setScenarioStatus(`Triggering ${scenario}...`);
    try {
      const res = await fetch("/api/v1/operations/simulation/trigger", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeToken}`,
        },
        body: JSON.stringify({ scenario, region: "KA_BLR_01" }),
      });
      if (res.ok) {
        setScenarioStatus(`✅ ${scenario} active`);
      } else {
        const err = await res.json();
        setScenarioStatus(`⚠️ ${err.error || res.statusText}`);
      }
    } catch {
      setScenarioStatus("❌ Network error");
    }
    setTimeout(() => setScenarioStatus(null), 4000);
  }, [activeToken]);

  const handleReset = useCallback(async () => {
    if (!window.confirm("Reset all demo data? This will re-seed the database.")) return;
    setResetting(true);
    setResetStatus("Resetting...");
    try {
      const res = await fetch("/api/v1/demo/reset", {
        method: "POST",
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      if (res.ok) {
        setResetStatus("✅ Demo data reset complete");
        setActiveStep(0);
      } else {
        setResetStatus("❌ Reset failed");
      }
    } catch {
      setResetStatus("❌ Network error");
    }
    setResetting(false);
    setTimeout(() => setResetStatus(null), 4000);
  }, [activeToken]);

  return (
    <div
      style={{
        position: "fixed",
        bottom: "1.25rem",
        right: "1.25rem",
        zIndex: 9999,
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        fontSize: "12px",
      }}
    >
      {/* DEMO badge toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        style={{
          background: "#f59e0b",
          color: "#000",
          border: "none",
          borderRadius: "6px 6px 0 0",
          padding: "4px 12px",
          cursor: "pointer",
          fontWeight: 700,
          letterSpacing: "0.08em",
          fontSize: "11px",
          display: "block",
          marginLeft: "auto",
        }}
      >
        🎬 DEMO MODE {collapsed ? "▲" : "▼"}
      </button>

      {!collapsed && (
        <div
          style={{
            background: "#0f172a",
            border: "1px solid #f59e0b",
            borderRadius: "8px 0 8px 8px",
            padding: "12px",
            width: "280px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          }}
        >
          {/* Role Switcher */}
          <div style={{ marginBottom: "10px" }}>
            <div style={{ color: "#94a3b8", marginBottom: "6px", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Active Role
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {DEMO_ROLES.map((role) => (
                <button
                  key={role.key}
                  onClick={() => onTokenChange(role.token)}
                  style={{
                    padding: "3px 8px",
                    borderRadius: "4px",
                    border: `1px solid ${activeToken === role.token ? role.color : "#334155"}`,
                    background: activeToken === role.token ? `${role.color}22` : "transparent",
                    color: activeToken === role.token ? role.color : "#64748b",
                    cursor: "pointer",
                    fontSize: "11px",
                    fontWeight: activeToken === role.token ? 700 : 400,
                    transition: "all 0.15s",
                  }}
                >
                  {role.label}
                </button>
              ))}
            </div>
          </div>

          {/* Scenario Selector */}
          <div style={{ marginBottom: "10px" }}>
            <div style={{ color: "#94a3b8", marginBottom: "6px", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Grid Scenario
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              {DEMO_SCENARIOS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => triggerScenario(s.key)}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "4px",
                    border: "1px solid #1e293b",
                    background: "#1e293b",
                    color: s.color,
                    cursor: "pointer",
                    fontSize: "11px",
                    textAlign: "left",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#334155")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#1e293b")}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {scenarioStatus && (
              <div style={{ color: "#94a3b8", marginTop: "4px", fontSize: "10px" }}>{scenarioStatus}</div>
            )}
          </div>

          {/* Demo Flow Steps */}
          <div style={{ marginBottom: "10px" }}>
            <div style={{ color: "#94a3b8", marginBottom: "6px", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Demo Flow ({activeStep + 1}/{DEMO_STEPS.length})
            </div>
            <div style={{ background: "#1e293b", borderRadius: "4px", padding: "6px 8px", color: "#e2e8f0", fontSize: "11px" }}>
              <strong style={{ color: "#f59e0b" }}>Step {activeStep + 1}:</strong> {DEMO_STEPS[activeStep]}
            </div>
            <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
              <button
                onClick={() => setActiveStep((s) => Math.max(0, s - 1))}
                disabled={activeStep === 0}
                style={{ flex: 1, padding: "3px", background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", cursor: "pointer", borderRadius: "4px", fontSize: "11px" }}
              >
                ← Prev
              </button>
              <button
                onClick={() => setActiveStep((s) => Math.min(DEMO_STEPS.length - 1, s + 1))}
                disabled={activeStep === DEMO_STEPS.length - 1}
                style={{ flex: 1, padding: "3px", background: "#f59e0b", border: "none", color: "#000", cursor: "pointer", borderRadius: "4px", fontSize: "11px", fontWeight: 700 }}
              >
                Next →
              </button>
            </div>
          </div>

          {/* Reset */}
          <div>
            <button
              onClick={handleReset}
              disabled={resetting}
              style={{
                width: "100%",
                padding: "5px",
                background: "transparent",
                border: "1px solid #ef4444",
                color: "#ef4444",
                borderRadius: "4px",
                cursor: resetting ? "not-allowed" : "pointer",
                fontSize: "11px",
                opacity: resetting ? 0.5 : 1,
              }}
            >
              {resetting ? "Resetting..." : "🔄 Reset Demo Data"}
            </button>
            {resetStatus && (
              <div style={{ color: "#94a3b8", marginTop: "4px", fontSize: "10px", textAlign: "center" }}>{resetStatus}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
