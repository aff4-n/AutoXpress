const Reports = (() => {
  const REPORTS = [
    { id:'inventory', name:'Inventory Report', desc:'All vehicles currently in stock or reserved', icon:'car' },
    { id:'sales', name:'Sales Report', desc:'Every vehicle sold, with buyer and profit detail', icon:'tag' },
    { id:'expense', name:'Expense Report', desc:'Full expense ledger across all vehicles', icon:'wallet' },
    { id:'profit', name:'Profit Report', desc:'Profitable sales ranked by margin', icon:'up' },
    { id:'loss', name:'Loss Report', desc:'Loss-making sales ranked by severity', icon:'down' },
    { id:'cashflow', name:'Cash Flow Report', desc:'Investment transactions and running balance', icon:'bank' },
    { id:'monthly', name:'Monthly Report', desc:'Rolling 12-month performance summary', icon:'chart' },
    { id:'yearly', name:'Yearly Report', desc:'Performance summary grouped by year', icon:'doc' },
  ];

  function render(){
    const el = document.getElementById('view-reports');
    el.innerHTML = `
      <div class="chart-grid">
        ${REPORTS.map(r=>`
          <div class="panel">
            <div class="panel-head">
              <div class="flex gap-8" style="align-items:center;">
                <div class="stat-icon accent-blue" style="margin:0; background:var(--accent2-dim); color:var(--accent2);">${iconHTML(r.icon)}</div>
                <div><h3 style="margin:0;">${r.name}</h3><span class="panel-sub">${r.desc}</span></div>
              </div>
            </div>
            <div class="flex gap-8">
              <button class="btn btn-secondary btn-sm" data-report="${r.id}" data-action="csv">${iconHTML('download')} CSV</button>
              <button class="btn btn-secondary btn-sm" data-report="${r.id}" data-action="print">${iconHTML('print')} Print / PDF</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    renderIcons(el);
    el.querySelectorAll('[data-report]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const rows = buildRows(btn.dataset.report);
        if(btn.dataset.action==='csv') exportCSV(btn.dataset.report, rows);
        else printReport(btn.dataset.report, rows);
      });
    });
  }

  function buildRows(id){
    const vehicles = Storage_DB.data.vehicles;
    switch(id){
      case 'inventory':
        return vehicles.filter(v=>v.status!=='sold').map(v=>({
          StockID:v.stockId, Make:v.make, Model:v.model, Year:v.year, Reg:v.reg||'', Status:v.status,
          PurchaseDate:Utils.fmtDate(v.purchaseDate), PurchasePrice:v.purchasePrice, TotalCost:Storage_DB.vehicleCost(v)
        }));
      case 'sales':
        return Metrics.soldVehicles().map(v=>({
          StockID:v.stockId, Make:v.make, Model:v.model, Year:v.year, SoldDate:Utils.fmtDate(v.sale.date),
          Buyer:v.sale.buyerName||'', SellingPrice:v.sale.sellingPrice, Cost:Storage_DB.vehicleCost(v), Profit:Storage_DB.vehicleProfit(v)
        }));
      case 'expense':
        return vehicles.flatMap(v => (v.expenses||[]).map(e=>({
          StockID:v.stockId, Vehicle:`${v.year} ${v.make} ${v.model}`, Date:Utils.fmtDate(e.date), Category:e.category, Description:e.description||'', Amount:e.amount
        })));
      case 'profit':
        return Metrics.allProfitsLossesSafe().filter(x=>x.p>0).sort((a,b)=>b.p-a.p).map(x=>({
          StockID:x.v.stockId, Vehicle:`${x.v.year} ${x.v.make} ${x.v.model}`, SoldDate:Utils.fmtDate(x.v.sale.date), Profit:x.p
        }));
      case 'loss':
        return Metrics.allProfitsLossesSafe().filter(x=>x.p<0).sort((a,b)=>a.p-b.p).map(x=>({
          StockID:x.v.stockId, Vehicle:`${x.v.year} ${x.v.make} ${x.v.model}`, SoldDate:Utils.fmtDate(x.v.sale.date), Loss:Math.abs(x.p)
        }));
      case 'cashflow': {
        let running = 0;
        return Storage_DB.data.investment.transactions.slice().sort((a,b)=>new Date(a.date)-new Date(b.date)).map(t=>{
          running += (t.type==='withdraw' ? -t.amount : t.amount);
          return { Date:Utils.fmtDate(t.date), Type:t.type, Amount:t.amount, Reason:t.reason||'', RunningBalance: running };
        });
      }
      case 'monthly': {
        const s = Metrics.monthlyRevenueExpenseSeries(12);
        const p = Metrics.monthlyProfitSeries(12);
        return s.labels.map((l,i)=>({ Month:l, Revenue:s.revenue[i], Expenses:s.expense[i], Profit:p.values[i] }));
      }
      case 'yearly': {
        const byYear = {};
        Metrics.soldVehicles().forEach(v=>{
          const y = new Date(v.sale.date).getFullYear();
          byYear[y] = byYear[y] || { Year:y, CarsSold:0, Revenue:0, Profit:0 };
          byYear[y].CarsSold++; byYear[y].Revenue += Number(v.sale.sellingPrice||0); byYear[y].Profit += Storage_DB.vehicleProfit(v);
        });
        return Object.values(byYear).sort((a,b)=>a.Year-b.Year);
      }
      default: return [];
    }
  }

  function exportCSV(id, rows){
    if(!rows.length){ Notify.show('No data available for this report yet', 'info'); return; }
    Utils.downloadFile(`autoxpress-${id}-${Utils.todayISO()}.csv`, Utils.toCSV(rows), 'text/csv');
    Notify.show('Report exported as CSV', 'success');
  }

  function printReport(id, rows){
    const meta = REPORTS.find(r=>r.id===id);
    const headers = rows.length ? Object.keys(rows[0]) : [];
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>${meta.name} — Auto Xpress</title>
      <style>
        body{ font-family: Arial, sans-serif; padding:32px; color:#111; }
        h1{ font-size:20px; margin-bottom:2px; } p{ color:#555; font-size:12px; margin-top:0; }
        table{ width:100%; border-collapse:collapse; margin-top:20px; font-size:12px; }
        th,td{ border:1px solid #ddd; padding:8px 10px; text-align:left; }
        th{ background:#f4f4f4; text-transform:uppercase; font-size:10px; letter-spacing:.03em; }
      </style></head><body>
      <h1>${meta.name}</h1>
      <p>Auto Xpress · Generated ${Utils.fmtDateTime(new Date())}</p>
      <table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r=>`<tr>${headers.map(h=>`<td>${r[h]}</td>`).join('')}</tr>`).join('') || `<tr><td>No data available</td></tr>`}</tbody></table>
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(()=>win.print(), 300);
  }

  return { render, buildRows };
})();
