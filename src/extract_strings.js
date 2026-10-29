const { chromium } = require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader']});const p=await b.newPage({viewport:{width:1440,height:900}});
await p.goto('file://'+process.cwd()+'/site_out/index.html');await p.waitForTimeout(2500);
const found=await p.evaluate(()=>{
  const G={'#mo-hinh':'Trang chủ · Đầu trang (cảnh 3D)','#doanh-nghiep':'Trang chủ · Dành cho Advertiser','#cong-nghe':'Trang chủ · Công nghệ','#doi-tac':'Trang chủ · Đối tác','#faq':'Trang chủ · Hỏi đáp','#lien-he':'Trang chủ · Liên hệ','#p-mo-hinh':'Trang Mô hình','#p-advertiser':'Trang Advertiser','#p-cong-nghe':'Trang Công nghệ','#p-doi-tac':'Trang Đối tác','#p-hoi-dap':'Trang Hỏi đáp','#p-lien-he':'Trang Liên hệ'};
  function grp(el){if(el.closest('header.nav,footer'))return 'Menu và chân trang';for(const sel in G){if(el.closest(sel))return G[sel]}return 'Khác'}
  const out=[],seen={};const SK=/^(SCRIPT|STYLE|CODE|PRE|SVG|PATH|NOSCRIPT)$/;
  function add(k,el){k=k.trim();if(!k||!/[A-Za-zÀ-ỹ]/.test(k)||seen[k])return;seen[k]=1;out.push({k,g:grp(el)})}
  (function w(r){if(r.nodeType===3){const p=r.parentNode;if(p&&p.nodeName!=='TITLE'&&!SK.test(p.nodeName.toUpperCase())&&!p.closest('.term,#tout,[data-nl],#faq .fq,.err'))add(r.__vi||r.nodeValue,p);return}
    if(r.nodeType!==1||SK.test(r.nodeName.toUpperCase())||r.closest('.term,#tout,[data-nl],#faq .fq,.err'))return;
    ['placeholder','aria-label','title'].forEach(a=>{const v=r['__vi_'+a]||(r.getAttribute&&r.getAttribute(a));if(v)add(v,r)});
    for(let c=r.firstChild;c;c=c.nextSibling)w(c)})(document.body);
  return out});
const en=JSON.parse(fs.readFileSync('en.json','utf8'));
const defs=JSON.parse(fs.readFileSync('cms/defaults.json','utf8'));
const used=new Set();defs.faq.forEach(f=>{used.add(f.cat.vi);used.add(f.q.vi);used.add(f.a.vi)});defs.partners.forEach(x=>used.add(x.group.vi));
const src=['pre-modules.html','pages.js','pages.html','scenes3d.js'].map(f=>fs.readFileSync(f,'utf8')).join('\n');
const seen=new Set(found.map(x=>x.k));
const extras=Object.keys(en).filter(k=>!seen.has(k)&&!used.has(k)&&k.trim()&&src.includes(k)&&!/^\d|\.\.\.$/.test(k)||['Đang gửi...'].includes(k)&&!seen.has(k)).filter(k=>!/^Advertiser muốn chạy chiến dịch hoặc|^Gửi yêu cầu ở form dành cho Advertiser cuối trang|^Terminal minh hoạ/.test(k)).map(k=>({k,g:'Thông báo, nút và nhãn khác'}));
const list=[...found,...extras].map(x=>({k:x.k,g:x.g,en:en[x.k]||''}));
const groups=[];list.forEach(x=>{if(!groups.includes(x.g))groups.push(x.g)});
fs.writeFileSync('cms/admin/strings.json',JSON.stringify({groups,items:list}));
const cnt={};list.forEach(x=>cnt[x.g]=(cnt[x.g]||0)+1);console.log(list.length,cnt,'| không có EN:',list.filter(x=>!x.en).length);
console.log('extras:',extras.map(x=>x.k.slice(0,50)));await b.close()})()
