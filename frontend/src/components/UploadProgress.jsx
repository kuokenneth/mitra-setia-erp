import "./UploadProgress.css";

export default function UploadProgress({ progress, label = "Mengunggah foto" }) {
  if (progress == null) return null;
  const value = Math.max(0, Math.min(100, Number(progress) || 0));
  return <div className="upload-progress" role="progressbar" aria-label={label} aria-valuemin="0" aria-valuemax="100" aria-valuenow={value}>
    <div><strong>{value < 100 ? label : "Upload selesai"}</strong><span>{value}%</span></div>
    <i><b style={{ width: `${value}%` }} /></i>
    <small>{value < 100 ? "Mohon jangan tutup halaman sampai foto selesai dikirim." : "Menyimpan data pengajuan…"}</small>
  </div>;
}
