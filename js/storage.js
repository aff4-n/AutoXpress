const DB_KEY = 'autoxpress_db_v1';

function defaultDB(){
  return {
    onboarded: false,
    settings: { theme:'dark', currency:'USD', staleDays: 45, allowNegativeCash:false },
    investment: { transactions: [] },
    cash: 0,
    vehicles: [],
    activity: [],
    auditLog: [],
    pinned: [],
    personalLedger: { cash: 0, entries: [] }
  };
}

const Storage_DB = {
  data: null,

  load(){
    try{
      const raw = localStorage.getItem(DB_KEY);
      this.data = raw ? JSON.parse(raw) : defaultDB();
      // backfill any missing keys for forward-compat
      const def = defaultDB();
      Object.keys(def).forEach(k=>{ if(this.data[k]===undefined) this.data[k]=def[k]; });
      Object.keys(def.settings).forEach(k=>{ if(this.data.settings[k]===undefined) this.data.settings[k]=def.settings[k]; });
    }catch(e){
      console.error('DB load failed, resetting', e);
      this.data = defaultDB();
    }
    return this.data;
  },
  save(){
    try{
      localStorage.setItem(DB_KEY, JSON.stringify(this.data));
    }catch(e){
      console.error('DB save failed', e);
      Notify.show('Storage error — data may not have saved.', 'error');
    }
  },
  reset(){
    localStorage.removeItem(DB_KEY);
    this.data = defaultDB();
    this.save();
  },
  logActivity(message, type){
    this.data.activity.unshift({ id: Utils.uid('act'), date: new Date().toISOString(), message, type: type||'info' });
    this.data.activity = this.data.activity.slice(0, 200);
  },
  logAudit(action, entity, details){
    this.data.auditLog.unshift({ id: Utils.uid('aud'), date: new Date().toISOString(), action, entity, details });
    this.data.auditLog = this.data.auditLog.slice(0, 500);
  },

  /* ---------------- INVESTMENT ---------------- */
  setInitialInvestment(amount, currency){
    this.data.investment.transactions.push({ id: Utils.uid('inv'), type:'initial', amount, date: new Date().toISOString(), reason:'Initial capitalization', notes:'' });
    this.data.cash = amount;
    this.data.settings.currency = currency;
    this.data.onboarded = true;
    this.logActivity(`Initial investment of ${Utils.fmtMoney(amount)} recorded`, 'success');
    this.save();
  },
  addInvestment(amount, reason, notes){
    this.data.investment.transactions.push({ id: Utils.uid('inv'), type:'add', amount, date: new Date().toISOString(), reason, notes });
    this.data.cash += amount;
    this.logActivity(`Investment added: ${Utils.fmtMoney(amount)}`, 'success');
    this.save();
  },
  withdrawInvestment(amount, reason, notes){
    if(!this.data.settings.allowNegativeCash && amount > this.data.cash){
      throw new Error('Withdrawal exceeds available cash.');
    }
    this.data.investment.transactions.push({ id: Utils.uid('inv'), type:'withdraw', amount, date: new Date().toISOString(), reason, notes });
    this.data.cash -= amount;
    this.logActivity(`Investment withdrawn: ${Utils.fmtMoney(amount)}`, 'warning');
    this.save();
  },
  deleteInvestmentTx(id){
    const tx = this.data.investment.transactions.find(t=>t.id===id);
    if(!tx) return;
    if(tx.type==='add') this.data.cash -= tx.amount;
    else if(tx.type==='withdraw') this.data.cash += tx.amount;
    this.data.investment.transactions = this.data.investment.transactions.filter(t=>t.id!==id);
    this.save();
  },

  /* ---------------- VEHICLES ---------------- */
  nextStockId(){
    const n = this.data.vehicles.length + 1;
    return 'AX-' + String(n).padStart(4,'0');
  },
  addVehicle(v){
    if(!this.data.settings.allowNegativeCash && v.purchasePrice > this.data.cash){
      throw new Error('Purchase price exceeds available cash.');
    }
    const vehicle = Object.assign({
      id: Utils.uid('veh'),
      stockId: this.nextStockId(),
      status: 'available',
      expenses: [],
      photos: [],
      tags: [],
      pinned: false,
      sale: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, v);
    this.data.vehicles.unshift(vehicle);
    this.data.cash -= (v.purchasePrice || 0);
    this.logActivity(`Vehicle added: ${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.stockId})`, 'success');
    this.logAudit('create','vehicle', vehicle.stockId);
    this.save();
    return vehicle;
  },
  updateVehicle(id, patch){
    const v = this.getVehicle(id);
    if(!v) return;
    const priceDiff = (patch.purchasePrice!==undefined) ? (patch.purchasePrice - v.purchasePrice) : 0;
    if(priceDiff && !this.data.settings.allowNegativeCash && priceDiff > this.data.cash){
      throw new Error('Adjustment exceeds available cash.');
    }
    Object.assign(v, patch, { updatedAt: new Date().toISOString() });
    if(priceDiff) this.data.cash -= priceDiff;
    this.logAudit('update','vehicle', v.stockId);
    this.save();
  },
  deleteVehicle(id){
    const v = this.getVehicle(id);
    if(!v) return;
    // reverse all financial effects
    this.data.cash += (v.purchasePrice || 0);
    (v.expenses||[]).forEach(e=> this.data.cash += e.amount);
    if(v.sale) this.data.cash -= (v.sale.sellingPrice - (v.sale.commission||0));
    this.data.vehicles = this.data.vehicles.filter(x=>x.id!==id);
    this.logActivity(`Vehicle deleted: ${v.stockId}`, 'error');
    this.logAudit('delete','vehicle', v.stockId);
    this.save();
    return v;
  },
  getVehicle(id){ return this.data.vehicles.find(v=>v.id===id); },

  /* ---------------- EXPENSES ---------------- */
  addExpense(vehicleId, exp){
    const v = this.getVehicle(vehicleId);
    if(!v) return;
    if(!this.data.settings.allowNegativeCash && exp.amount > this.data.cash){
      throw new Error('Expense exceeds available cash.');
    }
    const e = Object.assign({ id: Utils.uid('exp'), date: new Date().toISOString() }, exp);
    v.expenses.push(e);
    this.data.cash -= exp.amount;
    v.updatedAt = new Date().toISOString();
    this.logActivity(`Expense logged: ${Utils.fmtMoney(exp.amount)} on ${v.stockId}`, 'info');
    this.save();
  },
  deleteExpense(vehicleId, expId){
    const v = this.getVehicle(vehicleId);
    if(!v) return;
    const e = v.expenses.find(x=>x.id===expId);
    if(!e) return;
    this.data.cash += e.amount;
    v.expenses = v.expenses.filter(x=>x.id!==expId);
    this.save();
  },

  /* ---------------- SALES ---------------- */
  sellVehicle(vehicleId, sale){
    const v = this.getVehicle(vehicleId);
    if(!v) return;
    v.sale = Object.assign({ date: new Date().toISOString() }, sale);
    v.status = 'sold';
    v.updatedAt = new Date().toISOString();
    const net = (sale.sellingPrice||0) - (sale.commission||0);
    this.data.cash += net;
    this.logActivity(`Vehicle sold: ${v.stockId} for ${Utils.fmtMoney(sale.sellingPrice)}`, 'success');
    this.logAudit('sell','vehicle', v.stockId);
    this.save();
  },
  undoSale(vehicleId){
    const v = this.getVehicle(vehicleId);
    if(!v || !v.sale) return;
    const net = (v.sale.sellingPrice||0) - (v.sale.commission||0);
    this.data.cash -= net;
    v.sale = null;
    v.status = 'available';
    this.save();
  },

  /* ---------------- PERSONAL LEDGER ---------------- */
  addLedgerEntry(type, data){
    const entry = Object.assign({
      id: Utils.uid('led'),
      type, // 'income' | 'expense' | 'borrowed' | 'loan'
      date: new Date().toISOString(),
      status: (type==='borrowed'||type==='loan') ? 'pending' : 'settled',
      settledDate: null
    }, data);
    this.data.personalLedger.entries.unshift(entry);
    if(type==='income') this.data.personalLedger.cash += entry.amount;
    else if(type==='expense') this.data.personalLedger.cash -= entry.amount;
    else if(type==='borrowed') this.data.personalLedger.cash += entry.amount;
    else if(type==='loan') this.data.personalLedger.cash -= entry.amount;
    const labels = { income:'Income logged', expense:'Expense logged', borrowed:`Borrowed ${Utils.fmtMoney(entry.amount)} from ${entry.person||'someone'}`, loan:`Loaned ${Utils.fmtMoney(entry.amount)} to ${entry.person||'someone'}` };
    this.logActivity(labels[type], type==='expense'||type==='borrowed' ? 'warning' : 'success');
    this.save();
    return entry;
  },
  settleLedgerEntry(id){
    const e = this.data.personalLedger.entries.find(x=>x.id===id);
    if(!e || e.status==='settled') return;
    if(e.type==='borrowed') this.data.personalLedger.cash -= e.amount; // paying it back
    else if(e.type==='loan') this.data.personalLedger.cash += e.amount; // getting repaid
    e.status = 'settled';
    e.settledDate = new Date().toISOString();
    this.logActivity(`${e.type==='borrowed'?'Repaid':'Received repayment'}: ${Utils.fmtMoney(e.amount)} ${e.type==='borrowed'?'to':'from'} ${e.person||'someone'}`, 'success');
    this.save();
  },
  deleteLedgerEntry(id){
    const e = this.data.personalLedger.entries.find(x=>x.id===id);
    if(!e) return;
    if(e.type==='income') this.data.personalLedger.cash -= e.amount;
    else if(e.type==='expense') this.data.personalLedger.cash += e.amount;
    else if(e.type==='borrowed' && e.status==='pending') this.data.personalLedger.cash -= e.amount;
    else if(e.type==='loan' && e.status==='pending') this.data.personalLedger.cash += e.amount;
    // settled borrowed/loan entries already net to zero, so no cash change on delete
    this.data.personalLedger.entries = this.data.personalLedger.entries.filter(x=>x.id!==id);
    this.save();
    return e;
  },

  /* ---------------- COMPUTED METRICS ---------------- */
  vehicleCost(v){
    const exp = (v.expenses||[]).reduce((s,e)=>s+Number(e.amount||0),0);
    return Number(v.purchasePrice||0) + exp;
  },
  vehicleProfit(v){
    if(!v.sale) return null;
    const cost = this.vehicleCost(v);
    const net = Number(v.sale.sellingPrice||0) - Number(v.sale.commission||0) - Number(v.sale.tax||0);
    return net - cost;
  },
  netWorth(){
    const invValue = this.data.vehicles.filter(v=>v.status!=='sold').reduce((s,v)=>s+this.vehicleCost(v),0);
    return this.data.cash + invValue;
  }
};
