import React from "react";
import { Audio, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Stage } from "../components/Stage";
import { Wordmark, Beam, Chrome } from "../components/Brand";
import { theme } from "../theme";

export const Title: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const inMark = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 20 });
  const beam = interpolate(frame, [12, 45], [0, 1], { extrapolateRight: "clamp" });
  const subUp = spring({ frame: frame - 14, fps, config: { damping: 200 }, durationInFrames: 18 });

  return (
    <Stage>
      <Audio src={staticFile("audio/01_title.mp3")} />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 120,
          transform: "translateY(-50%)",
          opacity: inMark,
        }}
      >
        <div style={{ transform: `translateY(${interpolate(inMark, [0, 1], [30, 0])}px)` }}>
          <Wordmark size={130} />
        </div>
        <div style={{ marginTop: 30 }}>
          <Beam width={Math.min(720, width - 240)} progress={beam} />
        </div>
        <div
          style={{
            marginTop: 34,
            maxWidth: 980,
            fontFamily: theme.serif,
            fontSize: 46,
            lineHeight: 1.25,
            color: theme.text,
            opacity: subUp,
            transform: `translateY(${interpolate(subUp, [0, 1], [24, 0])}px)`,
          }}
        >
          Your laser-components lead database,
          <br />
          <span style={{ color: theme.muted }}>answered in plain English — inside ChatGPT.</span>
        </div>
      </div>
      <Chrome label="Lead discovery & enrichment" />
    </Stage>
  );
};
