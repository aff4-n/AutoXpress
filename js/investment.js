const Investment = (() => {
  function render(){
    const el = document.getElementById('view-investment');
    const txs = Storage_DB.data.investment.transactions.slice().sort((a,b)=>new Date(b.date)-new Date(a.date));
    el.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card accent-green"><div class="stat-icon">${iconHTML('wallet')}</div><div class="stat-label">Cash Available</div><div class="stat-value mono">${Utils.fmtMoney(Storage_DB.data.cash)}</div></div>
        <div class="stat-card accent-blue"><div class="stat-icon">${iconHTML('bank')}</div><div class="stat-label">Total Invested</div><div class="stat-value mono">${Utils.fmtMoney(Metrics.totalInvestment())}</div></div>
        <div class="stat-card accent-warn"><div class="stat-icon">${iconHTML('down')}</div><div class="stat-label">Total Withdrawn</div><div class="stat-value mono">${Utils.fmtMoney(Metrics.totalWithdrawn())}</div></div>
        <div class="stat-card accent-blue"><div class="stat-icon">${iconHTML('trend')}</div><div class="stat-label">Net Worth</div><div class="stat-value mono">${Utils.fmtMoney(Metrics.netWorth())}</div></div>
      </div>
      <div class="toolbar">
        <button class="btn btn-primary btn-sm" id="addInvBtn">${iconHTML('plus')} Add Investment</button>
        <button class="btn btn-secondary btn-sm" id="withdrawInvBtn">${iconHTML('down')} Withdraw</button>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Transaction History</h3><span class="panel-sub">${txs.length} entries</span></div>
        <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Reason</th><th>Notes</th><th></th></tr></thead>
          <tbody>
          ${txs.map(t=>`
            <tr>
              <td class="mono">${Utils.fmtDate(t.date)}</td>
              <td><span class="badge ${t.type==='withdraw'?'badge-loss':'badge-profit'}">${t.type}</span></td>
              <td class="mono">${Utils.fmtMoney(t.amount)}</td>
              <td>${Utils.escapeHtml(t.reason||'—')}</td>
              <td>${Utils.escapeHtml(t.notes||'—')}</td>
              <td class="row-actions">${t.type!=='initial' ? `<button class="icon-btn del-tx" data-id="${t.id}">${iconHTML('trash')}</button>` : ''}</td>
            </tr>`).join('') || `<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text-muted);">No transactions yet.</td></tr>`}
          </tbody>
        </table>
        </div>
      </div>
    `;
    renderIcons(el);
    el.querySelector('#addInvBtn').addEventListener('click', ()=>openTxModal('add'));
    el.querySelector('#withdrawInvBtn').addEventListener('click', ()=>openTxModal('withdraw'));
    el.querySelectorAll('.del-tx').forEach(b=>b.addEventListener('click', ()=>{
      Modal.confirm('Delete Transaction?', 'This will reverse its effect on your available cash.', ()=>{
        Storage_DB.deleteInvestmentTx(b.dataset.id);
        Notify.show('Transaction removed', 'success');
        App.refreshChrome(); render();
      });
    }));
  }

  function openTxModal(type){
    const label = type==='add' ? 'Add Investment' : 'Withdraw Investment';
    const overlay = Modal.open(`
      <div class="modal-head"><h3>${label}</h3><button class="icon-btn" data-modal-close><i data-icon="x"></i></button></div>
      <div class="modal-body">
        <div class="form-grid">
          <label class="field"><span>Amount *</span><input type="number" step="0.01" id="tx_amount" required></label>
          <label class="field"><span>Date</span><input type="date" id="tx_date" value="${Utils.todayISO()}"></label>
          <label class="field full"><span>Reason</span><input id="tx_reason" placeholder="${type==='add'?'e.g. Additional capital injection':'e.g. Personal withdrawal'}"></label>
          <label class="field full"><span>Notes</span><textarea id="tx_notes"></textarea></label>
        </div>
        <div id="txError" class="login-error"></div>
      </div>
      <div class="modal-foot"><button class="btn btn-secondary" data-modal-close>Cancel</button><button class="btn btn-primary" id="saveTxBtn">Confirm</button></div>
    `, { maxWidth: 460 });
    overlay.querySelector('#saveTxBtn').addEventListener('click', ()=>{
      const amount = Number(overlay.querySelector('#tx_amount').value);
      if(!amount || amount<=0){ overlay.querySelector('#txError').textContent = 'Enter a valid amount'; return; }
      try{
        const reason = overlay.querySelector('#tx_reason').value;
        const notes = overlay.querySelector('#tx_notes').value;
        if(type==='add') Storage_DB.addInvestment(amount, reason, notes);
        else Storage_DB.withdrawInvestment(amount, reason, notes);
        Notify.show(type==='add' ? 'Investment added' : 'Investment withdrawn', 'success');
        Modal.close(overlay);
        App.refreshChrome(); render();
      }catch(err){ overlay.querySelector('#txError').textContent = err.message; }
    });
  }

  return { render };
})();
