const Settings = (() => {
  function render(){
    const el = document.getElementById('view-settings');
    const s = Storage_DB.data.settings;
    el.innerHTML = `
      <div class="chart-grid">
        <div class="panel">
          <div class="panel-head"><h3>Appearance</h3><span class="panel-sub">Theme & display</span></div>
          <div class="field"><span>Theme</span>
            <select id="set_theme"><option value="dark" ${s.theme==='dark'?'selected':''}>Dark (default)</option><option value="light" ${s.theme==='light'?'selected':''}>Light</option></select>
          </div>
          <div class="field"><span>Default Currency</span>
            <select id="set_currency">
              ${['USD','PKR','AED','GBP','EUR','INR'].map(c=>`<option value="${c}" ${s.currency===c?'selected':''}>${c}</option>`).join('')}
            </select>
          </div>
          <div class="field mb-0"><span>Alert vehicles held longer than (days)</span><input type="number" id="set_stale" value="${s.staleDays}"></div>
        </div>

        <div class="panel">
          <div class="panel-head"><h3>Cash Rules</h3><span class="panel-sub">Financial validation</span></div>
          <label class="field" style="display:flex; align-items:center; gap:10px; flex-direction:row;">
            <input type="checkbox" id="set_allowNeg" ${s.allowNegativeCash?'checked':''} style="width:auto;">
            <span style="margin:0;">Allow purchases/expenses to push cash negative</span>
          </label>
          <p style="font-size:12px; color:var(--text-muted);">When off, Auto Xpress blocks any action that would overdraw your available cash.</p>
        </div>

        <div class="panel">
          <div class="panel-head"><h3>Data Management</h3><span class="panel-sub">Backup, restore, or reset</span></div>
          <div class="flex gap-8" style="flex-wrap:wrap;">
            <button class="btn btn-secondary btn-sm" id="backupBtn">${iconHTML('download')} Backup Data (JSON)</button>
            <button class="btn btn-secondary btn-sm" id="restoreBtn">${iconHTML('upload')} Restore Data</button>
            <input type="file" id="restoreFile" accept=".json" class="hidden">
            <button class="btn btn-danger btn-sm" id="resetBtn">${iconHTML('trash')} Reset Application</button>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head"><h3>Audit Log</h3><span class="panel-sub">Recent edits and deletions</span></div>
          <div class="timeline">
            ${Storage_DB.data.auditLog.slice(0,10).map(a=>`
              <div class="timeline-item"><div class="timeline-date">${Utils.fmtDateTime(a.date)}</div><div class="timeline-desc">${a.action} · ${a.entity} · ${Utils.escapeHtml(a.details||'')}</div></div>
            `).join('') || `<div style="color:var(--text-muted); font-size:13px;">No audit entries yet.</div>`}
          </div>
        </div>
      </div>
    `;
    renderIcons(el);

    el.querySelector('#set_theme').addEventListener('change', e=>{ s.theme=e.target.value; Storage_DB.save(); Theme.apply(s.theme); });
    el.querySelector('#set_currency').addEventListener('change', e=>{ s.currency=e.target.value; Storage_DB.save(); App.refreshChrome(); Notify.show('Currency updated', 'success'); });
    el.querySelector('#set_stale').addEventListener('change', e=>{ s.staleDays=Number(e.target.value)||45; Storage_DB.save(); Notify.show('Stale-vehicle threshold updated', 'success'); });
    el.querySelector('#set_allowNeg').addEventListener('change', e=>{ s.allowNegativeCash=e.target.checked; Storage_DB.save(); });

    el.querySelector('#backupBtn').addEventListener('click', ()=>{
      Utils.downloadFile(`autoxpress-backup-${Utils.todayISO()}.json`, JSON.stringify(Storage_DB.data, null, 2), 'application/json');
      Notify.show('Backup exported', 'success');
    });
    el.querySelector('#restoreBtn').addEventListener('click', ()=>el.querySelector('#restoreFile').click());
    el.querySelector('#restoreFile').addEventListener('change', e=>{
      const file = e.target.files[0];
      if(!file) return;
      Modal.confirm('Restore Data?', 'This will overwrite all current data with the contents of the backup file.', ()=>{
        const reader = new FileReader();
        reader.onload = ()=>{
          try{
            const parsed = JSON.parse(reader.result);
            Storage_DB.data = parsed;
            Storage_DB.save();
            Notify.show('Data restored successfully', 'success');
            App.refreshChrome(); render();
          }catch(err){ Notify.show('Invalid backup file', 'error'); }
        };
        reader.readAsText(file);
      }, { confirmLabel:'Restore' });
    });
    el.querySelector('#resetBtn').addEventListener('click', ()=>{
      Modal.confirm('Reset Application?', 'This will permanently erase all vehicles, sales, expenses, and investment history. This cannot be undone.', ()=>{
        Storage_DB.reset();
        Notify.show('Application reset', 'error');
        location.reload();
      });
    });
  }
  return { render };
})();
