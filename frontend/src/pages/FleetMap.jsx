import { useEffect, useMemo, useState } from "react";
import { LayersControl, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { FiMapPin, FiRefreshCw, FiSearch, FiTruck } from "react-icons/fi";
import { api } from "../api";
import { useLiveRefresh } from "../liveUpdates";
import "leaflet/dist/leaflet.css";
import "./FleetMap.css";

const DEFAULT_CENTER = [2.4, 99.3];

function validPosition(truck) {
  if (truck.lastGpsLatitude == null || truck.lastGpsLongitude == null) return null;
  const lat = Number(truck.lastGpsLatitude);
  const lng = Number(truck.lastGpsLongitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180 || (lat === 0 && lng === 0)) return null;
  return [lat, lng];
}

function markerIcon(status) {
  const tone = status === "DISPATCH" ? "#d97706" : status === "MAINTENANCE" ? "#dc2626" : "#0d7c3d";
  return L.divIcon({
    className: "fleet-marker-shell",
    html: `<span class="fleet-dot-marker" style="--marker-color:${tone}"><i></i></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
  });
}

function FitFleet({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (!positions.length) return;
    if (positions.length === 1) map.setView(positions[0], 14);
    else map.fitBounds(positions, { padding: [45, 45], maxZoom: 14 });
  }, [map, positions]);
  return null;
}

export default function FleetMap() {
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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

  const mapped = useMemo(() => trucks
    .map((truck) => ({ ...truck, position: validPosition(truck) }))
    .filter((truck) => truck.position), [trucks]);
  const unmapped = trucks.length - mapped.length;
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("id-ID");
    if (!needle) return mapped;
    return mapped.filter((truck) => [truck.plateNumber, truck.brand, truck.model, truck.driverUser?.name]
      .some((value) => String(value || "").toLocaleLowerCase("id-ID").includes(needle)));
  }, [mapped, query]);
  const positions = useMemo(() => visible.map((truck) => truck.position), [visible]);

  return (
    <main className="fleet-map-page">
      <header className="fleet-map-head">
        <div><span>OPERASIONAL</span><h1>Peta Armada</h1><p>Posisi terakhir kendaraan berdasarkan koordinat GPS GOlacak.</p></div>
        <button onClick={() => load()} disabled={loading}><FiRefreshCw /> {loading ? "Memuat…" : "Perbarui"}</button>
      </header>

      <section className="fleet-map-stats">
        <article><FiTruck /><div><strong>{trucks.length}</strong><span>Total armada</span></div></article>
        <article><FiMapPin /><div><strong>{mapped.length}</strong><span>Memiliki posisi GPS</span></div></article>
        <article className={unmapped ? "warning" : ""}><FiMapPin /><div><strong>{unmapped}</strong><span>Belum memiliki GPS</span></div></article>
      </section>

      {error && <div className="fleet-map-error">{error}</div>}

      <section className="fleet-map-card">
        <div className="fleet-map-toolbar">
          <div><h2>Lokasi Kendaraan</h2><p>Klik marker untuk melihat detail kendaraan.</p></div>
          <label><FiSearch /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nomor polisi…" /></label>
        </div>

        <div className="fleet-map-canvas">
          <MapContainer center={DEFAULT_CENTER} zoom={7} maxZoom={20} scrollWheelZoom className="fleet-leaflet-map">
            <LayersControl position="topright">
              <LayersControl.BaseLayer checked name="Peta Jalan Detail">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
                  url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                  detectRetina
                  maxNativeZoom={19}
                  maxZoom={20}
                />
              </LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="Satelit">
                <TileLayer
                  attribution="Tiles &copy; Esri"
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  maxZoom={20}
                />
              </LayersControl.BaseLayer>
            </LayersControl>
            <FitFleet positions={positions} />
            {visible.map((truck) => (
              <Marker key={truck.id} position={truck.position} icon={markerIcon(truck.status)}>
                <Popup>
                  <div className="fleet-map-popup">
                    <strong>{truck.plateNumber}</strong>
                    <span>{[truck.brand, truck.model].filter(Boolean).join(" ") || "Kendaraan"}</span>
                    <dl>
                      <div><dt>Status</dt><dd>{truck.status || "-"}</dd></div>
                      <div><dt>Kecepatan</dt><dd>{truck.lastGpsSpeed == null ? "-" : `${Number(truck.lastGpsSpeed).toFixed(0)} km/jam`}</dd></div>
                      <div><dt>Koordinat</dt><dd>{truck.position[0].toFixed(6)}, {truck.position[1].toFixed(6)}</dd></div>
                      <div><dt>Pengemudi</dt><dd>{truck.driverUser?.name || "Belum ditugaskan"}</dd></div>
                    </dl>
                    <a href={`https://www.google.com/maps?q=${truck.position.join(",")}`} target="_blank" rel="noreferrer">Buka di Google Maps</a>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
          {!loading && !visible.length && <div className="fleet-map-empty">Belum ada armada dengan koordinat GPS yang cocok.</div>}
        </div>
      </section>
    </main>
  );
}
