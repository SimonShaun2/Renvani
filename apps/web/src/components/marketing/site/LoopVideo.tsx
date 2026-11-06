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
  /** Hero / LCP: eager poster + delay video until after window load. */
  priority?: boolean | undefined;
  sizes?: string | undefined;
  /** Object-fit for the video/poster. */
  objectFit?: "cover" | "contain" | undefined;
};

/**
 * Autoplaying muted loop. Poster always renders (no JS required).
 * Sources attach only when near the viewport (and after load for priority).
 * Reduced-motion → poster only.
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
  sizes = "(max-width: 390px) 390px, (max-width: 768px) 768px, 1440px",
  objectFit = "cover"
}: LoopVideoProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  const [pageReady, setPageReady] = useState(!priority);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!priority) return;
    const markReady = () => setPageReady(true);
    if (document.readyState === "complete") {
      // Defer one tick so the LCP poster can paint first.
      const t = window.setTimeout(markReady, 0);
      return () => window.clearTimeout(t);
    }
    window.addEventListener("load", markReady, { once: true });
    return () => window.removeEventListener("load", markReady);
  }, [priority]);

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
      // Tight margin so below-fold loops do not request media on initial load.
      { rootMargin: "0px 0px", threshold: 0.01 }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [reducedMotion]);

  const activate = near && pageReady && !reducedMotion;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || reducedMotion) return;
    if (activate) {
      video.load();
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [activate, reducedMotion, webm, mp4]);

  const fitClass = objectFit === "contain" ? "object-contain" : "object-cover";
  const imgClass = `absolute inset-0 h-full w-full ${fitClass} ${className}`;

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
          className={imgClass}
        />
      </picture>
      {!reducedMotion ? (
        <video
          key={`${webm}|${mp4}`}
          ref={videoRef}
          className={`absolute inset-0 h-full w-full ${fitClass} ${className}`}
          muted
          loop
          playsInline
          preload={activate ? "metadata" : "none"}
          aria-label={alt || undefined}
          autoPlay={activate}
        >
          {activate ? (
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
