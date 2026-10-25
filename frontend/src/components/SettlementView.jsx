import { useState, useEffect } from 'react';
import './SettlementView.css';
import { fetchGroupBalances, fetchOptimizedSettlements, fetchGroupSettlements } from '../services/settlementApi';

/**
 * SettlementView Component (Days 11–12: Balances, Min-Cash-Flow Optimization, and Settle Up)
 */
function SettlementView({
  groups = [],
  currentUser,
  authToken,
  onOpenSettleUpModalWithData,
}) {
  const [selectedGroupId, setSelectedGroupId] = useState(groups[0]?.id || groups[0]?._id || '');
  const [balanceData, setBalanceData] = useState(null);
  const [optimizedPlan, setOptimizedPlan] = useState(null);
  const [settlementHistory, setSettlementHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (groups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(groups[0].id || groups[0]._id);
    }
  }, [groups, selectedGroupId]);

  const loadSettlementData = async (groupId) => {
    if (!groupId) return;
    setLoading(true);
    setError(null);
    try {
      const [bData, optData, historyData] = await Promise.all([
        fetchGroupBalances(groupId, authToken),
        fetchOptimizedSettlements(groupId, authToken),
        fetchGroupSettlements(groupId, authToken),
      ]);
      setBalanceData(bData);
      setOptimizedPlan(optData);
      setSettlementHistory(historyData);
    } catch (err) {
      setError(err.message || 'Failed to load settlement data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedGroupId) {
      loadSettlementData(selectedGroupId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId, authToken]);

  const activeGroup = groups.find((g) => (g.id || g._id) === selectedGroupId);

  // Extract current user balance in this group
  const myBalance = balanceData?.balances?.find(
    (b) =>
      (currentUser?.id && String(b.userId) === String(currentUser.id)) ||
      (currentUser?._id && String(b.userId) === String(currentUser._id)) ||
      (currentUser?.name && b.name.toLowerCase() === currentUser.name.toLowerCase())
  );

  return (
    <div className="settlement-view">
      {/* Header & Group Selector */}
      <div className="settlement-header">
        <div>
          <h2>🤝 Debt Settlement &amp; Optimization</h2>
          <p className="settlement-sub">
            Calculated via Greedy Min-Cash-Flow algorithm to settle all group debts with minimum transactions.
          </p>
        </div>

        <div className="settlement-group-selector">
          <label htmlFor="settle-group-select">Group:</label>
          <select
            id="settle-group-select"
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
          <button className="btn btn-secondary" onClick={() => loadSettlementData(selectedGroupId)} disabled={loading}>
            🔄
          </button>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="card empty-card" style={{ padding: '30px', textAlign: 'center' }}>
          <h3>No Groups Found</h3>
          <p>Create or join a group to calculate net balances and debt optimizations.</p>
        </div>
      ) : loading ? (
        <div className="card loading-card" style={{ padding: '30px', textAlign: 'center' }}>
          <div className="spinner"></div>
          <p>Calculating live net balances and running optimization algorithm...</p>
        </div>
      ) : error ? (
        <div className="card error-card" style={{ padding: '20px' }}>
          <p>⚠️ Error: {error}</p>
          <button className="btn btn-primary" onClick={() => loadSettlementData(selectedGroupId)}>Retry</button>
        </div>
      ) : (
        <>
          {/* Top Status Banner */}
          <div className="settlement-status-grid">
            {/* My Personal Net Balance Card */}
            <div className={`status-card ${myBalance?.netBalance > 0 ? 'card-creditor' : myBalance?.netBalance < 0 ? 'card-debtor' : 'card-settled'}`}>
              <span className="status-title">Your Net Balance in Group</span>
              <div className="status-amount">
                {myBalance ? (
                  myBalance.netBalance > 0 ? (
                    <span style={{ color: '#16a34a' }}>+${myBalance.netBalance.toFixed(2)}</span>
                  ) : myBalance.netBalance < 0 ? (
                    <span style={{ color: '#dc2626' }}>-${Math.abs(myBalance.netBalance).toFixed(2)}</span>
                  ) : (
                    <span style={{ color: '#64748b' }}>$0.00 (Settled)</span>
                  )
                ) : (
                  '$0.00'
                )}
              </div>
              <span className="status-hint">
                {myBalance?.netBalance > 0
                  ? 'You are owed money by other group members'
                  : myBalance?.netBalance < 0
                  ? 'You owe money to other group members'
                  : 'You have no outstanding debts or credits in this group'}
              </span>
            </div>

            {/* Total Transfer Volume */}
            <div className="status-card">
              <span className="status-title">Total Group Spending</span>
              <div className="status-amount">${balanceData?.summary?.totalGroupSpending?.toFixed(2) || '0.00'}</div>
              <span className="status-hint">Across {balanceData?.balances?.length || 0} group members</span>
            </div>

            {/* Total Settled */}
            <div className="status-card">
              <span className="status-title">Settlement Volume</span>
              <div className="status-amount">${optimizedPlan?.summary?.totalTransferVolume?.toFixed(2) || '0.00'}</div>
              <span className="status-hint">{optimizedPlan?.suggestedTransactions?.length || 0} minimum transaction(s) needed</span>
            </div>
          </div>

          {/* Section 1: Optimized Settlement Plan (Min-Cash-Flow) */}
          <section className="settle-section">
            <div className="section-title-wrap">
              <h3>⚡ Suggested Settlement Plan (Min-Cash-Flow)</h3>
              <span className="badge-opt">Greedy Algorithm</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0 14px 0' }}>
              These optimized transfers settle all group debts with the fewest possible transactions. Click <strong>&quot;Settle Up&quot;</strong> to record a payment.
            </p>

            {optimizedPlan?.suggestedTransactions?.length === 0 ? (
              <div className="settle-empty-banner">
                <span>🎉</span>
                <div>
                  <strong>All Debts Settled!</strong>
                  <p>Everyone in {activeGroup?.name || 'this group'} is square. No payments needed.</p>
                </div>
              </div>
            ) : (
              <div className="suggested-transactions-list">
                {optimizedPlan?.suggestedTransactions?.map((tx, idx) => (
                  <div key={idx} className="suggested-tx-card">
                    <div className="tx-actors">
                      <span className="actor-from">🔴 {tx.from}</span>
                      <span className="tx-arrow">➔ pays ➔</span>
                      <span className="actor-to">🟢 {tx.to}</span>
                    </div>

                    <div className="tx-right">
                      <span className="tx-amount">${tx.amount.toFixed(2)}</span>
                      <button
                        className="btn-settle-action"
                        onClick={() =>
                          onOpenSettleUpModalWithData({
                            groupId: selectedGroupId,
                            sender: tx.from,
                            receiver: tx.to,
                            amount: tx.amount.toFixed(2),
                          })
                        }
                      >
                        🤝 Settle Up
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section 2: Group Balances Table */}
          <section className="settle-section">
            <h3>👥 Group Members Net Balances</h3>
            <div className="table-responsive">
              <table className="settle-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Total Paid ($)</th>
                    <th>Total Owed ($)</th>
                    <th>Net Balance ($)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {balanceData?.balances?.map((b) => {
                    const isPositive = b.netBalance > 0.005;
                    const isNegative = b.netBalance < -0.005;
                    return (
                      <tr key={b.key || b.name}>
                        <td>
                          <strong>{b.name}</strong> {currentUser?.name === b.name ? '(You)' : ''}
                        </td>
                        <td>${b.totalPaid.toFixed(2)}</td>
                        <td>${b.totalOwed.toFixed(2)}</td>
                        <td style={{ fontWeight: 'bold', color: isPositive ? '#16a34a' : isNegative ? '#dc2626' : '#64748b' }}>
                          {isPositive ? `+$${b.netBalance.toFixed(2)}` : isNegative ? `-$${Math.abs(b.netBalance).toFixed(2)}` : '$0.00'}
                        </td>
                        <td>
                          <span className={`status-pill ${isPositive ? 'pill-creditor' : isNegative ? 'pill-debtor' : 'pill-settled'}`}>
                            {isPositive ? 'Gets Paid' : isNegative ? 'Owes' : 'Settled'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 3: Recorded Settlement Payment History */}
          <section className="settle-section">
            <div className="section-title-wrap">
              <h3>📜 Recorded Settlement Payment History ({settlementHistory.length})</h3>
            </div>

            {settlementHistory.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No settlement payments recorded for this group yet.</p>
            ) : (
              <div className="table-responsive">
                <table className="settle-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Sender (Payer)</th>
                      <th>Receiver (Payee)</th>
                      <th>Amount Paid</th>
                      <th>Method</th>
                      <th>Status</th>
                      <th>Notes / Partial Info</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlementHistory.map((st) => (
                      <tr key={st.id || st._id}>
                        <td>{new Date(st.paymentDate || st.createdAt).toLocaleDateString()}</td>
                        <td><strong>{st.senderName || 'Payer'}</strong></td>
                        <td><strong>{st.receiverName || 'Payee'}</strong></td>
                        <td style={{ fontWeight: 'bold' }}>${Number(st.amount || 0).toFixed(2)}</td>
                        <td><span className="method-tag">{st.paymentMethod || 'Cash'}</span></td>
                        <td>
                          <span className={`status-pill ${st.status === 'partial' ? 'pill-partial' : 'pill-completed'}`}>
                            {st.status === 'partial' ? '⚡ Partial' : '✓ Completed'}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.85rem', color: '#475569' }}>
                          {st.status === 'partial' && (
                            <div>
                              <strong>${Number(st.remainingAmount || 0).toFixed(2)}</strong> remaining of ${Number(st.originalAmount || 0).toFixed(2)}
                            </div>
                          )}
                          {st.notes && <div>{st.notes}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default SettlementView;
