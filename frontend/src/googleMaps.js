export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
export const GOOGLE_MAPS_MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";

let googleMapsPromise;

export function loadGoogleMaps() {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (!GOOGLE_MAPS_API_KEY) return Promise.reject(new Error("Google Maps API key belum dikonfigurasi"));
  if (!googleMapsPromise) {
    googleMapsPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-erp-google-maps="true"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(window.google.maps), { once: true });
        existing.addEventListener("error", () => reject(new Error("Google Maps gagal dimuat")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.dataset.erpGoogleMaps = "true";
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&libraries=marker,places&v=weekly`;
      script.async = true;
      script.onload = () => resolve(window.google.maps);
      script.onerror = () => reject(new Error("Google Maps gagal dimuat"));
      document.head.appendChild(script);
    });
  }
  return googleMapsPromise;
}
