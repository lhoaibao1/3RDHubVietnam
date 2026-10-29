// Phần dùng chung của các cảnh 3D: vật liệu, hình khối bo tròn, texture vẽ bằng canvas, robot mascot.
import * as T from 'three'

export const FONT = '"Nunito",system-ui,sans-serif'
export const RM = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/* ---------- 3D helpers ---------- */
export function C(h?:any){return new T.Color(h).convertSRGBToLinear()}
export function M(h?:any,o?:any){o=o||{} as any;return new T.MeshPhysicalMaterial({color:C(h),roughness:o.r==null?.55:o.r,metalness:o.m||0,emissive:o.e?C(o.e):new T.Color(0),emissiveIntensity:o.ei==null?1:o.ei,map:o.map||null,clearcoat:(o.e||o.m)?0:(o.cc==null?.5:o.cc),clearcoatRoughness:.26})}
/* môi trường phản chiếu: cubemap nhỏ vẽ bằng canvas (vòm sáng + hộp đèn studio), chạy được trên mọi thiết bị */
export function ENV(){var F:any[]=[];
  for(var i=0;i<6;i++){var c=document.createElement('canvas');c.width=c.height=64;var x=c.getContext('2d') as CanvasRenderingContext2D,g:any;
    if(i===2){g=x.createRadialGradient(32,32,2,32,32,46);g.addColorStop(0,'#FFFFFF');g.addColorStop(1,'#C4D3EE')}
    else if(i===3){g=x.createLinearGradient(0,0,0,64);g.addColorStop(0,'#8A8178');g.addColorStop(1,'#6A625A')}
    else{g=x.createLinearGradient(0,0,0,64);g.addColorStop(0,'#E4ECFB');g.addColorStop(.55,'#B9C4D8');g.addColorStop(1,'#8F857A')}
    x.fillStyle=g;x.fillRect(0,0,64,64);
    if(i===1||i===4){x.shadowColor='#fff';x.shadowBlur=10;x.fillStyle='#FFFFFF';x.fillRect(12,8,30,18)}
    if(i===0){x.shadowColor='#CFE0FF';x.shadowBlur=8;x.fillStyle='#EAF2FF';x.fillRect(22,6,22,40)}
    if(i===5){x.shadowColor='#FFE2C4';x.shadowBlur=8;x.fillStyle='#FFF1E0';x.fillRect(10,14,40,14)}
    F.push(c)}
  var t=new T.CubeTexture(F);t.encoding=T.sRGBEncoding;t.needsUpdate=true;return t}
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

export const MAT={white:M(0xFFFFFF,{r:.6}),cream:M(0xF4EFE6,{r:.8}),side:M(0xE9E2D5,{r:.85}),orange:M(0xFF6A2B,{r:.45}),orangeD:M(0xE2531A,{r:.5}),navy:M(0x0B2A6F,{r:.4}),navyL:M(0x1C3E8F,{r:.45}),glass:M(0xBFD6FF,{r:.15,m:.1}),gold:M(0xFFB238,{r:.3,m:.35}),green:M(0x3CC48B,{r:.7}),leaf:M(0x2BAE73,{r:.8}),wood:M(0xC99567,{r:.8}),dark:M(0x1A2340,{r:.5})};

export const FACE=ctex(256,180,function(x,w,h){x.fillStyle='#fff';x.fillRect(0,0,w,h);x.strokeStyle='#0B2A6F';x.lineWidth=12;rr(x,16,16,w-32,h-32,46);x.stroke();x.fillStyle='#0B2A6F';rr(x,70,58,22,58,11);x.fill();x.lineWidth=14;x.lineCap='round';x.beginPath();x.arc(178,104,26,Math.PI*1.12,Math.PI*1.88);x.stroke()});
export function rrect(w?:any,h?:any,r?:any,d?:any){var s=new T.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);
  return new T.ExtrudeGeometry(s,{depth:d,bevelEnabled:true,bevelThickness:.03,bevelSize:.03,bevelSegments:3,curveSegments:10})}
