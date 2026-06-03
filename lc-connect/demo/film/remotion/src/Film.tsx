import React from "react";
import { AbsoluteFill, Series } from "remotion";
import { Title } from "./scenes/Title";
import { Demo } from "./scenes/Demo";
import { Install } from "./scenes/Install";
import { Outro } from "./scenes/Outro";
import { theme } from "./theme";

export const SCENES = {
  title: 210, // 7.0s
  demo: 745, // 24.8s (journey 24.7s)
  install: 450, // 15.0s
  outro: 165, // 5.5s
};
export const TOTAL = Object.values(SCENES).reduce((a, b) => a + b, 0); // 1570

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
      <Series.Sequence durationInFrames={SCENES.outro}>
        <Outro />
      </Series.Sequence>
    </Series>
  </AbsoluteFill>
);
