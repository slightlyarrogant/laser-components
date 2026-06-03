import React from "react";
import { Audio, Sequence, staticFile } from "remotion";
import { Stage } from "../components/Stage";
import { BrowserFrame } from "../components/BrowserFrame";
import { Caption } from "../components/Caption";
import { Chrome } from "../components/Brand";

// Cues synced to install.mp4 (15s @30fps = 450f): settings → apps → create app
// → fill the form → Create.
const CUES = [
  { from: 4, dur: 70, audio: "audio/06_inst_a.mp3", kicker: "Two minutes", text: "Installing it is quick." },
  { from: 78, dur: 142, audio: "audio/07_inst_b.mp3", kicker: "In ChatGPT", text: "Settings → Apps → Create app." },
  { from: 228, dur: 175, audio: "audio/08_inst_c.mp3", kicker: "One form", text: "Name, paste the connector URL, click Create — connected." },
];

export const Install: React.FC = () => (
  <Stage>
    <BrowserFrame src="install.mp4" label="ChatGPT — Settings · Apps" />
    {CUES.map((c, i) => (
      <Sequence key={i} from={c.from} durationInFrames={c.dur}>
        <Audio src={staticFile(c.audio)} />
        <Caption kicker={c.kicker} text={c.text} />
      </Sequence>
    ))}
    <Chrome label="Install / Developer mode" />
  </Stage>
);
