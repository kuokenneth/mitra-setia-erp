import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

// Kept beside the preview components because they share the protected-blob loader.
// eslint-disable-next-line react-refresh/only-export-components
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
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const drag = useRef(null);

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    Promise.resolve().then(() => {
      if (active) {
        setError(false);
        setSrc("");
      }
    });
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
  function closeViewer() {
    setOpen(false);
    setScale(1);
    setPosition({ x: 0, y: 0 });
    drag.current = null;
  }

  function zoom(nextScale) {
    const limited = Math.min(5, Math.max(1, nextScale));
    setScale(limited);
    if (limited === 1) setPosition({ x: 0, y: 0 });
  }

  const viewer = open && createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Pratinjau ${alt}`}
      onMouseDown={event => { event.stopPropagation(); if (event.target === event.currentTarget) closeViewer(); }}
      style={{ position: "fixed", inset: 0, zIndex: 10000, display: "grid", gridTemplateRows: "auto minmax(0,1fr)", background: "rgba(7,18,12,.92)", backdropFilter: "blur(8px)" }}
    >
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "12px 16px", color: "white", background: "rgba(10,25,16,.82)", borderBottom: "1px solid rgba(255,255,255,.14)" }}>
        <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>{alt}</strong>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" aria-label="Perkecil gambar" onClick={() => zoom(scale - .25)} disabled={scale <= 1} style={viewerButtonStyle}>−</button>
          <span style={{ minWidth: 52, textAlign: "center", fontSize: 12 }}>{Math.round(scale * 100)}%</span>
          <button type="button" aria-label="Perbesar gambar" onClick={() => zoom(scale + .25)} disabled={scale >= 5} style={viewerButtonStyle}>+</button>
          <button type="button" onClick={() => zoom(1)} style={{ ...viewerButtonStyle, width: "auto", padding: "0 12px", fontSize: 11 }}>Reset</button>
          <button type="button" aria-label="Tutup pratinjau" onClick={closeViewer} style={{ ...viewerButtonStyle, marginLeft: 6 }}>×</button>
        </div>
      </header>
      <div
        onWheel={event => { event.preventDefault(); zoom(scale + (event.deltaY < 0 ? .25 : -.25)); }}
        onPointerDown={event => { if (scale > 1) { event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX - position.x, y: event.clientY - position.y }; } }}
        onPointerMove={event => { if (drag.current) setPosition({ x: event.clientX - drag.current.x, y: event.clientY - drag.current.y }); }}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
        style={{ display: "grid", placeItems: "center", minHeight: 0, overflow: "hidden", cursor: scale > 1 ? "grab" : "zoom-in", touchAction: "none" }}
      >
        <img src={src} alt={alt} draggable="false" onDoubleClick={() => zoom(scale === 1 ? 2 : 1)} style={{ maxWidth: "calc(100vw - 32px)", maxHeight: "calc(100dvh - 88px)", objectFit: "contain", transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`, transformOrigin: "center", userSelect: "none" }} />
      </div>
    </div>,
    document.body
  );

  return <>
    <button type="button" aria-label={`Perbesar ${alt}`} onClick={event => { event.preventDefault(); event.stopPropagation(); setOpen(true); }} style={{ display: "block", padding: 0, overflow: "hidden", border: 0, background: "transparent", cursor: "zoom-in" }}><img src={src} alt={alt} style={style} /></button>
    {viewer}
  </>;
}

const viewerButtonStyle = { display: "grid", width: 36, height: 36, padding: 0, placeItems: "center", border: "1px solid rgba(255,255,255,.24)", borderRadius: 8, background: "rgba(255,255,255,.1)", color: "white", fontSize: 19, fontWeight: 700, cursor: "pointer" };

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
