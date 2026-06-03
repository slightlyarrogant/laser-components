import React from "react";
import { AbsoluteFill } from "remotion";
import { theme } from "../theme";

// Shared dark-navy stage with a subtle radial glow + faint laser beams.
export const Stage: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(1200px 700px at 70% 18%, ${theme.surface} 0%, ${theme.bg} 45%, ${theme.bgDeep} 100%)`,
      fontFamily: theme.sans,
    }}
  >
    <div
      style={{
        position: "absolute",
        top: -120,
        left: -200,
        width: 1400,
        height: 3,
        transform: "rotate(8deg)",
        background: `linear-gradient(90deg, transparent, ${theme.accent}33 40%, transparent)`,
      }}
    />
    <div
      style={{
        position: "absolute",
        bottom: 60,
        right: -160,
        width: 1100,
        height: 3,
        transform: "rotate(8deg)",
        background: `linear-gradient(90deg, transparent, ${theme.accent}22 50%, transparent)`,
      }}
    />
    {children}
  </AbsoluteFill>
);
