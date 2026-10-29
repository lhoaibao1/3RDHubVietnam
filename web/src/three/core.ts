// Phần dùng chung của các cảnh 3D: vật liệu, hình khối bo tròn, texture vẽ bằng canvas, robot mascot.
import * as T from 'three'
import { getMode, onMode, type Mode } from './mode'
export { getMode, onMode, setMode } from './mode'
export type { Mode } from './mode'

export const FONT = '"Nunito",system-ui,sans-serif'
export const RM = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/* ---------- 3D helpers ---------- */
export function C(h?:any){return new T.Color(h).convertSRGBToLinear()}
export function M(h?:any,o?:any){o=o||{} as any;return new T.MeshPhysicalMaterial({color:C(h),roughness:o.r==null?.46:o.r,metalness:o.m||0,emissive:o.e?C(o.e):new T.Color(0),emissiveIntensity:o.ei==null?1:o.ei,map:o.map||null,clearcoat:(o.e||o.m)?0:(o.cc==null?.28:o.cc),clearcoatRoughness:.34,envMapIntensity:o.env==null?1:o.env})}
/* môi trường phản chiếu: cubemap vẽ bằng canvas (vòm trời + hộp đèn studio), chạy được trên mọi thiết bị.
   Bản sáng: studio trắng ấm/lạnh. Bản tối: nền xanh đêm với dải đèn cam và xanh lơ để viền bóng lên. */
var envCache:any={};
export function ENV(mode?:any){mode=mode||getMode();if(envCache[mode])return envCache[mode];var F:any[]=[],S=256,dk=mode==='dark';
  function box(x:any,a:number,b:number,w:number,h:number,col:string,blur:number){x.save();x.shadowColor=col;x.shadowBlur=blur;x.fillStyle=col;x.fillRect(a,b,w,h);x.restore()}
  for(var i=0;i<6;i++){var c=document.createElement('canvas');c.width=c.height=S;var x=c.getContext('2d') as CanvasRenderingContext2D,g:any;
    if(i===2){g=x.createRadialGradient(S/2,S/2,6,S/2,S/2,S*.75);if(dk){g.addColorStop(0,'#2A3470');g.addColorStop(1,'#0C1230')}else{g.addColorStop(0,'#FFFFFF');g.addColorStop(1,'#CBD8F0')}}
    else if(i===3){g=x.createLinearGradient(0,0,0,S);if(dk){g.addColorStop(0,'#1A2148');g.addColorStop(1,'#0A0E22')}else{g.addColorStop(0,'#A79C8E');g.addColorStop(1,'#7C7268')}}
    else{g=x.createLinearGradient(0,0,0,S);if(dk){g.addColorStop(0,'#1B2352');g.addColorStop(.5,'#10173A');g.addColorStop(1,'#0A0F26')}else{g.addColorStop(0,'#EAF1FF');g.addColorStop(.5,'#BCC8DE');g.addColorStop(1,'#94897D')}}
    x.fillStyle=g;x.fillRect(0,0,S,S);
    if(dk){
      if(i===2)box(x,70,70,116,116,'#6E7CFF',40);
      if(i===0)box(x,96,20,64,170,'#38D6FF',34);
      if(i===1)box(x,96,20,64,170,'#FF7A3C',34);
      if(i===4)box(x,30,40,70,40,'#9AA6FF',26);
      if(i===5)box(x,40,60,176,34,'#FF7A3C',30);
    }else{
      if(i===2)box(x,60,60,136,136,'#FFFFFF',50);
      if(i===1)box(x,92,16,72,176,'#FFF3E0',34);
      if(i===0)box(x,92,16,72,176,'#E3EEFF',34);
      if(i===4)box(x,40,30,96,70,'#FFFFFF',40);
      if(i===5)box(x,40,56,176,40,'#FFE9D2',34);
    }
    F.push(c)}
  var t=new T.CubeTexture(F);t.encoding=T.sRGBEncoding;t.needsUpdate=true;envCache[mode]=t;return t}
