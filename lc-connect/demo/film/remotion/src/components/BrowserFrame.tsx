import React from "react";
import { OffthreadVideo, staticFile } from "remotion";
import { theme } from "../theme";

// Frames a screen recording inside a rounded browser window, centered on the
// navy stage. Recordings are 1440x900; we scale to fit the 1920x1080 canvas.
export const BrowserFrame: React.FC<{ src: string; label: string; width?: number }> = ({
  src,
  label,
  width = 1520,
}) => {
  const vidH = (width * 900) / 1440;
  const bar = 46;
  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -52%)",
        width,
        borderRadius: 16,
        overflow: "hidden",
        background: theme.surface,
        border: `1px solid ${theme.border}`,
        boxShadow: "0 40px 90px rgba(0,0,0,0.55)",
      }}
    >
      <div
        style={{
          height: bar,
          background: "#0f2138",
          display: "flex",
          alignItems: "center",
          padding: "0 18px",
          gap: 9,
          borderBottom: `1px solid ${theme.border}`,
        }}
      >
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <span key={c} style={{ width: 13, height: 13, borderRadius: 13, background: c, display: "inline-block" }} />
        ))}
        <span
          style={{
            marginLeft: 14,
            fontFamily: theme.sans,
            fontSize: 17,
            color: theme.muted,
            background: "#0a1726",
            borderRadius: 8,
            padding: "5px 16px",
            border: `1px solid ${theme.border}`,
          }}
        >
          {label}
        </span>
      </div>
      <OffthreadVideo src={staticFile(src)} style={{ width, height: vidH, display: "block" }} />
    </div>
  );
};
