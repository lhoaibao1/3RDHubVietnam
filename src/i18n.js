
/* ---------- đổi ngôn ngữ VI / EN ---------- */
(function(){
  var D=window.__EN||{},lang='vi',SKIP=/^(SCRIPT|STYLE|CODE|PRE|SVG|PATH|NOSCRIPT)$/;
  try{lang=localStorage.getItem('3rd-lang')||'vi'}catch(e){}
  function tx(s){var k=s.trim();if(!k)return s;var v=D[k];return v==null?s:s.replace(k,v)}
  function node(n){if(n.__vi==null)n.__vi=n.nodeValue;var v=lang==='en'?tx(n.__vi):n.__vi;if(n.nodeValue!==v)n.nodeValue=v}
  function attrs(el){['placeholder','aria-label','title'].forEach(function(a){if(!el.hasAttribute||!el.hasAttribute(a))return;var key='__vi_'+a;if(el[key]==null)el[key]=el.getAttribute(a);var v=lang==='en'?tx(el[key]):el[key];if(el.getAttribute(a)!==v)el.setAttribute(a,v)})}
  function walk(root){if(!root)return;if(root.nodeType===3){var p=root.parentNode;if(p&&!SKIP.test(p.nodeName.toUpperCase())&&!(p.closest&&p.closest('.term,#tout')))node(root);return}
    if(root.nodeType!==1||SKIP.test(root.nodeName.toUpperCase())||root.closest('.term,#tout'))return;attrs(root);for(var c=root.firstChild;c;c=c.nextSibling)walk(c)}
  var vit=document.title,setT=null;function title(){if(document.title!==setT)vit=document.title;setT=lang==='en'?vit.split(' · ').map(function(p){return D[p]||p}).join(' · '):vit;document.title=setT}
  var busy=false,mo=new MutationObserver(function(ms){if(busy)return;busy=true;ms.forEach(function(m){if(m.type==='characterData'){var n=m.target;if(n.nodeValue!==(lang==='en'?tx(n.__vi||''):n.__vi)){n.__vi=n.nodeValue;node(n)}}else m.addedNodes.forEach(walk)});busy=false});
  function apply(){busy=true;walk(document.body);document.documentElement.lang=lang;$$('.lang button').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.l===lang)});busy=false;title();
    var f=$('#fqs');if(f)f.dispatchEvent(new Event('input'))}
  window.__tr=function(s){return lang==='en'&&D[s]||s};
  $$('.lang button').forEach(function(b){b.addEventListener('click',function(){lang=b.dataset.l;try{localStorage.setItem('3rd-lang',lang)}catch(e){}apply()})});
  window.addEventListener('hashchange',function(){setTimeout(title,0)});
  window.__i18nKeys=function(){var S={};(function w(r){if(r.nodeType===3){var p=r.parentNode,k=(r.__vi||r.nodeValue).trim();if(k&&/[A-Za-zÀ-ỹ]/.test(k)&&p&&!SKIP.test(p.nodeName.toUpperCase())&&!p.closest('.term,#tout'))S[k]=1;return}if(r.nodeType!==1||SKIP.test(r.nodeName.toUpperCase()))return;['placeholder','aria-label','title'].forEach(function(a){var v=r['__vi_'+a]||(r.getAttribute&&r.getAttribute(a));if(v&&/[A-Za-zÀ-ỹ]/.test(v))S[v.trim()]=1});for(var c=r.firstChild;c;c=c.nextSibling)w(c)})(document.body);return Object.keys(S)};
  mo.observe(document.body,{childList:true,subtree:true,characterData:true});
  apply();
})();
