import { useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);
ScrollTrigger.config({ ignoreMobileResize: true });

const MOTION_OK = "(prefers-reduced-motion: no-preference)";

/**
 * All scroll choreography for the landing page.
 * - Lenis smooth scrolling (only when the visitor has not asked for reduced motion)
 * - GSAP ScrollTrigger timelines, scoped with gsap.context so everything is
 *   reverted (pins, inline styles, triggers) when the page unmounts.
 */
export default function useLandingMotion(rootRef) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    let lenis = null;
    const tick = time => lenis?.raf(time * 1000);

    // ---- Operations route: place the five nodes on the path (needed with or without motion)
    const route = root.querySelector(".op-route-active");
    const nodes = [...root.querySelectorAll(".op-node")];
    if (route && nodes.length) {
      const total = route.getTotalLength();
      nodes.forEach((node, i) => {
        const pt = route.getPointAtLength((total * i) / (nodes.length - 1));
        node.setAttribute("transform", `translate(${pt.x} ${pt.y})`);
      });
    }

    // ---- Smooth anchor links (#services, /#about …) through Lenis when it is running
    const onAnchorClick = event => {
      const link = event.target.closest?.("a[href^='#'], a[href^='/#']");
      if (!link) return;
      const id = link.getAttribute("href").replace(/^\/?#/, "");
      const target = id && document.getElementById(id);
      if (!target) return;
      event.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.4 });
      else target.scrollIntoView();
      history.replaceState(null, "", `#${id}`);
    };
    document.addEventListener("click", onAnchorClick);

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add(
        { motion: MOTION_OK, desktop: "(min-width: 900px)", mobile: "(max-width: 899px)" },
        ({ conditions }) => {
          if (!conditions.motion) return undefined; // reduced motion: static, fully readable page

          const { desktop } = conditions;
          const k = desktop ? 1 : 0.55;          // movement intensity (smaller screens move less)
          const SCRUB = desktop ? 0.5 : 0.35;     // light smoothing on top of Lenis — glides without lagging
          const scrubbed = (trigger, extra = {}) => ({ trigger, start: "top bottom", end: "bottom top", scrub: SCRUB, ...extra });

          // ---------- one loop: Lenis is driven by GSAP's ticker, ScrollTrigger updates from Lenis ----------
          lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, anchors: false }); // touch keeps native scrolling
          lenis.on("scroll", ScrollTrigger.update);
          gsap.ticker.add(tick);
          gsap.ticker.lagSmoothing(0);

          // ---------- 1. HERO ----------
          gsap.timeline({ defaults: { ease: "power4.out" } })
            .from(".hx-line > span", { yPercent: 110, duration: 1.2, stagger: 0.1 }, 0.2)
            .from([".hx-kicker", ".hx-sub", ".hx-actions"], { y: 20, opacity: 0, duration: 0.9, stagger: 0.08, ease: "power3.out" }, 0.65);

          // the 3D camera handles depth (see useTruckScene); here only the copy and the foreground dust move
          gsap.timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: ".hx", start: "top top", end: "bottom top", scrub: SCRUB } })
            .fromTo(".hx-dust", { yPercent: 0 }, { yPercent: -28 * k, duration: 1 }, 0)
            // copy leaves in layers: subtitle + buttons first, then the headline
            .fromTo(".hx-bottom", { y: 0, opacity: 1 }, { y: -60 * k, opacity: 0, duration: 0.25, ease: "none" }, 0)
            .fromTo(".hx-content", { yPercent: 0 }, { yPercent: -22 * k, duration: 0.6, ease: "none" }, 0)
            .fromTo(".hx-content > div:first-child", { opacity: 1 }, { opacity: 0, duration: 0.55, ease: "power1.in" }, 0.05)
            .fromTo(".hx-veil", { opacity: 0 }, { opacity: 1, duration: 0.45, ease: "power1.in" }, 0.55);

          // dust motes only animate while the hero is on screen
          const hero = root.querySelector(".hx");
          ScrollTrigger.create({
            trigger: hero, start: "top bottom", end: "bottom top",
            onToggle: self => hero.classList.toggle("is-offscreen", !self.isActive),
          });

          // ---------- 2. ABOUT ----------
          gsap.fromTo(".ab-media img", { scale: 1.08 }, { scale: 1, ease: "none", scrollTrigger: scrubbed(".ab") });
          gsap.fromTo(".ab-media", { yPercent: 4 * k }, { yPercent: -4 * k, ease: "none", scrollTrigger: scrubbed(".ab") });
          gsap.fromTo(".ab-word", { opacity: 0.15 }, {
            opacity: 1, ease: "none", stagger: 0.08,
            scrollTrigger: { trigger: ".ab-title", start: "top 85%", end: "bottom 50%", scrub: SCRUB },
          });
          gsap.utils.toArray(".ab-pillar").forEach(el => {
            gsap.from(el, { y: 24, opacity: 0, duration: 0.8, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 90%" } });
          });

          // ---------- 3. SERVICES: copy reveals over the 3D scene ----------
          gsap.utils.toArray(".sv-panel").forEach(panel => {
            gsap.fromTo(panel.querySelector(".sv-title"), { xPercent: 5 * k }, { xPercent: -4 * k, ease: "none", scrollTrigger: scrubbed(panel) });
            gsap.from(panel.querySelectorAll(".sv-reveal"), {
              y: 32, opacity: 0, duration: 0.8, stagger: 0.08, ease: "power3.out",
              scrollTrigger: { trigger: panel, start: "top 62%", toggleActions: "play none none reverse" },
            });
          });

          // ---------- 4. FLEET: sticky stage; the 3D camera orbits (useTruckScene), copy settles in once ----------
          // animate inner content only — the containers' opacity belongs to the mobile CSS view switching
          gsap.from([".fl-intro > *", ".fl-specs > *", ".fl-view"], {
            y: 24, opacity: 0, duration: 0.8, stagger: 0.06, ease: "power3.out",
            scrollTrigger: { trigger: ".fl", start: "top 55%" },
          });

          // ---------- 5. OPERATIONS: the route draws itself with the scroll ----------
          const opSection = root.querySelector(".op");
          const steps = gsap.utils.toArray(".op-step");
          const details = gsap.utils.toArray(".op-detail-item");
          const routeEl = root.querySelector(".op-route-active");
          const len = routeEl.getTotalLength();
          gsap.set(routeEl, { strokeDasharray: len, strokeDashoffset: len });
          gsap.set(".op-node-on", { opacity: 0, scale: 0.4, transformOrigin: "50% 50%" });
          opSection.classList.add("is-animated");

          let current = -1;
          const setActive = index => {
            if (index === current) return;           // only touch the DOM when the step changes
            current = index;
            steps.forEach((s, i) => s.classList.toggle("is-active", i === index));
            details.forEach((d, i) => d.classList.toggle("is-active", i === index));
          };
          setActive(0);

          const ops = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
              trigger: ".op-pin",
              start: desktop ? "top top" : "top 70%",
              end: desktop ? "+=240%" : "bottom 60%",
              pin: desktop,
              scrub: desktop ? 0.6 : SCRUB,
              onUpdate: self => setActive(Math.min(steps.length - 1, Math.floor(self.progress * steps.length * 0.999))),
            },
          });
          ops.to(routeEl, { strokeDashoffset: 0, duration: 1 }, 0)
            .to(".op-truck", { duration: 1, motionPath: { path: routeEl, align: routeEl, alignOrigin: [0.5, 0.5], autoRotate: true } }, 0);
          root.querySelectorAll(".op-node").forEach((node, i, all) => {
            ops.to(node.querySelector(".op-node-on"), { opacity: 1, scale: 1, duration: 0.04 }, Math.max(0, i / (all.length - 1) - 0.02));
          });

          // ---------- 6. WHY ----------
          gsap.utils.toArray(".wy-row").forEach(row => {
            gsap.from(row.children, { y: 24, opacity: 0, duration: 0.8, stagger: 0.08, ease: "power3.out", scrollTrigger: { trigger: row, start: "top 90%" } });
          });

          // ---------- 7. FINAL CTA ----------
          gsap.from(".ct-content > *", {
            y: 32, opacity: 0, duration: 0.9, stagger: 0.1, ease: "power3.out",
            scrollTrigger: { trigger: ".ct", start: "top 55%" },
          });

          return () => {
            gsap.ticker.remove(tick);
            lenis?.destroy();
            lenis = null;
            hero.classList.remove("is-offscreen");
            opSection.classList.remove("is-animated");
            steps.forEach(s => s.classList.remove("is-active"));
            details.forEach(d => d.classList.remove("is-active"));
          };
        }
      );
    }, root);

    // fonts change text metrics, which changes pin lengths
    let alive = true;
    document.fonts?.ready.then(() => alive && ScrollTrigger.refresh());
    const onLoad = () => ScrollTrigger.refresh();
    if (document.readyState !== "complete") window.addEventListener("load", onLoad, { once: true });

    return () => {
      alive = false;
      window.removeEventListener("load", onLoad);
      document.removeEventListener("click", onAnchorClick);
      ctx.revert();
    };
  }, [rootRef]);
}
