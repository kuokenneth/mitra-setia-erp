import { useEffect, useMemo, useRef, useState } from "react";
import { FiEdit2, FiMapPin, FiPlus, FiRefreshCw, FiTrash2, FiX } from "react-icons/fi";
import { api } from "../api";
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_MAP_ID, loadGoogleMaps } from "../googleMaps";
import "./OperationalLocations.css";
import "./OperationalLocationsGoogle.css";

const MEDAN = { lat: 3.5952, lng: 98.6722 };
const EMPTY = { id: null, name: "", address: "", type: "OTHER", latitude: "", longitude: "", radiusM: 400, isActive: true };
const TYPE_LABELS = { BASE: "Base", CUSTOMER: "Customer", WAREHOUSE: "Gudang", PORT: "Pelabuhan", WARNING: "Area Warning", OTHER: "Lainnya" };

function GoogleLocationPicker({ position, radius, warning, onPick, onError }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const mapsRef = useRef(null);
  const placesRef = useRef(null);
  const sessionTokenRef = useRef(null);
  const searchRequestRef = useRef(0);
  const advancedMarkerRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const clickListenerRef = useRef(null);
  const onPickRef = useRef(onPick);
  const onErrorRef = useRef(onError);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);

  onPickRef.current = onPick;
  onErrorRef.current = onError;

  useEffect(() => {
    let active = true;
    loadGoogleMaps().then(async (maps) => {
      const [markerLibrary, placesLibrary] = await Promise.all([maps.importLibrary("marker"), maps.importLibrary("places")]);
      if (!active || !containerRef.current) return;
      const { AdvancedMarkerElement } = markerLibrary;
      const { AutocompleteSuggestion, AutocompleteSessionToken } = placesLibrary;
      if (!AdvancedMarkerElement || !AutocompleteSuggestion || !AutocompleteSessionToken) throw new Error("Places API (New) belum aktif pada API key ini");
      mapsRef.current = maps;
      placesRef.current = { AutocompleteSuggestion, AutocompleteSessionToken };
      sessionTokenRef.current = new AutocompleteSessionToken();
      advancedMarkerRef.current = AdvancedMarkerElement;
      mapRef.current = new maps.Map(containerRef.current, {
        center: position || MEDAN,
        zoom: position ? 16 : 12,
        mapId: GOOGLE_MAPS_MAP_ID,
        mapTypeControl: true,
        mapTypeControlOptions: { mapTypeIds: ["roadmap", "satellite", "hybrid"] },
        streetViewControl: false,
        fullscreenControl: true,
        gestureHandling: "greedy",
      });
      clickListenerRef.current = mapRef.current.addListener("click", (event) => {
        onPickRef.current({ lat: event.latLng.lat(), lng: event.latLng.lng() });
      });
      setReady(true);
    }).catch((error) => { if (active) onErrorRef.current(error.message); });

    return () => {
      active = false;
      clickListenerRef.current?.remove();
      if (markerRef.current) markerRef.current.map = null;
      circleRef.current?.setMap(null);
    };
  }, []);

  useEffect(() => {
    const input = query.trim();
    const requestId = ++searchRequestRef.current;
    if (!ready || input.length < 3 || !placesRef.current) {
      setSuggestions([]);
      setSearching(false);
      return undefined;
    }
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const { suggestions: results = [] } = await placesRef.current.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input,
          includedRegionCodes: ["id"],
          sessionToken: sessionTokenRef.current,
        });
        if (requestId !== searchRequestRef.current) return;
        setSuggestions(results.map((result) => result.placePrediction).filter(Boolean));
        onErrorRef.current("");
      } catch (error) {
        if (requestId !== searchRequestRef.current) return;
        setSuggestions([]);
        onErrorRef.current(error.message || "Pencarian Google Places gagal. Pastikan Places API (New) sudah aktif.");
      } finally {
        if (requestId === searchRequestRef.current) setSearching(false);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query, ready]);

  async function selectSuggestion(prediction) {
    try {
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ["displayName", "formattedAddress", "location"] });
      const point = place.location;
      if (!point) throw new Error("Koordinat lokasi tidak tersedia");
      setQuery(place.displayName || place.formattedAddress || prediction.text?.toString() || "");
      setSuggestions([]);
      sessionTokenRef.current = new placesRef.current.AutocompleteSessionToken();
      onErrorRef.current("");
      onPickRef.current({ lat: point.lat(), lng: point.lng() });
      mapRef.current.setCenter(point);
      mapRef.current.setZoom(16);
    } catch (error) {
      onErrorRef.current(error.message || "Lokasi tidak dapat dipilih");
    }
  }

  useEffect(() => {
    if (!ready || !mapRef.current || !mapsRef.current) return;
    const maps = mapsRef.current;
    if (!position) {
      if (markerRef.current) markerRef.current.map = null;
      circleRef.current?.setMap(null);
      return;
    }

    const color = warning ? "#dc2626" : "#0d7c3d";
    if (!markerRef.current) {
      const marker = document.createElement("div");
      marker.className = "google-location-pin";
      markerRef.current = new advancedMarkerRef.current({
        map: mapRef.current,
        position,
        title: "Titik lokasi",
        content: marker,
      });
    } else {
      markerRef.current.map = mapRef.current;
      markerRef.current.position = position;
    }
    markerRef.current.content.style.setProperty("--location-color", color);

    if (!circleRef.current) {
      circleRef.current = new maps.Circle({ map: mapRef.current });
    }
    circleRef.current.setOptions({
      map: mapRef.current,
      center: position,
      radius: Number(radius) || 400,
      strokeColor: color,
      strokeOpacity: .9,
      strokeWeight: 2,
      fillColor: color,
      fillOpacity: .12,
    });
    mapRef.current.panTo(position);
    if (mapRef.current.getZoom() < 14) mapRef.current.setZoom(16);
  }, [position, radius, warning, ready]);

  return <><label className="google-location-search-label">Cari lokasi<div className="google-location-search"><FiMapPin /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ketik minimal 3 huruf…" autoComplete="off" />{searching && <span className="google-location-searching">Mencari…</span>}</div>{suggestions.length > 0 && <div className="google-location-suggestions">{suggestions.map((prediction, index) => <button type="button" key={prediction.placeId || index} onClick={() => selectSuggestion(prediction)}><FiMapPin /><span>{prediction.text?.toString() || prediction.text?.text || "Lokasi"}</span></button>)}</div>}</label><div className="location-picker-map"><div ref={containerRef} className="google-location-map" /></div></>;
}

