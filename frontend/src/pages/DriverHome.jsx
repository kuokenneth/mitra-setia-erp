export default function DriverHome() {
  return (
    <div style={card}>
      <h2 style={h2}>Beranda Pengemudi</h2>
      <p style={p}>Selamat datang. Perjalanan yang ditugaskan kepada Anda akan tampil di sini.</p>
    </div>
  );
}
const card = { background: "#fff", border: "1px solid #d6f5e7", borderRadius: 16, padding: 16, boxShadow: "0 16px 30px rgba(0,0,0,0.06)" };
const h2 = { margin: 0, color: "#1d2a48" };
const p = { marginTop: 8, color: "#0f6d41" };
