"use client";

import Image from "next/image";

export function LandingSdgAnimation({ replayKey }: { replayKey: number }) {
  return (
    <div className="landing-sdg-scene" role="img" aria-label="Five stacked Sustainable Development Goal blocks">
      <Image
        key={replayKey}
        src="/landing-sdg-stack.png"
        alt=""
        width={1312}
        height={1199}
        sizes="310px"
        className="landing-sdg-stack"
        preload
      />
    </div>
  );
}