export default function OperationalLocations() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const result = await api("/operational-locations");
      setItems(result.items || []);
      setError("");
    } catch (err) {
      setError(err.message || "Gagal memuat master lokasi");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const selectedPosition = useMemo(() => {
    const lat = Number(form.latitude);
    const lng = Number(form.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && form.latitude !== "" && form.longitude !== "" ? { lat, lng } : null;
  }, [form.latitude, form.longitude]);
  const isWarning = form.type === "WARNING";

  function edit(item) {
    setForm({ ...item, address: item.address || "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(event) {
    event.preventDefault();
    if (!selectedPosition) return setError("Masukkan koordinat yang valid atau pilih titik pada peta terlebih dahulu");
    setSaving(true);
    try {
      await api(form.id ? `/operational-locations/${form.id}` : "/operational-locations", {
        method: form.id ? "PUT" : "POST",
        body: JSON.stringify(form),
      });
      setForm(EMPTY);
      await load();
    } catch (err) { setError(err.message || "Gagal menyimpan lokasi"); }
    finally { setSaving(false); }
  }

  async function remove(item) {
    if (!window.confirm(`Hapus lokasi “${item.name}”?`)) return;
    try {
      await api(`/operational-locations/${item.id}`, { method: "DELETE" });
      if (form.id === item.id) setForm(EMPTY);
      await load();
    } catch (err) { setError(err.message || "Gagal menghapus lokasi"); }
  }

  return (
    <main className="location-master-page">
      <header className="location-master-head">
        <div><span>OPERASIONAL</span><h1>Master Lokasi</h1><p>Simpan titik yang sering dikunjungi agar GPS armada menampilkan nama tempat.</p></div>
        <button onClick={load} disabled={loading}><FiRefreshCw /> Perbarui</button>
      </header>
      {error && <div className="location-master-error">{error}<button onClick={() => setError("")}><FiX /></button></div>}

      <div className="location-master-grid">
        <section className="location-editor-card">
          <div className="location-card-title"><div><h2>{form.id ? "Ubah Lokasi" : "Tambah Lokasi"}</h2><p>Masukkan koordinat atau klik langsung pada peta.</p></div>{form.id && <button onClick={() => setForm(EMPTY)}><FiPlus /> Baru</button>}</div>
          <form onSubmit={save}>
            <div className="location-form-row"><label>Nama lokasi<input required value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} placeholder="Contoh: Base Medan" /></label><label>Jenis<select value={form.type} onChange={(e) => setForm((v) => ({ ...v, type: e.target.value }))}>{Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
            <label>Alamat / keterangan<input value={form.address} onChange={(e) => setForm((v) => ({ ...v, address: e.target.value }))} placeholder="Contoh: Jl. Cemara No. 40" /></label>
            <div className="location-form-row three"><label>Latitude<input type="number" step="any" min="-90" max="90" required value={form.latitude} onChange={(e) => setForm((v) => ({ ...v, latitude: e.target.value }))} placeholder="Contoh: 3.595200" /></label><label>Longitude<input type="number" step="any" min="-180" max="180" required value={form.longitude} onChange={(e) => setForm((v) => ({ ...v, longitude: e.target.value }))} placeholder="Contoh: 98.672200" /></label><label>Radius (meter)<input type="number" min="50" max="5000" required value={form.radiusM} onChange={(e) => setForm((v) => ({ ...v, radiusM: e.target.value }))} /></label></div>
            {GOOGLE_MAPS_API_KEY ? <GoogleLocationPicker position={selectedPosition} radius={form.radiusM} warning={isWarning} onPick={({ lat, lng }) => setForm((v) => ({ ...v, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }))} onError={(message) => setError(message)} /> : <><label className="google-location-search-label">Cari lokasi<div className="google-location-search disabled"><FiMapPin /><input disabled placeholder="Google Maps belum dikonfigurasi" /></div></label><div className="location-picker-map"><div className="location-google-setup"><FiMapPin /><strong>Google Maps belum dikonfigurasi</strong><span>Tambahkan VITE_GOOGLE_MAPS_API_KEY pada environment frontend.</span></div></div></>}
            <label className="location-active"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm((v) => ({ ...v, isActive: e.target.checked }))} /> Lokasi aktif untuk pencocokan GPS</label>
            <button className="location-save" disabled={saving}>{saving ? "Menyimpan…" : form.id ? "Simpan Perubahan" : "Tambah Lokasi"}</button>
          </form>
        </section>

        <section className="location-list-card">
          <div className="location-card-title"><div><h2>Lokasi Tersimpan</h2><p>{items.length} lokasi tersedia.</p></div></div>
          <div className="location-list">
            {items.map((item) => <article key={item.id} className={!item.isActive ? "inactive" : ""} style={item.type === "WARNING" ? { background: "#fff7f7", borderLeft: "4px solid #dc2626", paddingLeft: 12 } : undefined}>
              <div className="location-pin" style={item.type === "WARNING" ? { background: "#fee2e2", color: "#dc2626" } : undefined}><FiMapPin /></div><div className="location-info"><div><strong>{item.name}</strong><span style={item.type === "WARNING" ? { background: "#fee2e2", color: "#b91c1c" } : undefined}>{TYPE_LABELS[item.type] || item.type}</span></div><p>{item.address || `${item.latitude.toFixed(6)}, ${item.longitude.toFixed(6)}`}</p><small>Radius {item.radiusM} m · {item.isActive ? "Aktif" : "Nonaktif"}</small></div>
              <div className="location-actions"><button title="Ubah" onClick={() => edit(item)}><FiEdit2 /></button><button className="danger" title="Hapus" onClick={() => remove(item)}><FiTrash2 /></button></div>
            </article>)}
            {!loading && !items.length && <div className="location-empty">Belum ada master lokasi. Pilih titik pada peta untuk menambahkan lokasi pertama.</div>}
          </div>
        </section>
      </div>
    </main>
  );
}
