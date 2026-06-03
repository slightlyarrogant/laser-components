import React from "react";
import { Audio, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Stage } from "../components/Stage";
import { Wordmark, Beam, Chrome } from "../components/Brand";
import { theme } from "../theme";

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inMark = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 18 });
  const cta = spring({ frame: frame - 16, fps, config: { damping: 200 }, durationInFrames: 18 });
  const beam = interpolate(frame, [10, 40], [0, 1], { extrapolateRight: "clamp" });

  return (
    <Stage>
      <Audio src={staticFile("audio/09_outro.mp3")} />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
          opacity: inMark,
        }}
      >
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Wordmark size={120} />
        </div>
        <div style={{ marginTop: 26, display: "flex", justifyContent: "center" }}>
          <Beam width={560} progress={beam} />
        </div>
        <div
          style={{
            marginTop: 34,
            fontFamily: theme.serif,
            fontSize: 52,
            color: theme.text,
            opacity: cta,
            transform: `translateY(${interpolate(cta, [0, 1], [22, 0])}px)`,
          }}
        >
          Try it yourself.
        </div>
        <div style={{ marginTop: 16, fontFamily: theme.sans, fontSize: 26, color: theme.muted, opacity: cta }}>
          Find and enrich your leads — in plain English.
        </div>
      </div>
      <Chrome label="Let's connect it to your data →" />
    </Stage>
  );
};
