const Utils = (() => {
  const CURRENCY_SYMBOLS = { USD:'$', PKR:'₨', AED:'AED ', GBP:'£', EUR:'€', INR:'₹' };

  function currencySymbol(){
    const c = (Storage_DB && Storage_DB.data.settings.currency) || 'USD';
    return CURRENCY_SYMBOLS[c] || c+' ';
  }
  function fmtMoney(n){
    n = Number(n)||0;
    const neg = n < 0;
    const abs = Math.abs(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
    return (neg?'-':'') + currencySymbol() + abs;
  }
  function fmtNum(n){ return Number(n||0).toLocaleString(); }
  function fmtDate(d){
    if(!d) return '—';
    const date = new Date(d);
    if(isNaN(date)) return '—';
    return date.toLocaleDateString(undefined,{year:'numeric', month:'short', day:'numeric'});
  }
  function fmtDateTime(d){
    const date = new Date(d);
    if(isNaN(date)) return '—';
    return date.toLocaleDateString(undefined,{month:'short', day:'numeric'}) + ' · ' + date.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'});
  }
  function todayISO(){ return new Date().toISOString().slice(0,10); }
  function uid(prefix){ return (prefix?prefix+'-':'') + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
  function daysBetween(a,b){
    const d1 = new Date(a), d2 = b? new Date(b): new Date();
    return Math.max(0, Math.round((d2 - d1) / 86400000));
  }
  function debounce(fn, wait){
    let t;
    return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), wait); };
  }
  function escapeHtml(str){
    if(str===undefined||str===null) return '';
    return String(str).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }
  function downloadFile(filename, content, type){
    const blob = new Blob([content], {type: type||'text/plain'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 2000);
  }
  function toCSV(rows){
    if(!rows.length) return '';
    const headers = Object.keys(rows[0]);
    const esc = v => `"${String(v===undefined||v===null?'':v).replace(/"/g,'""')}"`;
    const lines = [headers.join(',')];
    rows.forEach(r => lines.push(headers.map(h=>esc(r[h])).join(',')));
    return lines.join('\n');
  }
  function fileToDataURL(file){
    return new Promise((res,rej)=>{
      const r = new FileReader();
      r.onload = ()=>res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }
  function monthKey(d){ const dt=new Date(d); return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`; }
  function isSameMonth(d, ref){ const a=new Date(d), b=ref||new Date(); return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth(); }
  function isSameWeek(d){
    const a = new Date(d); const now = new Date();
    const start = new Date(now); start.setDate(now.getDate()-now.getDay()); start.setHours(0,0,0,0);
    return a >= start && a <= now;
  }
  function isToday(d){ const a=new Date(d), b=new Date(); return a.toDateString()===b.toDateString(); }
  function animateCounter(el, to, opts){
    opts = opts || {};
    const isMoney = opts.money;
    const from = parseFloat(el.dataset.rawValue || 0);
    const duration = 700;
    const start = performance.now();
    function step(t){
      const p = Math.min(1, (t-start)/duration);
      const eased = 1 - Math.pow(1-p, 3);
      const val = from + (to-from)*eased;
      el.textContent = isMoney ? fmtMoney(val) : fmtNum(Math.round(val));
      if(p<1) requestAnimationFrame(step); else el.dataset.rawValue = to;
    }
    el.dataset.rawValue = from;
    requestAnimationFrame(step);
  }
  return { fmtMoney, fmtNum, fmtDate, fmtDateTime, todayISO, uid, daysBetween, debounce, escapeHtml, downloadFile, toCSV, fileToDataURL, monthKey, isSameMonth, isSameWeek, isToday, animateCounter, currencySymbol };
})();
