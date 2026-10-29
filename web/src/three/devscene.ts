// Cảnh 3D "robot đang lập trình" ở mục Công nghệ; màn hình monitor hiển thị đúng nội dung terminal đang chạy.
import * as T from 'three'
import { dpr, meter, onQuality } from './quality'
import { ENV, MAT, M, C, RB, FONT, blinkEyes, cyl, ctex, getMode, glow, mesh, onMode, pool, rgeo, rr, robot, screen, sparkles, sph, type Mode } from './core'

export interface TermSource {
  /** Văn bản thuần của terminal (mỗi dòng một dòng). */
  text(): string
  /** Tăng mỗi khi nội dung đổi, để cảnh biết cần vẽ lại màn hình. */
  version(): number
}

export function createDevScene(canvas: HTMLCanvasElement, term: TermSource): { dispose(): void } {
  var c3=canvas,R3=new T.WebGLRenderer({canvas:c3,antialias:true,alpha:true});
  R3.setClearColor(0,0);R3.outputEncoding=T.sRGBEncoding;R3.toneMapping=T.ACESFilmicToneMapping;R3.toneMappingExposure=1.15;R3.shadowMap.enabled=true;R3.shadowMap.type=T.PCFSoftShadowMap;R3.shadowMap.autoUpdate=false;
  var s3=new T.Scene(),cm3=new T.OrthographicCamera(-10,10,10,-10,.1,200);
  var hemi3=new T.HemisphereLight(0xffffff,0xE9DFCF,.5);s3.add(hemi3);s3.environment=ENV(getMode());var l3=new T.DirectionalLight(0xFFF4E6,1.5);l3.position.set(-18,34,22);l3.castShadow=true;l3.shadow.mapSize.set(2048,2048);var sc3=l3.shadow.camera;sc3.left=-20;sc3.right=20;sc3.top=20;sc3.bottom=-20;l3.shadow.radius=5;s3.add(l3);var rA=new T.DirectionalLight(0xFF8A4C,0);rA.position.set(-22,10,-18);s3.add(rA);var rB=new T.DirectionalLight(0x38D6FF,0);rB.position.set(24,10,-18);s3.add(rB);
  var fl3=new T.Mesh(new T.PlaneGeometry(200,200),new T.ShadowMaterial({opacity:.14}));fl3.rotation.x=-Math.PI/2;fl3.receiveShadow=true;s3.add(fl3);
  function lights3(m:Mode){var d=m==='dark';hemi3.color.set(d?0x6F7FD8:0xffffff);hemi3.groundColor.set(d?0x141A3A:0xE9DFCF);hemi3.intensity=d?.45:.5;l3.color.set(d?0xC9D6FF:0xFFF4E6);l3.intensity=d?1.0:1.5;rA.intensity=d?1.4:0;rB.intensity=d?1.3:0;(fl3.material as any).opacity=d?.5:.14;s3.environment=ENV(m);R3.toneMappingExposure=d?1.05:1.15}
  var off3=onMode(lights3);lights3(getMode());
  var room=new T.Group();s3.add(room);
  var edge3=M(0x7B4DFF,{r:.3,e:0x7B4DFF,ei:0,cc:.4});RB(room,18.5,.5,13.5,1.2,edge3,0,-.1,0);RB(room,18,.7,13,1.2,MAT.white,0,.1,0);
  onMode(function(m:Mode){edge3.emissiveIntensity=m==='dark'?.7:0;edge3.needsUpdate=true});edge3.emissiveIntensity=getMode()==='dark'?.7:0;pool(room,22,0x7B4DFF,.02,.45);var spk=sparkles(s3,40,10,6,0x7AF4FF);
  /* desk */
  RB(room,10,.35,3.6,.15,MAT.wood,0,2.8,-2.6);[-4.6,4.6].forEach(function(x){RB(room,.3,2.1,3.2,.1,MAT.white,x,.8,-2.6)});
  /* live terminal texture */
  var tCanvas=document.createElement('canvas');tCanvas.width=1024;tCanvas.height=620;var tctx=tCanvas.getContext('2d') as CanvasRenderingContext2D;var ttex=new T.CanvasTexture(tCanvas);ttex.encoding=T.sRGBEncoding;ttex.anisotropy=8;
  function drawTex(){var x=tctx,w=1024,h=620;x.fillStyle='#0D1430';x.fillRect(0,0,w,h);x.fillStyle='#151E42';x.fillRect(0,0,w,52);['#FF5F57','#FEBC2E','#28C840'].forEach(function(c,i){x.fillStyle=c;x.beginPath();x.arc(30+i*28,26,9,0,7);x.fill()});
    x.font='600 22px ui-monospace,Menlo,Consolas,monospace';var lines=term.text().split('\n').slice(-17),y=88;lines.forEach(function(l){x.fillStyle=/^❯/.test(l)?'#FF8A5B':(/^(ok|✓|✔|🚀)/.test(l.trim())?'#3CC48B':'#D7DEF5');x.fillText(l.slice(0,72),24,y);y+=30});ttex.needsUpdate=true}
  var mon=new T.Group();RB(mon,6.2,3.9,.3,.2,MAT.navy,0,0,0);screen(mon,5.9,3.6,ttex,0,1.95,.17);RB(mon,.4,1.2,.4,.12,MAT.navy,0,-1.1,0);RB(mon,1.8,.12,1.2,.06,MAT.navy,0,-1.2,.2);mon.position.set(-1.6,4.35,-3.4);room.add(mon);
  var ui2=ctex(600,400,function(x,w,h){x.fillStyle='#F4F6FB';x.fillRect(0,0,w,h);x.fillStyle='#fff';x.fillRect(0,0,w,46);x.fillStyle='#42B883';x.beginPath();x.moveTo(20,12);x.lineTo(40,12);x.lineTo(30,32);x.fill();x.fillStyle='#0B2A6F';x.font='800 20px '+FONT;x.fillText('Trang quản trị',52,30);
    for(var i=0;i<3;i++){x.fillStyle='#fff';rr(x,20+i*190,66,170,96,14);x.fill();x.fillStyle=['#FF6A2B','#42B883','#00ADD8'][i];x.font='900 30px '+FONT;x.fillText(['1.284','312','68%'][i],36+i*190,128)}
    x.fillStyle='#fff';rr(x,20,180,560,200,16);x.fill();for(var j=0;j<10;j++){x.fillStyle=j%3?'#C7D3F2':'#FF6A2B';var bh=40+((j*37)%120);rr(x,46+j*52,360-bh,30,bh,6);x.fill()}});
  var mon2=new T.Group();RB(mon2,4.4,2.9,.3,.2,MAT.navy,0,0,0);screen(mon2,4.15,2.65,ui2,0,1.45,.17);RB(mon2,.35,1.0,.35,.1,MAT.navy,0,-.9,0);mon2.position.set(3.6,4.15,-3.0);mon2.rotation.y=-.45;room.add(mon2);
  RB(room,3.4,.14,1.1,.08,MAT.dark,-1.4,3.15,-1.6);cyl(room,.32,.6,MAT.orange,2.4,3.15,-1.6,20);
  /* chair + robot */
  RB(room,2.2,.3,2.2,.2,MAT.navy,-1.4,1.9,1.4);RB(room,2.2,2.2,.3,.2,MAT.navy,-1.4,2.1,2.5);cyl(room,.15,1.1,MAT.dark,-1.4,.8,1.4,8);
  var bot=robot(room,1.25,-1.4,1.0,Math.PI+.25);bot.position.y=1.3;
  /* server rack */
  var leds3:any[]=[];for(var k=0;k<2;k++){RB(room,1.6,6,1.8,.25,MAT.navy,6.8,.8,-4+k*2.2);for(var j=0;j<6;j++){var lm=M(j%2?0xFF6A2B:0x3CC48B,{e:j%2?0xFF6A2B:0x3CC48B,ei:1.6});var ld=mesh(new T.BoxGeometry(1,.1,.05),lm,6.8,1.8+j*.8,-4+k*2.2+.92,true);room.add(ld);leds3.push(ld)}}
  cyl(room,.5,.8,MAT.cream,-7,.8,3.4,20);sph(room,.95,MAT.leaf,-7,2.5,3.4);
  /* floating tech cubes */
  function cubeTex(t,bg,fg){return ctex(256,256,function(x,w,h){x.fillStyle=bg;rr(x,0,0,w,h,40);x.fill();x.fillStyle=fg;x.font='900 '+(t.length>4?54:84)+'px '+FONT;x.textAlign='center';x.textBaseline='middle';x.fillText(t,w/2,h/2+4)})}
  var CUBES=([['Vue.js','#42B883','#fff',-6.2,8.4,-1],['Go','#00ADD8','#fff',-2.6,10.2,-1.8],['SQL','#336791','#fff',2.2,9.6,-1.6],['Redis','#DC382D','#fff',5.8,8.6,-.6]] as any[]).map(function(c:any,i:number){var tx=cubeTex(c[0],c[1],c[2]);var mats=[0,1,2,3,4,5].map(function(){return new T.MeshStandardMaterial({map:tx,roughness:.45})});var m=new T.Mesh(rgeo(1.8,1.8,1.8,.35),M(parseInt(c[1].slice(1),16),{r:.45}));var g=new T.Group();m.position.y=-.9;g.add(m);var f=new T.Mesh(new T.PlaneGeometry(1.6,1.6),new T.MeshBasicMaterial({map:tx,toneMapped:false}));f.position.set(0,0,.91);g.add(f);var f2=f.clone();f2.position.set(.91,0,0);f2.rotation.y=Math.PI/2;g.add(f2);g.position.set(c[3],c[4],c[5]);m.castShadow=true;room.add(g);return {g:g,y0:c[4],ph:i*1.3}});
  var W3=1,H3=1,vis3=false,clk3=new T.Clock(),lastTex=0,seenVer=-1,raf=0;
  function size3(){var r=c3.getBoundingClientRect();W3=Math.max(1,r.width);H3=Math.max(1,r.height);R3.setPixelRatio(dpr());R3.setSize(W3,H3,false)}
  size3();var ro3=new ResizeObserver(size3);ro3.observe(c3);var io3=new IntersectionObserver(function(e){vis3=e[0].isIntersecting});io3.observe(c3);
  var D3=new T.Vector3(1,1.05,1).normalize(),tg3=new T.Vector3(0,3.6,0);
  var lastF=0,fc=0,mt=meter(),offQ=onQuality(size3);
  (function loop3(){raf=requestAnimationFrame(loop3);if(!vis3)return;var tf=performance.now();if(tf-lastF<22)return;mt(tf-lastF);lastF=tf;if(fc++%3===0)R3.shadowMap.needsUpdate=true;var t=clk3.getElapsedTime();
    if(term.version()!==seenVer&&t-lastTex>.08){drawTex();seenVer=term.version();lastTex=t}
    leds3.forEach(function(l,i){l.visible=Math.sin(t*5+i*1.7)>-.4});
    CUBES.forEach(function(c){c.g.position.y=c.y0+Math.sin(t*1.4+c.ph)*.35;c.g.rotation.y=.78+Math.sin(t*.7+c.ph)*.35});
    spk(t);blinkEyes(bot,t);if(bot.userData.wave)bot.userData.wave.rotation.z=-2.3+Math.sin(t*5)*.35;
    var asp=W3/H3,fh=W3<=600?Math.max(15,23.5/asp):Math.max(22,30/asp);cm3.left=-fh*asp/2;cm3.right=fh*asp/2;cm3.top=fh/2;cm3.bottom=-fh/2;cm3.updateProjectionMatrix();
    var az=Math.sin(t*.2)*.06;var d=D3.clone().applyAxisAngle(new T.Vector3(0,1,0),az);cm3.position.copy(tg3).addScaledVector(d,80);cm3.lookAt(tg3);
    R3.render(s3,cm3)})();
  return { dispose() { off3(); offQ(); cancelAnimationFrame(raf); ro3.disconnect(); io3.disconnect(); R3.dispose() } }
}
