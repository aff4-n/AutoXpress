const Analytics = (() => {
  let charts = [];

  function render(){
    const el = document.getElementById('view-analytics');
    const m = Metrics;
    const mp = m.mostProfitable(), lp = m.leastProfitable(), mep = m.mostExpensivePurchase(),
          hsp = m.highestSellingPrice(), brand = m.mostCommonBrand(), fs = m.fastestSelling(), ss = m.slowestSelling();

    el.innerHTML = `
      <div class="stat-grid">
        ${insightCard('star','accent-green','Most Profitable Car', mp ? vLabel(mp.v)+' · +'+Utils.fmtMoney(mp.p) : '—')}
        ${insightCard('down','accent-red','Least Profitable Car', lp ? vLabel(lp.v)+' · '+Utils.fmtMoney(lp.p) : '—')}
        ${insightCard('bank','accent-blue','Most Expensive Purchase', mep ? vLabel(mep)+' · '+Utils.fmtMoney(mep.purchasePrice) : '—')}
        ${insightCard('trend','accent-green','Highest Selling Price', hsp ? vLabel(hsp)+' · '+Utils.fmtMoney(hsp.sale.sellingPrice) : '—')}
        ${insightCard('car','accent-blue','Most Common Brand', brand ? `${brand.brand} (${brand.count})` : '—')}
        ${insightCard('clock','accent-green','Fastest Selling', fs ? vLabel(fs.v)+' · '+fs.days+'d' : '—')}
        ${insightCard('clock','accent-warn','Slowest Selling', ss ? vLabel(ss.v)+' · '+ss.days+'d' : '—')}
        ${insightCard('tag','accent-blue','Cars Sold This Month', m.carsSoldThisMonth())}
        ${insightCard('wallet','accent-blue','Avg Purchase Price', Utils.fmtMoney(m.avgPurchasePrice()))}
        ${insightCard('wallet','accent-blue','Avg Expense / Vehicle', Utils.fmtMoney(m.avgExpensePerVehicle()))}
      </div>

      <div class="chart-grid">
        <div class="panel"><div class="panel-head"><h3>Monthly Sales</h3></div><div class="chart-box"><canvas id="chSales"></canvas></div></div>
        <div class="panel"><div class="panel-head"><h3>Monthly Purchases</h3></div><div class="chart-box"><canvas id="chPurchases"></canvas></div></div>
        <div class="panel"><div class="panel-head"><h3>Inventory Value Trend</h3></div><div class="chart-box"><canvas id="chInvValue"></canvas></div></div>
        <div class="panel"><div class="panel-head"><h3>Expense Breakdown</h3></div><div class="chart-box"><canvas id="chExpBreak"></canvas></div></div>
        <div class="panel"><div class="panel-head"><h3>Brand Distribution</h3></div><div class="chart-box"><canvas id="chBrand"></canvas></div></div>
        <div class="panel"><div class="panel-head"><h3>Loss Trend</h3></div><div class="chart-box"><canvas id="chLoss"></canvas></div></div>
      </div>

      <div class="chart-grid">
        <div class="panel">
          <div class="panel-head"><h3>Top 5 Profitable Cars</h3></div>
          ${leaderboard(m.topProfitable(5).map(x=>({label:vLabel(x.v), value:x.p, positive:x.p>=0})))}
        </div>
        <div class="panel">
          <div class="panel-head"><h3>Top 5 Expense-Heavy Cars</h3></div>
          ${leaderboard(m.topExpenseHeavy(5).map(x=>({label:vLabel(x.v), value:x.exp, positive:false})))}
        </div>
        <div class="panel">
          <div class="panel-head"><h3>Top 5 Brands</h3></div>
          ${leaderboard(m.topBrands(5).map(x=>({label:x[0], value:x[1], positive:true, isCount:true})))}
        </div>
      </div>
    `;
    renderIcons(el);
    drawCharts();
  }

  function vLabel(v){ return `${v.year} ${v.make} ${v.model}`; }
  function insightCard(icon, cls, label, value){
    return `<div class="stat-card ${cls}"><div class="stat-icon">${iconHTML(icon)}</div><div class="stat-label">${label}</div><div class="stat-value mono" style="font-size:14.5px;">${value}</div></div>`;
  }
  function leaderboard(items){
    if(!items.length) return `<div class="empty-state" style="padding:30px 10px;">${iconHTML('chart')}<p>Not enough data yet.</p></div>`;
    const max = Math.max(...items.map(i=>Math.abs(i.value)),1);
    return `<div style="display:flex; flex-direction:column; gap:12px;">
      ${items.map((i,idx)=>`
        <div>
          <div class="flex-between" style="margin-bottom:5px; font-size:12.5px;">
            <span>${idx+1}. ${Utils.escapeHtml(i.label)}</span>
            <span class="mono ${i.positive?'text-green':'text-red'}">${i.isCount ? i.value : Utils.fmtMoney(i.value)}</span>
          </div>
          <div style="height:6px; border-radius:4px; background:rgba(255,255,255,0.06); overflow:hidden;">
            <div style="height:100%; width:${Math.min(100, Math.abs(i.value)/max*100)}%; background:${i.positive?'var(--accent)':'var(--danger)'};"></div>
          </div>
        </div>`).join('')}
    </div>`;
  }

  function drawCharts(){
    charts.forEach(c=>c.destroy()); charts = [];
    const grid = 'rgba(255,255,255,0.07)', text='#9CA3AF';
    const opts = { responsive:true, maintainAspectRatio:false, plugins:{legend:{labels:{color:text,font:{family:'Inter',size:11}}}}, scales:{ x:{grid:{color:grid},ticks:{color:text,font:{family:'IBM Plex Mono',size:10}}}, y:{grid:{color:grid},ticks:{color:text,font:{family:'IBM Plex Mono',size:10}}} } };
    const pieOpts = { responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'right', labels:{color:text, boxWidth:10, font:{size:10.5}}}} };
    const palette = ['#00C853','#00B0FF','#FFC107','#FF5252','#7C4DFF','#00E5FF','#FF6E40','#B2FF59'];

    const sales = Metrics.monthlySalesSeries(6);
    charts.push(new Chart(document.getElementById('chSales'), { type:'bar', data:{ labels:sales.labels, datasets:[{ label:'Cars Sold', data:sales.values, backgroundColor:'#00C853', borderRadius:5 }] }, options: opts }));

    const purch = Metrics.monthlyPurchaseSeries(6);
    charts.push(new Chart(document.getElementById('chPurchases'), { type:'bar', data:{ labels:purch.labels, datasets:[{ label:'Cars Purchased', data:purch.values, backgroundColor:'#00B0FF', borderRadius:5 }] }, options: opts }));

    const invVal = Metrics.inventoryValueTrendSeries(6);
    charts.push(new Chart(document.getElementById('chInvValue'), { type:'line', data:{ labels:invVal.labels, datasets:[{ label:'Inventory Value', data:invVal.values, borderColor:'#00B0FF', backgroundColor:'rgba(0,176,255,0.12)', fill:true, tension:.35 }] }, options: opts }));

    const expBreak = Metrics.expenseBreakdown();
    const expLabels = Object.keys(expBreak), expValues = Object.values(expBreak);
    charts.push(new Chart(document.getElementById('chExpBreak'), { type:'doughnut', data:{ labels: expLabels.length?expLabels:['No expenses'], datasets:[{ data: expValues.length?expValues:[1], backgroundColor: palette, borderWidth:0 }] }, options: pieOpts }));

    const brandDist = Metrics.brandDistribution();
    const bLabels = Object.keys(brandDist), bValues = Object.values(brandDist);
    charts.push(new Chart(document.getElementById('chBrand'), { type:'pie', data:{ labels: bLabels.length?bLabels:['No vehicles'], datasets:[{ data: bValues.length?bValues:[1], backgroundColor: palette, borderWidth:0 }] }, options: pieOpts }));

    // Safely use your robust monthlySeries metric pipeline to map monthly transaction totals
    const loss6 = Metrics.monthlySeries(6, (d, key) => {
      return Metrics.allProfitsLosses()
        .filter(x => Utils.monthKey(x.v.sale.date) === key && x.p < 0)
        .reduce((s, x) => s + Math.abs(x.p), 0);
    });

    charts.push(new Chart(document.getElementById('chLoss'), { type:'bar', data:{ labels:loss6.labels, datasets:[{ label:'Loss', data:loss6.values, backgroundColor:'#FF5252', borderRadius:5 }] }, options: opts }));
  }

  return { render };
})();