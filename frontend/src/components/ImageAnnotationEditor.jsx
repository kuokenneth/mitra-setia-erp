import { useEffect, useRef, useState } from "react";
import "./ImageAnnotationEditor.css";

const MAX_CANVAS_EDGE = 1800;

function pointOnCanvas(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height),
  };
}

export default function ImageAnnotationEditor({ file, open, onClose, onSave }) {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const drawingRef = useRef(false);
  const [strokes, setStrokes] = useState([]);
  const [activeStroke, setActiveStroke] = useState([]);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !file) return undefined;
    setStrokes([]);
    setActiveStroke([]);
    setReady(false);
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, MAX_CANVAS_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      imageRef.current = image;
      setReady(true);
    };
    image.onerror = () => setReady(false);
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file, open]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!ready || !canvas || !image) return;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const drawStroke = (points) => {
      if (!points.length) return;
      context.save();
      context.strokeStyle = "#ef2d2d";
      context.lineWidth = Math.max(5, Math.round(Math.max(canvas.width, canvas.height) * 0.006));
      context.lineCap = "round";
      context.lineJoin = "round";
      context.shadowColor = "rgba(255,255,255,.9)";
      context.shadowBlur = 2;
      context.beginPath();
      context.moveTo(points[0].x, points[0].y);
      points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
      context.stroke();
      context.restore();
    };
    strokes.forEach(drawStroke);
    drawStroke(activeStroke);
  }, [strokes, activeStroke, ready]);

  function beginMark(event) {
    if (!ready) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointOnCanvas(event, event.currentTarget);
    drawingRef.current = true;
    setActiveStroke([point]);
  }

  function moveMark(event) {
    if (!drawingRef.current) return;
    const point = pointOnCanvas(event, event.currentTarget);
    setActiveStroke((current) => [...current, point]);
  }

  function finishMark() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (activeStroke.length > 1) setStrokes((saved) => [...saved, activeStroke]);
    setActiveStroke([]);
  }

  async function saveImage() {
    const canvas = canvasRef.current;
    if (!canvas || !ready) return;
    setSaving(true);
    try {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (!blob) throw new Error("Foto anotasi tidak dapat dibuat");
      const baseName = String(file.name || "bukti-kerusakan").replace(/\.[^.]+$/, "");
      onSave(new File([blob], `${baseName}-ditandai.jpg`, { type: "image/jpeg", lastModified: Date.now() }));
    } finally {
      setSaving(false);
    }
  }

  if (!open || !file) return null;
  return <div className="image-annotator-overlay" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="image-annotator-dialog" role="dialog" aria-modal="true" aria-label="Tandai kerusakan pada foto">
      <header><div><span>TANDAI BUKTI KERUSAKAN</span><h3>Gambar pada bagian yang bermasalah</h3><p>Gunakan jari atau stylus untuk mencoret, menggarisbawahi, atau melingkari area kerusakan.</p></div><button type="button" onClick={onClose}>Tutup</button></header>
      <div className="image-annotator-stage"><canvas ref={canvasRef} onPointerDown={beginMark} onPointerMove={moveMark} onPointerUp={finishMark} onPointerCancel={finishMark} /></div>
      <footer><div><button type="button" disabled={!strokes.length || saving} onClick={() => setStrokes((current) => current.slice(0, -1))}>Urungkan</button><button type="button" disabled={!strokes.length || saving} onClick={() => setStrokes([])}>Hapus semua</button></div><button className="image-annotator-save" type="button" disabled={!ready || saving} onClick={saveImage}>{saving ? "Menyimpan..." : strokes.length ? "Simpan Foto Bertanda" : "Gunakan Tanpa Tanda"}</button></footer>
    </section>
  </div>;
}
