import React from "react";
import { Audio, Sequence, staticFile } from "remotion";
import { Stage } from "../components/Stage";
import { BrowserFrame } from "../components/BrowserFrame";
import { Caption } from "../components/Caption";
import { Chrome } from "../components/Brand";

// Cues synced to install.mp4 (25s @30fps = 750f): profile → Settings → Apps →
// Advanced settings → Developer mode → Create app → form → Create → OAuth sign-in.
const CUES = [
  { from: 4, dur: 350, audio: "audio/06_inst_dev.mp3", kicker: "Step 1", text: "Profile → Settings → Apps → Advanced — switch on Developer mode." },
  { from: 360, dur: 175, audio: "audio/07_inst_create.mp3", kicker: "Step 2", text: "Create app — name it, paste the connector URL." },
  { from: 540, dur: 210, audio: "audio/08_inst_oauth.mp3", kicker: "Step 3", text: "Click Create, then sign in with the demo credentials — connected." },
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
