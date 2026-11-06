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
  /**
   * Hero / LCP: eager poster; attach video sources only after
   * load+idle(~3s) OR first scroll OR first pointer — whichever comes first.
   */
  priority?: boolean | undefined;
  sizes?: string | undefined;
  /** Object-fit for the video/poster. */
  objectFit?: "cover" | "contain" | undefined;
};

/**
 * Autoplaying muted loop. Poster always renders (no JS required).
 * Sources attach only when near the viewport (and after deferral for priority).
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
  const [videoReady, setVideoReady] = useState(false);
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
    let cancelled = false;
    let idleHandle: number | undefined;
    let timeoutHandle: number | undefined;

    const markReady = () => {
      if (cancelled) return;
      cancelled = true;
      setPageReady(true);
      cleanup();
    };

    const onScroll = () => markReady();
    const onPointer = () => markReady();

    const cleanup = () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("pointermove", onPointer);
      if (idleHandle !== undefined && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle !== undefined) window.clearTimeout(timeoutHandle);
    };

    window.addEventListener("scroll", onScroll, { once: true, passive: true });
    window.addEventListener("pointerdown", onPointer, { once: true, passive: true });
    window.addEventListener("pointermove", onPointer, { once: true, passive: true });

    const startIdleClock = () => {
      // ~3s after load, then idle (rIC) if available; setTimeout-only where rIC isn't supported.
      timeoutHandle = window.setTimeout(() => {
        if (typeof window.requestIdleCallback === "function") {
          idleHandle = window.requestIdleCallback(() => markReady(), { timeout: 1000 });
        } else {
          markReady();
        }
      }, 3000);
    };

    if (document.readyState === "complete") {
      startIdleClock();
    } else {
      window.addEventListener("load", startIdleClock, { once: true });
    }

    return () => {
      cancelled = true;
      cleanup();
      window.removeEventListener("load", startIdleClock);
    };
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
      setVideoReady(false);
    }
  }, [activate, reducedMotion, webm, mp4]);

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
          preload={activate ? "metadata" : "none"}
          aria-label={alt || undefined}
          autoPlay={activate}
          onPlaying={() => setVideoReady(true)}
          onCanPlay={() => {
            // Prefer playing for the swap, but canplay is enough if already decoding.
            if (videoRef.current && !videoRef.current.paused) setVideoReady(true);
          }}
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
