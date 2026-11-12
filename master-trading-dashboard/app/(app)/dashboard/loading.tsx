export default function LoadingDashboard() {
  return <div className="page-body" role="status" aria-label="Loading dashboard">
    <div style={{ height: 85, position: 'relative', marginBottom: 20 }}><div className="chart-skeleton"/></div>
    <div className="metrics-grid">{Array.from({ length: 5 }, (_, index) => <div key={index} className="metric-card" style={{ height: 160 }}><div className="chart-skeleton"/></div>)}</div>
    <div className="overview-grid">
      <div className="panel" style={{ height: 380, position: 'relative' }}><div className="chart-skeleton"/></div>
      <div className="panel" style={{ height: 380, position: 'relative' }}><div className="chart-skeleton"/></div>
    </div>
  </div>;
}
