import { useLayoutEffect } from "react";
import gsap from "gsap";

/**
 * Staggered entrance for auth forms (heading → fields → button).
 * Animates opacity/transform only — elements stay focusable and typeable
 * the whole time, so autofocus and fast typists are never blocked.
 */
export default function useAuthReveal(scopeRef) {
  useLayoutEffect(() => {
    const el = scopeRef.current;
    if (!el) return undefined;
    const ctx = gsap.context(() => {
      gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(".au-reveal", {
          y: 18, opacity: 0, duration: 0.7, stagger: 0.06, ease: "power3.out", clearProps: "transform,opacity",
        });
      });
    }, el);
    return () => ctx.revert();
  }, [scopeRef]);
}
