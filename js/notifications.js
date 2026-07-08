const Notify = (() => {
  function show(message, type, opts){
    type = type || 'info';
    opts = opts || {};
    const root = document.getElementById('toastRoot');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    const icon = type==='success' ? 'check' : type==='error' ? 'x' : 'info';
    el.innerHTML = `<div class="toast-icon">${iconHTML(icon)}</div><div style="flex:1;">${Utils.escapeHtml(message)}</div>${opts.actionLabel ? `<button class="btn btn-ghost btn-sm" style="padding:4px 10px;">${Utils.escapeHtml(opts.actionLabel)}</button>` : ''}`;
    root.appendChild(el);
    let dismissed = false;
    const dismiss = ()=>{
      if(dismissed) return; dismissed = true;
      el.classList.add('leaving');
      setTimeout(()=>el.remove(), 260);
    };
    if(opts.actionLabel && opts.onAction){
      el.querySelector('button').addEventListener('click', ()=>{ opts.onAction(); dismiss(); });
    }
    setTimeout(dismiss, opts.duration || 4500);
  }
  return { show };
})();

const Modal = (() => {
  function open(innerHTML, opts){
    opts = opts || {};
    const root = document.getElementById('modalRoot');
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal" style="${opts.maxWidth?`max-width:${opts.maxWidth}px`:''}">${innerHTML}</div>`;
    root.appendChild(overlay);
    renderIcons(overlay);
    if(!opts.persistent){
      overlay.addEventListener('mousedown', (e)=>{ if(e.target===overlay) close(overlay); });
    }
    overlay.querySelectorAll('[data-modal-close]').forEach(b=>b.addEventListener('click', ()=>close(overlay)));
    document.addEventListener('keydown', escHandler);
    function escHandler(e){ if(e.key==='Escape'){ close(overlay); } }
    overlay._escHandler = escHandler;
    return overlay;
  }
  function close(overlay){
    if(!overlay) return;
    document.removeEventListener('keydown', overlay._escHandler);
    overlay.style.animation = 'fadeIn .15s ease reverse';
    setTimeout(()=>overlay.remove(), 140);
  }
  function confirm(title, message, onConfirm, opts){
    opts = opts || {};
    const overlay = open(`
      <div class="modal-head"><h3>${Utils.escapeHtml(title)}</h3><button class="icon-btn" data-modal-close><i data-icon="x"></i></button></div>
      <div class="modal-body"><p class="modal-confirm-text">${message}</p></div>
      <div class="modal-foot">
        <button class="btn btn-secondary" data-modal-close>Cancel</button>
        <button class="btn ${opts.danger===false?'btn-primary':'btn-danger'}" id="modalConfirmBtn">${opts.confirmLabel||'Delete'}</button>
      </div>
    `, { maxWidth: 420 });
    overlay.querySelector('#modalConfirmBtn').addEventListener('click', ()=>{
      onConfirm();
      close(overlay);
    });
    return overlay;
  }
  return { open, close, confirm };
})();
