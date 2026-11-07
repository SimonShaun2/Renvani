"use client";

import { Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { PosterSet } from "./media-loops";

export type ClickToPlayVideoProps = {
  src: string;
  poster: PosterSet;
  captionsSrc?: string | undefined;
  title: string;
  className?: string | undefined;
  sizes?: string | undefined;
};

/** Inline video with always-visible poster + large play overlay. Plays with sound on click. */
export function ClickToPlayVideo({
  src,
  poster,
  captionsSrc,
  title,
  className = "",
  sizes = "(max-width: 390px) 390px, (max-width: 768px) 768px, 1440px"
}: ClickToPlayVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!started) return;
    const video = videoRef.current;
    if (!video) return;
    video.controls = true;
    video.load();
    void video.play().catch(() => undefined);
  }, [started, src]);

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-[#0f1530] ${className}`} style={{ aspectRatio: "16 / 9" }}>
      {!started ? (
        <picture>
          <source type="image/avif" srcSet={poster.avifSrcSet} sizes={sizes} />
          <source type="image/webp" srcSet={poster.webpSrcSet} sizes={sizes} />
          <img
            src={poster.src}
            alt=""
            width={1920}
            height={1080}
            decoding="async"
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </picture>
      ) : null}
      <video
        ref={videoRef}
        className="relative z-[1] h-full w-full object-cover"
        preload="none"
        playsInline
        controls={started}
        aria-label={title}
        onPlay={() => setStarted(true)}
      >
        {started ? <source src={src} type="video/mp4" /> : null}
        {captionsSrc ? <track kind="captions" srcLang="en" label="English" src={captionsSrc} default={false} /> : null}
      </video>
      {!started ? (
        <button
          type="button"
          onClick={() => setStarted(true)}
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
