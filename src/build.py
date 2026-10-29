import re,json,os
NP='npm/'
LU=NP+'lucide-static-1.64.0/package/icons/'
SI=NP+'simple-icons-16.36.0/package/'
data={d['slug'] if 'slug' in d else None:d for d in json.load(open(SI+'data/simple-icons.json'))}
def si(k):
    t=open(SI+'icons/'+k+'.svg').read();p=re.search(r' d="([^"]+)"',t).group(1)
    hx=None
    for d in json.load(open(SI+'data/simple-icons.json')):
        slug=d.get('slug') or re.sub(r'[^a-z0-9]','',d['title'].lower().replace('.','dot').replace('+','plus'))
        if slug==k: hx=d['hex'];break
    return p,'#'+(hx or '000000')
def lu(k):
    t=open(LU+k+'.svg').read();inner=re.search(r'>\s*(.*)\s*</svg>',t,re.S).group(1)
    inner=re.sub(r'\s+',' ',inner).strip()
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+inner+'</svg>'
def siSvg(k):
    p,c=si(k);return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="'+c+'" d="'+p+'"/></svg>'
html=open('pages.html',encoding='utf8').read()
html=re.sub(r'(<span class="[^"]*" data-i="([a-z0-9-]+)">)',lambda m:m.group(1)+lu(m.group(2)),html)
html=re.sub(r'(<span class="bl" data-b="([a-z0-9]+)">)',lambda m:m.group(1)+siSvg(m.group(2)),html)
html=re.sub(r'(<span data-b="([a-z0-9]+)">)',lambda m:m.group(1)+siSvg(m.group(2)),html)
BR={k:dict(zip(('p','c'),si(k))) for k in ['vuedotjs','go','postgresql','redis','docker','nginx','typescript','nuxt','tiktok','facebook','zalo','tailwindcss']}
s=open('pre-modules.html',encoding='utf8').read()
def rep(a,b):
    global s
    assert s.count(a)==1,(s.count(a),a[:80]);s=s.replace(a,b)
rep('@media(max-width:900px){.nav nav,.nav .lg{display:none}.nav .btn{margin-left:auto}}','@media(max-width:900px){.nav .lg{display:none}.nav .btn{margin-left:auto}}')
rep('@media(prefers-reduced-motion:reduce)',open('pages.css',encoding='utf8').read()+'\n@media(prefers-reduced-motion:reduce)')
rep('<nav aria-label="Điều hướng"><a href="#mo-hinh">Mô hình</a><a href="#doanh-nghiep">Advertiser</a><a href="#cong-nghe">Công nghệ</a><a href="#doi-tac">Đối tác</a><a href="#faq">Hỏi đáp</a><a href="#lien-he">Liên hệ</a></nav>',
    '<nav aria-label="Điều hướng"><a href="#/mo-hinh">Mô hình</a><a href="#/advertiser">Advertiser</a><a href="#/cong-nghe">Công nghệ</a><a href="#/doi-tac">Đối tác</a><a href="#/hoi-dap">Hỏi đáp</a><a href="#/lien-he">Liên hệ</a><a class="mcta" href="https://app.3rdvn.io.vn/auth/login?tab=signup" target="_blank" rel="noopener">Đăng ký ngay</a></nav>')
rep('<a class="brand" href="#top"','<a class="brand" href="#/"')
rep('  <a class="btn or" href="https://app.3rdvn.io.vn/auth/login?tab=signup" target="_blank" rel="noopener">Đăng ký ngay</a>\n</header>',
    '  <a class="btn or" href="https://app.3rdvn.io.vn/auth/login?tab=signup" target="_blank" rel="noopener">Đăng ký ngay</a>\n  <div class="lang" role="group" aria-label="Ngôn ngữ"><svg class="lg-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg><button type="button" data-l="vi" aria-pressed="true" aria-label="Tiếng Việt"><svg class="flag" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="10" fill="#DA251D"/><path fill="#FFCD00" d="m10 4.6 1.3 4h4.2l-3.4 2.5 1.3 4L10 12.6l-3.4 2.5 1.3-4-3.4-2.5h4.2z"/></svg><span>VI</span></button><button type="button" data-l="en" aria-pressed="false" aria-label="English"><svg class="flag" viewBox="0 0 20 20" aria-hidden="true"><defs><clipPath id="fgb"><circle cx="10" cy="10" r="10"/></clipPath></defs><g clip-path="url(#fgb)"><rect width="20" height="20" fill="#012169"/><path d="M0 0 20 20M20 0 0 20" stroke="#fff" stroke-width="4"/><path d="M0 0 20 20M20 0 0 20" stroke="#C8102E" stroke-width="1.6"/><path d="M10 0v20M0 10h20" stroke="#fff" stroke-width="6"/><path d="M10 0v20M0 10h20" stroke="#C8102E" stroke-width="3.4"/></g></svg><span>EN</span></button></div>\n  <button type="button" class="mnu" id="mnu" aria-label="Mở menu" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>\n</header>')
rep('</main>\n<footer>','</main>\n'+html+'<footer>')
rep("$$('.need button').forEach(function(b){b.addEventListener('click',function(){$$('.need button').forEach(function(x){x.setAttribute('aria-pressed',x===b)})})});",
    "$$('.need button').forEach(function(b){b.addEventListener('click',function(){$$('button',b.parentNode).forEach(function(x){x.setAttribute('aria-pressed',x===b)})})});")
i=s.index("$$('[data-copy]').forEach");j=s.index('\n',i)
s=s[:j+1]+open('pages.js',encoding='utf8').read()+s[j+1:]
k=s.rindex('})();\n</script>')
en=json.load(open('en.json',encoding='utf8')) if os.path.exists('en.json') else {}
s=s[:k]+'var BR='+json.dumps(BR,separators=(',',':'))+';\nwindow.__EN='+json.dumps(en,ensure_ascii=False,separators=(',',':'))+';\n'+open('scenes3d.js',encoding='utf8').read()+open('i18n.js',encoding='utf8').read()+open('cms-client.js',encoding='utf8').read()+s[k:]
open('fixed.html','w',encoding='utf8').write(s)
print('ok',len(s))
