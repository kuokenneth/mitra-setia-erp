export default function DriverJobs() {
  return (
    <div style={card}>
      <h2 style={h2}>My Jobs</h2>
      <p style={p}>List of delivery jobs assigned to you (coming next).</p>
    </div>
  );
}
const card = { background: "#fff", border: "1px solid #d1fae5", borderRadius: 16, padding: 16, boxShadow: "0 16px 30px rgba(0,0,0,0.06)" };
const h2 = { margin: 0, color: "#065f46" };
const p = { marginTop: 8, color: "#047857" };
