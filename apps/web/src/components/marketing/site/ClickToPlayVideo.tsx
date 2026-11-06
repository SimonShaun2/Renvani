"use client";

import { Play } from "lucide-react";
import { useRef, useState } from "react";

export type ClickToPlayVideoProps = {
  src: string;
  poster: string;
  captionsSrc?: string | undefined;
  title: string;
  className?: string | undefined;
};

/** Inline video with always-visible poster + large play overlay. Plays with sound on click. */
export function ClickToPlayVideo({ src, poster, captionsSrc, title, className = "" }: ClickToPlayVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);

  const start = async () => {
    const video = videoRef.current;
    if (!video) return;
    setStarted(true);
    video.controls = true;
    try {
      await video.play();
    } catch {
      /* user gesture / autoplay policy */
    }
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-[#0f1530] ${className}`} style={{ aspectRatio: "16 / 9" }}>
      {/* Explicit poster img so a black frame never shows if the video poster attribute lags. */}
      {!started ? (
        <img
          src={poster}
          alt=""
          width={1920}
          height={1080}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
      <video
        ref={videoRef}
        className="relative z-[1] h-full w-full object-cover"
        poster={poster}
        preload="none"
        playsInline
        controls={started}
        aria-label={title}
        onPlay={() => setStarted(true)}
      >
        <source src={src} type="video/mp4" />
        {captionsSrc ? <track kind="captions" srcLang="en" label="English" src={captionsSrc} default={false} /> : null}
      </video>
      {!started ? (
        <button
          type="button"
          onClick={() => void start()}
          className="absolute inset-0 z-[2] flex items-center justify-center bg-black/20 transition hover:bg-black/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          aria-label={`Play ${title}`}
        >
          <span className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-white/95 text-[var(--color-mkt-ink)] shadow-lg">
            <Play size={36} fill="currentColor" aria-hidden="true" className="ml-1" />
          </span>
        </button>
      ) : null}
    </div>
  );
}
