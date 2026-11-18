import { useEffect } from "react";

/**
 * Shared environment for every popup tagged .ms-dialog-overlay:
 *  - locks background scrolling while any popup is open (scrolling inside the popup still works);
 *  - exposes the *visual* viewport as --ms-vvh / --ms-vv-top so dialogs shrink above the
 *    iPhone/iPad on-screen keyboard instead of being covered by it.
 * Keeps focused form fields inside the visible viewport without scrolling the
 * background or disturbing horizontal table/dropdown scrolling.
 */
export default function usePopupEnvironment() {
  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;
    let frame = 0;
    let focusFrame = 0;
    let focusTimer = 0;
    let viewportTimer = 0;

    const revealFocusedField = () => {
      focusFrame = 0;
      const field = document.activeElement;
      if (!(field instanceof HTMLElement) || !field.matches("input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=radio]), textarea, select")) return;
      const panel = field.closest(".ms-dialog, .ui-modal, .ui-drawer-panel, .ms-confirm");
      if (!panel) return;
      const bounds = panel.getBoundingClientRect();
      let top = Math.max(bounds.top, vv?.offsetTop || 0) + 16;
      let bottom = Math.min(bounds.bottom, (vv?.offsetTop || 0) + (vv?.height || window.innerHeight)) - 16;
      for (const child of panel.children) {
        if (!["sticky", "fixed"].includes(getComputedStyle(child).position)) continue;
        const rect = child.getBoundingClientRect();
        if (child.matches("header, .ms-dialog-head, .ui-modal__head")) top = Math.max(top, rect.bottom + 12);
        if (child.matches("footer, .ms-dialog-foot, .ui-modal__foot, .modal-actions, .expense-create-actions")) bottom = Math.min(bottom, rect.top - 12);
      }
      // Some forms use an inner body scroller, others scroll the panel itself.
      // Work from the nearest scroll container outward, and only on the Y axis.
      for (let ancestor = field.parentElement; ancestor && panel.contains(ancestor); ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        if (/(auto|scroll)/.test(style.overflowY) && ancestor.scrollHeight > ancestor.clientHeight + 1) {
          const container = ancestor.getBoundingClientRect();
          const visibleTop = Math.max(top, container.top + ancestor.clientTop + 8);
          const visibleBottom = Math.min(bottom, container.top + ancestor.clientTop + ancestor.clientHeight - 8);
          if (visibleBottom <= visibleTop) continue;
          const rect = field.getBoundingClientRect();
          if (rect.height > visibleBottom - visibleTop) ancestor.scrollTop += rect.top - visibleTop;
          else if (rect.bottom > visibleBottom) ancestor.scrollTop += rect.bottom - visibleBottom;
          else if (rect.top < visibleTop) ancestor.scrollTop -= visibleTop - rect.top;
        }
        if (ancestor === panel) break;
      }
    };
    const scheduleFocus = () => {
      cancelAnimationFrame(focusFrame);
      focusFrame = requestAnimationFrame(revealFocusedField);
    };
    const onFocus = () => {
      scheduleFocus();
      clearTimeout(focusTimer);
      focusTimer = window.setTimeout(scheduleFocus, 350);
    };

    const syncViewport = () => {
      frame = 0;
      if (!vv) return;
      const keyboardOpen = window.innerHeight - vv.height > 120 && vv.scale < 1.1;
      root.classList.toggle("ms-keyboard-open", keyboardOpen);
      root.style.setProperty("--ms-vvh", `${Math.round(vv.height)}px`);
      root.style.setProperty("--ms-vv-top", `${Math.round(vv.offsetTop)}px`);
      scheduleFocus();
      // Safari may finish panning after its final resize event. Reveal again
      // after layout and the keyboard animation have both settled.
      clearTimeout(viewportTimer);
      viewportTimer = window.setTimeout(scheduleFocus, 180);
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
    document.addEventListener("focusin", onFocus);
    const observer = typeof MutationObserver !== "undefined" ? new MutationObserver(syncOpen) : null;
    observer?.observe(document.body, { childList: true, subtree: true });

    return () => {
      vv?.removeEventListener("resize", scheduleViewport);
      vv?.removeEventListener("scroll", scheduleViewport);
      document.removeEventListener("focusin", onFocus);
      clearTimeout(focusTimer);
      clearTimeout(viewportTimer);
      cancelAnimationFrame(focusFrame);
      observer?.disconnect();
      if (frame) cancelAnimationFrame(frame);
      root.classList.remove("ms-dialog-open", "ms-keyboard-open");
      root.style.removeProperty("--ms-vvh");
      root.style.removeProperty("--ms-vv-top");
    };
  }, []);
}