export function rgeo(w?:any,h?:any,d?:any,r?:any){
  r=Math.min(r,w/2-.01,d/2-.01,h/2-.01);var b=r*.5,rr=Math.max(.01,r-b),W=w-2*b,D=d-2*b,x=-W/2,y=-D/2,s=new T.Shape();
  s.moveTo(x+rr,y);s.lineTo(x+W-rr,y);s.quadraticCurveTo(x+W,y,x+W,y+rr);s.lineTo(x+W,y+D-rr);s.quadraticCurveTo(x+W,y+D,x+W-rr,y+D);s.lineTo(x+rr,y+D);s.quadraticCurveTo(x,y+D,x,y+D-rr);s.lineTo(x,y+rr);s.quadraticCurveTo(x,y,x+rr,y);
  var g=new T.ExtrudeGeometry(s,{depth:Math.max(.01,h-2*b),bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:4,curveSegments:8});
  g.rotateX(-Math.PI/2);g.translate(0,b,0);return g;
}
export function mesh(g?:any,m?:any,x?:any,y?:any,z?:any,noShadow?:any){var o=new T.Mesh(g,m);o.position.set(x||0,y||0,z||0);o.castShadow=!noShadow;o.receiveShadow=true;return o}
export function RB(p?:any,w?:any,h?:any,d?:any,r?:any,m?:any,x?:any,y?:any,z?:any){var o=mesh(rgeo(w,h,d,r),m,x,y,z);p.add(o);return o}
export function cyl(p?:any,r?:any,h?:any,m?:any,x?:any,y?:any,z?:any,seg?:any){var o=mesh(new T.CylinderGeometry(r,r,h,seg||32),m,x,y+h/2,z);p.add(o);return o}
export function sph(p?:any,r?:any,m?:any,x?:any,y?:any,z?:any){var o=mesh(new T.SphereGeometry(r,24,18),m,x,y,z);p.add(o);return o}
export function capsule(p?:any,r?:any,len?:any,m?:any){var g=new T.Group();g.add(mesh(new T.CylinderGeometry(r,r,len,16),m));g.add(mesh(new T.SphereGeometry(r,16,12),m,0,len/2,0));g.add(mesh(new T.SphereGeometry(r,16,12),m,0,-len/2,0));p.add(g);return g}
export function ctex(w?:any,h?:any,fn?:any){var c=document.createElement('canvas');c.width=w;c.height=h;var x=c.getContext('2d') as CanvasRenderingContext2D;fn(x,w,h);var t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;t.anisotropy=8;return t}
export function rr(x?:any,a?:any,b?:any,w?:any,h?:any,r?:any){x.beginPath();x.moveTo(a+r,b);x.arcTo(a+w,b,a+w,b+h,r);x.arcTo(a+w,b+h,a,b+h,r);x.arcTo(a,b+h,a,b,r);x.arcTo(a,b,a+w,b,r);x.closePath()}
export function screen(p?:any,w?:any,h?:any,tex?:any,x?:any,y?:any,z?:any,ry?:any){var o=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:tex,toneMapped:false}));o.position.set(x,y,z);o.rotation.y=ry||0;p.add(o);return o}

export const MAT={white:M(0xFFFFFF,{r:.5}),cream:M(0xF4EFE6,{r:.7}),side:M(0xE9E2D5,{r:.8}),orange:M(0xFF6A2B,{r:.4}),orangeD:M(0xE2531A,{r:.45}),navy:M(0x0B2A6F,{r:.36}),navyL:M(0x1C3E8F,{r:.4}),glass:M(0xBFD6FF,{r:.12,m:.1,env:1.4}),gold:M(0xFFB238,{r:.28,m:.4}),green:M(0x3CC48B,{r:.6}),leaf:M(0x2BAE73,{r:.7}),wood:M(0xC99567,{r:.7}),dark:M(0x1A2340,{r:.45})};
/* màu theo chế độ: bản tối đổi các vật liệu sáng thành xanh đêm để cảnh không bị chói trên nền tối */
var PAL:any={light:{white:0xFFFFFF,cream:0xF4EFE6,side:0xE9E2D5,navy:0x0B2A6F,navyL:0x1C3E8F,wood:0xC99567,dark:0x1A2340,glass:0xBFD6FF},
  dark:{white:0x39467A,cream:0x2E3A6E,side:0x2A3566,navy:0x3A56B8,navyL:0x4C6BD0,wood:0x8D6A4A,dark:0x0E1430,glass:0x6C8CFF}};
