import { useState, useEffect } from 'react';
import './ReportsView.css';
import { fetchGroupReport, downloadGroupReportCsv } from '../services/reportApi';

/**
 * ReportsView Component (Day 14: Comprehensive Reports, Category Analytics & CSV Export)
 */
function ReportsView({ groups = [], authToken }) {
  const [selectedGroupId, setSelectedGroupId] = useState(groups[0]?.id || groups[0]?._id || '');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (groups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(groups[0].id || groups[0]._id);
    }
  }, [groups, selectedGroupId]);

  const loadReport = async (groupId) => {
    if (!groupId || !authToken) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGroupReport(groupId, authToken);
      setReportData(data);
    } catch (err) {
      setError(err.message || 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedGroupId) {
      loadReport(selectedGroupId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId, authToken]);

  const activeGroup = groups.find((g) => (g.id || g._id) === selectedGroupId);

  const handleCsvDownload = async () => {
    if (!selectedGroupId || !authToken) return;
    setDownloadingCsv(true);
    try {
      await downloadGroupReportCsv(selectedGroupId, authToken, activeGroup?.name || 'group');
    } catch (err) {
      alert(`Error exporting CSV: ${err.message}`);
    } finally {
      setDownloadingCsv(false);
    }
  };

  return (
    <div className="reports-view">
      {/* Header & Controls */}
      <div className="reports-header">
        <div>
          <h2>📊 Financial Reports &amp; Analytics</h2>
          <p className="reports-sub">
            Category breakdowns, member contribution audits, and downloadable CSV exports.
          </p>
        </div>

        <div className="reports-controls">
          <div className="group-picker">
            <label htmlFor="report-group-select">Group:</label>
            <select
              id="report-group-select"
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              disabled={loading}
            >
              {groups.map((g) => (
                <option key={g.id || g._id} value={g.id || g._id}>
                  {g.name} ({g.baseCurrency || 'USD'})
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn-export-csv"
            onClick={handleCsvDownload}
            disabled={loading || downloadingCsv || !reportData}
            title="Download full group report as CSV"
          >
            {downloadingCsv ? '⏳ Generating CSV...' : '📥 Export CSV Report'}
          </button>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="card empty-card" style={{ padding: '40px', textAlign: 'center' }}>
          <h3>No Groups Found</h3>
          <p>Create or join a group to inspect financial reports and analytics.</p>
        </div>
      ) : loading ? (
        <div className="card loading-card" style={{ padding: '30px', textAlign: 'center' }}>
          <div className="spinner"></div>
          <p>Aggregating MongoDB category metrics and compiling financial report...</p>
        </div>
      ) : error ? (
        <div className="card error-card" style={{ padding: '20px' }}>
          <p>⚠️ Error: {error}</p>
          <button className="btn btn-primary" onClick={() => loadReport(selectedGroupId)}>Retry</button>
        </div>
      ) : reportData ? (
        <>
          {/* Summary Metric Cards Grid */}
          <div className="report-metrics-grid">
            <div className="rep-metric-card">
              <span className="rep-label">Total Group Spending</span>
              <div className="rep-value">${reportData.summary.totalSpending.toFixed(2)}</div>
              <span className="rep-hint">{reportData.summary.expenseCount} recorded expenses</span>
            </div>

            <div className="rep-metric-card">
              <span className="rep-label">Total Settled Volume</span>
              <div className="rep-value">${reportData.summary.totalSettled.toFixed(2)}</div>
              <span className="rep-hint">{reportData.summary.settledMembers} settled members</span>
            </div>

            <div className="rep-metric-card">
              <span className="rep-label">Group Members</span>
              <div className="rep-value">{reportData.summary.memberCount}</div>
              <span className="rep-hint">{reportData.summary.unsettledMembers} unsettled members</span>
            </div>

            <div className="rep-metric-card">
              <span className="rep-label">Optimized Debt Transfers</span>
              <div className="rep-value">{reportData.summary.optimizedTransactionCount}</div>
              <span className="rep-hint">Calculated via Min-Cash-Flow</span>
            </div>
          </div>

          {/* Section 1: Category Spending Breakdown */}
          <section className="report-section">
            <h3>🏷️ Category Spending Breakdown</h3>
            <div className="category-bars-list">
              {reportData.categoryBreakdown.map((cat) => (
                <div key={cat.category} className="category-bar-row">
                  <div className="cat-info">
                    <strong>{cat.category}</strong>
                    <span className="cat-numbers">
                      ${cat.totalAmount.toFixed(2)} ({cat.percentage.toFixed(1)}% &bull; {cat.count} expenses)
                    </span>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${Math.max(cat.percentage, 3)}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section 2: Member Spending & Balances */}
          <section className="report-section">
            <h3>👥 Member Financial Balances</h3>
            <div className="table-responsive">
              <table className="rep-table">
                <thead>
                  <tr>
                    <th>Member Name</th>
                    <th>Total Paid ($)</th>
                    <th>Total Owed ($)</th>
                    <th>Net Balance ($)</th>
                    <th>Financial Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.memberBreakdown.map((m) => {
                    const isPositive = m.netBalance > 0.005;
                    const isNegative = m.netBalance < -0.005;
                    return (
                      <tr key={m.name}>
                        <td>
                          <strong>{m.name}</strong> {currentUser?.name === m.name ? '(You)' : ''}
                        </td>
                        <td>${m.totalPaid.toFixed(2)}</td>
                        <td>${m.totalOwed.toFixed(2)}</td>
                        <td style={{ fontWeight: 'bold', color: isPositive ? '#16a34a' : isNegative ? '#dc2626' : '#64748b' }}>
                          {isPositive ? `+$${m.netBalance.toFixed(2)}` : isNegative ? `-$${Math.abs(m.netBalance).toFixed(2)}` : '$0.00'}
                        </td>
                        <td>
                          <span className={`status-pill ${isPositive ? 'pill-creditor' : isNegative ? 'pill-debtor' : 'pill-settled'}`}>
                            {m.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 3: Itemized Expenses Table */}
          <section className="report-section">
            <h3>🧾 Itemized Expenses Audit</h3>
            <div className="table-responsive">
              <table className="rep-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Paid By</th>
                    <th>Split Method</th>
                    <th>Amount ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.itemizedExpenses.map((exp) => (
                    <tr key={exp.id}>
                      <td>{new Date(exp.expenseDate).toLocaleDateString()}</td>
                      <td><strong>{exp.title}</strong></td>
                      <td><span className="cat-badge">{exp.category}</span></td>
                      <td>{exp.paidBy}</td>
                      <td><span className="split-badge">{exp.splitType}</span></td>
                      <td style={{ fontWeight: 'bold' }}>${exp.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

export default ReportsView;
