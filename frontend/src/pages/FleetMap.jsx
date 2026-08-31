import { useEffect, useMemo, useRef, useState } from "react";
import { FiAlertTriangle, FiMapPin, FiRefreshCw, FiSearch, FiTruck } from "react-icons/fi";
import { api } from "../api";
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_MAP_ID, loadGoogleMaps } from "../googleMaps";
import { useLiveRefresh } from "../liveUpdates";
import "./FleetMap.css";
import "./FleetMapGoogle.css";

const DEFAULT_CENTER = { lat: 2.4, lng: 99.3 };
function validPosition(truck) {
  if (truck.lastGpsLatitude == null || truck.lastGpsLongitude == null) return null;
  const lat = Number(truck.lastGpsLatitude);
  const lng = Number(truck.lastGpsLongitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180 || (lat === 0 && lng === 0)) return null;
  return { lat, lng };
}

function markerColor(truck) {
  if (truck.gpsLocation?.type === "WARNING" || truck.gpsStopWarning?.severity === "CRITICAL") return "#c2413b";
  if (truck.gpsStopWarning || truck.status === "MAINTENANCE") return "#d38219";
  if (truck.status === "DISPATCH") return "#2563a8";
  return "#157347";
}

function markerElement(truck) {
  const marker = document.createElement("button");
  marker.type = "button";
  marker.className = "google-fleet-marker";
  marker.style.setProperty("--marker-color", markerColor(truck));
  marker.innerHTML = `<span>${truck.plateNumber || "TRUK"}</span><i></i>`;
  return marker;
}

function popupContent(truck) {
  const root = document.createElement("div");
  root.className = "fleet-map-popup google-popup";
  const title = document.createElement("strong");
  title.textContent = truck.plateNumber || "Kendaraan";
  const vehicle = document.createElement("span");
  vehicle.textContent = [truck.brand, truck.model].filter(Boolean).join(" ") || "Kendaraan";
  const details = document.createElement("dl");
  const detailRows = [
    ["Status", truck.status || "-"],
    ["Lokasi", truck.gpsLocation?.name || "Dalam perjalanan"],
    ["Kecepatan", truck.lastGpsSpeed == null ? "-" : `${Number(truck.lastGpsSpeed).toFixed(0)} km/jam`],
    ["Pengemudi", truck.driverUser?.name || "Belum ditugaskan"],
    ["Update GPS", truck.lastGpsAt ? new Date(truck.lastGpsAt).toLocaleString("id-ID") : "-"],
  ];
  detailRows.forEach(([label, value]) => {
    const row = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = value;
    row.append(term, description);
    details.appendChild(row);
  });
  const link = document.createElement("a");
  link.href = `https://www.google.com/maps?q=${truck.position.lat},${truck.position.lng}`;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = "Buka navigasi Google Maps";
  root.append(title, vehicle, details, link);
  return root;
}

function GoogleFleetMap({ trucks, onError }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const infoWindowRef = useRef(null);

  useEffect(() => {
    let active = true;
    loadGoogleMaps().then(async (maps) => {
      if (!active || !containerRef.current) return;
      await maps.importLibrary("marker");
      if (!mapRef.current) {
        mapRef.current = new maps.Map(containerRef.current, {
          center: DEFAULT_CENTER,
          zoom: 7,
          mapId: GOOGLE_MAPS_MAP_ID,
          mapTypeControl: true,
          mapTypeControlOptions: { mapTypeIds: ["roadmap", "satellite", "hybrid"] },
          streetViewControl: false,
          fullscreenControl: true,
          gestureHandling: "greedy",
        });
        infoWindowRef.current = new maps.InfoWindow();
      }
      markersRef.current.forEach((marker) => { marker.map = null; });
      markersRef.current = [];
      const bounds = new maps.LatLngBounds();
      trucks.forEach((truck) => {
        const marker = new maps.marker.AdvancedMarkerElement({ map: mapRef.current, position: truck.position, title: truck.plateNumber, content: markerElement(truck) });
        marker.addListener("click", () => {
          infoWindowRef.current.setContent(popupContent(truck));
          infoWindowRef.current.open({ map: mapRef.current, anchor: marker });
        });
        markersRef.current.push(marker);
        bounds.extend(truck.position);
      });
      if (trucks.length === 1) {
        mapRef.current.setCenter(trucks[0].position);
        mapRef.current.setZoom(15);
      } else if (trucks.length > 1) mapRef.current.fitBounds(bounds, 55);
    }).catch((error) => { if (active) onError(error.message); });
    return () => { active = false; };
  }, [trucks, onError]);

  return <div ref={containerRef} className="fleet-google-map" />;
}

export default function FleetMap() {
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mapError, setMapError] = useState("");
  const [query, setQuery] = useState("");

  async function load({ background = false } = {}) {
    if (!background) setLoading(true);
    try {
      const result = await api("/trucks");
      setTrucks(result.items || []);
      setError("");
    } catch (err) {
      setError(err.message || "Gagal memuat posisi armada");
    } finally {
      if (!background) setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useLiveRefresh(load, { interval: 60000 });

  const mapped = useMemo(() => trucks.map((truck) => ({ ...truck, position: validPosition(truck) })).filter((truck) => truck.position), [trucks]);
  const unmapped = trucks.length - mapped.length;
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("id-ID");
    if (!needle) return mapped;
    return mapped.filter((truck) => [truck.plateNumber, truck.brand, truck.model, truck.driverUser?.name].some((value) => String(value || "").toLocaleLowerCase("id-ID").includes(needle)));
  }, [mapped, query]);

  return (
    <main className="fleet-map-page google-map-page">
      <header className="fleet-map-head"><div><span>LIVE FLEET</span><h1>Peta Armada</h1><p>Posisi kendaraan terkini menggunakan Google Maps dan data GPS GOlacak.</p></div><button onClick={() => load()} disabled={loading}><FiRefreshCw /> {loading ? "Memuat…" : "Perbarui"}</button></header>
      <section className="fleet-map-stats"><article><FiTruck /><div><strong>{trucks.length}</strong><span>Total armada</span></div></article><article><FiMapPin /><div><strong>{mapped.length}</strong><span>Memiliki posisi GPS</span></div></article><article className={unmapped ? "warning" : ""}><FiAlertTriangle /><div><strong>{unmapped}</strong><span>Belum memiliki GPS</span></div></article></section>
      {error && <div className="fleet-map-error">{error}</div>}
      <section className="fleet-map-card google-map-card">
        <div className="fleet-map-toolbar"><div><h2>Lokasi Kendaraan</h2><p>Klik marker untuk melihat detail dan membuka navigasi.</p></div><label><FiSearch /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nomor polisi…" /></label></div>
        <div className="fleet-map-canvas">
          {GOOGLE_MAPS_API_KEY ? <GoogleFleetMap trucks={visible} onError={setMapError} /> : <div className="google-map-setup"><FiMapPin /><h3>Google Maps belum dikonfigurasi</h3><p>Tambahkan <code>VITE_GOOGLE_MAPS_API_KEY</code> pada environment frontend, lalu aktifkan Maps JavaScript API dan billing di Google Cloud.</p></div>}
          {mapError && <div className="fleet-map-error google-map-runtime-error">{mapError}</div>}
          {!loading && GOOGLE_MAPS_API_KEY && !visible.length && <div className="fleet-map-empty">Belum ada armada dengan koordinat GPS yang cocok.</div>}
        </div>
      </section>
    </main>
  );
}
