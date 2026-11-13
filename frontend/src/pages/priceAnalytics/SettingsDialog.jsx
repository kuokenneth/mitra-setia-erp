import { useState } from "react";
import { api } from "../../api";
import { Dialog } from "./ui";
import { dateLabel } from "./format";

const FIELDS = [
  { key: "mildPct", label: "Peringatan ringan", suffix: "%", help: "Harga lebih tinggi dari referensi melebihi nilai ini.", step: "0.5" },
  { key: "strongPct", label: "Peringatan kuat", suffix: "%", step: "0.5" },
  { key: "highPct", label: "Peringatan harga tinggi", suffix: "%", step: "0.5" },
  { key: "lookbackDays", label: "Periode pembanding", suffix: "hari", help: "Pembelian dalam periode ini dipakai sebagai referensi dan pembanding penghematan.", step: "1" },
  { key: "minTransactions", label: "Minimal transaksi", suffix: "pembelian", help: "Di bawah jumlah ini, harga referensi tidak ditentukan.", step: "1" },
];

export default function SettingsDialog({ settings, onClose, onSaved }) {
  const [form, setForm] = useState(() => Object.fromEntries(FIELDS.map((f) => [f.key, String(settings[f.key] ?? "")])));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = Object.fromEntries(FIELDS.map((f) => [f.key, Number(form[f.key])]));
      const result = await api("/price-analytics/settings", { method: "PUT", body: JSON.stringify(body) });
      onSaved(result.settings);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open title="Pengaturan peringatan harga" subtitle="Berlaku untuk peringatan di menu Pembelian dan perhitungan di halaman ini" onClose={onClose}
      footer={<>
        <button type="button" className="pa-btn" onClick={onClose}>Batal</button>
        <button type="submit" form="pa-settings-form" className="pa-btn primary" disabled={busy}>{busy ? "Menyimpan…" : "Simpan pengaturan"}</button>
      </>}>
      <form id="pa-settings-form" className="pa-settings" onSubmit={save}>
        {FIELDS.map((field) => (
          <label key={field.key} className="pa-settings-row">
            <span><b>{field.label}</b>{field.help && <small>{field.help}</small>}</span>
            <span className="pa-input-suffix">
              <input type="number" inputMode="decimal" min="0" step={field.step} required value={form[field.key]} onChange={(event) => setForm((f) => ({ ...f, [field.key]: event.target.value }))} />
              <em>{field.suffix}</em>
            </span>
          </label>
        ))}
        <p className="pa-fineprint">Peringatan tidak pernah memblokir penyimpanan PO, penerimaan, atau invoice — hanya membantu tim pembelian meninjau harga.</p>
        {settings.stored && settings.updatedByName && <p className="pa-fineprint">Terakhir diubah oleh {settings.updatedByName}, {dateLabel(settings.updatedAt)}.</p>}
        {error && <p className="pa-form-error" role="alert">{error}</p>}
      </form>
    </Dialog>
  );
}
