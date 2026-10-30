// Cảnh 3D trang chủ: 5 trạm của mô hình affiliate trên một đường dẫn, camera trực giao bay qua từng bước.
import * as T from 'three'
import { dpr, meter, onQuality } from './quality'
import { bankB, hub, phoneDev, rack } from './props'
import { ENV, MAT, M, C, RB, RM, FONT, blinkEyes, cyl, ctex, getMode, glow, mesh, onMode, pool, robot, rr, screen, sparkles, sph, type Mode } from './core'

export const HERO_LABELS = ['Advertiser', '3RDHub', 'Publisher', 'Khách hàng', 'Hoa hồng']

export interface Hero {
  /** Đặt bước hiện tại (0 = tổng quan, 1..5 = các trạm). */
  go(k: number): void
  visible(): boolean
  dispose(): void
}

export function createHero(canvas: HTMLCanvasElement, tagEl: HTMLElement, cb: { onTag(k: number, label: string): void }): Hero {
  var R: any, scene: any, cam: any, W = 1, H = 1, anim: any[] = [], stations: any[] = [], curve: any, progMesh: any, coin: any
  R=new T.WebGLRenderer({canvas:canvas,antialias:dpr()<1.75,alpha:true,powerPreference:'high-performance'});
  R.setClearColor(0,0);R.outputEncoding=T.sRGBEncoding;R.toneMapping=T.ACESFilmicToneMapping;R.toneMappingExposure=getMode()==='dark'?1.05:1.18;
  R.shadowMap.enabled=true;R.shadowMap.type=T.PCFSoftShadowMap;R.shadowMap.autoUpdate=false;
  scene=new T.Scene();
  cam=new T.OrthographicCamera(-10,10,10,-10,.1,400);
  var hemi=new T.HemisphereLight(0xffffff,0xE9DFCF,.5);scene.add(hemi);scene.environment=ENV(getMode());
  var sun=new T.DirectionalLight(0xFFF4E6,1.6);sun.position.set(-30,60,30);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
  var sc=sun.shadow.camera;sc.left=-55;sc.right=55;sc.top=55;sc.bottom=-55;sc.near=1;sc.far=200;sun.shadow.bias=-.0004;sun.shadow.normalBias=.02;sun.shadow.radius=6;scene.add(sun);scene.add(sun.target);
  var fill=new T.DirectionalLight(0xDDE6FF,.35);fill.position.set(40,20,-20);scene.add(fill);
  var rimA=new T.DirectionalLight(0xFF8A4C,0);rimA.position.set(-40,14,-30);scene.add(rimA);var rimB=new T.DirectionalLight(0x38D6FF,0);rimB.position.set(44,12,-34);scene.add(rimB);
  var floor=new T.Mesh(new T.PlaneGeometry(400,400),new T.ShadowMaterial({opacity:.16}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
  /* ánh sáng theo chế độ sáng/tối */
  function lights(m:Mode){var d=m==='dark';hemi.color.set(d?0x6F7FD8:0xffffff);hemi.groundColor.set(d?0x141A3A:0xE9DFCF);hemi.intensity=d?.45:.5;
    sun.color.set(d?0xC9D6FF:0xFFF4E6);sun.intensity=d?1.05:1.6;fill.intensity=d?.2:.35;rimA.intensity=d?1.5:0;rimB.intensity=d?1.4:0;
    floor.material.opacity=d?.5:.16;scene.environment=ENV(m);R.toneMappingExposure=d?1.05:1.18}
  var offMode=onMode(lights);lights(getMode());

  function rbt(...a:any[]){var r=(robot as any)(...a);r.position.y=.8;return r}
  var ACC=[0xFF6A2B,0x7B4DFF,0x12A06A,0x1BA6D9,0xFFB238];
  var topTex=ctex(512,512,function(x:any,w:any,h:any){var g=x.createLinearGradient(0,0,w,h);g.addColorStop(0,'#FFFFFF');g.addColorStop(1,'#ECE7DD');x.fillStyle=g;x.fillRect(0,0,w,h);x.strokeStyle='rgba(110,100,85,.13)';x.lineWidth=2;for(var k=1;k<8;k++){x.beginPath();x.moveTo(k*w/8,0);x.lineTo(k*w/8,h);x.moveTo(0,k*h/8);x.lineTo(w,k*h/8);x.stroke()}
    x.strokeStyle='rgba(110,100,85,.35)';x.lineWidth=6;x.lineCap='round';[[40,40,1,1],[w-40,40,-1,1],[40,h-40,1,-1],[w-40,h-40,-1,-1]].forEach(function(c:any){x.beginPath();x.moveTo(c[0],c[1]+c[3]*46);x.lineTo(c[0],c[1]);x.lineTo(c[0]+c[2]*46,c[1]);x.stroke()})});
  function platform(x?:any,z?:any,acc?:any){var g=new T.Group();g.position.set(x,0,z);acc=acc||0xFF6A2B;
    var edge=M(acc,{r:.3,e:acc,ei:0,cc:.4});RB(g,13.5,.5,13.5,1.2,edge,0,-.1,0);
    RB(g,13,.7,13,1.2,MAT.white,0,.1,0);
    var tp=new T.Mesh(new T.PlaneGeometry(12.2,12.2),new T.MeshStandardMaterial({map:topTex,roughness:.7}));tp.rotation.x=-Math.PI/2;tp.position.y=.805;tp.receiveShadow=true;g.add(tp);
    function paintTop(m:Mode){(tp.material as any).color.set(m==='dark'?0x6B79B8:0xFFFFFF)}paintTop(getMode());onMode(paintTop);
    var neon=new T.Mesh(new T.PlaneGeometry(12.4,12.4),new T.MeshBasicMaterial({color:C(acc),toneMapped:false,transparent:true,opacity:.0}));
    onMode(function(m:Mode){edge.emissiveIntensity=m==='dark'?.7:0;edge.needsUpdate=true});edge.emissiveIntensity=getMode()==='dark'?.7:0;
    pool(g,17,acc,.05,.45);
    scene.add(g);return g}
  var SP=[[-24,-10],[0,-18],[24,-8],[14,16],[-14,14]];
  var LBL=['Advertiser','3RDHub','Publisher','Khách hàng','Hoa hồng'];

  /* S1 advertiser: ngân hàng + thẻ tín dụng */
  (function(){var g=platform(SP[0][0],SP[0][1],ACC[0]);
    var bk=bankB(g,1.15);bk.position.set(-1.2,.8,-1.8);var ped=bk;
    var tx=ctex(640,150,function(x,w,h){x.fillStyle='#0B2A6F';rr(x,0,0,w,h,28);x.fill();x.fillStyle='#fff';x.font='900 66px '+FONT;x.textAlign='center';x.textBaseline='middle';x.fillText('ADVERTISER',w/2,h/2+4)});
    screen(g,2.9,.7,tx,-1.2,5.45,1.2);
    var card=ctex(640,400,function(x,w,h){var gr=x.createLinearGradient(0,0,w,h);gr.addColorStop(0,'#0B2A6F');gr.addColorStop(1,'#2E5BD8');x.fillStyle=gr;rr(x,0,0,w,h,44);x.fill();x.fillStyle='#FFC24D';rr(x,60,130,110,84,14);x.fill();x.fillStyle='rgba(255,255,255,.9)';x.font='800 40px '+FONT;x.fillText('4520  ••••  ••••  2026',60,300);x.fillStyle='#FF6A2B';x.beginPath();x.arc(w-120,h-80,40,0,7);x.fill();x.fillStyle='rgba(255,193,77,.9)';x.beginPath();x.arc(w-80,h-80,40,0,7);x.fill();x.fillStyle='#fff';x.font='900 44px '+FONT;x.fillText('CREDIT',60,90)});
    var cg=new T.Group();var cb=mesh(new T.BoxGeometry(4.2,2.7,.18),MAT.navy);cg.add(cb);screen(cg,4.1,2.6,card,0,0,.1);cg.rotation.order='YXZ';cg.rotation.y=.78;cg.rotation.x=-.12;cg.position.set(3.2,3.6,2.6);g.add(cg);anim.push({bob:cg,y0:3.6,ph:0});
    rbt(g,1.45,-3.6,4.0,.78,{wave:true});
    stations.push({g:g,h:6});})();
  /* S2 3RDHub */
  (function(){var g=platform(SP[1][0],SP[1][1],ACC[1]);
    var HB=hub(g,1.1,0,.8,0,0xFF6A2B);anim.push({fn:HB.tick});
    var lk=ctex(1024,320,function(x,w,h){x.fillStyle='#fff';rr(x,0,0,w,h,56);x.fill();x.fillStyle='#8890A6';x.font='800 40px '+FONT;x.textAlign='center';x.textBaseline='middle';x.fillText('Link của bạn',w/2,82);x.fillStyle='#0B2A6F';x.font='900 52px '+FONT;x.fillText('3rdvn.io.vn/aff/shb-finance',w/2,160);x.fillStyle='#FFE14D';rr(x,w/2-210,204,420,76,18);x.fill();x.fillStyle='#0B2A6F';x.fillText('?ref=RD260001',w/2,244)});
    screen(g,5.4,1.69,lk,0,2.4,4.6,0);
    var RK=rack(g,-5.2,.8,-3.2,3);RK.leds.forEach(function(l:any,n:number){anim.push({blink:l,ph:n})});
    rbt(g,1.6,4.2,3.4,.78,{wave:true});
    var ch=new T.Group();var t1=mesh(new T.TorusGeometry(1.1,.32,16,40),MAT.orange);t1.scale.set(1.5,1,1);t1.position.x=-.9;ch.add(t1);var t2=mesh(new T.TorusGeometry(1.1,.32,16,40),MAT.navy);t2.scale.set(1.5,1,1);t2.position.x=.9;t2.rotation.x=Math.PI/2;ch.add(t2);ch.position.set(-1.6,9.2,1.6);ch.rotation.y=.78;g.add(ch);anim.push({bob:ch,y0:9.2,ph:1.2,spinY:true});
    var cur=new T.Shape();cur.moveTo(0,0);cur.lineTo(0,-2.4);cur.lineTo(.6,-1.8);cur.lineTo(1.1,-2.9);cur.lineTo(1.5,-2.7);cur.lineTo(1.0,-1.6);cur.lineTo(1.8,-1.6);cur.lineTo(0,0);
    var cm2=mesh(new T.ExtrudeGeometry(cur,{depth:.35,bevelEnabled:true,bevelThickness:.08,bevelSize:.08,bevelSegments:3}),MAT.white);cm2.position.set(3.6,8.4,2.6);cm2.rotation.y=.78;cm2.rotation.z=.25;g.add(cm2);anim.push({bob:cm2,y0:8.4,ph:2.4});
    stations.push({g:g,h:7});})();
  /* S3 publisher */
  (function(){var g=platform(SP[2][0],SP[2][1],ACC[2]);
    RB(g,6,.3,2.8,.12,MAT.wood,0,2.4,-1.8);
    [-2.6,2.6].forEach(function(xx){RB(g,.25,1.6,2.4,.08,MAT.white,xx,.8,-1.8)});
    var sc2=ctex(512,320,function(x,w,h){x.fillStyle='#F4F6FB';x.fillRect(0,0,w,h);var c=[['TikTok','#111'],['Facebook','#1877F2'],['Zalo','#0068FF']];c.forEach(function(q,i){x.fillStyle='#fff';rr(x,26,26+i*94,w-52,76,18);x.fill();x.fillStyle=q[1];x.beginPath();x.arc(72,64+i*94,22,0,7);x.fill();x.fillStyle='#0B2A6F';x.font='800 34px '+FONT;x.textBaseline='middle';x.fillText(q[0],110,66+i*94);x.fillStyle='#FF6A2B';x.font='900 30px '+FONT;x.textAlign='right';x.fillText('+'+(48-i*15)+' click',w-50,66+i*94);x.textAlign='left'})});
    RB(g,3.6,2.3,.25,.1,MAT.navy,-.6,3.2,-2.6);screen(g,3.3,2.0,sc2,-.6,4.35,-2.46);
    RB(g,.3,.5,.3,.08,MAT.navy,-.6,2.7,-2.6);
    RB(g,1.4,.08,1,.06,MAT.navy,1.9,2.7,-1.5);
    cyl(g,.3,.5,MAT.orange,2.4,2.7,-2.4,20);
    RB(g,1.6,.25,1.6,.2,MAT.navy,-.4,1.3,1.2);RB(g,1.6,1.6,.25,.15,MAT.navy,-.4,1.5,1.95);cyl(g,.12,1.2,MAT.dark,-.4,.8,1.2,8);
    rbt(g,1.45,-.4,1.0,Math.PI);
    var tp=new T.Group();[0,2.1,4.2].forEach(function(a){var l=mesh(new T.CylinderGeometry(.06,.06,3.4,8),MAT.dark);l.position.set(Math.sin(a)*.6,1.6,Math.cos(a)*.6);l.rotation.set(Math.cos(a)*.18,0,-Math.sin(a)*.18);tp.add(l)});
    var rl=mesh(new T.TorusGeometry(1.1,.14,14,48),M(0xFFFFFF,{e:0xFFF3D6,ei:1.2}));rl.position.y=4.1;tp.add(rl);
    var ph2=new T.Group();RB(ph2,.85,1.6,.12,.12,MAT.navy,0,-.8,0);ph2.position.set(0,4.1,.06);tp.add(ph2);
    tp.position.set(3.6,.8,2.6);tp.rotation.y=.78;g.add(tp);
    var play=ctex(256,256,function(x,w,h){x.fillStyle='#FF2D55';rr(x,10,40,236,176,48);x.fill();x.fillStyle='#fff';x.beginPath();x.moveTo(100,84);x.lineTo(176,128);x.lineTo(100,172);x.closePath();x.fill()});
    var pv=new T.Sprite(new T.SpriteMaterial({map:play,transparent:true,toneMapped:false}));pv.scale.set(1.8,1.8,1);pv.position.set(3.6,7.4,2.6);g.add(pv);anim.push({bob:pv,y0:7.4,ph:.5});
    var heart=ctex(128,128,function(x,w,h){x.fillStyle='#FF4D6D';x.beginPath();x.moveTo(64,104);x.bezierCurveTo(10,70,14,22,46,22);x.bezierCurveTo(56,22,62,30,64,36);x.bezierCurveTo(66,30,72,22,82,22);x.bezierCurveTo(114,22,118,70,64,104);x.fill()});
    for(var k=0;k<3;k++){var sp=new T.Sprite(new T.SpriteMaterial({map:heart,transparent:true,toneMapped:false}));sp.scale.set(.9,.9,1);sp.position.set(-1.8+k*1.4,6,-2.6);g.add(sp);anim.push({float:sp,ph:k*1.3,y0:6})}
    stations.push({g:g,h:5});})();
  /* S4 khách hàng */
  (function(){var g=platform(SP[3][0],SP[3][1],ACC[3]);
    var ph=ctex(300,600,function(x,w,h){x.fillStyle='#fff';x.fillRect(0,0,w,h);x.fillStyle='#0B2A6F';x.font='900 30px '+FONT;x.fillText('Mở thẻ tín dụng',26,70);x.fillStyle='#8890A6';x.font='600 20px '+FONT;x.fillText('SHB Finance',26,104);for(var i=0;i<4;i++){x.fillStyle='#EEF1F7';rr(x,26,140+i*80,w-52,56,14);x.fill()}x.fillStyle='#FF6A2B';rr(x,26,480,w-52,64,18);x.fill();x.fillStyle='#fff';x.font='900 26px '+FONT;x.textAlign='center';x.fillText('Đăng ký ngay',w/2,522)});
    phoneDev(g,3.2,6.2,ph,1.6,.8,-1.6,-.35);
    rbt(g,1.55,-2.4,2.4,.78,{wave:true});
    var hs=new T.Group();RB(hs,3,2.6,3,.3,MAT.cream,0,0,0);var roof=mesh(new T.ConeGeometry(2.5,1.6,4),MAT.orange,0,3.4,0);roof.rotation.y=Math.PI/4;hs.add(roof);RB(hs,.8,1.4,.1,.05,MAT.navy,0,0,1.52);hs.position.set(-3.4,.8,-3.6);g.add(hs);
    stations.push({g:g,h:5});})();
  /* S5 hoa hồng */
  (function(){var g=platform(SP[4][0],SP[4][1],ACC[4]);
    RB(g,5,5,4.4,.6,MAT.navyL,-1.2,.8,-1.6);
    var door=mesh(new T.CylinderGeometry(1.5,1.5,.35,40),MAT.white,-1.2,3.3,.72);door.rotation.x=Math.PI/2;g.add(door);
    var ring=mesh(new T.TorusGeometry(1.05,.13,12,40),MAT.orange,-1.2,3.3,.95);g.add(ring);anim.push({spinZ:ring});
    var hb=mesh(new T.BoxGeometry(.25,1.5,.2),MAT.navy,-1.2,3.3,1.0);g.add(hb);var hb2=hb.clone();hb2.rotation.z=Math.PI/2;g.add(hb2);anim.push({spinZ:hb,b2:hb2});
    [[2.6,0,5],[3.8,-1.2,8],[3.6,1.3,3]].forEach(function(c){for(var k=0;k<c[2];k++)cyl(g,.62,.22,MAT.gold,c[0],.8+k*.24,c[1],32)});
    var wl=new T.Group();RB(wl,3.4,2.2,1.0,.4,MAT.orange,0,0,0);RB(wl,1.6,.9,.3,.2,MAT.navy,.9,.65,.5);sph(wl,.14,MAT.gold,1.35,1.1,.7);
    var cash=ctex(256,128,function(x,w,h){x.fillStyle='#3CC48B';rr(x,0,0,w,h,16);x.fill();x.strokeStyle='rgba(255,255,255,.7)';x.lineWidth=6;rr(x,12,12,w-24,h-24,10);x.stroke();x.fillStyle='#fff';x.font='900 56px '+FONT;x.textAlign='center';x.textBaseline='middle';x.fillText('₫',w/2,h/2+2)});
    for(var k=0;k<3;k++){var bn=screen(wl,2.4,1.2,cash,-.3+k*.15,2.1+k*.18,-.05-k*.02);bn.rotation.z=.15-k*.12}
    wl.position.set(-4.2,.8,2.8);wl.rotation.y=.78;g.add(wl);
    var pc=ctex(256,256,function(x,w,h){x.fillStyle='#FF6A2B';x.beginPath();x.arc(128,128,118,0,7);x.fill();x.fillStyle='#fff';x.font='900 130px '+FONT;x.textAlign='center';x.textBaseline='middle';x.fillText('%',128,138)});
    var ps=new T.Sprite(new T.SpriteMaterial({map:pc,transparent:true,toneMapped:false}));ps.scale.set(2,2,1);ps.position.set(-1.2,8.6,-1.6);g.add(ps);anim.push({bob:ps,y0:8.6,ph:1.7});
    rbt(g,1.55,1.2,4.2,.78,{wave:true});
    stations.push({g:g,h:5});})();

  anim.push({fn:sparkles(scene,120,34,8,0xFFB238)});
  /* path */
  var pts=[[-24,-3],[-12,-4],[0,-10],[12,-12],[24,-1],[22,8],[14,9],[0,14],[-14,7]].map(function(p){return new T.Vector3(p[0],.08,p[1])});
  curve=new T.CatmullRomCurve3(pts,false,'catmullrom',.4);
  var base=new T.Mesh(new T.TubeGeometry(curve,400,.22,10,false),M(0xE2DCCF,{r:.9}));base.receiveShadow=true;scene.add(base);
  progMesh=new T.Mesh(new T.TubeGeometry(curve,400,.32,12,false),M(0xFF6A2B,{r:.3,e:0xFF6A2B,ei:.6}));progMesh.castShadow=true;scene.add(progMesh);
  var cg=new T.Group();var cm=new T.Mesh(new T.CylinderGeometry(.9,.9,.26,40),[M(0xE2531A,{r:.3,m:.4}),M(0xFFB238,{r:.25,m:.45}),M(0xFFB238,{r:.25,m:.45})]);cm.rotation.x=Math.PI/2;cm.castShadow=true;cg.add(cm);scene.add(cg);coin=cg;
  /* station fractions along path */
  var FR=SP.map(function(s){var best=0,bd=1e9;for(var u=0;u<=1;u+=.002){var q=curve.getPointAt(u),d=Math.hypot(q.x-s[0],q.z-s[1]);if(d<bd){bd=d;best=u}}return best});
  FR[0]=0;FR[4]=1;
  var idxCount=progMesh.geometry.index.count;
  function setProg(u){progMesh.geometry.setDrawRange(0,Math.max(0,Math.floor(idxCount*u/6)*6));var q=curve.getPointAt(Math.min(1,Math.max(0,u)));coin.position.set(q.x,2.2,q.z)}
  setProg(0);

  /* camera */
  var DIR=new T.Vector3(1,1.05,1).normalize(),tgt=new T.Vector3(),zoom=1,FIT=60;
  var KEY=[{t:new T.Vector3(0,2,-1),z:1}].concat(SP.map(function(s,i){return {t:new T.Vector3(s[0],stations[i].h*.5,s[1]),z:[2.0,2.45,2.45,2.4,2.4][i]}}));
  function size(){var r=canvas.getBoundingClientRect();W=Math.max(1,r.width);H=Math.max(1,r.height);R.setPixelRatio(dpr());R.setSize(W,H,false)}
  function camUpd(){var asp=W/H,mob=W<=900;var base=mob?Math.max(62/asp,34):Math.max(58,92/asp);var fh=base/(mob?1+(zoom-1)*1.45:zoom),fw=fh*asp;
    cam.left=-fw/2;cam.right=fw/2;cam.top=fh/2;cam.bottom=-fh/2;
    if(!mob)cam.setViewOffset(W,H,-W*.2,0,W,H);else cam.clearViewOffset();
    cam.updateProjectionMatrix();cam.position.copy(tgt).addScaledVector(DIR,120);cam.lookAt(tgt);
    sun.position.set(tgt.x-30,60,tgt.z+30);sun.target.position.copy(tgt);}
  size();
  var P=0,PT=0,clock=new T.Clock(),vis=true,v=new T.Vector3(),raf=0,lastK=-1,lastF=0,fc=0,mt=meter(),bots:any[]=[];
  function ease(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2}
  function frame(){
    raf=requestAnimationFrame(frame);if(!vis)return;var tf=performance.now();if(tf-lastF<14)return;mt(tf-lastF);lastF=tf;if(fc++%3===0)R.shadowMap.needsUpdate=true;
    var dt=Math.min(.05,clock.getDelta()),time=clock.elapsedTime;
    P+= (PT-P)*(RM?1:Math.min(1,dt*2.2));
    var i=Math.min(4,Math.floor(P)),f=P-i,e=ease(f),a=KEY[i],b=KEY[i+1];
    tgt.lerpVectors(a.t,b.t,e);var mid=Math.sin(Math.PI*e)*.35;zoom=a.z+(b.z-a.z)*e-mid*(i>0?1:0);
    var u=P<=1?0:FR[Math.min(4,i-1>=0?i-1:0)]+(FR[Math.min(4,i)]-FR[Math.max(0,i-1)])*e;if(P>=5)u=1;
    if(i>=1){u=FR[i-1]+(FR[Math.min(4,i)]-FR[i-1])*e}else{u=0}
    setProg(u);coin.rotation.y=time*2.2;coin.position.y=2.2+Math.sin(time*3)*.25;
    anim.forEach(function(o){if(o.fn)o.fn(time);if(o.bob){o.bob.position.y=o.y0+Math.sin(time*1.6+o.ph)*.35;if(o.spinY)o.bob.rotation.y=.78+Math.sin(time*.8)*.4}if(o.blink)o.blink.visible=Math.sin(time*4+o.ph)>-.3;if(o.float){o.float.position.y=o.y0+((time*.6+o.ph)%3);o.float.material.opacity=1-((time*.6+o.ph)%3)/3}if(o.spinZ){o.spinZ.rotation.z=time*.6;if(o.b2)o.b2.rotation.z=time*.6+Math.PI/2}});
    bots.forEach(function(o){blinkEyes(o,time);if(o.userData.wave){o.userData.wave.rotation.z=-2.3+Math.sin(time*5+o.userData.ph)*.35}});
    camUpd();R.render(scene,cam);
    /* tag */
    var k=Math.round(P);if(k>=1&&Math.abs(P-k)<.3){var s=SP[k-1];v.set(s[0],stations[k-1].h+6.5,s[1]).project(cam);tagEl.style.transform='translate('+((v.x*.5+.5)*W-60)+'px,'+((-v.y*.5+.5)*H-20)+'px)';if(k!==lastK){lastK=k;cb.onTag(k,LBL[k-1])}tagEl.style.opacity='1'}else tagEl.style.opacity='0';
  }
  scene.traverse(function(o:any){if(o.userData&&o.userData.eyes)bots.push(o)});
  var offQ=onQuality(size);
  var io=new IntersectionObserver(function(e){vis=e[0].isIntersecting});io.observe(canvas);
  var ro=new ResizeObserver(size);ro.observe(canvas);
  frame();

  return {
    go(k) { PT = k },
    visible() { return vis },
    dispose() { offMode(); offQ(); cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); R.dispose(); scene.traverse(function (o) { if (o.geometry) o.geometry.dispose() }) },
  }
}
