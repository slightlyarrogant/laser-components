import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";

// Lower-third caption: amber kicker + white headline, springs up from the bottom.
export const Caption: React.FC<{ kicker?: string; text: string }> = ({ kicker, text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 14 });
  const y = interpolate(enter, [0, 1], [40, 0]);
  return (
    <div
      style={{
        position: "absolute",
        left: 80,
        bottom: 70,
        transform: `translateY(${y}px)`,
        opacity: enter,
        maxWidth: 1100,
      }}
    >
      <div
        style={{
          display: "inline-block",
          background: "rgba(8,19,32,0.82)",
          backdropFilter: "blur(6px)",
          border: `1px solid ${theme.border}`,
          borderLeft: `4px solid ${theme.accent}`,
          borderRadius: 14,
          padding: "18px 26px",
        }}
      >
        {kicker ? (
          <div
            style={{
              fontFamily: theme.sans,
              fontSize: 18,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: theme.accent,
              marginBottom: 6,
              fontWeight: 600,
            }}
          >
            {kicker}
          </div>
        ) : null}
        <div style={{ fontFamily: theme.sans, fontSize: 34, color: theme.text, fontWeight: 600, lineHeight: 1.2 }}>
          {text}
        </div>
      </div>
    </div>
  );
};
