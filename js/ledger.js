const Ledger = (() => {
  let state = { filter:'all' };

  const FILTERS = [
    { id:'all', label:'All' },
    { id:'income', label:'Income' },
    { id:'expense', label:'Expense' },
    { id:'borrowed', label:'Borrowed' },
    { id:'loan', label:'Loan Given' },
    { id:'pending', label:'Pending' },
  ];

  function entries(){ return Storage_DB.data.personalLedger.entries; }

  function totals(){
    const owed = entries().filter(e=>e.type==='borrowed' && e.status==='pending').reduce((s,e)=>s+e.amount,0);
    const receivable = entries().filter(e=>e.type==='loan' && e.status==='pending').reduce((s,e)=>s+e.amount,0);
    const cash = Storage_DB.data.personalLedger.cash;
    return { owed, receivable, cash, netWorth: cash + receivable - owed };
  }

  function render(){
    const el = document.getElementById('view-ledger');
    const t = totals();
    el.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card accent-green"><div class="stat-icon">${iconHTML('wallet')}</div><div class="stat-label">Personal Cash</div><div class="stat-value mono">${Utils.fmtMoney(t.cash)}</div></div>
        <div class="stat-card accent-red"><div class="stat-icon">${iconHTML('down')}</div><div class="stat-label">Total Owed (Borrowed)</div><div class="stat-value mono">${Utils.fmtMoney(t.owed)}</div></div>
        <div class="stat-card accent-blue"><div class="stat-icon">${iconHTML('up')}</div><div class="stat-label">Total Receivable (Loaned)</div><div class="stat-value mono">${Utils.fmtMoney(t.receivable)}</div></div>
        <div class="stat-card accent-blue"><div class="stat-icon">${iconHTML('trend')}</div><div class="stat-label">Net Personal Worth</div><div class="stat-value mono">${Utils.fmtMoney(t.netWorth)}</div></div>
      </div>

      <div class="toolbar">
        <button class="btn btn-primary btn-sm" id="addIncomeBtn">${iconHTML('plus')} Income</button>
        <button class="btn btn-secondary btn-sm" id="addExpenseBtn">${iconHTML('plus')} Expense</button>
        <button class="btn btn-secondary btn-sm" id="addBorrowedBtn">${iconHTML('down')} Borrowed</button>
        <button class="btn btn-secondary btn-sm" id="addLoanBtn">${iconHTML('handshake')} Gave Loan</button>
      </div>
      <div class="filter-pills" style="margin-bottom:16px;">
        ${FILTERS.map(f=>`<button class="pill ${state.filter===f.id?'active':''}" data-filter="${f.id}">${f.label}</button>`).join('')}
      </div>

      <div class="panel">
        <div class="panel-head"><h3>Ledger Entries</h3><span class="panel-sub">${filteredEntries().length} entries</span></div>
        <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th>Date</th><th>Type</th><th>Person</th><th>Place</th><th>What For</th><th>Amount</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${filteredEntries().map(rowHTML).join('') || `<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">No entries yet — log your first transaction above.</td></tr>`}
          </tbody>
        </table>
        </div>
      </div>
    `;
    renderIcons(el);

    el.querySelectorAll('.pill').forEach(p=>p.addEventListener('click', ()=>{ state.filter=p.dataset.filter; render(); }));
    el.querySelector('#addIncomeBtn').addEventListener('click', ()=>openTxModal('income'));
    el.querySelector('#addExpenseBtn').addEventListener('click', ()=>openTxModal('expense'));
    el.querySelector('#addBorrowedBtn').addEventListener('click', ()=>openBorrowLoanModal('borrowed'));
    el.querySelector('#addLoanBtn').addEventListener('click', ()=>openBorrowLoanModal('loan'));
    el.querySelectorAll('.settle-entry').forEach(b=>b.addEventListener('click', ()=>{
      const e = entries().find(x=>x.id===b.dataset.id);
      const label = e.type==='borrowed' ? 'Mark as Returned?' : 'Mark as Received?';
      const msg = e.type==='borrowed'
        ? `This records that you paid back ${Utils.fmtMoney(e.amount)} to ${Utils.escapeHtml(e.person||'this person')}, deducting it from your personal cash.`
        : `This records that ${Utils.escapeHtml(e.person||'this person')} paid you back ${Utils.fmtMoney(e.amount)}, adding it to your personal cash.`;
      Modal.confirm(label, msg, ()=>{
        Storage_DB.settleLedgerEntry(e.id);
        Notify.show(e.type==='borrowed' ? 'Marked as returned' : 'Marked as received', 'success');
        App.refreshChrome(); render();
      }, { danger:false, confirmLabel:'Confirm' });
    }));
    el.querySelectorAll('.del-entry').forEach(b=>b.addEventListener('click', ()=>{
      Modal.confirm('Delete Entry?', 'This will reverse its effect on your personal cash balance.', ()=>{
        Storage_DB.deleteLedgerEntry(b.dataset.id);
        Notify.show('Entry deleted', 'error');
        App.refreshChrome(); render();
      });
    }));
  }

  function filteredEntries(){
    let list = entries();
    if(state.filter==='pending') list = list.filter(e=>e.status==='pending');
    else if(state.filter!=='all') list = list.filter(e=>e.type===state.filter);
    return list;
  }

  function typeBadge(type){
    const map = {
      income: '<span class="badge badge-profit">Income</span>',
      expense: '<span class="badge badge-loss">Expense</span>',
      borrowed: '<span class="badge badge-reserved">Borrowed</span>',
      loan: '<span class="badge badge-available">Loan Given</span>',
    };
    return map[type] || type;
  }

  function rowHTML(e){
    const showSettle = (e.type==='borrowed' || e.type==='loan') && e.status==='pending';
    const statusHTML = e.type==='borrowed' || e.type==='loan'
      ? (e.status==='pending' ? '<span class="badge badge-reserved">Pending</span>' : '<span class="badge badge-sold">Settled</span>')
      : '—';
    return `
      <tr>
        <td class="mono">${Utils.fmtDate(e.date)}</td>
        <td>${typeBadge(e.type)}</td>
        <td>${Utils.escapeHtml(e.person||'—')}</td>
        <td>${Utils.escapeHtml(e.place||'—')}</td>
        <td>${Utils.escapeHtml(e.description||'—')}</td>
        <td class="mono">${Utils.fmtMoney(e.amount)}</td>
        <td>${statusHTML}</td>
        <td class="row-actions">
          ${showSettle ? `<button class="icon-btn settle-entry" data-id="${e.id}" title="${e.type==='borrowed'?'Mark returned':'Mark received'}">${iconHTML('check')}</button>` : ''}
          <button class="icon-btn del-entry" data-id="${e.id}">${iconHTML('trash')}</button>
        </td>
      </tr>`;
  }

  /* ================= INCOME / EXPENSE MODAL ================= */
  function openTxModal(type){
    const isIncome = type==='income';
    const overlay = Modal.open(`
      <div class="modal-head"><h3>${isIncome?'Add Income':'Add Expense'}</h3><button class="icon-btn" data-modal-close><i data-icon="x"></i></button></div>
      <div class="modal-body">
        <div class="form-grid">
          <label class="field"><span>Amount *</span><input type="number" step="0.01" id="l_amount" required></label>
          <label class="field"><span>Date</span><input type="date" id="l_date" value="${Utils.todayISO()}"></label>
          <label class="field"><span>${isIncome?'Received From':'Paid To'}</span><input id="l_person" placeholder="Who?"></label>
          <label class="field"><span>${isIncome?'Where Received':'Where Spent'}</span><input id="l_place" placeholder="Place / merchant"></label>
          <label class="field full"><span>What For</span><input id="l_desc" placeholder="e.g. Salary, groceries, rent..."></label>
          <label class="field full"><span>Notes</span><textarea id="l_notes"></textarea></label>
        </div>
        <div id="lError" class="login-error"></div>
      </div>
      <div class="modal-foot"><button class="btn btn-secondary" data-modal-close>Cancel</button><button class="btn btn-primary" id="saveLBtn">Save</button></div>
    `, { maxWidth: 480 });
    overlay.querySelector('#saveLBtn').addEventListener('click', ()=>{
      const amount = Number(overlay.querySelector('#l_amount').value);
      if(!amount || amount<=0){ overlay.querySelector('#lError').textContent = 'Enter a valid amount'; return; }
      Storage_DB.addLedgerEntry(type, {
        amount, date: overlay.querySelector('#l_date').value || Utils.todayISO(),
        person: overlay.querySelector('#l_person').value,
        place: overlay.querySelector('#l_place').value,
        description: overlay.querySelector('#l_desc').value,
        notes: overlay.querySelector('#l_notes').value
      });
      Notify.show(isIncome?'Income logged':'Expense logged', 'success');
      Modal.close(overlay);
      App.refreshChrome(); render();
    });
  }

  /* ================= BORROWED / LOAN GIVEN MODAL ================= */
  function openBorrowLoanModal(type){
    const isBorrow = type==='borrowed';
    const overlay = Modal.open(`
      <div class="modal-head"><h3>${isBorrow?'Borrowed Money':'Gave a Loan'}</h3><button class="icon-btn" data-modal-close><i data-icon="x"></i></button></div>
      <div class="modal-body">
        <div class="form-grid">
          <label class="field"><span>Amount *</span><input type="number" step="0.01" id="l_amount" required></label>
          <label class="field"><span>Date</span><input type="date" id="l_date" value="${Utils.todayISO()}"></label>
          <label class="field"><span>${isBorrow?'Borrowed From *':'Given To *'}</span><input id="l_person" required placeholder="Name"></label>
          <label class="field"><span>Contact</span><input id="l_contact" placeholder="Phone / email (optional)"></label>
          <label class="field"><span>Place</span><input id="l_place" placeholder="Where / context"></label>
          <label class="field"><span>Expected Return Date</span><input type="date" id="l_due"></label>
          <label class="field full"><span>What For</span><input id="l_desc" placeholder="Reason for the ${isBorrow?'loan':'money'}"></label>
          <label class="field full"><span>Notes</span><textarea id="l_notes"></textarea></label>
        </div>
        <div id="lError" class="login-error"></div>
      </div>
      <div class="modal-foot"><button class="btn btn-secondary" data-modal-close>Cancel</button><button class="btn btn-primary" id="saveLBtn">${isBorrow?'Record Borrowed Money':'Record Loan Given'}</button></div>
    `, { maxWidth: 520 });
    overlay.querySelector('#saveLBtn').addEventListener('click', ()=>{
      const amount = Number(overlay.querySelector('#l_amount').value);
      const person = overlay.querySelector('#l_person').value.trim();
      if(!amount || amount<=0){ overlay.querySelector('#lError').textContent = 'Enter a valid amount'; return; }
      if(!person){ overlay.querySelector('#lError').textContent = isBorrow ? 'Enter who you borrowed from' : 'Enter who you gave the loan to'; return; }
      Storage_DB.addLedgerEntry(type, {
        amount, date: overlay.querySelector('#l_date').value || Utils.todayISO(),
        person, contact: overlay.querySelector('#l_contact').value,
        place: overlay.querySelector('#l_place').value,
        dueDate: overlay.querySelector('#l_due').value || null,
        description: overlay.querySelector('#l_desc').value,
        notes: overlay.querySelector('#l_notes').value
      });
      Notify.show(isBorrow ? 'Borrowed money recorded' : 'Loan recorded', 'success');
      Modal.close(overlay);
      App.refreshChrome(); render();
    });
  }

  return { render };
})();
