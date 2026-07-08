const App = (() => {
  let currentView = 'dashboard';
  const VIEW_META = {
    dashboard: { title:'Dashboard', sub:'Real-time overview of your dealership' },
    inventory: { title:'Inventory', sub:'Manage vehicles in stock, reserved, and sold' },
    vehicle:   { title:'Vehicle', sub:'Full history and financial detail' },
    sales:     { title:'Sales', sub:'Sold inventory and performance' },
    analytics: { title:'Analytics', sub:'Deep insights into your business' },
    reports:   { title:'Reports', sub:'Generate and export financial reports' },
    investment:{ title:'Investment', sub:'Capital contributions and withdrawals' },
    ledger:    { title:'Personal Ledger', sub:'Your own income, expenses, borrowed money, and loans given' },
    settings:  { title:'Settings', sub:'Preferences and data management' },
  };
  const RENDERERS = {
    dashboard: ()=>Dashboard.render(),
    inventory: ()=>Inventory.render(),
    vehicle: ()=>{}, // rendered on-demand via Inventory.openDetail
    sales: ()=>Sales.render(),
    analytics: ()=>Analytics.render(),
    reports: ()=>Reports.render(),
    investment: ()=>Investment.render(),
    ledger: ()=>Ledger.render(),
    settings: ()=>Settings.render(),
  };

  function init(){
    Storage_DB.load();
    renderIcons();
    wireLogin();
    wireOnboarding();
    wireShell();

    const session = sessionStorage.getItem('ax_session');
    if(session === 'active'){
      afterLogin();
    } else {
      show('loginScreen');
    }
  }

  function show(id){
    ['loginScreen','onboardScreen','appShell'].forEach(s=>{
      document.getElementById(s).classList.toggle('hidden', s!==id);
    });
  }

  function wireLogin(){
    document.getElementById('loginForm').addEventListener('submit', e=>{
      e.preventDefault();
      const u = document.getElementById('loginUser').value.trim();
      const p = document.getElementById('loginPass').value;
      if(u==="Abasit" && p==="Basit_123"){
        sessionStorage.setItem('ax_session','active');
        afterLogin();
      } else {
        document.getElementById('loginError').textContent = 'Invalid username or password.';
      }
    });
  }

  function afterLogin(){
    if(!Storage_DB.data.onboarded){
      show('onboardScreen');
    } else {
      show('appShell');
      navigate('dashboard');
      Theme.init();
    }
  }

  function wireOnboarding(){
    document.getElementById('onboardForm').addEventListener('submit', e=>{
      e.preventDefault();
      const amount = Number(document.getElementById('onboardAmount').value);
      const currency = document.getElementById('onboardCurrency').value;
      if(!amount || amount<=0) return;
      Storage_DB.setInitialInvestment(amount, currency);
      show('appShell');
      Theme.init();
      navigate('dashboard');
      Notify.show('Welcome to Auto Xpress — your terminal is live.', 'success');
    });
  }

  function wireShell(){
    document.querySelectorAll('.nav-item, .bnav-item[data-view]').forEach(btn=>{
      btn.addEventListener('click', ()=>navigate(btn.dataset.view));
    });
    document.getElementById('bnavMore').addEventListener('click', openMoreMenu);
    document.getElementById('logoutBtn').addEventListener('click', ()=>{
      sessionStorage.removeItem('ax_session');
      show('loginScreen');
      document.getElementById('loginForm').reset();
    });
    document.getElementById('quickAddBtn').addEventListener('click', ()=>Inventory.openVehicleModal());
    document.getElementById('fabAdd').addEventListener('click', ()=>Inventory.openVehicleModal());

    document.addEventListener('keydown', e=>{
      if(document.getElementById('appShell').classList.contains('hidden')) return;
      const typing = ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName);
      if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='n' && !typing){ e.preventDefault(); Inventory.openVehicleModal(); }
      if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='f' && !typing){
        e.preventDefault();
        navigate('inventory');
        setTimeout(()=>document.getElementById('invSearch') && document.getElementById('invSearch').focus(), 100);
      }
    });
  }

  const MORE_ITEMS = [
    { view:'sales', icon:'tag', label:'Sales', desc:'Sold inventory and performance' },
    { view:'reports', icon:'doc', label:'Reports', desc:'Generate and export financial reports' },
    { view:'investment', icon:'bank', label:'Investment', desc:'Add or withdraw capital' },
    { view:'ledger', icon:'book', label:'Personal Ledger', desc:'Income, expenses, borrowed money, loans given' },
    { view:'settings', icon:'gear', label:'Settings', desc:'Preferences and data management' },
  ];
  function openMoreMenu(){
    const overlay = Modal.open(`
      <div class="modal-head"><h3>More</h3><button class="icon-btn" data-modal-close><i data-icon="x"></i></button></div>
      <div class="modal-body" style="padding-top:8px;">
        <div style="display:flex; flex-direction:column; gap:6px;">
          ${MORE_ITEMS.map(m=>`
            <button class="more-menu-item" data-view="${m.view}">
              <div class="stat-icon accent-blue" style="margin:0; background:var(--accent2-dim); color:var(--accent2);">${iconHTML(m.icon)}</div>
              <div style="text-align:left;">
                <div style="font-weight:700; font-size:14px;">${m.label}</div>
                <div style="font-size:12px; color:var(--text-muted);">${m.desc}</div>
              </div>
            </button>
          `).join('')}
        </div>
      </div>
    `, { maxWidth: 420 });
    overlay.querySelectorAll('.more-menu-item').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        Modal.close(overlay);
        navigate(btn.dataset.view);
      });
    });
  }

  function navigate(view){
    currentView = view;
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    document.getElementById('view-'+view).classList.add('active');
    document.querySelectorAll('.nav-item, .bnav-item[data-view]').forEach(b=>b.classList.toggle('active', b.dataset.view===view));
    document.getElementById('bnavMore').classList.toggle('active', ['sales','reports','investment','ledger','settings'].includes(view));
    const meta = VIEW_META[view] || {title:'', sub:''};
    document.getElementById('viewTitle').textContent = meta.title;
    document.getElementById('viewSubtitle').textContent = meta.sub;
    if(RENDERERS[view]) RENDERERS[view]();
    refreshTicker();
    window.scrollTo({top:0, behavior:'smooth'});
  }

  function refreshTicker(){
    document.getElementById('tickerCash').textContent = Utils.fmtMoney(Storage_DB.data.cash);
    document.getElementById('tickerNetWorth').textContent = Utils.fmtMoney(Metrics.netWorth());
    document.getElementById('tickerStock').textContent = Utils.fmtNum(Metrics.stockVehicles().length);
  }

  // Called after any state-mutating action so ticker + current view stay in sync
  function refreshChrome(){
    refreshTicker();
  }

  return { init, navigate, refreshChrome, get currentView(){ return currentView; } };
})();

document.addEventListener('DOMContentLoaded', App.init);
