'use client';

import { useEffect } from 'react';

/**
 * Enforces "only one video plays at a time" across the whole page.
 *
 * Attaches a single document-level listener for the `play` event in the
 * capture phase. The `play` event does not bubble, so capture is required to
 * observe it from any <video> on the page — including ones swapped in
 * dynamically (e.g. click-to-play film cards). When any video starts, every
 * other currently-playing video is paused. Controls, click-to-play, autoplay,
 * and poster-then-play behavior are all left untouched.
 */
export function useSingleVideoPlayback() {
  useEffect(() => {
    const handlePlay = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLVideoElement)) return;
      const videos = document.querySelectorAll('video');
      videos.forEach((video) => {
        if (video !== target && !video.paused) {
          video.pause();
        }
      });
    };

    document.addEventListener('play', handlePlay, true);
    return () => document.removeEventListener('play', handlePlay, true);
  }, []);
}
