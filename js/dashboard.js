const Dashboard = (() => {
  let chart1, chart2;

  function render(){
    const el = document.getElementById('view-dashboard');
    const m = Metrics;
    const stock = m.stockVehicles();
    const sold = m.soldVehicles();
    const stale = m.staleVehicles();

    el.innerHTML = `
      ${stale.length ? `
      <div class="panel" style="border-color:rgba(255,193,7,0.35); background:var(--warning-dim);">
        <div class="flex" style="gap:12px; align-items:flex-start;">
          <div style="color:var(--warning)">${iconHTML('warning')}</div>
          <div>
            <div style="font-weight:700; font-size:13.5px; margin-bottom:2px;">${stale.length} vehicle${stale.length>1?'s':''} held longer than ${Storage_DB.data.settings.staleDays} days</div>
            <div style="font-size:12.5px; color:var(--text-muted);">${stale.slice(0,3).map(v=>`${v.stockId} · ${v.make} ${v.model}`).join(', ')}${stale.length>3?` +${stale.length-3} more`:''}</div>
          </div>
        </div>
      </div>` : ''}

      <div class="stat-grid" id="statGrid">
        ${statCard('accent-green','wallet','Cash Available', Utils.fmtMoney(Storage_DB.data.cash), 'money')}
        ${statCard('accent-blue','car','Inventory Value', Utils.fmtMoney(m.inventoryValue()), 'money')}
        ${statCard('accent-blue','grid','Cars in Stock', Utils.fmtNum(stock.length), 'num')}
        ${statCard('accent-green','tag','Cars Sold', Utils.fmtNum(sold.length), 'num')}
        ${statCard('accent-blue','bank','Total Investment', Utils.fmtMoney(m.totalInvestment()), 'money')}
        ${statCard('accent-green','trend','Total Revenue', Utils.fmtMoney(m.totalRevenue()), 'money')}
        ${statCard('accent-green','up','Total Profit (All Time)', Utils.fmtMoney(m.totalProfit()), 'money')}
        ${statCard('accent-red','down','Total Loss (All Time)', Utils.fmtMoney(m.totalLoss()), 'money')}
        ${statCard('accent-green','up','Profit This Month', Utils.fmtMoney(m.thisMonthProfit()), 'money')}
        ${statCard('accent-red','down','Loss This Month', Utils.fmtMoney(m.thisMonthLoss()), 'money')}
        ${statCard('accent-blue','chart','Avg Profit / Car', Utils.fmtMoney(m.avgProfitPerCar()), 'money')}
        ${statCard('accent-blue','clock','Avg Holding Time', m.avgHoldingTime()+' days', 'raw')}
        ${statCard(m.roi()>=0?'accent-green':'accent-red','trend','Return on Investment', m.roi().toFixed(1)+'%', 'raw')}
        ${statCard('accent-blue','wallet','Net Worth', Utils.fmtMoney(m.netWorth()), 'money')}
      </div>

      <div class="chart-grid">
        <div class="panel">
          <div class="panel-head"><h3>Profit Trend</h3><span class="panel-sub">Last 6 months</span></div>
          <div class="chart-box"><canvas id="chartProfitTrend"></canvas></div>
        </div>
        <div class="panel">
          <div class="panel-head"><h3>Cash Flow</h3><span class="panel-sub">Revenue vs. Expenses</span></div>
          <div class="chart-box"><canvas id="chartCashFlow"></canvas></div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h3>Recent Activity</h3><span class="panel-sub">Latest actions across your dealership</span></div>
        <div class="timeline">
          ${Storage_DB.data.activity.slice(0,8).map(a=>`
            <div class="timeline-item ${a.type==='success'?'tl-sale':a.type==='warning'?'tl-expense':''}">
              <div class="timeline-date">${Utils.fmtDateTime(a.date)}</div>
              <div class="timeline-desc">${Utils.escapeHtml(a.message)}</div>
            </div>
          `).join('') || emptyRow('No activity yet — add your first vehicle to get started.')}
        </div>
      </div>
    `;
    renderIcons(el);
    drawCharts();
    el.querySelectorAll('.stat-value').forEach(v=>{ /* placeholder for future animated counters */ });
  }

  function statCard(cls, icon, label, value){
    return `<div class="stat-card ${cls}">
      <div class="stat-icon">${iconHTML(icon)}</div>
      <div class="stat-label">${label}</div>
      <div class="stat-value mono">${value}</div>
    </div>`;
  }
  function emptyRow(msg){ return `<div style="color:var(--text-muted); font-size:13px;">${msg}</div>`; }

  function drawCharts(){
    if(chart1) chart1.destroy();
    if(chart2) chart2.destroy();
    const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--border-soft');
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-muted');

    const pt = Metrics.monthlyProfitSeries(6);
    chart1 = new Chart(document.getElementById('chartProfitTrend'), {
      type:'line',
      data:{ labels: pt.labels, datasets:[{ label:'Profit', data:pt.values, borderColor:'#00C853', backgroundColor:'rgba(0,200,83,0.12)', fill:true, tension:.35, pointRadius:3 }] },
      options: chartOpts(gridColor, textColor)
    });

    const cf = Metrics.monthlyRevenueExpenseSeries(6);
    chart2 = new Chart(document.getElementById('chartCashFlow'), {
      type:'bar',
      data:{ labels: cf.labels, datasets:[
        { label:'Revenue', data:cf.revenue, backgroundColor:'#00B0FF', borderRadius:5 },
        { label:'Expenses', data:cf.expense, backgroundColor:'#FF5252', borderRadius:5 }
      ]},
      options: chartOpts(gridColor, textColor)
    });
  }

  function chartOpts(gridColor, textColor){
    return {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ labels:{ color: textColor.trim()||'#9CA3AF', font:{family:'Inter', size:11} } } },
      scales:{
        x:{ grid:{ color: gridColor.trim()||'rgba(255,255,255,0.07)' }, ticks:{ color: textColor.trim()||'#9CA3AF', font:{family:'IBM Plex Mono', size:10} } },
        y:{ grid:{ color: gridColor.trim()||'rgba(255,255,255,0.07)' }, ticks:{ color: textColor.trim()||'#9CA3AF', font:{family:'IBM Plex Mono', size:10} } }
      }
    };
  }

  return { render };
})();
