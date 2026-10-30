// Cảnh 3D riêng cho từng trang module: camera phối cảnh, một renderer dùng chung, canvas được gắn vào khung của trang đang mở.
import * as T from 'three'
import { BRANDS as BR } from '../lib/icons.generated'
import type { Partner } from '../lib/content'
import { dpr, meter, onQuality } from './quality'
import { bankB, bars as barsP, hub, mailbox, monitor, phoneDev, rack, tower, tree } from './props'
import { ENV, FONT, MAT, M, C, RB, RM, ao, blinkEyes, ctex, cyl, getMode, glow, mesh, onMode, pool, rgeo, robot, rr, screen, sparkles, sph, type Mode } from './core'

var PARTNERS: Partner[] = []

function boot() {

/* ---------- 3D cho từng trang module: camera phối cảnh, một renderer dùng chung, canvas chuyển theo trang đang mở ---------- */
  var cv=document.createElement('canvas');cv.className='glp';cv.setAttribute('aria-hidden','true');
  var R=new T.WebGLRenderer({canvas:cv,antialias:dpr()<1.75,alpha:true});
  R.setClearColor(0,0);R.outputEncoding=T.sRGBEncoding;R.toneMapping=T.ACESFilmicToneMapping;R.toneMappingExposure=getMode()==='dark'?1.0:1.05;R.shadowMap.enabled=true;R.shadowMap.type=T.PCFSoftShadowMap;R.shadowMap.autoUpdate=false;
  var cam=new T.PerspectiveCamera(30,1,.5,400),W=1,H=1,vis=false,cur:any=null,SC:any={},clk=new T.Clock(),UPV=new T.Vector3(0,1,0),px=0,py=0,tx0=0,ty0=0;
  function V(x?:any,y?:any,z?:any){return new T.Vector3(x,y,z)}
  function bgCol(){var m=getComputedStyle(document.body).backgroundColor.match(/\d+/g)||[243,241,236];return new T.Color('rgb('+m[0]+','+m[1]+','+m[2]+')')}
  /* ánh sáng theo chế độ: sáng = studio ấm, tối = ánh trăng xanh với hai đèn viền cam và xanh lơ */
  function lights(o:any,m:Mode){var d=m==='dark',L=o.L;
    L.hemi.color.set(d?0x6F7FD8:0xffffff);L.hemi.groundColor.set(d?0x141A3A:0xE6DCCB);L.hemi.intensity=d?.42:.38;
    L.key.color.set(d?0xC9D6FF:0xFFF1DC);L.key.intensity=d?1.15:1.75;
    L.rim.color.set(d?0xFF8A4C:0xCFE0FF);L.rim.intensity=d?1.6:.55;
    L.rim2.intensity=d?1.5:.25;L.rim2.color.set(d?0x38D6FF:0xFFE9D2);
    L.floor.material.opacity=d?.55:.2;
    o.s.environment=ENV(m);o.s.fog.color.copy(bgCol())}
  function base(){var s=new T.Scene();s.fog=new T.Fog(bgCol(),30,90);
    var hemi=new T.HemisphereLight(0xffffff,0xE6DCCB,.38);s.add(hemi);
    var l=new T.DirectionalLight(0xFFF1DC,1.75);l.position.set(-14,26,18);l.castShadow=true;l.shadow.mapSize.set(1024,1024);var c=l.shadow.camera;c.left=-22;c.right=22;c.top=22;c.bottom=-22;c.near=1;c.far=80;l.shadow.radius=7;l.shadow.bias=-.0005;l.shadow.normalBias=.03;s.add(l);
    var rim=new T.DirectionalLight(0xCFE0FF,.55);rim.position.set(18,10,-16);s.add(rim);
    var rim2=new T.DirectionalLight(0xFFE9D2,.25);rim2.position.set(-20,8,-14);s.add(rim2);
    var fl=new T.Mesh(new T.PlaneGeometry(300,300),new T.ShadowMaterial({opacity:.2}));fl.rotation.x=-Math.PI/2;fl.receiveShadow=true;s.add(fl);
    var root=new T.Group();s.add(root);var fx=new T.Group();root.add(fx);
    var o:any={s:s,root:root,fx:fx,a:[] as any[],tg:V(0,3,0),R:10,az:.35,el:.38,t0:0,L:{hemi:hemi,key:l,rim:rim,rim2:rim2,floor:fl}};lights(o,getMode());return o}
  onMode(function(m:Mode){R.toneMappingExposure=m==='dark'?1.0:1.05;for(var k in SC)lights(SC[k],m)});
  /* textures, helpers */
  function pill(t?:any,bg?:any,fg?:any){var c=document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;c.font='900 44px '+FONT;var w=Math.ceil(c.measureText(t).width)+84;
    return ctex(w,96,function(x,W,H){x.fillStyle=bg;rr(x,4,4,W-8,H-8,44);x.fill();x.fillStyle=fg;x.font='900 44px '+FONT;x.textAlign='center';x.textBaseline='middle';x.fillText(t,W/2,H/2+3)})}
  function spr(tex?:any,h?:any,x?:any,y?:any,z?:any){var sp=new T.Sprite(new T.SpriteMaterial({map:tex,transparent:true,toneMapped:false,fog:false}));var a=tex.image.width/tex.image.height;sp.scale.set(h*a,h,1);sp.position.set(x,y,z);return sp}
  function label(o?:any,p?:any,t?:any,x?:any,y?:any,z?:any,bg?:any,fg?:any){var sp=spr(pill(t,bg||'#0B2A6F',fg||'#fff'),1.05,x,y,z);p.add(sp);o.a.push({bob:sp,y0:y,ph:x*.3,amp:.12});return sp}
  function drawLogo(x?:any,k?:any,cx?:any,cy?:any,sz?:any,col?:any){var b=BR[k];x.save();x.translate(cx-sz/2,cy-sz/2);x.scale(sz/24,sz/24);x.fillStyle=col||b.c;x.fill(new Path2D(b.p));x.restore()}
  function logoBadge(k?:any){return ctex(256,256,function(x,w,h){x.fillStyle='#fff';x.beginPath();x.arc(128,128,120,0,7);x.fill();drawLogo(x,k,128,128,130)})}
  function logoCube(o?:any,p?:any,k?:any,x?:any,y?:any,z?:any,s?:any){var g=new T.Group(),tx=ctex(256,256,function(x,w,h){x.fillStyle='#fff';x.fillRect(0,0,w,h);drawLogo(x,k,128,128,150)});
    var m=new T.Mesh(rgeo(s,s,s,s*.22),MAT.white);m.position.y=-s/2;g.add(m);
    var f=new T.Mesh(new T.PlaneGeometry(s*.84,s*.84),new T.MeshBasicMaterial({map:tx,toneMapped:false}));f.position.z=s/2+.01;g.add(f);
    var f2=f.clone();f2.position.set(s/2+.01,0,0);f2.rotation.y=Math.PI/2;g.add(f2);
    var f3=f.clone();f3.position.set(0,s/2+.01,0);f3.rotation.x=-Math.PI/2;g.add(f3);
    g.position.set(x,y,z);p.add(g);o.a.push({bob:g,y0:y,ph:x+z,sway:.4,r0:.3});return g}
  function tube(p?:any,pts?:any,r?:any,m?:any,closed?:any){var c=new T.CatmullRomCurve3(pts,!!closed);p.add(mesh(new T.TubeGeometry(c,90,r,10,!!closed),m));return c}
  function mover(o?:any,p?:any,curve?:any,obj?:any,sp?:any,ph?:any,mode?:any){p.add(obj);o.a.push({path:curve,obj:obj,sp:sp,ph:ph||0,mode:mode||''})}
  function arrow(col?:any){var g=new T.Group();var c=mesh(new T.ConeGeometry(.32,.7,20),M(col||0xFF6A2B,{r:.4,e:col||0xFF6A2B,ei:.25}));g.add(c);return g}
  function ring(p?:any,r?:any,col?:any,x?:any,y?:any,z?:any){var m=new T.MeshBasicMaterial({color:C(col),transparent:true,toneMapped:false});var t=new T.Mesh(new T.TorusGeometry(r,.07,10,56),m);t.position.set(x,y,z);p.add(t);return t}
  function tri(p?:any,w?:any,h?:any,d?:any,m?:any,x?:any,y?:any,z?:any){var sh=new T.Shape();sh.moveTo(-w/2,0);sh.lineTo(w/2,0);sh.lineTo(0,h);sh.lineTo(-w/2,0);var g=new T.ExtrudeGeometry(sh,{depth:d,bevelEnabled:true,bevelThickness:.1,bevelSize:.1,bevelSegments:3});g.translate(0,0,-d/2);var o=mesh(g,m,x,y,z);p.add(o);return o}
  function bot(o?:any,p?:any,s?:any,x?:any,z?:any,ry?:any,wave?:any,y?:any){var r=robot(p,s,x,z,ry,{wave:wave});r.position.y=y||0;o.a.push({fn:function(t){blinkEyes(r,t)}});if(r.userData.wave)o.a.push({wave:r.userData.wave,ph:x});return r}
  /* bệ tròn: thay cho tấm sàn trắng lớn */
  function podium(o?:any,x?:any,z?:any,r?:any,acc?:any){var g=new T.Group();g.position.set(x,0,z);o.root.add(g);
    var A=acc||0xFF6A2B,body=M(A,{r:.3,e:A,ei:0,cc:.4});
    var top=ctex(256,256,function(c:any,W:any,H:any){var gr=c.createRadialGradient(W/2,H/2,10,W/2,H/2,W/2);gr.addColorStop(0,'#FFFFFF');gr.addColorStop(1,'#E9E4DA');c.fillStyle=gr;c.fillRect(0,0,W,H);c.strokeStyle='rgba(120,110,95,.16)';c.lineWidth=2;for(var k=1;k<=4;k++){c.beginPath();c.arc(W/2,H/2,k*W/9,0,7);c.stroke()}});
    var topM=M(0xFFFFFF,{r:.55,map:top,cc:.1});function paintTop(m:Mode){topM.color.set(m==='dark'?0x6B79B8:0xFFFFFF)}paintTop(getMode());onMode(paintTop);
    cyl(g,r+.42,.16,body,0,0,0,96);
    cyl(g,r+.16,.14,MAT.cream,0,.16,0,96);
    cyl(g,r,.4,MAT.white,0,.1,0,96);
    cyl(g,r-.13,.04,topM,0,.5,0,96);
    var neon=new T.Mesh(new T.TorusGeometry(r-.06,.045,10,140),new T.MeshBasicMaterial({color:C(A),toneMapped:false}));neon.rotation.x=Math.PI/2;neon.position.y=.52;g.add(neon);
    var neon2=new T.Mesh(new T.TorusGeometry(r+.2,.03,8,140),new T.MeshBasicMaterial({color:C(A),toneMapped:false,transparent:true,opacity:.7}));neon2.rotation.x=Math.PI/2;neon2.position.y=.2;g.add(neon2);
    pool(g,r*2.1,A,.02,.45);
    onMode(function(m:Mode){body.emissiveIntensity=m==='dark'?.5:0;body.needsUpdate=true});body.emissiveIntensity=getMode()==='dark'?.5:0;
    g.userData.top=.54;return g}
  function bank(p?:any,s?:any){var b=new T.Group();b.scale.setScalar(s||1);p.add(b);
    RB(b,6,.4,4.6,.15,MAT.cream,0,0,0);RB(b,5.4,3,3.4,.25,MAT.white,0,.4,-.5);
    for(var k=0;k<4;k++)cyl(b,.26,2.8,MAT.white,-2+k*1.33,.4,1.6,18);
    RB(b,6,.45,4.6,.15,MAT.navy,0,3.2,0);tri(b,5.6,1.5,3.8,MAT.orange,0,3.65,0);RB(b,1,1.8,.12,.05,MAT.navy,0,.4,1.2);return b}
  function card(o?:any,p?:any,x?:any,y?:any,z?:any){var tx=ctex(640,400,function(x,w,h){var gr=x.createLinearGradient(0,0,w,h);gr.addColorStop(0,'#0B2A6F');gr.addColorStop(1,'#2E5BD8');x.fillStyle=gr;rr(x,0,0,w,h,44);x.fill();x.fillStyle='#FFC24D';rr(x,60,130,110,84,14);x.fill();x.fillStyle='rgba(255,255,255,.9)';x.font='800 40px '+FONT;x.fillText('4520  ••••  ••••  2026',60,300);x.fillStyle='#FF6A2B';x.beginPath();x.arc(w-120,h-80,40,0,7);x.fill();x.fillStyle='rgba(255,193,77,.9)';x.beginPath();x.arc(w-80,h-80,40,0,7);x.fill();x.fillStyle='#fff';x.font='900 44px '+FONT;x.fillText('CREDIT',60,90)});
    var g=new T.Group();g.add(mesh(new T.BoxGeometry(3,1.9,.12),MAT.navy));screen(g,2.92,1.82,tx,0,0,.07);g.rotation.order='YXZ';g.rotation.y=.25;g.rotation.x=-.18;g.rotation.z=.12;g.position.set(x,y,z);p.add(g);o.a.push({bob:g,y0:y,ph:1,sway:.25,r0:.25});return g}
  function coin(){var g=new T.Group();var c=mesh(new T.CylinderGeometry(.5,.5,.16,32),MAT.gold);c.rotation.x=Math.PI/2;g.add(c);var tx=ctex(128,128,function(x,w,h){x.fillStyle='#FFB238';x.beginPath();x.arc(64,64,60,0,7);x.fill();x.fillStyle='#fff';x.font='900 72px '+FONT;x.textAlign='center';x.textBaseline='middle';x.fillText('₫',64,70)});var f=new T.Mesh(new T.CircleGeometry(.4,32),new T.MeshBasicMaterial({map:tx,toneMapped:false}));f.position.z=.09;g.add(f);var f2=f.clone();f2.rotation.y=Math.PI;f2.position.z=-.09;g.add(f2);return g}
  function doc(){var g=new T.Group();var tx=ctex(160,200,function(x,w,h){x.fillStyle='#fff';rr(x,0,0,w,h,16);x.fill();x.fillStyle='#0B2A6F';x.fillRect(22,30,80,14);x.fillStyle='#C7D3F2';for(var i=0;i<4;i++)x.fillRect(22,64+i*24,116-i*14,10);x.fillStyle='#3CC48B';x.beginPath();x.arc(118,160,22,0,7);x.fill();x.strokeStyle='#fff';x.lineWidth=6;x.beginPath();x.moveTo(108,160);x.lineTo(116,168);x.lineTo(130,152);x.stroke()});
    g.add(mesh(new T.BoxGeometry(.9,1.15,.05),MAT.white));var f=new T.Mesh(new T.PlaneGeometry(.88,1.12),new T.MeshBasicMaterial({map:tx,toneMapped:false}));f.position.z=.03;g.add(f);var f2=f.clone();f2.rotation.y=Math.PI;f2.position.z=-.03;g.add(f2);return g}
  function phone(p?:any,tx?:any,x?:any,y?:any,z?:any,ry?:any,w?:any,h?:any){var g=new T.Group();RB(g,w,h,.36,.36,MAT.navy,0,0,0);screen(g,w-.3,h-.36,tx,0,h/2,.19);g.position.set(x,y,z);g.rotation.y=ry||0;g.rotation.x=-.05;p.add(g);return g}
  function sign(t?:any,bg?:any){return ctex(512,150,function(x,w,h){x.fillStyle=bg||'#0B2A6F';rr(x,0,0,w,h,36);x.fill();x.fillStyle='#fff';x.font='900 72px '+FONT;x.textAlign='center';x.textBaseline='middle';x.fillText(t,w/2,h/2+4)})}
  function chain(o?:any,p?:any,x?:any,y?:any,z?:any,s?:any){var ch=new T.Group();var t1=mesh(new T.TorusGeometry(.8*s,.24*s,16,40),MAT.orange);t1.scale.set(1.5,1,1);t1.position.x=-.65*s;ch.add(t1);var t2=mesh(new T.TorusGeometry(.8*s,.24*s,16,40),MAT.navy);t2.scale.set(1.5,1,1);t2.position.x=.65*s;t2.rotation.x=Math.PI/2;ch.add(t2);ch.position.set(x,y,z);p.add(ch);o.a.push({bob:ch,y0:y,ph:1.2,sway:.5,r0:.3});return ch}
  function pk(col?:any){return mesh(new T.SphereGeometry(.2,16,12),M(col,{e:col,ei:.7}))}

  /* quả cầu, vòng, khối nhỏ bay quanh: tạo chiều sâu và màu sắc cho nền */
  function decor(o?:any,tint?:any,n?:any){var cols=[tint,0xFF6A2B,0x0B2A6F,0xFFFFFF,0xFFB238,tint],geos=[function(r){return new T.SphereGeometry(r,28,20)},function(r){return new T.TorusGeometry(r*.9,r*.34,14,36)},function(r){return rgeo(r*1.5,r*1.5,r*1.5,r*.5)},function(r){return new T.IcosahedronGeometry(r,1)}],seed=7;
    function rnd(){seed=(seed*9301+49297)%233280;return seed/233280}
    var g=new T.Group();o.root.add(g);
    pool(o.root,17,tint,.005,.42);o.a.push({fn:sparkles(o.root,60,15,6,tint)});
    for(var i=0;i<(n||11);i++){var r=.28+rnd()*.5,gm=geos[i%4](r),m=new T.Mesh(gm,M(cols[i%cols.length],{r:.18,cc:.9,env:1.3}));m.rotation.set(rnd()*3,rnd()*3,0);
      var a=rnd()*Math.PI*2,rad=7.5+rnd()*8,x=Math.cos(a)*rad,z=Math.sin(a)*rad*.6-3,y=1.5+rnd()*9.5;if(Math.abs(x)<4.8&&y<8.5&&z>-6)x+=x<0?-5:5;
      m.position.set(x,y,z);g.add(m);o.a.push({bob:m,y0:y,ph:i*1.1,amp:.45});o.a.push({fn:function(mm,k){return function(t){mm.rotation.x+=.004+k*.001;mm.rotation.y+=.006}}(m,i%3)})}}
  var BUILD={
  'mo-hinh':function(o){var A=podium(o,-8.2,1.2,3.7),Hb=podium(o,0,-2.2,3.5),P=podium(o,8.2,1.2,3.7,0x12A06A);
    var b=bankB(A,.62);b.position.y=.54;b.rotation.y=.32;card(o,A,2.4,5.6,1.6);tree(A,-3.4,.54,2.6,1);tree(A,3.2,.54,-2.2,.8);
    var H1=hub(Hb,.9,0,.54,0,0xFF6A2B);o.a.push({fn:H1.tick});chain(o,Hb,0,6.4,0,1);
    var r=bot(o,P,1.12,-1.2,.9,-.25,true,.54);
    var st=ctex(300,560,function(x,w,h){x.fillStyle='#F4F6FB';x.fillRect(0,0,w,h);[['tiktok','TikTok'],['facebook','Facebook'],['zalo','Zalo']].forEach(function(q,i){x.fillStyle='#fff';rr(x,20,40+i*120,w-40,100,22);x.fill();drawLogo(x,q[0],70,90+i*120,52);x.fillStyle='#0B2A6F';x.font='800 30px '+FONT;x.textBaseline='middle';x.fillText(q[1],112,80+i*120);x.fillStyle='#FF6A2B';x.font='900 26px '+FONT;x.fillText('+'+(48-i*15)+' click',112,114+i*120)})});
    phoneDev(P,2,3.8,st,1.5,.54,-.8,-.45);tree(P,-3,.54,-2,.9,0x3CC48B);
    ['tiktok','facebook','zalo'].forEach(function(k,i){var sp=spr(logoBadge(k),1.1,-1.8+i*1.5,5.4+(i%2)*.6,-1.2);P.add(sp);o.a.push({bob:sp,y0:sp.position.y,ph:i*1.4,amp:.25})});
    var path=tube(o.fx,[V(-5.2,1.15,3.2),V(-3.4,2.6,2.6),V(-1.6,1.15,1.4),V(1.6,1.15,1.4),V(3.4,2.6,2.6),V(5.2,1.15,3.2)],.09,MAT.cream);
    for(var k=0;k<2;k++)mover(o,o.fx,path,coin(),.14,k/2,'face');mover(o,o.fx,path,doc(),.14,.25,'face');
    for(var k=0;k<5;k++)mover(o,o.fx,path,arrow(),.14,.12+k/5,'arrow');
    label(o,A,'Advertiser',0,7.6,0);label(o,Hb,'3RDHub',0,8.2,0,'#FF6A2B');label(o,P,'Publisher',0,7.4,0,'#12A06A');
    o.tg.set(0,3,0);o.R=13.2;o.az=.08;o.el=.34},

  'advertiser':function(o){o.mz=.84;var P=podium(o,0,0,6.6,0x7B4DFF);
    var ui=ctex(800,500,function(x,w,h){x.fillStyle='#F6F4FB';x.fillRect(0,0,w,h);x.fillStyle='#fff';x.fillRect(0,0,w,64);x.fillStyle='#0B2A6F';x.font='900 30px '+FONT;x.fillText('Chiến dịch · Tổng quan',28,42);
      var K=[['Click','18.240','#7B4DFF'],['Lead','1.284','#FF6A2B'],['Duyệt','68%','#12A06A']];K.forEach(function(k,i){x.fillStyle='#fff';rr(x,24+i*256,88,236,120,18);x.fill();x.fillStyle='#8890A6';x.font='700 24px '+FONT;x.fillText(k[0],46+i*256,128);x.fillStyle=k[2];x.font='900 44px '+FONT;x.fillText(k[1],46+i*256,182)});
      x.fillStyle='#fff';rr(x,24,228,752,248,18);x.fill();x.strokeStyle='#7B4DFF';x.lineWidth=7;x.lineJoin='round';x.beginPath();[60,120,100,170,150,210,190,260,240,300].forEach(function(v,i){var px=60+i*76,py=440-v*.7;i?x.lineTo(px,py):x.moveTo(px,py)});x.stroke();
      x.strokeStyle='#FF6A2B';x.setLineDash([14,12]);x.beginPath();[30,60,50,90,80,110,100,140,130,170].forEach(function(v,i){var px=60+i*76,py=440-v*.7;i?x.lineTo(px,py):x.moveTo(px,py)});x.stroke()});
    monitor(P,7,4.5,ui,-.4,2.2,-2.6,.12);
    var bars:any[]=[];for(var i=0;i<5;i++)bars.push(RB(P,.8,3,.8,.2,i%2?MAT.navy:MAT.orange,1.4+i*1.0,.54,2.2+i*.1));
    o.a.push({fn:function(t){bars.forEach(function(b,i){b.scale.y=.3+.7*(.5+.5*Math.sin(t*1.4+i*.9))*(.45+i*.15)})}});
    var mg=new T.Group();var cone=mesh(new T.CylinderGeometry(1,.32,2,32,1,true),M(0xFF6A2B,{r:.45}));cone.material.side=T.DoubleSide;cone.rotation.z=-Math.PI/2;mg.add(cone);
    var bk=mesh(new T.CylinderGeometry(.4,.4,.6,24),MAT.navy);bk.rotation.z=-Math.PI/2;bk.position.x=-1.3;mg.add(bk);RB(mg,.28,.9,.28,.1,MAT.navy,-.8,-1,0);
    mg.position.set(-5.2,5.4,.6);mg.rotation.y=-.35;mg.rotation.z=.2;P.add(mg);o.a.push({bob:mg,y0:5.4,ph:.4,amp:.18});
    for(var k=0;k<3;k++){var rg=ring(P,.8,'#FF6A2B',-3.3,5.8,1.3);rg.rotation.y=Math.PI/2-.35;o.a.push({pulse:rg,sp:.7,ph:k/3,s0:.6,s1:1.5})}
    bot(o,P,1.2,-3.6,3,.35,true,.54);
    var pc=ctex(256,256,function(x,w,h){x.fillStyle='#7B4DFF';x.beginPath();x.arc(128,128,118,0,7);x.fill();x.fillStyle='#fff';x.font='900 130px '+FONT;x.textAlign='center';x.textBaseline='middle';x.fillText('%',128,138)});
    var ps=spr(pc,1.5,4.6,6.4,1);P.add(ps);o.a.push({bob:ps,y0:6.4,ph:2});
    o.tg.set(0,3,0);o.R=9.4;o.az=.3;o.el=.3},

  'cong-nghe':function(o){var L=podium(o,-7.6,1.4,3.1,0x42B883),S=podium(o,0,-1.6,3.3,0x00ADD8),D=podium(o,7.6,1.4,3.1,0x336791);
    var lp=new T.Group();lp.position.set(.2,.54,.4);lp.rotation.y=.35;L.add(lp);RB(lp,3.4,.2,2.4,.1,MAT.dark,0,0,0);
    var lu=ctex(520,340,function(x,w,h){x.fillStyle='#F4F6FB';x.fillRect(0,0,w,h);x.fillStyle='#fff';x.fillRect(0,0,w,52);drawLogo(x,'vuedotjs',34,26,30);x.fillStyle='#0B2A6F';x.font='800 24px '+FONT;x.fillText('Website publisher',60,34);for(var i=0;i<3;i++){x.fillStyle='#fff';rr(x,20,70+i*88,w-40,72,14);x.fill();x.fillStyle=['#FF6A2B','#42B883','#7B4DFF'][i];rr(x,36,86+i*88,40,40,10);x.fill();x.fillStyle='#0B2A6F';x.font='800 22px '+FONT;x.fillText(['Mở thẻ tín dụng','Vay tiêu dùng','Bảo hiểm'][i],92,114+i*88)}});
    var scr=new T.Group();RB(scr,3.4,2.3,.14,.1,MAT.dark,0,0,0);screen(scr,3.2,2.1,lu,0,1.15,.08);scr.position.set(0,.2,-1.15);scr.rotation.x=-.2;lp.add(scr);
    var RK=rack(S,0,.54,0,3);RK.leds.forEach(function(l:any,n:number){o.a.push({blink:l,ph:n})});
    screen(S,2.4,.7,sign('API Go','#00ADD8'),1.42,3.6,0,Math.PI/2);
    var dbm=M(0x336791,{r:.4});for(var i=0;i<3;i++){cyl(D,1.5,1.05,dbm,0,.54+i*1.2,0,48);cyl(D,1.52,.12,MAT.white,0,.54+i*1.2+1.05,0,48)}
    RB(D,1.3,1.3,1.3,.28,M(0xDC382D,{r:.45}),2.1,.54,1.4);for(var q=0;q<3;q++){var br=new T.Mesh(new T.TorusGeometry(1.52,.045,8,64),new T.MeshBasicMaterial({color:C(0x38D6FF),toneMapped:false}));br.rotation.x=Math.PI/2;br.position.y=.54+q*1.2+.55;D.add(br)}
    var c1=tube(o.fx,[V(-5.4,1.6,2.4),V(-3.6,2.6,1.4),V(-1.6,2,.4)],.07,MAT.cream),c2=tube(o.fx,[V(1.6,2,.4),V(3.6,2.6,1.4),V(5.4,1.6,2.4)],.07,MAT.cream);
    [c1,c2].forEach(function(c,i){for(var k=0;k<3;k++)mover(o,o.fx,c,pk(k%2?0xFF6A2B:0x3CC48B),.45,k/3+i*.1);mover(o,o.fx,c,arrow(0x0B2A6F),.45,.5,'arrow')});
    var orb=new T.Group();orb.position.set(0,6.6,-1.6);o.root.add(orb);o.a.push({fn:function(t){orb.rotation.y=t*.25}});
    ['docker','nginx','typescript','nuxt','redis','tailwindcss'].forEach(function(k,i){var a=i/6*Math.PI*2,sp=spr(logoBadge(k),1.25,Math.cos(a)*4.8,Math.sin(i*1.7)*.6,Math.sin(a)*4.8);orb.add(sp)});
    logoCube(o,L,'vuedotjs',0,5.2,0,1.6);logoCube(o,S,'go',0,8.2,0,1.8);logoCube(o,D,'postgresql',0,6,0,1.6);
    bot(o,L,1,-1.8,1.4,.4,true,.54);
    o.tg.set(0,3.4,0);o.R=12.4;o.az=.1;o.el=.32},

  'doi-tac':function(o){o.mz=.94;var Hb=podium(o,0,0,3.4);var H1=hub(Hb,1,0,.54,0,0xFF6A2B);o.a.push({fn:H1.tick});chain(o,Hb,0,7.4,0,.9);
    var Pn=PARTNERS.slice(0,8),roofs=[0xFF6A2B,0x0B2A6F,0x12A06A,0x7B4DFF,0x00ADD8,0xFF6A2B,0x0B2A6F,0x12A06A];
    Pn.forEach(function(p,i){var a=i/Pn.length*Math.PI*2+.2,rx=Math.cos(a)*8.4,rz=Math.sin(a)*8.4*.85,hh=2+(i%3)*.8;
      var b=podium(o,rx,rz,1.8,roofs[i]);var hh2=hh*1.25+.6;tower(b,2,hh2,2,roofs[i],0,.54,0,i*7+3,i%3);
      var tx=ctex(400,160,function(x,w,h){x.fillStyle='#fff';rr(x,4,4,w-8,h-8,36);x.fill();x.strokeStyle='#E4E0D8';x.lineWidth=4;rr(x,4,4,w-8,h-8,36);x.stroke()});
      var im=new Image();im.onload=function(){var c=tx.image.getContext('2d'),r=Math.min(320/im.width,110/im.height);c.drawImage(im,200-im.width*r/2,80-im.height*r/2,im.width*r,im.height*r);tx.needsUpdate=true};im.src=p.logo||'';
      var sp=spr(tx,1.1,0,hh2+2.3,0);b.add(sp);o.a.push({bob:sp,y0:hh2+2.3,ph:i,amp:.1});
      var c=tube(o.fx,[V(rx*.78,.9,rz*.78),V(rx*.55,1.5,rz*.55),V(rx*.3,1.1,rz*.3)],.05,MAT.cream);
      mover(o,o.fx,c,pk(0x3CC48B),.35,i*.13)});
    bot(o,Hb,1,1.9,2.2,.3,true,.54);
    o.tg.set(0,2.6,0);o.R=12.6;o.az=.2;o.el=.5},

  'hoi-dap':function(o){o.mz=.84;var P=podium(o,0,0,6.2,0xFFB238);
    function bubble(col?:any,txt?:any,fg?:any,w?:any,hh?:any,x?:any,y?:any,z?:any,ph?:any){var b=new T.Group(),bm=RB(b,w,.7,hh,.34,M(col,{r:.45}),0,0,0);bm.rotation.x=Math.PI/2;bm.position.set(0,hh/2,-.35);
      var tl=mesh(new T.ConeGeometry(.42,.9,4),M(col,{r:.45}));tl.rotation.z=Math.PI*.82;tl.position.set(-w*.28,-.2,0);b.add(tl);
      var tx=ctex(256,256,function(x,W,H){x.fillStyle=fg;x.font='900 200px '+FONT;x.textAlign='center';x.textBaseline='middle';x.fillText(txt,W/2,H/2+14)});var f=screen(b,hh*.9,hh*.9,tx,0,hh/2,.4);f.material.transparent=true;
      b.position.set(x,y,z);b.rotation.y=.25;P.add(b);o.a.push({bob:b,y0:y,ph:ph,amp:.3,sway:.15,r0:.25});return b}
    bubble(0xFF6A2B,'?','#fff',3.2,2.8,.8,6,-2,0);bubble(0x0B2A6F,'!','#fff',2,1.9,-3.6,7.4,-2.8,1.4);bubble(0xFFFFFF,'…','#0B2A6F',2.2,1.6,4,7.8,-3,2.6);
    var tb=new T.Group();tb.position.set(-2.2,.54,.6);tb.rotation.y=.3;P.add(tb);RB(tb,3,.25,1.9,.1,MAT.wood,0,1.9,0);[-1.2,1.2].forEach(function(xx){RB(tb,.2,1.9,1.6,.06,MAT.white,xx,0,0)});
    var lp=new T.Group();RB(lp,1.8,.1,1.2,.05,MAT.dark,0,0,0);var ls=new T.Group();RB(ls,1.8,1.2,.08,.05,MAT.dark,0,0,0);ls.position.set(0,.1,-.58);ls.rotation.x=-.25;lp.add(ls);lp.position.set(0,2.15,0);tb.add(lp);
    bot(o,P,1.2,-1.6,3,.3,true,.54);
    var lb=new T.Group();sph(lb,.85,M(0xFFE27A,{e:0xFFD23F,ei:.9,r:.2}),0,1.5,0);cyl(lb,.4,.55,M(0xC9CED8,{r:.4,m:.5}),0,.3,0,20);lb.position.set(3.8,3.6,1.8);P.add(lb);o.a.push({bob:lb,y0:3.6,ph:.8});
    var gl=ring(lb,1.1,'#FFB238',0,1.5,0);gl.rotation.y=.25;o.a.push({pulse:gl,sp:.45,ph:0,s0:.9,s1:.7});
    [[0xFF6A2B,0],[0x0B2A6F,.4],[0x12A06A,.8],[0x7B4DFF,1.2]].forEach(function(q,i){RB(P,2.2-i*.12,.38,1.6,.08,M(q[0],{r:.6}),3.4,.54+q[1],-1.6).rotation.y=i*.14});
    o.tg.set(0,3.4,0);o.R=8.2;o.az=.25;o.el=.3},

  'lien-he':function(o){o.mz=.84;var P=podium(o,0,0,6.4,0xFF4D8D);
    var MB=mailbox(P,-3.8,.54,.4,.35),flag=MB.flag;o.a.push({fn:function(t){flag.rotation.z=-.6+Math.sin(t*1.6)*.6}});
    var pt=ctex(300,600,function(x,w,h){x.fillStyle='#fff';x.fillRect(0,0,w,h);x.fillStyle='#8890A6';x.font='700 24px '+FONT;x.textAlign='center';x.fillText('Đang gọi',w/2,96);x.fillStyle='#0B2A6F';x.font='900 32px '+FONT;x.fillText('3RDHub Vietnam',w/2,150);x.font='800 26px '+FONT;x.fillStyle='#5B6279';x.fillText('(+84) 398 192 414',w/2,192);
      x.fillStyle='#EEF1F7';x.beginPath();x.arc(w/2,320,70,0,7);x.fill();x.fillStyle='#0B2A6F';x.font='900 60px '+FONT;x.fillText('3R',w/2,342);x.fillStyle='#3CC48B';x.beginPath();x.arc(w/2,500,46,0,7);x.fill();x.strokeStyle='#fff';x.lineWidth=8;x.lineCap='round';x.beginPath();x.arc(w/2,500,20,Math.PI*.2,Math.PI*.8);x.stroke()});
    phoneDev(P,2.8,5.4,pt,2.4,.54,-1.4,-.3);
    for(var k=0;k<3;k++){var rg=ring(P,.7,'#3CC48B',4.4,5.6,-1.2);rg.rotation.y=-.3;o.a.push({pulse:rg,sp:.6,ph:k/3,s0:.6,s1:1.5})}
    var et=ctex(256,170,function(x,w,h){x.fillStyle='#fff';rr(x,0,0,w,h,16);x.fill();x.strokeStyle='#0B2A6F';x.lineWidth=8;x.lineJoin='round';x.beginPath();x.moveTo(16,18);x.lineTo(w/2,96);x.lineTo(w-16,18);x.stroke();x.fillStyle='#FF6A2B';x.beginPath();x.arc(w-40,h-36,18,0,7);x.fill()});
    function env(){var e=new T.Group();e.scale.setScalar(1.25);e.add(mesh(new T.BoxGeometry(1.5,1,.08),MAT.white));var f=new T.Mesh(new T.PlaneGeometry(1.48,.98),new T.MeshBasicMaterial({map:et,toneMapped:false}));f.position.z=.045;e.add(f);var f2=f.clone();f2.rotation.y=Math.PI;f2.position.z=-.045;e.add(f2);return e}
    var loop=new T.CatmullRomCurve3([V(-3.6,5.4,.8),V(-1,7.6,2.6),V(3,8,1),V(2.6,7,-3.4),V(-2.6,6.6,-3)],true);
    for(var k=0;k<3;k++)mover(o,o.fx,loop,env(),.08,k/3,'face');
    bot(o,P,1.2,-.4,3,.25,true,.54);
    o.tg.set(0,3.4,0);o.R=8.4;o.az=.28;o.el=.3}
  };

  var Q=new T.Quaternion();
  function run(o?:any,t?:any){o.a.forEach(function(q){
    if(q.bob){q.bob.position.y=q.y0+Math.sin(t*1.6+(q.ph||0))*(q.amp||.35);if(q.sway)q.bob.rotation.y=(q.r0||0)+Math.sin(t*.8+(q.ph||0))*q.sway}
    if(q.blink)q.blink.visible=Math.sin(t*4+q.ph)>-.3;
    if(q.pulse){var k=(t*q.sp+q.ph)%1;q.pulse.scale.setScalar(q.s0+k*q.s1);q.pulse.material.opacity=1-k}
    if(q.path){var u=(t*q.sp+q.ph)%1,d=q.path.getTangentAt(u);q.obj.position.copy(q.path.getPointAt(u));
      if(q.mode==='arrow'){q.obj.quaternion.setFromUnitVectors(UPV,d)}else if(q.mode==='face'){q.obj.rotation.set(0,Math.atan2(d.x,d.z)+Math.PI/2,0)}
      var e=Math.min(1,u*8,(1-u)*8);q.obj.scale.setScalar(Math.max(.001,e))}
    if(q.wave)q.wave.rotation.z=-2.3+Math.sin(t*5+(q.ph||0))*.35;
    if(q.fn)q.fn(t)});
    /* hiệu ứng xuất hiện: từng cụm bật lên lần lượt */
    var kids=o.root.children;for(var i=0;i<kids.length;i++){var c=kids[i];if(c.userData.s0==null)c.userData.s0=c.scale.x;var k=Math.min(1,Math.max(0,(t-o.t0-i*.12)/.75));var s=k<1?1+2.2*Math.pow(k-1,3)+1.2*Math.pow(k-1,2):1;c.scale.setScalar(Math.max(.001,c.userData.s0*s))}}
  function size(){var r=cv.getBoundingClientRect();W=Math.max(1,r.width);H=Math.max(1,r.height);R.setPixelRatio(dpr());R.setSize(W,H,false)}
  new ResizeObserver(size).observe(cv);new IntersectionObserver(function(e){vis=e[0].isIntersecting}).observe(cv);
  window.addEventListener('pointermove',function(e){tx0=(e.clientX/innerWidth-.5)*2;ty0=(e.clientY/innerHeight-.5)*2},{passive:true});
  var lastF=0,fc=0,mt=meter();onQuality(size);
  (function loop(){requestAnimationFrame(loop);if(!cur||!vis)return;var tf=performance.now();if(tf-lastF<22)return;mt(tf-lastF);lastF=tf;if(fc++%3===0)R.shadowMap.needsUpdate=true;var t=clk.getElapsedTime();px+=(tx0-px)*.05;py+=(ty0-py)*.05;
    run(cur,RM?cur.t0+99:t);
    var mob=W<=900,asp=W/H,ea=mob?asp:asp*.56,vf=cam.fov*Math.PI/180,hf=2*Math.atan(Math.tan(vf/2)*ea),dist=cur.R*(mob?(cur.mz||1):.88)/Math.sin(Math.min(vf,hf)/2);
    var az=cur.az+(RM?0:Math.sin(t*.18)*.1)+px*.12,el=cur.el+py*.05;
    cam.position.set(cur.tg.x+dist*Math.cos(el)*Math.sin(az),cur.tg.y+dist*Math.sin(el),cur.tg.z+dist*Math.cos(el)*Math.cos(az));cam.lookAt(cur.tg);
    cam.aspect=asp;if(!mob)cam.setViewOffset(W,H,-W*.21,0,W,H);else cam.clearViewOffset();cam.near=Math.max(.5,dist-40);cam.far=dist+60;cam.updateProjectionMatrix();
    cur.s.fog.near=dist-2;cur.s.fog.far=dist+cur.R*3.2;
    R.render(cur.s,cam)})();
  BUILD['san-pham']=BUILD['advertiser'];BUILD['bao-gia']=BUILD['advertiser'];
  var TINT={'bao-gia':0xFFB238,'san-pham':0x1BA6D9,'mo-hinh':0xFF6A2B,'advertiser':0x7B4DFF,'cong-nghe':0x00ADD8,'doi-tac':0x12A06A,'hoi-dap':0xFFB238,'lien-he':0xFF4D8D};
  function show(slot?:any,id?:any,partners?:any){if(!BUILD[id])return false;PARTNERS=partners;slot.insertBefore(cv,slot.firstChild);
    if(!SC[id]){var o=base();BUILD[id](o);decor(o,TINT[id]||0xFF6A2B);o.a.forEach(function(q){var f=q.bob||q.obj;if(f)f.traverse(function(n){n.castShadow=false})});SC[id]=o}
    cur=SC[id];cur.s.fog.color.copy(bgCol());cur.t0=clk.getElapsedTime();size();return true}
  function hide(){cur=null;vis=false;if(cv.parentNode)cv.parentNode.removeChild(cv)}
  return {show:show,hide:hide}
}

let api: ReturnType<typeof boot> | null = null

/** Hiện cảnh 3D của trang `id` trong khung `slot`. Trả về false nếu trang không có cảnh. */
export function showPage3D(slot: HTMLElement, id: string, partners: Partner[]): boolean {
  if (!api) api = boot()
  return api.show(slot, id, partners)
}

export function hidePage3D(): void {
  api?.hide()
}
