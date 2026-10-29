
/* ---------- trang chi tiết từng module ---------- */
(function(){
  var ORDER=[['mo-hinh','Mô hình','Hành trình một hồ sơ, hình thức hoa hồng, trạng thái đơn'],['advertiser','Advertiser','Ba gói hợp tác và quy trình triển khai'],['cong-nghe','Công nghệ','Stack, luồng tracking và postback'],['doi-tac','Đối tác','Ngân hàng, công ty tài chính, mạng affiliate'],['hoi-dap','Hỏi đáp','Câu hỏi thường gặp theo từng nhóm'],['lien-he','Liên hệ','Đăng ký publisher hoặc gửi yêu cầu tư vấn']];
  var main=$('main'),pages=$$('#pages .pg'),links=$$('.nav nav a'),nav=$('.nav'),mnu=$('#mnu'),base=document.title,onPage=false;

  /* cuối mỗi trang: khối CTA */
  ORDER.forEach(function(o){if(o[0]==='lien-he')return;var d=document.createElement('div');d.className='pnext';
    d.innerHTML='<div class="cta"><h2>Sẵn sàng bắt đầu?</h2><p>Publisher đăng ký trên app. Advertiser để lại yêu cầu, đội ngũ 3RDVN Technology sẽ liên hệ.</p><div class="acts"><a class="btn or" href="https://app.3rdvn.io.vn/auth/login?tab=signup" target="_blank" rel="noopener">Đăng ký làm publisher</a><a class="btn gh" href="#/lien-he">Advertiser liên hệ</a></div></div>';
    $('#p-'+o[0]).appendChild(d)});

  /* hiệu ứng: hiện dần khi cuộn, đếm số, trạng thái sáng lần lượt */
  var RVSEL='.ps>.k2,.ps>h2,.ps>.sub,.ps .cd,.tl li,.steps6 li,.seq li,.states span,.anat,.cmpw,.cmp tbody tr,.codeb,.g2.al>div,.cnt div,.pg2 a,.pgrp h3,.fq2>div,.pnext .cta,.ps0 .cd,.ps0>form';
  var rio=('IntersectionObserver' in window)?new IntersectionObserver(function(es){es.forEach(function(e){if(!e.isIntersecting)return;e.target.classList.add('in');rio.unobserve(e.target);
    if(e.target.matches('.cnt div')){var b=e.target.querySelector('b'),n=+b.dataset.n||+b.textContent,t0=performance.now();b.dataset.n=n;(function up(t){var k=Math.min(1,(t-t0)/900);b.textContent=Math.round(n*(1-Math.pow(1-k,3)));if(k<1)requestAnimationFrame(up)})(t0)}})},{rootMargin:'0px 0px -8% 0px'}):null;
  function reveal(pg){$$(RVSEL,pg).forEach(function(el){var sib=[].slice.call(el.parentNode.children).filter(function(x){return x.matches(RVSEL)});el.style.setProperty('--i',Math.min(8,sib.indexOf(el)));el.classList.add('rv');el.classList.remove('in');if(rio)rio.observe(el);else el.classList.add('in')})}
  var cyc=null;
  function cycle(pg){clearInterval(cyc);var st=$$('.states span',pg),an=$$('.anat code span:not(.a1)',pg),i=0;if(!st.length&&!an.length)return;
    cyc=setInterval(function(){st.forEach(function(x,k){x.classList.toggle('cur',k===i%st.length)});an.forEach(function(x,k){x.classList.toggle('cur',k===i%an.length)});i++},1100)}

  /* link "Xem chi tiết" trên trang chủ */
  [['#doanh-nghiep .bh .lead','advertiser'],['#cong-nghe .th .lead','cong-nghe'],['#doi-tac > p','doi-tac'],['#faq .fqi > p','hoi-dap']].forEach(function(x){var el=$(x[0]);if(!el)return;var a=document.createElement('a');a.className='more';a.href='#/'+x[1];a.textContent='Xem chi tiết →';el.insertAdjacentElement('afterend',a)});

  /* bảng so sánh: nhãn cột cho dạng thẻ trên mobile */
  var hd=$$('.cmp thead th').map(function(t){return t.textContent});$$('.cmp tbody tr').forEach(function(r){$$('td',r).forEach(function(td,i){td.setAttribute('data-l',hd[i+1])})});

  /* đối tác theo nhóm (dữ liệu từ CMS nếu có) */
  function buildPartnerPage(){var groups={},order=[];PARTNERS.forEach(function(p){var g=p.group.vi;if(!groups[g]){groups[g]={label:p.group,items:[]};order.push(g)}groups[g].items.push(p)});
    var el=$('#pgroups');el.setAttribute('data-nl','');
    el.innerHTML=order.map(function(g){var G=groups[g];return '<div class="pgrp"><h3>'+escH(LV(G.label))+'</h3><div class="pg2">'+G.items.map(function(p){return '<a href="'+escH(okUrl(p.url))+'" target="_blank" rel="noopener">'+'<span class="lg">'+(p.logo?'<img src="'+escH(p.logo)+'" alt="">':'')+'</span><b>'+escH(p.name)+'</b><small>'+escH(LV(p.group))+'</small></a>'}).join('')+'</div></div>'}).join('');
    var nb=PARTNERS.filter(function(p){return /Ngân hàng/.test(p.group.vi)}).length,nf=PARTNERS.filter(function(p){return p.group.vi==='Công ty tài chính'}).length;
    $('#pcnt').innerHTML='<div><b>'+PARTNERS.length+'</b><span>Đối tác đồng hành</span></div><div><b>'+nb+'</b><span>Ngân hàng</span></div><div><b>'+nf+'</b><span>Công ty tài chính</span></div><div><b>'+(PARTNERS.length-nb-nf)+'</b><span>Đối tác chiến lược, affiliate</span></div>';
    var tb=$('#p-doi-tac .p3d .ft b');if(tb){tb.setAttribute('data-nl','');tb.textContent=PARTNERS.length+' '+(window.__lang&&__lang()==='en'?'partners':'đối tác')}}
  buildPartnerPage();__hk.partnersPage=buildPartnerPage;
  __hk.partners=function(){var c=window.__CMS;if(c&&c.partners&&c.partners.length){PARTNERS.length=0;c.partners.forEach(function(p){PARTNERS.push(p)})}buildPlist();buildPartnerPage()};

  /* hỏi đáp */
  var FQ=[
   ['Chung','3RDHub Vietnam là gì?','3RDHub Vietnam là nền tảng tiếp thị liên kết thuộc 3RDVN Technology. Advertiser đăng chiến dịch, publisher chia sẻ link riêng, hệ thống ghi nhận lượt bấm, hồ sơ và tính hoa hồng khi hồ sơ được duyệt.'],
   ['Chung','3RDHub và 3RDVN Technology liên quan thế nào?','3RDVN Technology là đơn vị xây dựng và vận hành 3RDHub Vietnam. Đội ngũ này cũng nhận thiết kế, lập trình hệ thống affiliate riêng cho Advertiser.'],
   ['Chung','3RDHub đang có những sản phẩm nào?','Các chiến dịch tài chính như mở thẻ tín dụng, vay tiêu dùng, bảo hiểm sức khoẻ và mở tài khoản số. Danh sách chiến dịch đang chạy xem trực tiếp trên app.'],
   ['Publisher','Ai có thể làm publisher?','Bất kỳ ai có kênh tiếp cận khách hàng: TikTok, Facebook, nhóm Zalo, website hoặc tệp khách quen. Bạn đăng ký tài khoản, hoàn tất định danh rồi chọn chiến dịch.'],
   ['Publisher','Đăng ký publisher gồm những bước nào?','Tạo tài khoản trên app, hoàn tất định danh theo hướng dẫn, chọn chiến dịch và lấy link đầu tiên. Bạn không cần chờ đội ngũ liên hệ.'],
   ['Publisher','Tôi được chia sẻ link ở đâu?','Trên kênh bạn có: TikTok, Facebook, nhóm Zalo, website hoặc gửi trực tiếp cho khách. Một số chiến dịch có quy định riêng về kênh quảng bá, hãy đọc kỹ mô tả chiến dịch trước khi chạy.'],
   ['Publisher','Có thể làm theo đội nhóm không?','Có. App có mục Đội nhóm để quản lý thành viên. Gọi hotline nếu bạn cần hướng dẫn thiết lập.'],
   ['Hoa hồng và rút tiền','Hoa hồng được tính và chi trả thế nào?','Mỗi chiến dịch ghi rõ hình thức tính và mức hoa hồng. Khi Advertiser duyệt hồ sơ, hoa hồng được cộng vào ví sau đối soát. Bạn gửi yêu cầu rút và theo dõi trạng thái ngay trên app.'],
   ['Hoa hồng và rút tiền','CPL, CPS và CPA khác nhau thế nào?','CPL trả theo hồ sơ được duyệt, ví dụ mở thẻ tín dụng. CPS trả theo khoản bán hoặc khoản vay thành công. CPA trả khi khách hoàn tất một hành động cụ thể như ký hợp đồng bảo hiểm hay mở tài khoản.'],
   ['Hoa hồng và rút tiền','Bao lâu thì hoa hồng vào ví?','Hoa hồng vào ví sau khi Advertiser duyệt hồ sơ và qua đối soát. Thời gian duyệt tuỳ từng đối tác và chiến dịch, trạng thái luôn hiển thị trên app.'],
   ['Hoa hồng và rút tiền','Rút tiền như thế nào?','Vào mục Ví hoa hồng, gửi yêu cầu rút về tài khoản ngân hàng và theo dõi trạng thái duyệt rút trong lịch sử giao dịch.'],
   ['Hoa hồng và rút tiền','Vì sao hồ sơ bị từ chối?','Advertiser xét duyệt hồ sơ theo tiêu chí riêng của sản phẩm. Hồ sơ không đạt chuyển sang trạng thái Từ chối và không tính hoa hồng.'],
   ['Tracking và báo cáo','Làm sao biết khách đến từ link của tôi?','Mỗi link mang mã publisher riêng, có thể gắn thêm Sub ID theo kênh. Lượt bấm, lead và đơn hiển thị theo thời gian thực trong mục Báo cáo.'],
   ['Tracking và báo cáo','Sub ID dùng để làm gì?','Sub ID là nhãn bạn tự đặt cho từng kênh, ví dụ tiktok-04 hay fb-group. Báo cáo sẽ tách lượt bấm và đơn theo nhãn này để bạn biết kênh nào hiệu quả.'],
   ['Tracking và báo cáo','Nếu hồ sơ của khách không được ghi nhận?','Bạn gửi báo mất đơn ngay trong hệ thống. Yêu cầu được đối chiếu với dữ liệu Advertiser trả về qua postback.'],
   ['Advertiser','Advertiser muốn chạy chiến dịch thì làm sao?','Gửi yêu cầu ở trang Liên hệ. Đội ngũ 3RDVN Technology sẽ trao đổi về sản phẩm, hình thức hoa hồng và cách kết nối postback.'],
   ['Advertiser','Có thể xây hệ thống affiliate riêng không?','Có. 3RDVN Technology thiết kế và lập trình trọn gói gồm website cho cộng tác viên, hệ thống quản trị và kết nối đối tác, mang thương hiệu của bạn.'],
   ['Advertiser','Kết nối kỹ thuật với 3RDHub gồm những gì?','Postback để cập nhật trạng thái hồ sơ, API key riêng cho từng đối tác, môi trường test tách biệt và tài liệu API.']
  ];
  var FQD=FQ.map(function(q,i){var E=window.__EN||{};return {id:'d'+i,cat:{vi:q[0]},q:{vi:q[1]},a:{vi:q[2]}}});
  var fcat='*';
  function faqItems(){var c=window.__CMS;return c&&c.faq?c.faq:FQD}
  function norm(s){return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d')}
  function renderFQ(){var items=faqItems(),q=norm($('#fqs').value.trim()),html='',n=0,cats=[];
    items.forEach(function(f){if(cats.indexOf(f.cat.vi)<0)cats.push(f.cat.vi)});
    if(fcat!=='*'&&cats.indexOf(fcat)<0)fcat='*';
    var cb=$('#fcat');cb.setAttribute('data-nl','');
    cb.innerHTML=['*'].concat(cats).map(function(c){var lbl=c==='*'?(window.__tr?__tr('Tất cả'):'Tất cả'):LV(items.filter(function(f){return f.cat.vi===c})[0].cat);return '<button type="button" data-c="'+escH(c)+'" aria-pressed="'+(c===fcat)+'">'+escH(lbl)+'</button>'}).join('');
    cats.forEach(function(c){if(fcat!=='*'&&c!==fcat)return;var it=items.filter(function(f){return f.cat.vi===c&&(!q||norm([f.q.vi,ENT(f.q),f.a.vi,ENT(f.a)].join(' ')).indexOf(q)>-1)});if(!it.length)return;n+=it.length;
      html+='<div><h2>'+escH(LV(it[0].cat))+'</h2>'+it.map(function(f){return '<details'+(q?' open':'')+'><summary>'+escH(LV(f.q))+'</summary><p>'+escH(LV(f.a)).replace(/\n/g,'<br>')+'</p></details>'}).join('')+'</div>'});
    var box=$('#fq2');box.setAttribute('data-nl','');box.innerHTML=html;$('#fempty').hidden=n>0;$$('#fq2>div').forEach(function(d){d.classList.add('rv','in')})}
  $('#fqs').addEventListener('input',renderFQ);
  $('#fcat').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;fcat=b.dataset.c;renderFQ()});
  renderFQ();__hk.faqPage=renderFQ;

  /* form liên hệ: gửi về CMS, nếu không được thì soạn email */
  $('#form2').addEventListener('submit',function(e){e.preventDefault();submitLead(e.target,$('#msg2'))});

  /* router: "#/module" mở trang chi tiết, còn lại là trang chủ */
  function route(){var h=location.hash||'',m=h.match(/^#\/([a-z-]+)/),pg=m&&$('#p-'+m[1]);
    nav.classList.remove('open');mnu.setAttribute('aria-expanded','false');
    pages.forEach(function(p){p.hidden=p!==pg});main.hidden=!!pg;
    links.forEach(function(a){if(pg&&a.getAttribute('href')==='#/'+m[1])a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
    if(pg){var o=ORDER.filter(function(x){return x[0]===m[1]})[0];document.title=(o?o[1]+' · ':'')+base;window.scrollTo(0,0);onPage=true;reveal(pg);cycle(pg);if(window.__p3)window.__p3(m[1]);return}
    clearInterval(cyc);
    document.title=base;var t=h.length>1&&h.charAt(1)!=='/'&&document.getElementById(h.slice(1));
    if(t)t.scrollIntoView();else if(onPage)window.scrollTo(0,0);onPage=false}
  window.addEventListener('hashchange',route);route();
  mnu.addEventListener('click',function(){var o=nav.classList.toggle('open');mnu.setAttribute('aria-expanded',o)});
  document.addEventListener('click',function(e){if(!nav.contains(e.target)){nav.classList.remove('open');mnu.setAttribute('aria-expanded','false')}});
})();
