
/* ---------- nội dung từ CMS: lấy /api/content, lưu đệm để lần sau hiện ngay ---------- */
(function(){
  var KEY='3rd-cms-v1';
  function use(c){if(!c||typeof c!=='object')return;window.__CMS=c;if(window.__i18nApply)window.__i18nApply()}
  try{var cached=JSON.parse(localStorage.getItem(KEY)||'null');if(cached)use(cached)}catch(e){}
  if(location.protocol==='file:'||!window.fetch)return;
  fetch('/api/content',{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(c){
    if(!c||(!c.ov&&!c.faq&&!c.partners&&!c.settings))return;
    try{localStorage.setItem(KEY,JSON.stringify(c))}catch(e){}
    use(c)}).catch(function(){});
})();
