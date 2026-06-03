import React from "react";
import { theme } from "../theme";

export const Wordmark: React.FC<{ size?: number }> = ({ size = 64 }) => (
  <div
    style={{
      fontFamily: theme.serif,
      fontWeight: 700,
      fontSize: size,
      letterSpacing: -1,
      color: theme.text,
      display: "flex",
      alignItems: "baseline",
      gap: size * 0.18,
    }}
  >
    <span style={{ color: theme.accent }}>LC</span>
    <span>Connect</span>
  </div>
);

// A thin amber "laser beam" rule, echoing the deck's beams.
export const Beam: React.FC<{ width: number; delay?: number; progress?: number }> = ({
  width,
  progress = 1,
}) => (
  <div style={{ position: "relative", height: 3, width }}>
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        height: 3,
        width: width * progress,
        background: `linear-gradient(90deg, transparent, ${theme.accent} 30%, ${theme.accentSoft})`,
        boxShadow: `0 0 18px ${theme.accent}`,
        borderRadius: 3,
      }}
    />
  </div>
);

// Footer chrome like the deck slides (brand left, label right).
export const Chrome: React.FC<{ label: string }> = ({ label }) => (
  <div
    style={{
      position: "absolute",
      bottom: 40,
      left: 64,
      right: 64,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      fontFamily: theme.sans,
      fontSize: 20,
      letterSpacing: 2,
      textTransform: "uppercase",
      color: theme.muted,
    }}
  >
    <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ width: 9, height: 9, borderRadius: 9, background: theme.accent, display: "inline-block" }} />
      LC Connect
    </span>
    <span style={{ opacity: 0.7 }}>{label}</span>
  </div>
);
