const Inventory = (() => {
  let state = { search:'', status:'all', sort:'newest' };

  const CATEGORIES = ['Maintenance','Detailing','Oil Change','Mechanical','Electrical','Paint','Tyres','Fuel','Transport','Registration','Documentation','Insurance','Accessories','Cleaning','Other'];
  const COMMON_TAGS = ['Auction','Trade-in','Luxury','SUV','Sedan','Hatchback','Commercial'];

  /* ================= LIST VIEW ================= */
  function render(){
    const el = document.getElementById('view-inventory');
    el.innerHTML = `
      <div class="toolbar">
        <div class="search-input">${iconHTML('search')}<input id="invSearch" placeholder="Search make, model, reg, VIN, year..." value="${Utils.escapeHtml(state.search)}"></div>
        <select class="select-chip" id="invSort">
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="priceHigh">Highest Price</option>
          <option value="priceLow">Lowest Price</option>
          <option value="alpha">Alphabetical</option>
        </select>
        <button class="btn btn-primary btn-sm" id="invAddBtn">${iconHTML('plus')} Add Vehicle</button>
      </div>
      <div class="filter-pills" style="margin-bottom:16px;">
        ${pill('all','All')} ${pill('available','Available')} ${pill('reserved','Reserved')} ${pill('sold','Sold')}
      </div>
      <div id="invGrid" class="vehicle-grid"></div>
    `;
    document.getElementById('invSort').value = state.sort;
    renderIcons(el);
    document.getElementById('invSearch').addEventListener('input', Utils.debounce(e=>{ state.search=e.target.value; renderGrid(); },200));
    document.getElementById('invSort').addEventListener('change', e=>{ state.sort=e.target.value; renderGrid(); });
    document.getElementById('invAddBtn').addEventListener('click', ()=>openVehicleModal());
    el.querySelectorAll('.pill').forEach(p=>p.addEventListener('click', ()=>{ state.status=p.dataset.status; renderGrid(); render_pills(); }));
    renderGrid();
  }
  function pill(status,label){ return `<button class="pill ${state.status===status?'active':''}" data-status="${status}">${label}</button>`; }
  function render_pills(){
    document.querySelectorAll('.filter-pills .pill').forEach(p=>p.classList.toggle('active', p.dataset.status===state.status));
  }

  function filteredVehicles(){
    let list = [...Storage_DB.data.vehicles];
    if(state.status!=='all') list = list.filter(v=>v.status===state.status);
    if(state.search){
      const q = state.search.toLowerCase();
      list = list.filter(v => [v.make,v.model,v.variant,v.reg,v.vin,v.year,v.color].join(' ').toLowerCase().includes(q));
    }
    switch(state.sort){
      case 'newest': list.sort((a,b)=> new Date(b.purchaseDate)-new Date(a.purchaseDate)); break;
      case 'oldest': list.sort((a,b)=> new Date(a.purchaseDate)-new Date(b.purchaseDate)); break;
      case 'priceHigh': list.sort((a,b)=> b.purchasePrice-a.purchasePrice); break;
      case 'priceLow': list.sort((a,b)=> a.purchasePrice-b.purchasePrice); break;
      case 'alpha': list.sort((a,b)=> (a.make+a.model).localeCompare(b.make+b.model)); break;
    }
    return list;
  }

  function renderGrid(){
    const grid = document.getElementById('invGrid');
    const list = filteredVehicles();
    if(!list.length){
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">${iconHTML('car')}<h4>No vehicles found</h4><p>Try adjusting filters or add your first vehicle to stock.</p></div>`;
      renderIcons(grid);
      return;
    }
    grid.innerHTML = list.map(cardHTML).join('');
    renderIcons(grid);
    grid.querySelectorAll('.vehicle-card').forEach(c=>c.addEventListener('click', ()=>openDetail(c.dataset.id)));
  }

  function cardHTML(v){
    const cost = Storage_DB.vehicleCost(v);
    const badge = v.status==='available' ? '<span class="badge badge-available">Available</span>' :
                  v.status==='reserved' ? '<span class="badge badge-reserved">Reserved</span>' :
                  '<span class="badge badge-sold">Sold</span>';
    const thumb = v.photos && v.photos[0]
      ? `<img class="vehicle-thumb" src="${v.photos[0]}">`
      : `<div class="vehicle-thumb-placeholder">${iconHTML('image')}</div>`;
    let priceLine = `${Utils.fmtMoney(v.purchasePrice)}`;
    if(v.status==='sold' && v.sale){
      const p = Storage_DB.vehicleProfit(v);
      priceLine = `${Utils.fmtMoney(v.sale.sellingPrice)} <span class="${p>=0?'text-green':'text-red'}" style="font-size:12px;">(${p>=0?'+':''}${Utils.fmtMoney(p)})</span>`;
    }
    return `
      <div class="vehicle-card" data-id="${v.id}">
        ${thumb}
        <div class="vehicle-card-top">
          <div>
            <h4>${v.year} ${Utils.escapeHtml(v.make)} ${Utils.escapeHtml(v.model)}</h4>
            <div class="vc-sub">${Utils.escapeHtml(v.stockId)} ${v.reg?('· '+Utils.escapeHtml(v.reg)):''}</div>
          </div>
          ${badge}
        </div>
        <div class="vc-price mono">${priceLine}</div>
        <div class="vc-meta">
          <span>${Utils.escapeHtml(v.color||'—')}</span>
          <span>${Utils.fmtNum(v.mileage||0)} mi</span>
          <span>Cost: ${Utils.fmtMoney(cost)}</span>
        </div>
        ${v.tags && v.tags.length ? `<div class="tag-list" style="margin-top:10px;">${v.tags.map(t=>`<span class="tag">${Utils.escapeHtml(t)}</span>`).join('')}</div>` : ''}
      </div>`;
  }

  /* ================= ADD / EDIT VEHICLE MODAL ================= */
  function openVehicleModal(existing){
    const isEdit = !!existing;
    const v = existing || {};
    const overlay = Modal.open(`
      <div class="modal-head"><h3>${isEdit?'Edit Vehicle':'Add Vehicle'}</h3><button class="icon-btn" data-modal-close><i data-icon="x"></i></button></div>
      <div class="modal-body">
        <form id="vehicleForm">
          <div class="form-grid">
            <label class="field"><span>Make *</span><input required id="f_make" value="${v.make||''}"></label>
            <label class="field"><span>Model *</span><input required id="f_model" value="${v.model||''}"></label>
            <label class="field"><span>Variant</span><input id="f_variant" value="${v.variant||''}"></label>
            <label class="field"><span>Year *</span><input required type="number" id="f_year" value="${v.year||''}"></label>
            <label class="field"><span>Color</span><input id="f_color" value="${v.color||''}"></label>
            <label class="field"><span>Mileage</span><input type="number" id="f_mileage" value="${v.mileage||''}"></label>
            <label class="field"><span>Transmission</span>
              <select id="f_transmission"><option ${v.transmission==='Automatic'?'selected':''}>Automatic</option><option ${v.transmission==='Manual'?'selected':''}>Manual</option><option ${v.transmission==='CVT'?'selected':''}>CVT</option></select>
            </label>
            <label class="field"><span>Fuel Type</span>
              <select id="f_fuelType"><option ${v.fuelType==='Petrol'?'selected':''}>Petrol</option><option ${v.fuelType==='Diesel'?'selected':''}>Diesel</option><option ${v.fuelType==='Hybrid'?'selected':''}>Hybrid</option><option ${v.fuelType==='Electric'?'selected':''}>Electric</option></select>
            </label>
            <label class="field"><span>Engine</span><input id="f_engine" value="${v.engine||''}"></label>
            <label class="field"><span>Registration Number</span><input id="f_reg" value="${v.reg||''}"></label>
            <label class="field"><span>VIN (optional)</span><input id="f_vin" value="${v.vin||''}"></label>
            <label class="field"><span>Purchase Date *</span><input required type="date" id="f_purchaseDate" value="${v.purchaseDate ? v.purchaseDate.slice(0,10) : Utils.todayISO()}"></label>
            <label class="field"><span>Purchase Price *</span><input required type="number" step="0.01" id="f_purchasePrice" value="${v.purchasePrice||''}"></label>
            <label class="field"><span>Seller Name</span><input id="f_sellerName" value="${v.sellerName||''}"></label>
            <label class="field"><span>Seller Contact</span><input id="f_sellerContact" value="${v.sellerContact||''}"></label>
            <label class="field full"><span>Purchase Location</span><input id="f_purchaseLocation" value="${v.purchaseLocation||''}"></label>
            <label class="field full"><span>Tags</span><input id="f_tags" placeholder="Auction, SUV, Luxury..." value="${(v.tags||[]).join(', ')}"></label>
            <label class="field full"><span>Notes</span><textarea id="f_notes">${v.notes||''}</textarea></label>
            <label class="field full"><span>Photos</span><input type="file" id="f_photos" accept="image/*" multiple></label>
          </div>
          <div id="dupWarning" class="login-error"></div>
        </form>
      </div>
      <div class="modal-foot">
        <button class="btn btn-secondary" data-modal-close>Cancel</button>
        <button class="btn btn-primary" id="saveVehicleBtn">${isEdit?'Save Changes':'Add to Inventory'}</button>
      </div>
    `, { maxWidth: 640 });

    let photoData = v.photos ? [...v.photos] : [];
    overlay.querySelector('#f_photos').addEventListener('change', async (e)=>{
      const files = Array.from(e.target.files).slice(0,6);
      for(const f of files){ photoData.push(await Utils.fileToDataURL(f)); }
      Notify.show(`${files.length} photo(s) attached`, 'success');
    });

    overlay.querySelector('#saveVehicleBtn').addEventListener('click', ()=>{
      const g = id => overlay.querySelector('#'+id).value.trim();
      const make = g('f_make'), model = g('f_model'), reg = g('f_reg'), vin = g('f_vin');
      if(!make || !model || !g('f_year') || !g('f_purchaseDate') || !g('f_purchasePrice')){
        overlay.querySelector('#dupWarning').textContent = 'Please fill all required fields (*)';
        return;
      }
      // duplicate detection — warn once, require a second click to confirm
      const dup = Storage_DB.data.vehicles.find(x => x.id!==v.id && ((vin && x.vin===vin) || (reg && x.reg===reg)));
      const saveBtn = overlay.querySelector('#saveVehicleBtn');
      if(dup && !saveBtn.dataset.confirmedDup){
        overlay.querySelector('#dupWarning').textContent = `Warning: duplicate VIN/Registration matches ${dup.stockId}. Click Save again to confirm.`;
        saveBtn.dataset.confirmedDup = '1';
        return;
      }
      const payload = {
        make, model,
        variant: g('f_variant'), year: Number(g('f_year')), color: g('f_color'),
        mileage: Number(g('f_mileage')||0), transmission: g('f_transmission'), fuelType: g('f_fuelType'),
        engine: g('f_engine'), reg, vin,
        purchaseDate: g('f_purchaseDate'), purchasePrice: Number(g('f_purchasePrice')||0),
        sellerName: g('f_sellerName'), sellerContact: g('f_sellerContact'), purchaseLocation: g('f_purchaseLocation'),
        notes: g('f_notes'), tags: g('f_tags').split(',').map(t=>t.trim()).filter(Boolean),
        photos: photoData
      };
      try{
        if(isEdit){ Storage_DB.updateVehicle(v.id, payload); Notify.show('Vehicle updated', 'success'); }
        else { Storage_DB.addVehicle(payload); Notify.show('Vehicle added to inventory', 'success'); }
        Modal.close(overlay);
        App.refreshChrome();
        if(App.currentView==='inventory') render(); else if(App.currentView==='vehicle' && isEdit) openDetail(v.id);
      }catch(err){ overlay.querySelector('#dupWarning').textContent = err.message; }
    });
  }

  /* ================= VEHICLE DETAIL ================= */
  function openDetail(id){
    App.navigate('vehicle');
    renderDetail(id);
  }

  function renderDetail(id){
    const v = Storage_DB.getVehicle(id);
    const el = document.getElementById('view-vehicle');
    if(!v){ el.innerHTML = emptyDetail(); return; }
    const cost = Storage_DB.vehicleCost(v);
    const profit = Storage_DB.vehicleProfit(v);
    const held = Utils.daysBetween(v.purchaseDate, v.sale ? v.sale.date : null);

    el.innerHTML = `
      <button class="btn btn-ghost btn-sm" id="backToInv" style="margin-bottom:14px;">${iconHTML('arrowLeft')} Back to Inventory</button>
      <div class="panel">
        <div class="panel-head">
          <div>
            <h3 style="font-size:19px;">${v.year} ${Utils.escapeHtml(v.make)} ${Utils.escapeHtml(v.model)} ${Utils.escapeHtml(v.variant||'')}</h3>
            <span class="panel-sub">${v.stockId} ${v.reg?('· '+Utils.escapeHtml(v.reg)):''} ${v.vin?('· VIN '+Utils.escapeHtml(v.vin)):''}</span>
          </div>
          <div class="flex gap-8">
            ${v.status!=='sold' ? `<button class="btn btn-primary btn-sm" id="sellBtn">${iconHTML('tag')} Mark as Sold</button>` : ''}
            <button class="icon-btn" id="editVehBtn" title="Edit">${iconHTML('edit')}</button>
            <button class="icon-btn" id="deleteVehBtn" title="Delete">${iconHTML('trash')}</button>
          </div>
        </div>
        ${v.photos && v.photos.length ? `<div class="flex gap-8" style="flex-wrap:wrap; margin-bottom:16px;">${v.photos.map(p=>`<img src="${p}" style="width:90px;height:70px;object-fit:cover;border-radius:10px;border:1px solid var(--border);">`).join('')}</div>` : ''}
        <div class="stat-grid">
          ${miniStat('Purchase Price', Utils.fmtMoney(v.purchasePrice))}
          ${miniStat('Total Expenses', Utils.fmtMoney(cost-v.purchasePrice))}
          ${miniStat('Total Cost', Utils.fmtMoney(cost))}
          ${v.status==='sold' ? miniStat('Selling Price', Utils.fmtMoney(v.sale.sellingPrice)) : miniStat('Status', v.status[0].toUpperCase()+v.status.slice(1))}
          ${v.status==='sold' ? miniStat(profit>=0?'Net Profit':'Net Loss', Utils.fmtMoney(Math.abs(profit)), profit>=0?'text-green':'text-red') : ''}
          ${v.status==='sold' ? miniStat('Days Held', held+' days') : miniStat('Days in Stock', Utils.daysBetween(v.purchaseDate)+' days')}
        </div>
        <div class="form-grid" style="font-size:13px; color:var(--text-muted);">
          <div>Color: <b style="color:var(--text)">${v.color||'—'}</b></div>
          <div>Mileage: <b style="color:var(--text)">${Utils.fmtNum(v.mileage||0)}</b></div>
          <div>Transmission: <b style="color:var(--text)">${v.transmission||'—'}</b></div>
          <div>Fuel: <b style="color:var(--text)">${v.fuelType||'—'}</b></div>
          <div>Engine: <b style="color:var(--text)">${v.engine||'—'}</b></div>
          <div>Seller: <b style="color:var(--text)">${v.sellerName||'—'}</b></div>
        </div>
        ${v.notes ? `<p style="font-size:13px; color:var(--text-muted); margin-top:14px;">${Utils.escapeHtml(v.notes)}</p>` : ''}
        ${v.tags && v.tags.length ? `<div class="tag-list" style="margin-top:12px;">${v.tags.map(t=>`<span class="tag">${Utils.escapeHtml(t)}</span>`).join('')}</div>` : ''}
      </div>

      <div class="panel">
        <div class="panel-head">
          <h3>Expenses</h3>
          <button class="btn btn-secondary btn-sm" id="addExpBtn">${iconHTML('plus')} Add Expense</button>
        </div>
        <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th></th></tr></thead>
          <tbody>
            ${(v.expenses||[]).map(e=>`
              <tr>
                <td class="mono">${Utils.fmtDate(e.date)}</td>
                <td>${e.category}</td>
                <td>${Utils.escapeHtml(e.description||'—')}</td>
                <td class="mono">${Utils.fmtMoney(e.amount)}</td>
                <td class="row-actions"><button class="icon-btn del-exp" data-id="${e.id}">${iconHTML('trash')}</button></td>
              </tr>`).join('') || `<tr><td colspan="5" style="color:var(--text-muted); text-align:center; padding:24px;">No expenses logged yet.</td></tr>`}
          </tbody>
        </table>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h3>Timeline</h3></div>
        <div class="timeline">
          <div class="timeline-item">
            <div class="timeline-date">${Utils.fmtDate(v.purchaseDate)}</div>
            <div class="timeline-title">Vehicle Purchased</div>
            <div class="timeline-desc">Bought for ${Utils.fmtMoney(v.purchasePrice)} ${v.sellerName?('from '+Utils.escapeHtml(v.sellerName)):''}</div>
          </div>
          ${(v.expenses||[]).slice().sort((a,b)=>new Date(a.date)-new Date(b.date)).map(e=>`
            <div class="timeline-item tl-expense">
              <div class="timeline-date">${Utils.fmtDate(e.date)}</div>
              <div class="timeline-title">${e.category} Expense</div>
              <div class="timeline-desc">${Utils.fmtMoney(e.amount)} ${e.description?('— '+Utils.escapeHtml(e.description)):''}</div>
            </div>`).join('')}
          ${v.sale ? `
            <div class="timeline-item tl-sale">
              <div class="timeline-date">${Utils.fmtDate(v.sale.date)}</div>
              <div class="timeline-title">Vehicle Sold</div>
              <div class="timeline-desc">Sold for ${Utils.fmtMoney(v.sale.sellingPrice)} to ${Utils.escapeHtml(v.sale.buyerName||'buyer')}</div>
            </div>` : ''}
        </div>
      </div>
    `;
    renderIcons(el);

    el.querySelector('#backToInv').addEventListener('click', ()=>App.navigate('inventory'));
    el.querySelector('#editVehBtn').addEventListener('click', ()=>openVehicleModal(v));
    el.querySelector('#deleteVehBtn').addEventListener('click', ()=>{
      Modal.confirm('Delete Vehicle?', `This will delete ${v.stockId} and reverse all related financial entries. You can undo this within the current session.`, ()=>{
        const removed = Storage_DB.deleteVehicle(v.id);
        App.refreshChrome();
        App.navigate('inventory');
        Notify.show('Vehicle deleted', 'error', {
          actionLabel: 'Undo',
          duration: 6000,
          onAction: ()=>{
            Storage_DB.data.vehicles.unshift(removed);
            Storage_DB.data.cash -= (removed.purchasePrice || 0);
            (removed.expenses||[]).forEach(e=> Storage_DB.data.cash -= e.amount);
            if(removed.sale) Storage_DB.data.cash += (removed.sale.sellingPrice - (removed.sale.commission||0));
            Storage_DB.save();
            App.refreshChrome();
            if(App.currentView==='inventory') Inventory.render();
            Notify.show('Deletion undone', 'success');
          }
        });
      });
    });
    const sellBtn = el.querySelector('#sellBtn');
    if(sellBtn) sellBtn.addEventListener('click', ()=>Sales.openSellModal(v.id));
    el.querySelector('#addExpBtn').addEventListener('click', ()=>openExpenseModal(v.id));
    el.querySelectorAll('.del-exp').forEach(b=>b.addEventListener('click', ()=>{
      Modal.confirm('Delete Expense?', 'This expense amount will be refunded back to available cash.', ()=>{
        Storage_DB.deleteExpense(v.id, b.dataset.id);
        Notify.show('Expense removed', 'success');
        App.refreshChrome();
        renderDetail(v.id);
      });
    }));
  }
  function miniStat(label, value, cls){
    return `<div class="stat-card"><div class="stat-label">${label}</div><div class="stat-value mono ${cls||''}">${value}</div></div>`;
  }
  function emptyDetail(){
    return `<div class="empty-state">${iconHTML('car')}<h4>Vehicle not found</h4><p>It may have been deleted.</p></div>`;
  }

  function openExpenseModal(vehicleId){
    const overlay = Modal.open(`
      <div class="modal-head"><h3>Add Expense</h3><button class="icon-btn" data-modal-close><i data-icon="x"></i></button></div>
      <div class="modal-body">
        <div class="form-grid">
          <label class="field"><span>Amount *</span><input type="number" step="0.01" id="e_amount" required></label>
          <label class="field"><span>Date *</span><input type="date" id="e_date" value="${Utils.todayISO()}"></label>
          <label class="field full"><span>Category *</span><select id="e_category">${CATEGORIES.map(c=>`<option>${c}</option>`).join('')}</select></label>
          <label class="field full"><span>Description</span><input id="e_desc"></label>
          <label class="field full"><span>Receipt Image</span><input type="file" id="e_receipt" accept="image/*"></label>
        </div>
        <div id="expError" class="login-error"></div>
      </div>
      <div class="modal-foot"><button class="btn btn-secondary" data-modal-close>Cancel</button><button class="btn btn-primary" id="saveExpBtn">Add Expense</button></div>
    `, { maxWidth: 480 });
    let receipt = null;
    overlay.querySelector('#e_receipt').addEventListener('change', async e=>{
      if(e.target.files[0]) receipt = await Utils.fileToDataURL(e.target.files[0]);
    });
    overlay.querySelector('#saveExpBtn').addEventListener('click', ()=>{
      const amount = Number(overlay.querySelector('#e_amount').value);
      if(!amount || amount<=0){ overlay.querySelector('#expError').textContent = 'Enter a valid amount'; return; }
      try{
        Storage_DB.addExpense(vehicleId, {
          amount, date: overlay.querySelector('#e_date').value || Utils.todayISO(),
          category: overlay.querySelector('#e_category').value,
          description: overlay.querySelector('#e_desc').value,
          receipt
        });
        Notify.show('Expense added', 'success');
        Modal.close(overlay);
        App.refreshChrome();
        renderDetail(vehicleId);
      }catch(err){ overlay.querySelector('#expError').textContent = err.message; }
    });
  }

  return { render, openVehicleModal, openDetail, renderDetail, COMMON_TAGS };
})();
