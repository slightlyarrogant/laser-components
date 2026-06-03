import React from "react";
import { Audio, Sequence, staticFile } from "remotion";
import { Stage } from "../components/Stage";
import { BrowserFrame } from "../components/BrowserFrame";
import { Caption } from "../components/Caption";
import { Chrome } from "../components/Brand";

// Voice + caption cues synced to lc-connect-journey.mp4 (24.7s @30fps ≈ 741f).
const CUES = [
  { from: 10, dur: 188, audio: "audio/02_demo_bar.mp3", kicker: "Just ask", text: "Your leads, broken down by industry — as a live chart." },
  { from: 270, dur: 265, audio: "audio/03_demo_list.mp3", kicker: "Drill in", text: "A sector like Defense Electronics returns the actual companies." },
  { from: 540, dur: 118, audio: "audio/04_demo_co.mp3", kicker: "Go deeper", text: "Ask about one company — get everything on file." },
  { from: 656, dur: 90, audio: "audio/05_demo_map.mp3", kicker: "See it", text: "Exactly where your leads are, across Europe." },
];

export const Demo: React.FC = () => (
  <Stage>
    <BrowserFrame src="journey.mp4" label="chatgpt.com — LC Connect" />
    {CUES.map((c, i) => (
      <Sequence key={i} from={c.from} durationInFrames={c.dur}>
        <Audio src={staticFile(c.audio)} />
        <Caption kicker={c.kicker} text={c.text} />
      </Sequence>
    ))}
    <Chrome label="Live demo / ChatGPT" />
  </Stage>
);
