const Metrics = (() => {
  function db(){ return Storage_DB.data; }

  function soldVehicles(){ return db().vehicles.filter(v=>v.status==='sold' && v.sale); }
  function stockVehicles(){ return db().vehicles.filter(v=>v.status!=='sold'); }

  function profitOf(v){ return Storage_DB.vehicleProfit(v); }

  function totalInvestment(){
    return db().investment.transactions.filter(t=>t.type==='initial'||t.type==='add').reduce((s,t)=>s+t.amount,0);
  }
  function totalWithdrawn(){
    return db().investment.transactions.filter(t=>t.type==='withdraw').reduce((s,t)=>s+t.amount,0);
  }
  function inventoryValue(){
    return stockVehicles().reduce((s,v)=>s+Storage_DB.vehicleCost(v),0);
  }
  function totalRevenue(){
    return soldVehicles().reduce((s,v)=>s+Number(v.sale.sellingPrice||0),0);
  }
  function allProfitsLosses(){
    const list = soldVehicles().map(v=>({ v, p: profitOf(v) }));
    return list;
  }
  function totalProfit(){ return allProfitsLosses().filter(x=>x.p>0).reduce((s,x)=>s+x.p,0); }
  function totalLoss(){ return Math.abs(allProfitsLosses().filter(x=>x.p<0).reduce((s,x)=>s+x.p,0)); }
  function profitInRange(pred){
    return allProfitsLosses().filter(x=> pred(new Date(x.v.sale.date)) ).reduce((s,x)=> x.p>0? s+x.p : s, 0);
  }
  function lossInRange(pred){
    return Math.abs(allProfitsLosses().filter(x=> pred(new Date(x.v.sale.date)) ).reduce((s,x)=> x.p<0? s+x.p : s, 0));
  }
  function thisMonthProfit(){ return profitInRange(d=>Utils.isSameMonth(d)); }
  function thisMonthLoss(){ return lossInRange(d=>Utils.isSameMonth(d)); }
  function thisWeekProfit(){ return profitInRange(d=>Utils.isSameWeek(d)); }
  function thisWeekLoss(){ return lossInRange(d=>Utils.isSameWeek(d)); }
  function todayProfit(){ return profitInRange(d=>Utils.isToday(d)); }
  function todayLoss(){ return lossInRange(d=>Utils.isToday(d)); }

  function avgProfitPerCar(){
    const list = allProfitsLosses();
    if(!list.length) return 0;
    return list.reduce((s,x)=>s+x.p,0) / list.length;
  }
  function avgHoldingTime(){
    const list = soldVehicles();
    if(!list.length) return 0;
    const days = list.map(v=>Utils.daysBetween(v.purchaseDate, v.sale.date));
    return Math.round(days.reduce((a,b)=>a+b,0) / list.length);
  }
  function roi(){
    const inv = totalInvestment();
    if(!inv) return 0;
    return (totalProfit() - totalLoss()) / inv * 100;
  }
  function netWorth(){ return Storage_DB.netWorth(); }

  function largestProfit(){
    const list = allProfitsLosses().filter(x=>x.p>0).sort((a,b)=>b.p-a.p);
    return list[0] || null;
  }
  function largestLoss(){
    const list = allProfitsLosses().filter(x=>x.p<0).sort((a,b)=>a.p-b.p);
    return list[0] || null;
  }
  function mostProfitable(){ return largestProfit(); }
  function leastProfitable(){
    const list = allProfitsLosses().sort((a,b)=>a.p-b.p);
    return list[0] || null;
  }
  function mostExpensivePurchase(){
    return [...db().vehicles].sort((a,b)=>b.purchasePrice-a.purchasePrice)[0] || null;
  }
  function highestSellingPrice(){
    return [...soldVehicles()].sort((a,b)=>b.sale.sellingPrice-a.sale.sellingPrice)[0] || null;
  }
  function avgSellingPrice(){
    const list = soldVehicles();
    if(!list.length) return 0;
    return list.reduce((s,v)=>s+Number(v.sale.sellingPrice||0),0)/list.length;
  }
  function avgPurchasePrice(){
    const list = db().vehicles;
    if(!list.length) return 0;
    return list.reduce((s,v)=>s+Number(v.purchasePrice||0),0)/list.length;
  }
  function avgExpensePerVehicle(){
    const list = db().vehicles;
    if(!list.length) return 0;
    const totalExp = list.reduce((s,v)=>s+(v.expenses||[]).reduce((a,e)=>a+Number(e.amount||0),0),0);
    return totalExp/list.length;
  }
  function mostCommonBrand(){
    const counts = {};
    db().vehicles.forEach(v=>{ counts[v.make]=(counts[v.make]||0)+1; });
    const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
    return sorted[0] ? {brand:sorted[0][0], count:sorted[0][1]} : null;
  }
  function fastestSelling(){
    const list = soldVehicles().map(v=>({v, days:Utils.daysBetween(v.purchaseDate, v.sale.date)})).sort((a,b)=>a.days-b.days);
    return list[0] || null;
  }
  function slowestSelling(){
    const list = soldVehicles().map(v=>({v, days:Utils.daysBetween(v.purchaseDate, v.sale.date)})).sort((a,b)=>b.days-a.days);
    return list[0] || null;
  }
  function carsSoldThisMonth(){ return soldVehicles().filter(v=>Utils.isSameMonth(v.sale.date)).length; }

  function monthlySeries(monthsBack, valueFn){
    const now = new Date();
    const labels = []; const values = [];
    for(let i=monthsBack-1;i>=0;i--){
      const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      labels.push(d.toLocaleDateString(undefined,{month:'short', year:'2-digit'}));
      values.push(valueFn(d, key));
    }
    return { labels, values };
  }
  function monthlyProfitSeries(months){
    return monthlySeries(months, (d,key)=>{
      return allProfitsLosses().filter(x=>Utils.monthKey(x.v.sale.date)===key).reduce((s,x)=>s+x.p,0);
    });
  }
  function monthlyExpenseSeries(months){
    return monthlySeries(months, (d,key)=>{
      let sum = 0;
      db().vehicles.forEach(v=> (v.expenses||[]).forEach(e=>{ if(Utils.monthKey(e.date)===key) sum += Number(e.amount||0); }));
      return sum;
    });
  }
  function monthlySalesSeries(months){
    return monthlySeries(months, (d,key)=> soldVehicles().filter(v=>Utils.monthKey(v.sale.date)===key).length );
  }
  function monthlyPurchaseSeries(months){
    return monthlySeries(months, (d,key)=> db().vehicles.filter(v=>Utils.monthKey(v.purchaseDate)===key).length );
  }
  function monthlyRevenueExpenseSeries(months){
    const rev = monthlySeries(months, (d,key)=> soldVehicles().filter(v=>Utils.monthKey(v.sale.date)===key).reduce((s,v)=>s+Number(v.sale.sellingPrice||0),0));
    const exp = monthlyExpenseSeries(months);
    return { labels: rev.labels, revenue: rev.values, expense: exp.values };
  }
  function inventoryValueTrendSeries(months){
    // approximate: value of vehicles purchased minus sold cost per month, cumulative
    return monthlySeries(months, (d,key)=>{
      const purchasedUpTo = db().vehicles.filter(v=> new Date(v.purchaseDate) <= new Date(d.getFullYear(), d.getMonth()+1, 0));
      const stillStockAt = purchasedUpTo.filter(v=> !v.sale || new Date(v.sale.date) > new Date(d.getFullYear(), d.getMonth()+1, 0));
      return stillStockAt.reduce((s,v)=>s+Storage_DB.vehicleCost(v),0);
    });
  }
  function expenseBreakdown(){
    const cats = {};
    db().vehicles.forEach(v=> (v.expenses||[]).forEach(e=>{ cats[e.category]=(cats[e.category]||0)+Number(e.amount||0); }));
    return cats;
  }
  function brandDistribution(){
    const counts = {};
    db().vehicles.forEach(v=>{ counts[v.make]=(counts[v.make]||0)+1; });
    return counts;
  }
  function topProfitable(n){
    return allProfitsLosses().sort((a,b)=>b.p-a.p).slice(0,n);
  }
  function topExpenseHeavy(n){
    return [...db().vehicles].map(v=>({v, exp:(v.expenses||[]).reduce((s,e)=>s+Number(e.amount||0),0)})).sort((a,b)=>b.exp-a.exp).slice(0,n);
  }
  function topBrands(n){
    return Object.entries(brandDistribution()).sort((a,b)=>b[1]-a[1]).slice(0,n);
  }
  function staleVehicles(){
    const days = db().settings.staleDays || 45;
    return stockVehicles().filter(v=> Utils.daysBetween(v.purchaseDate) > days);
  }

  return {
    soldVehicles, stockVehicles, profitOf, allProfitsLosses, allProfitsLossesSafe: allProfitsLosses, totalInvestment, totalWithdrawn, inventoryValue, totalRevenue,
    totalProfit, totalLoss, thisMonthProfit, thisMonthLoss, thisWeekProfit, thisWeekLoss, todayProfit, todayLoss,
    avgProfitPerCar, avgHoldingTime, roi, netWorth, largestProfit, largestLoss, mostProfitable, leastProfitable,
    mostExpensivePurchase, highestSellingPrice, avgSellingPrice, avgPurchasePrice, avgExpensePerVehicle,
    mostCommonBrand, fastestSelling, slowestSelling, carsSoldThisMonth, monthlyProfitSeries, monthlyExpenseSeries,
    monthlySalesSeries, monthlyPurchaseSeries, monthlyRevenueExpenseSeries, inventoryValueTrendSeries,
    expenseBreakdown, brandDistribution, topProfitable, topExpenseHeavy, topBrands, staleVehicles
  };
})();
