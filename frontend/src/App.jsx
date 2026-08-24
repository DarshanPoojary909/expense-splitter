import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Function to fetch health check from Express backend
  const fetchHealthStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      // Calling Express backend on port 5000
      const response = await fetch('http://localhost:5000/api/health');
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      setHealthData(data);
    } catch (err) {
      console.error('Failed to fetch backend health status:', err);
      setError(err.message || 'Could not connect to backend server');
      setHealthData(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetch automatically on initial mount
  useEffect(() => {
    fetchHealthStatus();
  }, []);

  return (
    <div className="app-container">
      <header className="header">
        <h1>Expense Splitter</h1>
        <p>Day 1: Full-Stack Connectivity & Health Check</p>
      </header>

      <main>
        <section className="card">
          <h2>Backend Health Status (GET /api/health)</h2>
          
          {loading && <p>Testing connection to backend...</p>}

          {error && (
            <div className="status-badge offline" style={{ padding: '12px', display: 'block', marginBottom: '12px' }}>
              <strong>Connection Error:</strong> {error}
              <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem' }}>
                Make sure the Express backend server is running on <code>http://localhost:5000</code>.
              </p>
            </div>
          )}

          {healthData && (
            <div className="status-grid">
              <div className="status-item">
                <div className="status-label">API Status</div>
                <div className="status-value">
                  <span className="status-badge online">{healthData.status}</span>
                </div>
              </div>

              <div className="status-item">
                <div className="status-label">Database</div>
                <div className="status-value">
                  <span className={`status-badge ${healthData.database === 'connected' ? 'online' : 'connecting'}`}>
                    {healthData.database}
                  </span>
                </div>
              </div>

              <div className="status-item">
                <div className="status-label">Environment</div>
                <div className="status-value">{healthData.environment}</div>
              </div>

              <div className="status-item">
                <div className="status-label">Last Checked</div>
                <div className="status-value" style={{ fontSize: '0.9rem' }}>
                  {new Date(healthData.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          )}

          <button 
            className="btn" 
            onClick={fetchHealthStatus} 
            disabled={loading}
          >
            {loading ? 'Checking...' : 'Re-check Backend Health'}
          </button>
        </section>

        <section className="architecture-info">
          <h3>Full Data Flow in Action</h3>
          <ul>
            <li><strong>Frontend:</strong> React on Vite (<code>http://localhost:5173</code>)</li>
            <li><strong>CORS:</strong> Express allows requests from origin <code>http://localhost:5173</code></li>
            <li><strong>Backend API:</strong> Express listening on <code>http://localhost:5000/api/health</code></li>
            <li><strong>Database:</strong> Mongoose reporting connection state via <code>readyState</code></li>
          </ul>
        </section>
      </main>
    </div>
  );
}

export default App;
