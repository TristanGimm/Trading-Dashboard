'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A video backdrop that crossfades between two clips every few minutes.
 *
 * Portrait screens get the portrait cuts, landscape screens the wide ones, so
 * the framing is right on a phone instead of showing a letterboxed sliver.
 *
 * Two <video> elements are used, one per scene, and only their opacity is
 * swapped. Changing `src` on a single element restarts decoding and flashes
 * black, which is exactly what a crossfade must avoid. That is also why this
 * component assumes exactly two scenes: with two, each element loads its clip
 * once and never reloads.
 */

type Variant = 'hero' | 'ambient';

const SCENES = [
  { landscape: '/videos/globe-landscape.mp4', portrait: '/videos/globe-portrait.mp4', posterLandscape: '/videos/globe-landscape.jpg', posterPortrait: '/videos/globe-portrait.jpg' },
  { landscape: '/videos/horizon-landscape.mp4', portrait: '/videos/horizon-portrait.mp4', posterLandscape: '/videos/horizon-landscape.jpg', posterPortrait: '/videos/horizon-portrait.jpg' },
] as const;

/** How long one clip stays on screen before the crossfade (two minutes). */
const DWELL_MS = 120_000;

export function VideoBackdrop({ variant = 'hero' }: { variant?: Variant }) {
  const [portrait, setPortrait] = useState<boolean | null>(null);
  const [scene, setScene] = useState(0);
  const [still, setStill] = useState(false);
  const elements = useRef<(HTMLVideoElement | null)[]>([null, null]);

  // Decide the cut only after the viewport is known, so the wrong orientation
  // is never downloaded.
  useEffect(() => {
    const query = window.matchMedia('(orientation: portrait)');
    const apply = () => setPortrait(query.matches || window.innerWidth < window.innerHeight);
    apply();
    query.addEventListener('change', apply);
    window.addEventListener('resize', apply);
    return () => {
      query.removeEventListener('change', apply);
      window.removeEventListener('resize', apply);
    };
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setStill(query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  // Alternate. With reduced motion a single paused frame stays instead of
  // cutting between clips.
  useEffect(() => {
    if (portrait === null || still) return;
    const timer = setInterval(() => setScene(current => (current + 1) % SCENES.length), DWELL_MS);
    return () => clearInterval(timer);
  }, [portrait, still]);

  // Visibility follows the active scene; each element keeps its own clip.
  useEffect(() => {
    if (portrait === null) return;
    elements.current.forEach((element, index) => {
      if (!element) return;
      const visible = index === scene;
      element.style.opacity = visible ? '1' : '0';
      if (visible && !still) void element.play().catch(() => {});
      if (!visible) element.pause();
    });
  }, [scene, portrait, still]);

  // A background video must not burn battery while the tab is hidden.
  useEffect(() => {
    const onVisibility = () => {
      const element = elements.current[scene];
      if (!element) return;
      if (document.hidden) element.pause();
      else if (!still) void element.play().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [scene, still]);

  if (portrait === null) {
    return <div className={variant === 'hero' ? 'videobg videobg-hero' : 'videobg videobg-ambient'} aria-hidden="true">
      <div className="videobg-scrim"/>
    </div>;
  }

  return <div className={variant === 'hero' ? 'videobg videobg-hero' : 'videobg videobg-ambient'} aria-hidden="true">
    {SCENES.map((item, index) => <video
      key={item.landscape}
      ref={element => { elements.current[index] = element; }}
      className="videobg-clip"
      src={portrait ? item.portrait : item.landscape}
      poster={portrait ? item.posterPortrait : item.posterLandscape}
      muted
      loop
      playsInline
      autoPlay={index === 0 && !still}
      preload="auto"
      style={{ opacity: index === scene ? 1 : 0 }}
    />)}
    <div className="videobg-scrim"/>
  </div>;
}
