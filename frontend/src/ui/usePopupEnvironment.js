import { useEffect } from "react";

/**
 * Shared environment for every popup tagged .ms-dialog-overlay:
 *  - locks background scrolling while any popup is open (scrolling inside the popup still works);
 *  - exposes the *visual* viewport as --ms-vvh / --ms-vv-top so dialogs shrink above the
 *    iPhone/iPad on-screen keyboard instead of being covered by it.
 * It only toggles a class and two CSS variables; no popup state or handler is touched.
 */
export default function usePopupEnvironment() {
  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;
    let frame = 0;

    const syncViewport = () => {
      frame = 0;
      if (!vv) return;
      root.style.setProperty("--ms-vvh", `${Math.round(vv.height)}px`);
      root.style.setProperty("--ms-vv-top", `${Math.round(vv.offsetTop)}px`);
    };
    const scheduleViewport = () => { if (!frame) frame = requestAnimationFrame(syncViewport); };

    const syncOpen = () => {
      const open = Boolean(document.querySelector(".ms-dialog-overlay, .ui-overlay, .ms-confirm-overlay"));
      root.classList.toggle("ms-dialog-open", open);
    };

    syncViewport();
    syncOpen();
    vv?.addEventListener("resize", scheduleViewport);
    vv?.addEventListener("scroll", scheduleViewport);
    const observer = typeof MutationObserver !== "undefined" ? new MutationObserver(syncOpen) : null;
    observer?.observe(document.body, { childList: true, subtree: true });

    return () => {
      vv?.removeEventListener("resize", scheduleViewport);
      vv?.removeEventListener("scroll", scheduleViewport);
      observer?.disconnect();
      if (frame) cancelAnimationFrame(frame);
      root.classList.remove("ms-dialog-open");
      root.style.removeProperty("--ms-vvh");
      root.style.removeProperty("--ms-vv-top");
    };
  }, []);
}
