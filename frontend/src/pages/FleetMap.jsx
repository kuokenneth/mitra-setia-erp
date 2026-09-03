import { useEffect, useMemo, useRef, useState } from "react";
import { FiActivity, FiAlertTriangle, FiChevronRight, FiMapPin, FiNavigation, FiRefreshCw, FiSearch, FiTruck } from "react-icons/fi";
import { api } from "../api";
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_MAP_ID, loadGoogleMaps } from "../googleMaps";
import { useLiveRefresh } from "../liveUpdates";
import LoadingState from "../components/LoadingState";
import "./FleetMap.css";
import "./FleetMapGoogle.css";
import "./FleetMapRedesign.css";
import "./FleetMapToolbarFix.css";

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
  if (truck.status === "PLANNED") return "#6366f1";
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

function GoogleFleetMap({ trucks, focusTruckId, onError }) {
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
      markersRef.current.forEach(({ marker }) => { marker.map = null; });
      markersRef.current = [];
      const bounds = new maps.LatLngBounds();
      trucks.forEach((truck) => {
        const marker = new maps.marker.AdvancedMarkerElement({ map: mapRef.current, position: truck.position, title: truck.plateNumber, content: markerElement(truck) });
        marker.addListener("click", () => {
          infoWindowRef.current.setContent(popupContent(truck));
          infoWindowRef.current.open({ map: mapRef.current, anchor: marker });
        });
        markersRef.current.push({ truck, marker });
        bounds.extend(truck.position);
      });
      if (trucks.length === 1) {
        mapRef.current.setCenter(trucks[0].position);
        mapRef.current.setZoom(15);
      } else if (trucks.length > 1) mapRef.current.fitBounds(bounds, 55);
      const focused = markersRef.current.find(({ truck }) => truck.id === focusTruckId);
      if (focused) {
        mapRef.current.panTo(focused.truck.position);
        mapRef.current.setZoom(16);
        infoWindowRef.current.setContent(popupContent(focused.truck));
        infoWindowRef.current.open({ map: mapRef.current, anchor: focused.marker });
      }
    }).catch((error) => { if (active) onError(error.message); });
    return () => { active = false; };
  }, [trucks, focusTruckId, onError]);

  return <div ref={containerRef} className="fleet-google-map" />;
}

export default function FleetMap() {
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mapError, setMapError] = useState("");
  const [query, setQuery] = useState("");
  const [mapFilter, setMapFilter] = useState("ALL");
  const [focusTruckId, setFocusTruckId] = useState(null);

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
  const searched = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("id-ID");
    if (!needle) return mapped;
    return mapped.filter((truck) => [truck.plateNumber, truck.brand, truck.model, truck.driverUser?.name].some((value) => String(value || "").toLocaleLowerCase("id-ID").includes(needle)));
  }, [mapped, query]);
  const movingAll = useMemo(() => mapped.filter((truck) => truck.status === "DISPATCH" || Number(truck.lastGpsSpeed || 0) > 5), [mapped]);
  const attentionAll = useMemo(() => mapped.filter((truck) => truck.gpsStopWarning || truck.gpsLocation?.type === "WARNING" || truck.status === "MAINTENANCE"), [mapped]);
  const visible = useMemo(() => searched.filter((truck) => mapFilter === "MOVING" ? (truck.status === "DISPATCH" || Number(truck.lastGpsSpeed || 0) > 5) : mapFilter === "ATTENTION" ? (truck.gpsStopWarning || truck.gpsLocation?.type === "WARNING" || truck.status === "MAINTENANCE") : true), [searched, mapFilter]);
  const moving = useMemo(() => visible.filter((truck) => truck.status === "DISPATCH" || Number(truck.lastGpsSpeed || 0) > 5).sort((a, b) => Number(b.lastGpsSpeed || 0) - Number(a.lastGpsSpeed || 0)), [visible]);

  return (
    <main className="fleet-map-page google-map-page">
      <header className="fleet-map-head"><div><span>LIVE FLEET CONTROL</span><h1>Peta Armada</h1><p>Pantau posisi, pergerakan, dan perhatian GPS seluruh armada dalam satu layar.</p></div><button onClick={() => load()} disabled={loading}><FiRefreshCw className={loading ? "spin" : ""}/> {loading ? "Memuat…" : "Sinkronkan GPS"}</button></header>
      <section className="fleet-map-stats"><article><FiTruck /><div><small>TOTAL ARMADA</small><strong>{trucks.length}</strong><span>Terdaftar</span></div></article><article><FiMapPin /><div><small>TERHUBUNG GPS</small><strong>{mapped.length}</strong><span>Memiliki koordinat</span></div></article><article><FiNavigation /><div><small>SEDANG JALAN</small><strong>{movingAll.length}</strong><span>Dispatch / bergerak</span></div></article><article className={attentionAll.length ? "warning" : ""}><FiAlertTriangle /><div><small>PERLU PERHATIAN</small><strong>{attentionAll.length + unmapped}</strong><span>{unmapped} tanpa GPS</span></div></article></section>
      {error && <div className="fleet-map-error">{error}</div>}
      <section className="fleet-map-card google-map-card">
        <div className="fleet-map-toolbar"><div><h2>Live Position</h2><p>{visible.length} armada ditampilkan · pembaruan setiap 1 menit</p></div><div className="fleet-map-filters"><button className={mapFilter === "ALL" ? "active" : ""} onClick={() => setMapFilter("ALL")}><FiTruck/> Semua</button><button className={mapFilter === "MOVING" ? "active" : ""} onClick={() => setMapFilter("MOVING")}><FiNavigation/> Bergerak</button><button className={mapFilter === "ATTENTION" ? "attention active" : "attention"} onClick={() => setMapFilter("ATTENTION")}><FiActivity/> Perhatian</button></div><label><FiSearch /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari BK, pengemudi…" /></label></div>
        <div className="fleet-map-canvas">
          {loading && <LoadingState variant="overlay" label="Menyiapkan peta armada" note="Menyinkronkan posisi GPS terbaru…" />}
          {GOOGLE_MAPS_API_KEY ? <GoogleFleetMap trucks={visible} focusTruckId={focusTruckId} onError={setMapError} /> : <div className="google-map-setup"><FiMapPin /><h3>Google Maps belum dikonfigurasi</h3><p>Tambahkan <code>VITE_GOOGLE_MAPS_API_KEY</code> pada environment frontend, lalu aktifkan Maps JavaScript API dan billing di Google Cloud.</p></div>}
          {!loading && GOOGLE_MAPS_API_KEY && moving.length > 0 && <aside className="moving-fleet-panel"><header><span><FiNavigation /></span><div><strong>Armada Bergerak</strong><small>{moving.length} kendaraan terdeteksi jalan</small></div></header><div className="moving-fleet-list">{moving.map((truck) => <button type="button" key={truck.id} className={focusTruckId === truck.id ? "active" : ""} onClick={() => setFocusTruckId(truck.id)}><i /><span><strong>{truck.plateNumber}</strong><small>{truck.gpsLocation?.name || "Dalam perjalanan"}</small></span><b>{Number(truck.lastGpsSpeed || 0).toFixed(0)}<small>km/j</small></b><FiChevronRight /></button>)}</div></aside>}
          {mapError && <div className="fleet-map-error google-map-runtime-error">{mapError}</div>}
          {!loading && GOOGLE_MAPS_API_KEY && !visible.length && <div className="fleet-map-empty">Belum ada armada dengan koordinat GPS yang cocok.</div>}
        </div>
      </section>
    </main>
  );
}
