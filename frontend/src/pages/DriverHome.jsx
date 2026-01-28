export default function DriverHome() {
  return (
    <div style={card}>
      <h2 style={h2}>Driver Home</h2>
      <p style={p}>Welcome driver. Here you’ll see assigned trips.</p>
    </div>
  );
}
const card = { background: "#fff", border: "1px solid #d1fae5", borderRadius: 16, padding: 16, boxShadow: "0 16px 30px rgba(0,0,0,0.06)" };
const h2 = { margin: 0, color: "#065f46" };
const p = { marginTop: 8, color: "#047857" };
