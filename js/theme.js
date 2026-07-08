const Theme = (() => {
  function apply(theme){
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('themeToggle');
    if(btn) btn.innerHTML = theme==='dark' ? iconHTML('moon') : iconHTML('sun');
  }
  function init(){
    const theme = Storage_DB.data.settings.theme || 'dark';
    apply(theme);
    const btn = document.getElementById('themeToggle');
    if(btn) btn.addEventListener('click', toggle);
  }
  function toggle(){
    const cur = Storage_DB.data.settings.theme || 'dark';
    const next = cur==='dark' ? 'light' : 'dark';
    Storage_DB.data.settings.theme = next;
    Storage_DB.save();
    apply(next);
  }
  return { init, apply, toggle };
})();
