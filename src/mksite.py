#!/usr/bin/env python3
"""Ghép site từ các file nguồn và xuất ra thư mục đích (mặc định ./site_out): index.html + lib/."""
import os,re,shutil,subprocess,sys
out=sys.argv[1] if len(sys.argv)>1 else 'site_out'
subprocess.run([sys.executable,'build.py'],check=True,stdout=subprocess.DEVNULL)
s=open('fixed.html',encoding='utf8').read()
s=s.replace('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/','lib/').replace('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/','lib/')
SITE_URL=os.environ.get('SITE_URL','https://3rdhubvietnam.tech')
meta='''<title>3RDHub Vietnam</title>
<meta name="description" content="3RDHub Vietnam, nền tảng tiếp thị liên kết thuộc 3RDVN Technology. Mỗi lượt bấm, mỗi hồ sơ và mỗi đồng hoa hồng đều được ghi nhận.">
<meta name="theme-color" content="#F3F1EC">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta property="og:type" content="website">
<meta property="og:site_name" content="3RDHub Vietnam">
<meta property="og:title" content="3RDHub Vietnam">
<meta property="og:description" content="Nền tảng tiếp thị liên kết, minh bạch từng đồng.">
<meta property="og:url" content="SITE_URL/">
<meta property="og:image" content="SITE_URL/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="SITE_URL/og-image.png">
<script>/* đường dẫn gọn cho trang pháp lý: /dieu-khoan, /bao-mat (và /terms, /privacy) */(function(){var m=location.pathname.match(/^\\/(dieu-khoan|bao-mat|terms|privacy)\\/?$/);if(m)location.replace('/#/'+({terms:'dieu-khoan',privacy:'bao-mat'}[m[1]]||m[1]))})()</script>'''.replace('SITE_URL',SITE_URL)
assert s.count('<title>3RDHub Vietnam</title>')==1
s=s.replace('<title>3RDHub Vietnam</title>',meta).replace('<meta name="claude:viewport-fit-sides" content="cover">','').replace('<html>','<html lang="vi">',1)
os.makedirs(os.path.join(out,'lib'),exist_ok=True)
for f in ('three.min.js','gsap.min.js','ScrollTrigger.min.js'): shutil.copy(os.path.join('lib',f),os.path.join(out,'lib',f))
open(os.path.join(out,'index.html'),'w',encoding='utf8').write(s)
if os.path.isdir('assets'):
    for f in os.listdir('assets'): shutil.copy(os.path.join('assets',f),os.path.join(out,f))
print('site ->',out,len(s))
