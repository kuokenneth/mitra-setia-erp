import { useEffect, useMemo, useState } from "react";
import { Circle, CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { FiEdit2, FiMapPin, FiPlus, FiRefreshCw, FiTrash2, FiX } from "react-icons/fi";
import { api } from "../api";
import "leaflet/dist/leaflet.css";
import "./OperationalLocations.css";

const MEDAN = [3.5952, 98.6722];
const EMPTY = { id: null, name: "", address: "", type: "OTHER", latitude: "", longitude: "", radiusM: 400, isActive: true };
const TYPE_LABELS = { BASE: "Base", CUSTOMER: "Customer", WAREHOUSE: "Gudang", PORT: "Pelabuhan", OTHER: "Lainnya" };

function PointPicker({ onPick }) {
  useMapEvents({ click: (event) => onPick(event.latlng) });
  return null;
}

function MoveMap({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, 16, { duration: .8 });
  }, [map, position]);
  return null;
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
    return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && form.latitude !== "" && form.longitude !== "" ? [lat, lng] : null;
  }, [form.latitude, form.longitude]);

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
            <label className="location-active"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm((v) => ({ ...v, isActive: e.target.checked }))} /> Lokasi aktif untuk pencocokan GPS</label>
            <div className="location-picker-map">
              <MapContainer center={selectedPosition || MEDAN} zoom={selectedPosition ? 15 : 12} maxZoom={20} scrollWheelZoom>
                <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" detectRetina maxNativeZoom={19} maxZoom={20} />
                <PointPicker onPick={({ lat, lng }) => setForm((v) => ({ ...v, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }))} />
                <MoveMap position={selectedPosition} />
                {selectedPosition && <><Circle center={selectedPosition} radius={Number(form.radiusM) || 400} pathOptions={{ color: "#0d7c3d", fillColor: "#10a050", fillOpacity: .12 }} /><CircleMarker center={selectedPosition} radius={7} pathOptions={{ color: "white", weight: 3, fillColor: "#0d7c3d", fillOpacity: 1 }} /></>}
              </MapContainer>
            </div>
            <button className="location-save" disabled={saving}>{saving ? "Menyimpan…" : form.id ? "Simpan Perubahan" : "Tambah Lokasi"}</button>
          </form>
        </section>

        <section className="location-list-card">
          <div className="location-card-title"><div><h2>Lokasi Tersimpan</h2><p>{items.length} lokasi tersedia.</p></div></div>
          <div className="location-list">
            {items.map((item) => <article key={item.id} className={!item.isActive ? "inactive" : ""}>
              <div className="location-pin"><FiMapPin /></div><div className="location-info"><div><strong>{item.name}</strong><span>{TYPE_LABELS[item.type] || item.type}</span></div><p>{item.address || `${item.latitude.toFixed(6)}, ${item.longitude.toFixed(6)}`}</p><small>Radius {item.radiusM} m · {item.isActive ? "Aktif" : "Nonaktif"}</small></div>
              <div className="location-actions"><button title="Ubah" onClick={() => edit(item)}><FiEdit2 /></button><button className="danger" title="Hapus" onClick={() => remove(item)}><FiTrash2 /></button></div>
            </article>)}
            {!loading && !items.length && <div className="location-empty">Belum ada master lokasi. Pilih titik pada peta untuk menambahkan lokasi pertama.</div>}
          </div>
        </section>
      </div>
    </main>
  );
}
