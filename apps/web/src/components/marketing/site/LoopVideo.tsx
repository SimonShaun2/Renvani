"use client";

import Image from "next/image";
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
 * Autoplaying muted loop. Loads sources only when near the viewport.
 * Under prefers-reduced-motion, renders the poster still only.
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
  sizes,
  objectFit = "cover"
}: LoopVideoProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
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
          setActive(entry.isIntersecting);
        }
      },
      { rootMargin: "200px 0px", threshold: 0.01 }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [reducedMotion]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || reducedMotion) return;
    if (active) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [active, reducedMotion]);

  const fitClass = objectFit === "contain" ? "object-contain" : "object-cover";

  return (
    <div
      ref={frameRef}
      className={`relative overflow-hidden ${frameClassName}`}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      {reducedMotion || !active ? (
        <Image
          src={poster}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          sizes={sizes}
          className={`absolute inset-0 h-full w-full ${fitClass} ${className}`}
        />
      ) : null}
      {!reducedMotion ? (
        <video
          ref={videoRef}
          className={`absolute inset-0 h-full w-full ${fitClass} ${className}`}
          muted
          loop
          playsInline
          preload={active ? "metadata" : "none"}
          poster={poster}
          aria-label={alt || undefined}
          autoPlay={active}
          style={{ opacity: active ? 1 : 0 }}
        >
          {active ? (
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
