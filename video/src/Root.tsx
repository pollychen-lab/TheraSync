import React from "react";
import { Composition } from "remotion";
import { TheraSyncDemo, TOTAL_FRAMES } from "./TheraSyncDemo";
import { TheraSyncThreeMinute, THREE_MINUTE_FRAMES } from "./TheraSyncThreeMinute";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TheraSyncDemo"
        component={TheraSyncDemo}
        durationInFrames={TOTAL_FRAMES}
        fps={30}
        width={1600}
        height={900}
      />
      <Composition
        id="TheraSyncThreeMinute"
        component={TheraSyncThreeMinute}
        durationInFrames={THREE_MINUTE_FRAMES}
        fps={30}
        width={1600}
        height={900}
      />
    </>
  );
};
