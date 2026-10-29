
/* ---------- đổi ngôn ngữ VI / EN + chữ tuỳ chỉnh từ CMS ---------- */
(function(){
  var D=window.__EN||{},lang='vi',SKIP=/^(SCRIPT|STYLE|CODE|PRE|SVG|PATH|NOSCRIPT)$/,NOTR='.term,#tout,[data-nl]';
  try{lang=localStorage.getItem('3rd-lang')||'vi'}catch(e){}
  var DEF={signup_url:'https://app.3rdvn.io.vn/auth/login?tab=signup',email:'admin_support@3rdvn.io.vn',hotline:'(+84) 398 192 414',hotline_tel:'+84398192414',company_name:'3RDVN Technology',tax_id:'4001342613',address:'',working_hours:'',working_hours_en:'',facebook:'',zalo:'',tiktok:'',youtube:'',instagram:'',site_title:'',meta_description:'',analytics_id:''};
  function cms(){return window.__CMS||{}}
  function S(k){var s=cms().settings||{};return s[k]||DEF[k]}
  /* chữ gốc (tiếng Việt, đã trim) -> bản tuỳ chỉnh từ CMS nếu có */
  function OV(k){var c=cms(),o=c.ov&&c.ov[k];if(o)return o;var s=c.settings||{};
    if(k===DEF.email&&s.email)return {vi:s.email,en:s.email};
    if(k===DEF.hotline&&s.hotline)return {vi:s.hotline,en:s.hotline};return null}
  function trans(k){var o=OV(k);
    if(lang==='en'){if(o&&o.en)return o.en;var v=D[k];if(v!=null)return v;return (o&&o.vi)||k}
    return (o&&o.vi)||k}
  function tx(s){var k=s.trim();if(!k)return s;var v=trans(k);return v===k?s:s.replace(k,function(){return v})}
  function node(n){if(n.__vi==null)n.__vi=n.nodeValue;var v=tx(n.__vi);if(n.nodeValue!==v)n.nodeValue=v}
  function attrs(el){['placeholder','aria-label','title'].forEach(function(a){if(!el.hasAttribute||!el.hasAttribute(a))return;var key='__vi_'+a;if(el[key]==null)el[key]=el.getAttribute(a);var v=tx(el[key]);if(el.getAttribute(a)!==v)el.setAttribute(a,v)})}
  function walk(root){if(!root)return;if(root.nodeType===3){var p=root.parentNode;if(p&&!SKIP.test(p.nodeName.toUpperCase())&&!(p.closest&&p.closest(NOTR)))node(root);return}
    if(root.nodeType!==1||SKIP.test(root.nodeName.toUpperCase())||root.closest(NOTR))return;attrs(root);for(var c=root.firstChild;c;c=c.nextSibling)walk(c)}
  var vit=document.title,setT=null;function title(){if(document.title!==setT)vit=document.title;setT=vit.split(' · ').map(trans).join(' · ');document.title=setT}
  /* liên kết, số hotline, email lấy từ phần "Cài đặt" của CMS */
  var TAGS=[['signup_url','a[href^="https://app.3rdvn.io.vn/auth/login?tab=signup"]'],['mailto','a[href^="mailto:"]'],['tel','a[href^="tel:"]']];
  function settings(){TAGS.forEach(function(t){$$(t[1]).forEach(function(a){if(!a.dataset.set)a.dataset.set=t[0]})});
    $$('a[data-set]').forEach(function(a){var k=a.dataset.set,v=k==='mailto'?'mailto:'+S('email'):k==='tel'?'tel:'+S('hotline_tel'):S(k);if(a.getAttribute('href')!==v)a.setAttribute('href',v)});
    $$('[data-copy]').forEach(function(b){if(!b.dataset.cp)b.dataset.cp=/@/.test(b.dataset.copy)?'email':'tel';b.dataset.copy=b.dataset.cp==='email'?S('email'):S('hotline_tel')})}
  var busy=false,mo=new MutationObserver(function(ms){if(busy)return;busy=true;ms.forEach(function(m){if(m.type==='characterData'){var n=m.target;if(n.nodeValue!==tx(n.__vi||'')){n.__vi=n.nodeValue;node(n)}}else m.addedNodes.forEach(walk)});busy=false});
  function apply(){busy=true;walk(document.body);document.documentElement.lang=lang;$$('.lang button').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.l===lang)});settings();busy=false;title();
    if(window.__refresh)window.__refresh()}
  window.__tr=trans;window.__S=S;window.__lang=function(){return lang};window.__i18nApply=apply;
  $$('.lang button').forEach(function(b){b.addEventListener('click',function(){lang=b.dataset.l;try{localStorage.setItem('3rd-lang',lang)}catch(e){}apply()})});
  window.addEventListener('hashchange',function(){setTimeout(title,0)});
  window.__i18nKeys=function(){var o={};(function w(r){if(r.nodeType===3){var p=r.parentNode,k=(r.__vi||r.nodeValue).trim();if(k&&/[A-Za-zÀ-ỹ]/.test(k)&&p&&!SKIP.test(p.nodeName.toUpperCase())&&!p.closest(NOTR))o[k]=1;return}if(r.nodeType!==1||SKIP.test(r.nodeName.toUpperCase())||(r.closest&&r.closest(NOTR)))return;['placeholder','aria-label','title'].forEach(function(a){var v=r['__vi_'+a]||(r.getAttribute&&r.getAttribute(a));if(v&&/[A-Za-zÀ-ỹ]/.test(v))o[v.trim()]=1});for(var c=r.firstChild;c;c=c.nextSibling)w(c)})(document.body);return Object.keys(o)};
  mo.observe(document.body,{childList:true,subtree:true,characterData:true});
  apply();
})();
