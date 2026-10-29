#!/usr/bin/env python3
"""Ghép site từ các file nguồn và xuất ra thư mục đích (mặc định ./site_out): index.html + lib/."""
import os,re,shutil,subprocess,sys
out=sys.argv[1] if len(sys.argv)>1 else 'site_out'
subprocess.run([sys.executable,'build.py'],check=True,stdout=subprocess.DEVNULL)
s=open('fixed.html',encoding='utf8').read()
s=s.replace('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/','lib/').replace('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/','lib/')
fav="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%230B2A6F'/%3E%3Crect x='12' y='18' width='40' height='28' rx='12' fill='none' stroke='%23fff' stroke-width='4'/%3E%3Crect x='23' y='26' width='5' height='12' rx='2.5' fill='%23fff'/%3E%3Cpath d='M36 34a6 6 0 0 1 10 0' stroke='%23FF6A2B' stroke-width='4' fill='none' stroke-linecap='round'/%3E%3C/svg%3E"
meta='<title>3RDHub Vietnam</title>\n<meta name="description" content="3RDHub Vietnam, nền tảng tiếp thị liên kết thuộc 3RDVN Technology. Mỗi lượt bấm, mỗi hồ sơ và mỗi đồng hoa hồng đều được ghi nhận.">\n<meta name="theme-color" content="#F3F1EC">\n<meta property="og:title" content="3RDHub Vietnam">\n<meta property="og:description" content="Nền tảng tiếp thị liên kết, minh bạch từng đồng.">\n<meta property="og:type" content="website">\n<link rel="icon" href="'+fav+'">'
assert s.count('<title>3RDHub Vietnam</title>')==1
s=s.replace('<title>3RDHub Vietnam</title>',meta).replace('<meta name="claude:viewport-fit-sides" content="cover">','').replace('<html>','<html lang="vi">',1)
os.makedirs(os.path.join(out,'lib'),exist_ok=True)
for f in ('three.min.js','gsap.min.js','ScrollTrigger.min.js'): shutil.copy(os.path.join('lib',f),os.path.join(out,'lib',f))
open(os.path.join(out,'index.html'),'w',encoding='utf8').write(s)
print('site ->',out,len(s))
