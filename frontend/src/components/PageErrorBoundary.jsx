import React from "react";
import { FiAlertTriangle, FiRefreshCw } from "react-icons/fi";

export default class PageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Page render failed", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <section style={{ maxWidth: 760, margin: "48px auto", padding: 28, border: "1px solid #ead8ce", borderRadius: 16, background: "#fffaf7", color: "#26362c", textAlign: "center" }}>
      <FiAlertTriangle style={{ width: 24, height: 24, padding: 12, borderRadius: 12, background: "#f8e9df", color: "#a85d38" }} />
      <h2 style={{ margin: "14px 0 7px" }}>Halaman belum dapat ditampilkan</h2>
      <p style={{ margin: "0 auto 18px", maxWidth: 520, color: "#748078", fontSize: 13 }}>Ada data yang gagal dirender. Muat ulang halaman untuk mengambil versi dan data operasional terbaru.</p>
      <button type="button" onClick={() => window.location.reload()} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 15px", border: 0, borderRadius: 9, background: "#168348", color: "white", fontWeight: 800, cursor: "pointer" }}><FiRefreshCw /> Muat ulang halaman</button>
      {import.meta.env.DEV && <pre style={{ marginTop: 18, padding: 12, overflow: "auto", borderRadius: 8, background: "#fff", color: "#a3432e", fontSize: 10, textAlign: "left" }}>{`${this.state.error?.name || "Error"}: ${this.state.error?.message || "Unknown render error"}\n${this.state.error?.stack || ""}`}</pre>}
    </section>;
  }
}