export const RBM={visor:new T.MeshStandardMaterial({color:C(0x0F1733),roughness:.18,metalness:.35}),eye:new T.MeshBasicMaterial({color:C(0x7AF4FF),toneMapped:false}),glow:new T.MeshBasicMaterial({color:C(0xFF8A4C),toneMapped:false}),joint:M(0x2A3557,{r:.5})};
/* robot: đầu bo tròn, kính đen, mắt phát sáng, ăng-ten */
export function robot(parent?:any,s?:any,x?:any,z?:any,ry?:any,o?:any){
  o=o||{};var g=new T.Group();
  RB(g,.5,.26,.68,.13,MAT.navy,-.3,0,.06);RB(g,.5,.26,.68,.13,MAT.navy,.3,0,.06);
  var l1=capsule(g,.14,.3,MAT.white);l1.position.set(-.3,.56,0);var l2=capsule(g,.14,.3,MAT.white);l2.position.set(.3,.56,0);
  RB(g,1.22,1.02,.94,.44,MAT.white,0,.78,0);
  var ch=mesh(new T.CylinderGeometry(.19,.19,.06,32),RBM.glow,0,1.3,.47,true);ch.rotation.x=Math.PI/2;g.add(ch);
  var chr=mesh(new T.TorusGeometry(.22,.04,10,32),MAT.navy,0,1.3,.47,true);g.add(chr);
  cyl(g,.2,.2,RBM.joint,0,1.78,0,20);
  var hy=1.92,head=RB(g,1.78,1.28,1.32,.56,MAT.white,0,hy,0),hc=hy+.64;
  var vs=new T.Mesh(rrect(1.42,.88,.34,.06),RBM.visor);vs.position.set(0,hc,.6);g.add(vs);
  var eyes:any[]=[];[-.3,.3].forEach(function(ex){var e=new T.Mesh(new T.SphereGeometry(.12,20,14),RBM.eye);e.scale.set(1,1.4,.4);e.position.set(ex,hc+.06,.7);g.add(e);eyes.push(e)});
  var sm=new T.Mesh(new T.TorusGeometry(.13,.032,8,24,Math.PI),RBM.eye);sm.rotation.z=Math.PI;sm.position.set(0,hc-.17,.7);g.add(sm);
  [-1,1].forEach(function(k){var ea=mesh(new T.CylinderGeometry(.24,.24,.16,28),MAT.orange,k*.95,hc,0);ea.rotation.z=Math.PI/2;g.add(ea)});
  cyl(g,.04,.42,RBM.joint,0,hy+1.28,0,10);var bulb=sph(g,.13,RBM.glow,0,hy+1.78,0);
  var la=capsule(g,.15,.4,MAT.white);la.position.set(-.8,1.36,0);la.rotation.z=-.67;sph(g,.2,MAT.navy,-1,1.1,0);
  var ra;if(o.wave){ra=new T.Group();ra.position.set(.62,1.6,0);ra.rotation.z=-2.3;g.add(ra);var ac=capsule(ra,.15,.4,MAT.white);ac.position.set(-.38,0,0);ac.rotation.z=Math.PI/2;sph(ra,.2,MAT.navy,-.78,0,0)}
  else{ra=capsule(g,.15,.4,MAT.white);ra.position.set(.8,1.36,0);ra.rotation.z=.67;sph(g,.2,MAT.navy,1,1.1,0)}
  g.scale.setScalar(s);g.position.set(x,0,z);g.rotation.y=ry||0;parent.add(g);
  g.userData={wave:o.wave?ra:null,eyes:eyes,base:0,ph:Math.random()*6};
  return g;
}
export function blinkEyes(r?:any,t?:any){var e=r.userData.eyes;if(!e)return;var k=((t+r.userData.ph)%3.6)<.12?.15:1;e[0].scale.y=e[1].scale.y=1.4*k}