function paintMat(m:Mode){var p=PAL[m];for(var k in p)(MAT as any)[k].color.copy(C(p[k]))}
paintMat(getMode());onMode(paintMat);

/** Quầng sáng mềm (sprite). Chế độ tối dùng cộng sáng, chế độ sáng dùng pha màu thường. */
var glowT:any=null;
function glowTex(){return glowT||(glowT=ctex(128,128,function(x:any,w:any,h:any){var g=x.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.35,'rgba(255,255,255,.35)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,w,h)}))}
export function glow(parent?:any,col?:any,size?:any,x?:any,y?:any,z?:any,op?:any){
  var m=new T.SpriteMaterial({map:glowTex(),color:C(col),transparent:true,depthWrite:false,toneMapped:false,opacity:op==null?.55:op,fog:false});
  var sp=new T.Sprite(m);sp.scale.set(size,size,1);sp.position.set(x||0,y||0,z||0);sp.renderOrder=2;
  function mode(k:Mode){m.blending=k==='dark'?T.AdditiveBlending:T.NormalBlending;m.opacity=(op==null?.55:op)*(k==='dark'?1.25:.8);m.needsUpdate=true}
  mode(getMode());onMode(mode);parent.add(sp);return sp}
/** Bóng đổ mềm giả (ambient occlusion) dưới một vật: đĩa gradient đen mờ nằm sát mặt bệ. */
var aoT:any=null;
export function ao(parent?:any,w?:any,d?:any,x?:any,y?:any,z?:any,op?:any){
  aoT=aoT||ctex(128,128,function(c:any,W:any,H:any){var g=c.createRadialGradient(W/2,H/2,0,W/2,H/2,W/2);g.addColorStop(0,'rgba(0,0,0,.55)');g.addColorStop(.55,'rgba(0,0,0,.22)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,W,H)});
  var m=new T.Mesh(new T.PlaneGeometry(w,d),new T.MeshBasicMaterial({map:aoT,transparent:true,depthWrite:false,opacity:op==null?.8:op,toneMapped:false,fog:false}));
  m.rotation.x=-Math.PI/2;m.position.set(x||0,(y||0)+.012,z||0);m.renderOrder=1;parent.add(m);return m}
/** Vũng sáng màu trên mặt sàn (tạo không khí cho cảnh): đĩa gradient tròn nhuộm màu chủ đề. */
var poolT:any=null;
export function pool(parent?:any,r?:any,col?:any,y?:any,op?:any){
  poolT=poolT||ctex(256,256,function(c:any,W:any,H:any){var g=c.createRadialGradient(W/2,H/2,0,W/2,H/2,W/2);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.5,'rgba(255,255,255,.4)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,W,H)});
  var m=new T.MeshBasicMaterial({map:poolT,color:C(col),transparent:true,depthWrite:false,toneMapped:false,opacity:op==null?.4:op,fog:false});
  var e=new T.Mesh(new T.PlaneGeometry(r*2,r*2),m);e.rotation.x=-Math.PI/2;e.position.y=y||.01;e.renderOrder=0;
  function mode(k:Mode){m.blending=k==='dark'?T.AdditiveBlending:T.NormalBlending;m.opacity=(op==null?.4:op)*(k==='dark'?1.1:.7);m.needsUpdate=true}mode(getMode());onMode(mode);parent.add(e);return e}
/** Hạt sáng lấp lánh bay quanh cảnh. Trả về hàm cập nhật theo thời gian (giây). */
var starT:any=null;
export function sparkles(parent?:any,n?:any,spread?:any,cy?:any,col?:any){
  starT=starT||ctex(64,64,function(c:any,W:any,H:any){var g=c.createRadialGradient(W/2,H/2,0,W/2,H/2,W/2);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.25,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,W,H);c.fillStyle='rgba(255,255,255,.9)';c.fillRect(W/2-1,4,2,H-8);c.fillRect(4,H/2-1,W-8,2)});
  var pos=new Float32Array(n*3),ph=new Float32Array(n),seed=11;function rnd(){seed=(seed*9301+49297)%233280;return seed/233280}
  for(var i=0;i<n;i++){var a=rnd()*Math.PI*2,r=3+rnd()*spread;pos[i*3]=Math.cos(a)*r;pos[i*3+1]=cy+(rnd()-.35)*spread*.9;pos[i*3+2]=Math.sin(a)*r*.7;ph[i]=rnd()*6.28}
  var geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(pos,3));
  var mat=new T.PointsMaterial({map:starT,size:9,transparent:true,depthWrite:false,color:C(col||0xFFFFFF),toneMapped:false,sizeAttenuation:false,opacity:.9,fog:false});
  function mode(k:Mode){mat.blending=k==='dark'?T.AdditiveBlending:T.NormalBlending;mat.color.copy(C(k==='dark'?(col||0xBFD0FF):0xFFB238));mat.needsUpdate=true}mode(getMode());onMode(mode);
  var pts=new T.Points(geo,mat);pts.renderOrder=3;parent.add(pts);
  return function(t:number){mat.opacity=.55+.4*Math.sin(t*1.7);pts.rotation.y=t*.02;pts.position.y=Math.sin(t*.5)*.25}}

export const FACE=ctex(256,180,function(x,w,h){x.fillStyle='#fff';x.fillRect(0,0,w,h);x.strokeStyle='#0B2A6F';x.lineWidth=12;rr(x,16,16,w-32,h-32,46);x.stroke();x.fillStyle='#0B2A6F';rr(x,70,58,22,58,11);x.fill();x.lineWidth=14;x.lineCap='round';x.beginPath();x.arc(178,104,26,Math.PI*1.12,Math.PI*1.88);x.stroke()});
export function rrect(w?:any,h?:any,r?:any,d?:any){var s=new T.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);
  return new T.ExtrudeGeometry(s,{depth:d,bevelEnabled:true,bevelThickness:.03,bevelSize:.03,bevelSegments:3,curveSegments:10})}
export const RBM={visor:new T.MeshPhysicalMaterial({color:C(0x0B1230),roughness:.08,metalness:.2,clearcoat:1,clearcoatRoughness:.05,envMapIntensity:1.6}),eye:new T.MeshBasicMaterial({color:C(0x7AF4FF),toneMapped:false}),glow:new T.MeshBasicMaterial({color:C(0xFF8A4C),toneMapped:false}),joint:M(0x2A3557,{r:.4,m:.3}),
  shell:M(0xFFFFFF,{r:.28,cc:.6}),trim:M(0xFF6A2B,{r:.3,cc:.5})};
/* robot mascot: thân và đầu hình trứng nhẵn như sứ, mặt kính đen bóng, mắt phát sáng, tai và ăng-ten cam */
export function robot(parent?:any,s?:any,x?:any,z?:any,ry?:any,o?:any){
  o=o||{};var g=new T.Group();
  function ell(rx:number,ry2:number,rz:number,m:any,px:number,py:number,pz:number,seg?:number){var e=mesh(new T.SphereGeometry(1,seg||36,26),m,px,py,pz);e.scale.set(rx,ry2,rz);g.add(e);return e}
  /* chân + bàn chân */
  [-1,1].forEach(function(k){
    RB(g,.5,.24,.7,.12,RBM.joint,k*.3,0,.08);
    var leg=cyl(g,.12,.36,MAT.white,k*.3,.2,0,20);leg.material=RBM.shell;
  });
  /* thân trứng + vòng eo cam + đèn ngực */
  var body=ell(.64,.58,.5,RBM.shell,0,1.28,0);body.rotation.x=.04;
  var belt=mesh(new T.TorusGeometry(.55,.035,10,48),RBM.trim,0,.96,0,true);belt.rotation.x=Math.PI/2;belt.scale.set(1,.82,1);g.add(belt);
  var chest=mesh(new T.CylinderGeometry(.17,.17,.05,36),RBM.glow,0,1.34,.46,true);chest.rotation.x=Math.PI/2;g.add(chest);
  var ringc=mesh(new T.TorusGeometry(.2,.04,12,36),RBM.joint,0,1.34,.46,true);g.add(ringc);
  glow(g,0xFF8A4C,.9,0,1.34,.62,.5);
  /* cổ */
  cyl(g,.2,.22,RBM.joint,0,1.74,0,20);
  /* đầu trứng, mặt kính, mắt, miệng */
  var hy=1.92,hc=hy+.64;
  ell(.92,.68,.76,RBM.shell,0,hc,0,44);
  var vis=ell(.76,.5,.74,RBM.visor,0,hc+.02,.07,44);
  var eyes:any[]=[];[-.3,.3].forEach(function(ex){var e=new T.Mesh(new T.SphereGeometry(.12,24,16),RBM.eye);e.scale.set(1,1.45,.4);e.position.set(ex,hc+.08,.745);g.add(e);eyes.push(e)});
  var sm=new T.Mesh(new T.TorusGeometry(.13,.032,8,28,Math.PI),RBM.eye);sm.rotation.z=Math.PI;sm.position.set(0,hc-.15,.74);g.add(sm);
  glow(g,0x7AF4FF,1.6,0,hc+.02,.9,.38);
  /* tai nghe cam hai bên */
  [-1,1].forEach(function(k){var ea=mesh(new T.CylinderGeometry(.25,.25,.2,32),RBM.trim,k*.93,hc,0);ea.rotation.z=Math.PI/2;g.add(ea);
    var cap=mesh(new T.CylinderGeometry(.16,.16,.05,28),RBM.joint,k*1.04,hc,0,true);cap.rotation.z=Math.PI/2;g.add(cap)});
  /* ăng-ten + đèn */
  cyl(g,.035,.42,RBM.joint,0,hc+.62,0,10);var bulb=sph(g,.13,RBM.glow,0,hc+1.08,0);glow(g,0xFF8A4C,.8,0,hc+1.08,0,.7);
  /* tay: vai tròn, tay trắng, bàn tay cam */
  var la=capsule(g,.14,.4,RBM.shell);la.position.set(-.8,1.36,0);la.rotation.z=-.67;sph(g,.2,RBM.joint,-1,1.1,0);
  var ra;if(o.wave){ra=new T.Group();ra.position.set(.62,1.6,0);ra.rotation.z=-2.3;g.add(ra);var ac=capsule(ra,.14,.4,RBM.shell);ac.position.set(-.38,0,0);ac.rotation.z=Math.PI/2;sph(ra,.2,RBM.joint,-.78,0,0)}
  else{ra=capsule(g,.14,.4,RBM.shell);ra.position.set(.8,1.36,0);ra.rotation.z=.67;sph(g,.2,RBM.joint,1,1.1,0)}
  ao(g,1.9,1.5,0,0,.1,.7);
  g.scale.setScalar(s);g.position.set(x,0,z);g.rotation.y=ry||0;parent.add(g);
  g.userData={wave:o.wave?ra:null,eyes:eyes,base:0,ph:Math.random()*6};
  return g;
}
export function blinkEyes(r?:any,t?:any){var e=r.userData.eyes;if(!e)return;var k=((t+r.userData.ph)%3.6)<.12?.15:1;e[0].scale.y=e[1].scale.y=1.4*k}
