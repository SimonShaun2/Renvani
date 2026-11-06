"use client";

import { useEffect, useRef, useState } from "react";

export type LoopVideoProps = {
  webm: string;
  mp4: string;
  poster: string;
  width: number;
  height: number;
  className?: string | undefined;
  /** Applied to the outer frame (aspect + overflow). */
  frameClassName?: string | undefined;
  alt?: string | undefined;
  priority?: boolean | undefined;
  sizes?: string | undefined;
  /** Object-fit for the video/poster. */
  objectFit?: "cover" | "contain" | undefined;
};

/**
 * Autoplaying muted loop. Poster always renders (no JS required).
 * Sources attach only when near the viewport. Reduced-motion → poster only.
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
  objectFit = "cover"
}: LoopVideoProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const node = frameRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setNear(entry.isIntersecting);
        }
      },
      { rootMargin: "240px 0px", threshold: 0.01 }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [reducedMotion]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || reducedMotion) return;
    if (near) {
      // Reload when sources appear / swap so the new tab's file actually loads.
      video.load();
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [near, reducedMotion, webm, mp4]);

  const fitClass = objectFit === "contain" ? "object-contain" : "object-cover";

  return (
    <div
      ref={frameRef}
      className={`relative overflow-hidden ${frameClassName}`}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      {/* Always-visible poster — must render even if IO/lazy JS never fires. */}
      <img
        src={poster}
        alt={alt}
        width={width}
        height={height}
        decoding="async"
        className={`absolute inset-0 h-full w-full ${fitClass} ${className}`}
      />
      {!reducedMotion ? (
        <video
          key={`${webm}|${mp4}`}
          ref={videoRef}
          className={`absolute inset-0 h-full w-full ${fitClass} ${className}`}
          muted
          loop
          playsInline
          preload={near ? "metadata" : "none"}
          poster={poster}
          aria-label={alt || undefined}
          autoPlay={near}
        >
          {near ? (
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
