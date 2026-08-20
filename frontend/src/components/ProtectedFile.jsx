import { useEffect, useState } from "react";
import { API_BASE, apiAssetUrl, getAccessToken } from "../api";

async function fetchProtectedBlob(value) {
  const url = apiAssetUrl(value);
  const token = getAccessToken();
  const response = await fetch(url, {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error(`File tidak dapat dibuka (${response.status})`);
  return response.blob();
}

export async function openProtectedFile(value) {
  const url = apiAssetUrl(value);
  if (/^https?:\/\//i.test(url) && !url.startsWith(API_BASE)) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  const popup = window.open("", "_blank");
  try {
    const blob = await fetchProtectedBlob(value);
    const objectUrl = URL.createObjectURL(blob);
    if (popup) popup.location.href = objectUrl;
    else window.open(objectUrl, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (error) {
    popup?.close();
    throw error;
  }
}

export function ProtectedImage({ url, alt, style }) {
  const [src, setSrc] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    setError(false);
    fetchProtectedBlob(url)
      .then((blob) => {
        if (!blob.type.startsWith("image/")) throw new Error("File bukan gambar");
        objectUrl = URL.createObjectURL(blob);
        if (active) setSrc(objectUrl);
      })
      .catch(() => active && setError(true));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  if (error) return <div style={{ ...style, display: "grid", placeItems: "center", color: "#6B7280", fontSize: 12 }}>Preview tidak tersedia</div>;
  if (!src) return <div style={{ ...style, display: "grid", placeItems: "center", color: "#6B7280", fontSize: 12 }}>Memuat...</div>;
  return <a href={src} target="_blank" rel="noreferrer" style={{ display: "block" }}><img src={src} alt={alt} style={style} /></a>;
}

export function ProtectedFilePreview({ url, mimeType, fileName = "Lampiran", imageStyle, onError }) {
  const isPdf = String(mimeType || "").toLowerCase().includes("pdf") || String(url || "").toLowerCase().includes(".pdf");
  if (!isPdf) {
    return <ProtectedImage url={url} alt={fileName} style={imageStyle || { width: 160, height: 100, objectFit: "cover", borderRadius: 8 }} />;
  }
  return (
    <button
      type="button"
      onClick={() => openProtectedFile(url).catch((error) => onError?.(error))}
      style={{ minHeight: 58, padding: "10px 14px", borderRadius: 8, border: "1px solid #D4E8DC", background: "#F5F9F7", color: "#0D7C3D", fontWeight: 700, cursor: "pointer" }}
    >
      PDF · {fileName}
    </button>
  );
}
