import React from "react";
import { AbsoluteFill, Series } from "remotion";
import { Title } from "./scenes/Title";
import { Demo } from "./scenes/Demo";
import { Install } from "./scenes/Install";
import { Note } from "./scenes/Note";
import { Outro } from "./scenes/Outro";
import { theme } from "./theme";

export const SCENES = {
  title: 220, // 7.3s  (VO 7.1s)
  demo: 741, // 24.7s (journey)
  install: 750, // 25.0s (install.mp4)
  note: 354, // 11.8s (VO 11.3s)
  outro: 175, // 5.8s  (VO 5.5s)
};
export const TOTAL = Object.values(SCENES).reduce((a, b) => a + b, 0);

export const Film: React.FC = () => (
  <AbsoluteFill style={{ background: theme.bgDeep }}>
    <Series>
      <Series.Sequence durationInFrames={SCENES.title}>
        <Title />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.demo}>
        <Demo />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.install}>
        <Install />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.note}>
        <Note />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.outro}>
        <Outro />
      </Series.Sequence>
    </Series>
  </AbsoluteFill>
);
