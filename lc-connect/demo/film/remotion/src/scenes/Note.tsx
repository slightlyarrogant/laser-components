import React from "react";
import { Audio, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Stage } from "../components/Stage";
import { Beam, Chrome } from "../components/Brand";
import { theme } from "../theme";

// "Good to know" card: the install steps are for an individual plan; on an
// organisation plan IT provisions the connector.
export const Note: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 18 });
  const b = spring({ frame: frame - 18, fps, config: { damping: 200 }, durationInFrames: 18 });
  const beam = interpolate(frame, [8, 38], [0, 1], { extrapolateRight: "clamp" });

  const Card: React.FC<{ tag: string; tagColor: string; head: string; body: string; opacity: number; dx: number }> = ({
    tag, tagColor, head, body, opacity, dx,
  }) => (
    <div
      style={{
        flex: 1,
        background: "rgba(8,19,32,0.6)",
        border: `1px solid ${theme.border}`,
        borderTop: `3px solid ${tagColor}`,
        borderRadius: 16,
        padding: "34px 38px",
        opacity,
        transform: `translateX(${dx}px)`,
      }}
    >
      <div style={{ fontFamily: theme.sans, fontSize: 18, letterSpacing: 3, textTransform: "uppercase", color: tagColor, fontWeight: 700, marginBottom: 14 }}>
        {tag}
      </div>
      <div style={{ fontFamily: theme.serif, fontSize: 38, color: theme.text, marginBottom: 14 }}>{head}</div>
      <div style={{ fontFamily: theme.sans, fontSize: 26, color: theme.muted, lineHeight: 1.4 }}>{body}</div>
    </div>
  );

  return (
    <Stage>
      <Audio src={staticFile("audio/09_note_org.mp3")} />
      <div style={{ position: "absolute", top: 150, left: 120, right: 120, opacity: a }}>
        <div style={{ fontFamily: theme.sans, fontSize: 20, letterSpacing: 4, textTransform: "uppercase", color: theme.accent, fontWeight: 600 }}>
          Good to know
        </div>
        <div style={{ fontFamily: theme.serif, fontSize: 58, color: theme.text, marginTop: 10 }}>
          Individual plan, or organisation?
        </div>
        <div style={{ marginTop: 22 }}>
          <Beam width={520} progress={beam} />
        </div>
      </div>
      <div style={{ position: "absolute", top: 360, left: 120, right: 120, display: "flex", gap: 34 }}>
        <Card
          tag="Individual plan"
          tagColor={theme.accent}
          head="Follow the steps above"
          body="Turn on Developer mode, create the app, paste the URL, sign in — done."
          opacity={a}
          dx={interpolate(a, [0, 1], [-30, 0])}
        />
        <Card
          tag="Organisation plan"
          tagColor="#5b9bf0"
          head="Your IT department sets it up"
          body="The connector is provisioned by the company — just ask IT to enable it for you."
          opacity={b}
          dx={interpolate(b, [0, 1], [30, 0])}
        />
      </div>
      <Chrome label="Individual vs. organisation" />
    </Stage>
  );
};
