const Sales = (() => {
  let state = { range:'all' };

  function openSellModal(vehicleId){
    const v = Storage_DB.getVehicle(vehicleId);
    if(!v) return;
    const overlay = Modal.open(`
      <div class="modal-head"><h3>Mark as Sold — ${v.stockId}</h3><button class="icon-btn" data-modal-close><i data-icon="x"></i></button></div>
      <div class="modal-body">
        <div class="form-grid">
          <label class="field"><span>Selling Price *</span><input type="number" step="0.01" id="s_price" required></label>
          <label class="field"><span>Selling Date *</span><input type="date" id="s_date" value="${Utils.todayISO()}"></label>
          <label class="field"><span>Buyer Name</span><input id="s_buyer"></label>
          <label class="field"><span>Buyer Contact</span><input id="s_contact"></label>
          <label class="field"><span>Payment Method</span>
            <select id="s_payment"><option>Cash</option><option>Bank Transfer</option><option>Cheque</option><option>Financing</option><option>Trade-in</option></select>
          </label>
          <label class="field"><span>Commission (optional)</span><input type="number" step="0.01" id="s_commission" value="0"></label>
          <label class="field full"><span>Notes</span><textarea id="s_notes"></textarea></label>
        </div>
        <div class="panel" style="margin:14px 0 0; padding:14px;">
          <div class="flex-between"><span class="stat-label mb-0">Total Cost</span><span class="mono" id="s_costPreview">${Utils.fmtMoney(Storage_DB.vehicleCost(v))}</span></div>
          <div class="flex-between" style="margin-top:8px;"><span class="stat-label mb-0">Projected Profit / Loss</span><span class="mono" id="s_profitPreview">${Utils.fmtMoney(0)}</span></div>
        </div>
        <div id="sellError" class="login-error"></div>
      </div>
      <div class="modal-foot"><button class="btn btn-secondary" data-modal-close>Cancel</button><button class="btn btn-primary" id="confirmSellBtn">Confirm Sale</button></div>
    `, { maxWidth: 560 });

    const cost = Storage_DB.vehicleCost(v);
    function updatePreview(){
      const price = Number(overlay.querySelector('#s_price').value||0);
      const comm = Number(overlay.querySelector('#s_commission').value||0);
      const profit = price - comm - cost;
      const pEl = overlay.querySelector('#s_profitPreview');
      pEl.textContent = (profit>=0?'+':'') + Utils.fmtMoney(profit);
      pEl.className = 'mono ' + (profit>=0?'text-green':'text-red');
    }
    overlay.querySelector('#s_price').addEventListener('input', updatePreview);
    overlay.querySelector('#s_commission').addEventListener('input', updatePreview);

    overlay.querySelector('#confirmSellBtn').addEventListener('click', ()=>{
      const price = Number(overlay.querySelector('#s_price').value);
      if(!price || price<=0){ overlay.querySelector('#sellError').textContent = 'Enter a valid selling price'; return; }
      Storage_DB.sellVehicle(vehicleId, {
        sellingPrice: price,
        sellingDate: overlay.querySelector('#s_date').value,
        buyerName: overlay.querySelector('#s_buyer').value,
        buyerContact: overlay.querySelector('#s_contact').value,
        paymentMethod: overlay.querySelector('#s_payment').value,
        commission: Number(overlay.querySelector('#s_commission').value||0),
        notes: overlay.querySelector('#s_notes').value,
        date: overlay.querySelector('#s_date').value
      });
      Notify.show('Vehicle marked as sold', 'success');
      Modal.close(overlay);
      App.refreshChrome();
      if(App.currentView==='vehicle') Inventory.renderDetail(vehicleId);
      else if(App.currentView==='sales') render();
      else if(App.currentView==='inventory') Inventory.render();
    });
  }

  /* ================= SALES VIEW ================= */
  function render(){
    const el = document.getElementById('view-sales');
    const sold = Metrics.soldVehicles().slice().sort((a,b)=>new Date(b.sale.date)-new Date(a.sale.date));
    el.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card accent-green"><div class="stat-icon">${iconHTML('tag')}</div><div class="stat-label">Cars Sold</div><div class="stat-value mono">${sold.length}</div></div>
        <div class="stat-card accent-blue"><div class="stat-icon">${iconHTML('trend')}</div><div class="stat-label">Total Revenue</div><div class="stat-value mono">${Utils.fmtMoney(Metrics.totalRevenue())}</div></div>
        <div class="stat-card accent-green"><div class="stat-icon">${iconHTML('up')}</div><div class="stat-label">Avg Selling Price</div><div class="stat-value mono">${Utils.fmtMoney(Metrics.avgSellingPrice())}</div></div>
        <div class="stat-card accent-blue"><div class="stat-icon">${iconHTML('clock')}</div><div class="stat-label">Avg Holding Time</div><div class="stat-value mono">${Metrics.avgHoldingTime()} days</div></div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Sold Inventory</h3><span class="panel-sub">${sold.length} vehicle${sold.length!==1?'s':''}</span></div>
        <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th>Stock ID</th><th>Vehicle</th><th>Sold Date</th><th>Buyer</th><th>Sale Price</th><th>Profit/Loss</th><th>Days Held</th><th></th></tr></thead>
          <tbody>
          ${sold.map(v=>{
            const p = Storage_DB.vehicleProfit(v);
            const held = Utils.daysBetween(v.purchaseDate, v.sale.date);
            return `<tr>
              <td class="mono">${v.stockId}</td>
              <td>${v.year} ${Utils.escapeHtml(v.make)} ${Utils.escapeHtml(v.model)}</td>
              <td class="mono">${Utils.fmtDate(v.sale.date)}</td>
              <td>${Utils.escapeHtml(v.sale.buyerName||'—')}</td>
              <td class="mono">${Utils.fmtMoney(v.sale.sellingPrice)}</td>
              <td><span class="badge ${p>=0?'badge-profit':'badge-loss'}">${p>=0?'+':''}${Utils.fmtMoney(p)}</span></td>
              <td class="mono">${held}d</td>
              <td class="row-actions"><button class="icon-btn view-veh" data-id="${v.id}">${iconHTML('search')}</button></td>
            </tr>`;
          }).join('') || `<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">No vehicles sold yet.</td></tr>`}
          </tbody>
        </table>
        </div>
      </div>
    `;
    renderIcons(el);
    el.querySelectorAll('.view-veh').forEach(b=>b.addEventListener('click', ()=>Inventory.openDetail(b.dataset.id)));
  }

  return { openSellModal, render };
})();
