import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const FLEET_VIEWS = [0, 0.24, 0.48, 0.7, 0.9];

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGL2RenderingContext && c.getContext("webgl2"));
  } catch { return false; }
}

/**
 * Connects the 3D scene (lazy-loaded) to the page:
 *  - "window" sections (hero, services, fleet, CTA) are transparent; the fixed canvas shows through them
 *  - each window section reports its scroll progress → the engine turns it into truck/camera/cargo/time of day
 *  - while only opaque sections are on screen, the engine stops rendering
 *  - one animation loop: the engine ticks on GSAP's ticker, which also drives Lenis and ScrollTrigger
 */
export default function useTruckScene(rootRef, canvasRef) {
  useEffect(() => {
    const root = rootRef.current, canvas = canvasRef.current;
    if (!root || !canvas) return undefined;
    if (!webglAvailable()) { root.classList.add("no-3d"); return undefined; }

    let engine = null, disposed = false, ctx = null;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mobile = window.matchMedia("(max-width: 899px), (pointer: coarse)").matches;
    const visibleSections = new Set();

    const tick = () => engine?.tick(performance.now());
    const onResize = () => engine?.resize();

    import("./three/engine.js").then(({ createEngine }) => {
      if (disposed) return;
      try {
        engine = createEngine(canvas, { mobile, reducedMotion });
      } catch (error) {
        console.warn("3D scene unavailable, using photo fallback", error);
        root.classList.add("no-3d");
        return;
      }

      ctx = gsap.context(() => {
        // which window section drives the scene, and how far through it we are
        const segment = (name, trigger, start, end) => ScrollTrigger.create({
          trigger, start, end,
          onUpdate: self => engine.set(name, self.progress),
          onToggle: self => { if (self.isActive) engine.set(name, self.progress); },
          onRefresh: self => { if (self.isActive) engine.set(name, self.progress); },
        });
        segment("hero", ".hx", "top top", "bottom top");
        segment("services", ".sv-stack", "top bottom", "bottom top");
        segment("fleet", ".fl", "top top", "bottom bottom");
        segment("cta", ".ct", "top bottom", "bottom bottom");

        // render only while at least one window section is on screen
        const watch = (name, trigger) => ScrollTrigger.create({
          trigger, start: "top bottom", end: "bottom top",
          onToggle: self => {
            if (self.isActive) visibleSections.add(name); else visibleSections.delete(name);
            engine.setVisible(visibleSections.size > 0);
          },
        });
        watch("hero", ".hx"); watch("services", ".sv-stack"); watch("fleet", ".fl"); watch("cta", ".ct");

        // fleet captions follow the camera's current view (class toggles only — no React renders)
        const views = gsap.utils.toArray(".fl-view");
        const fleet = root.querySelector(".fl");
        let current = -1;
        ScrollTrigger.create({
          trigger: ".fl", start: "top top", end: "bottom bottom",
          onUpdate: self => {
            let idx = 0;
            FLEET_VIEWS.forEach((v, i) => { if (self.progress >= v - 0.08) idx = i; });
            if (idx === current) return;
            current = idx;
            views.forEach((el, i) => el.classList.toggle("is-active", i === idx));
            fleet.style.setProperty("--view", idx);
            fleet.classList.toggle("is-last-view", idx === views.length - 1);
            fleet.classList.toggle("is-past-intro", idx > 0);
          },
        });
      }, root);

      // opt-in handle for automated visual tests only (set window.__SCENE_DEBUG__ before load)
      if (window.__SCENE_DEBUG__) window.__truckScene = engine;
      engine.setVisible(window.scrollY < window.innerHeight * 1.5 || visibleSections.size > 0);
      engine.tick(performance.now());
      gsap.ticker.add(tick);
      window.addEventListener("resize", onResize);
      ScrollTrigger.refresh();
      // fade the canvas in once the first frame exists
      requestAnimationFrame(() => root.classList.add("scene-ready"));
    }).catch(error => {
      console.warn("3D scene failed to load, using photo fallback", error);
      root.classList.add("no-3d");
    });

    return () => {
      disposed = true;
      gsap.ticker.remove(tick);
      window.removeEventListener("resize", onResize);
      ctx?.revert();
      engine?.dispose();
      engine = null;
      if (window.__truckScene) delete window.__truckScene;
      root.classList.remove("scene-ready", "no-3d");
    };
  }, [rootRef, canvasRef]);
}
