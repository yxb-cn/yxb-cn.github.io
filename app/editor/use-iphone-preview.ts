import { useLayoutEffect, type RefObject } from "react";

export function useIPhonePreview(
  frameRef: RefObject<HTMLIFrameElement | null>,
  enabled: boolean,
) {
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const viewport = frame?.parentElement;
    if (!enabled || !frame || !viewport) return;

    // Zoom the browsing context to the phone's density, then fit its image
    // to the panel without changing the viewport used for page layout.
    const fit = () => {
      const densityZoom = 3 / window.devicePixelRatio;
      const scale = Math.min(
        1,
        viewport.clientWidth / frame.offsetWidth,
        viewport.clientHeight / frame.offsetHeight,
      );
      frame.style.setProperty("--phone-zoom", String(densityZoom));
      frame.style.setProperty("--phone-scale", String(scale / densityZoom));
    };
    const hideScrollGutter = () => {
      frame.contentDocument?.documentElement.style.setProperty("scrollbar-width", "none");
    };
    const currentDensity = () =>
      window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    let density = currentDensity();
    const onDensityChange = () => {
      fit();
      density = currentDensity();
      density.addEventListener("change", onDensityChange, { once: true });
    };

    fit();
    hideScrollGutter();
    const observer = new ResizeObserver(fit);
    observer.observe(viewport);
    density.addEventListener("change", onDensityChange, { once: true });
    frame.addEventListener("load", hideScrollGutter);
    return () => {
      observer.disconnect();
      density.removeEventListener("change", onDensityChange);
      frame.removeEventListener("load", hideScrollGutter);
      frame.contentDocument?.documentElement.style.removeProperty("scrollbar-width");
      frame.style.removeProperty("--phone-zoom");
      frame.style.removeProperty("--phone-scale");
    };
  }, [enabled, frameRef]);
}
