"use client";

import { useEffect, useRef, useState } from "react";

import type { PosterSet } from "./media-loops";

export type LoopVideoProps = {
  webm: string;
  mp4: string;
  poster: PosterSet;
  width: number;
  height: number;
  className?: string | undefined;
  /** Applied to the outer frame (aspect + overflow). */
  frameClassName?: string | undefined;
  alt?: string | undefined;
  /** Hero / LCP: eager, high-priority poster. Sources still attach at window load. */
  priority?: boolean | undefined;
  /**
   * Attach sources at the window load event and autoplay regardless of viewport
   * (hero + trade cards). Otherwise sources attach when the frame nears the viewport.
   */
  attachOnLoad?: boolean | undefined;
  sizes?: string | undefined;
  /** Object-fit for the video/poster. */
  objectFit?: "cover" | "contain" | undefined;
};

/**
 * Autoplaying muted loop. Poster always renders (no JS required).
 * Sources attach at window load (attachOnLoad / priority) or when near the viewport,
 * never gated on user input. Reduced motion → still poster only.
 */
export function LoopVideo({
  webm,
  mp4,
  poster,
  width,
  height,
  className = "",
  frameClassName = "",
  alt = "",
  priority = false,
  attachOnLoad = false,
  sizes = "(max-width: 390px) 390px, (max-width: 768px) 768px, 1440px",
  objectFit = "cover"
}: LoopVideoProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const eager = attachOnLoad || priority;
  const [near, setNear] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Window load (keeps the poster as LCP); no idle/scroll/pointer gate.
  useEffect(() => {
    if (!eager) return;
    if (document.readyState === "complete") {
      setLoaded(true);
      return;
    }
    const onLoad = () => setLoaded(true);
    window.addEventListener("load", onLoad, { once: true });
    return () => window.removeEventListener("load", onLoad);
  }, [eager]);

  useEffect(() => {
    if (eager || reducedMotion) return;
    const node = frameRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setNear(entry.isIntersecting);
      },
      { rootMargin: "0px 0px", threshold: 0.01 }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [eager, reducedMotion]);

  const shouldAttach = !reducedMotion && (eager ? loaded : near);

  // Load the attached sources, then start playback programmatically (load() first so play() is not aborted).
  useEffect(() => {
    const video = videoRef.current;
    if (!video || reducedMotion) return;
    if (!shouldAttach) {
      video.pause();
      setVideoReady(false);
      return;
    }
    video.muted = true;
    video.defaultMuted = true;
    video.load();
    void Promise.resolve(video.play()).catch((error: unknown) => {
      console.warn("[LoopVideo] play() rejected", webm, error);
    });
  }, [shouldAttach, reducedMotion, webm, mp4]);

  const fitClass = objectFit === "contain" ? "object-contain" : "object-cover";
  const mediaClass = `absolute inset-0 h-full w-full ${fitClass} ${className}`;

  return (
    <div
      ref={frameRef}
      className={`relative overflow-hidden ${frameClassName}`}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <picture>
        <source type="image/avif" srcSet={poster.avifSrcSet} sizes={sizes} />
        <source type="image/webp" srcSet={poster.webpSrcSet} sizes={sizes} />
        <img
          src={poster.src}
          alt={alt}
          width={width}
          height={height}
          sizes={sizes}
          decoding={priority ? "sync" : "async"}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          className={mediaClass}
          style={{
            opacity: videoReady ? 0 : 1,
            transition: "opacity 280ms ease",
            zIndex: 1,
            pointerEvents: "none"
          }}
        />
      </picture>
      {!reducedMotion ? (
        <video
          key={`${webm}|${mp4}`}
          ref={videoRef}
          className={mediaClass}
          style={{ zIndex: 0 }}
          muted
          loop
          playsInline
          preload={shouldAttach ? "metadata" : "none"}
          aria-hidden="true"
          autoPlay
          onPlaying={() => setVideoReady(true)}
          onCanPlay={() => {
            if (videoRef.current && !videoRef.current.paused) setVideoReady(true);
          }}
        >
          {shouldAttach ? (
            <>
              <source src={webm} type="video/webm" />
              <source src={mp4} type="video/mp4" />
            </>
          ) : null}
        </video>
      ) : null}
    </div>
  );
}
