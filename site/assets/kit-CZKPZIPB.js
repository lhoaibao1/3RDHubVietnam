import{M as N,u as te,O as ge,_ as q,$ as U,a0 as Z,a1 as b,a2 as W,a3 as se,a4 as I,k as ve,n as P,V as S,y as xe,j as ie,W as ye,s as L,S as Re,F as Pe,m as Fe,a5 as De,t as Be,H as _e,D as Y,l as A,J as Ee,a as Ue,i as oe,a6 as Ae,c as ke,E as Le,L as ze,Q as He,U as Ve,g as Qe,h as Ge,q as Oe,v as We,w as Ie,x as je,d as Ne,e as qe,K as Ke}from"./three-CdhQykoC.js";import{K as Xe,P as ce}from"./index-BSQ13Dh8.js";import{k as de,o as $e,q as Ye}from"./LeadForm.vue_vue_type_script_setup_true_lang-CCe3USJK.js";var j={uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;

		}`};class H{constructor(){this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}}const Je=new ge(-1,1,1,-1,0,1),re=new te;re.setAttribute("position",new q([-1,3,0,-1,-1,0,3,-1,0],3));re.setAttribute("uv",new q([0,2,0,0,2,0],2));class we{constructor(e){this._mesh=new N(re,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,Je)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}}class ee extends H{constructor(e,s){super(),this.textureID=s!==void 0?s:"tDiffuse",e instanceof U?(this.uniforms=e.uniforms,this.material=e):e&&(this.uniforms=Z.clone(e.uniforms),this.material=new U({defines:Object.assign({},e.defines),uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader})),this.fsQuad=new we(this.material)}render(e,s,t){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=t.texture),this.fsQuad.material=this.material,this.renderToScreen?(e.setRenderTarget(null),this.fsQuad.render(e)):(e.setRenderTarget(s),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this.fsQuad.render(e))}}class me extends H{constructor(e,s){super(),this.scene=e,this.camera=s,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,s,t){const r=e.getContext(),o=e.state;o.buffers.color.setMask(!1),o.buffers.depth.setMask(!1),o.buffers.color.setLocked(!0),o.buffers.depth.setLocked(!0);let i,a;this.inverse?(i=0,a=1):(i=1,a=0),o.buffers.stencil.setTest(!0),o.buffers.stencil.setOp(r.REPLACE,r.REPLACE,r.REPLACE),o.buffers.stencil.setFunc(r.ALWAYS,i,4294967295),o.buffers.stencil.setClear(a),o.buffers.stencil.setLocked(!0),e.setRenderTarget(t),this.clear&&e.clear(),e.render(this.scene,this.camera),e.setRenderTarget(s),this.clear&&e.clear(),e.render(this.scene,this.camera),o.buffers.color.setLocked(!1),o.buffers.depth.setLocked(!1),o.buffers.stencil.setLocked(!1),o.buffers.stencil.setFunc(r.EQUAL,1,4294967295),o.buffers.stencil.setOp(r.KEEP,r.KEEP,r.KEEP),o.buffers.stencil.setLocked(!0)}}class Ze extends H{constructor(){super(),this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}}class et{constructor(e,s){if(this.renderer=e,s===void 0){const t={minFilter:I,magFilter:I,format:se},r=e.getSize(new b);this._pixelRatio=e.getPixelRatio(),this._width=r.width,this._height=r.height,s=new W(this._width*this._pixelRatio,this._height*this._pixelRatio,t),s.texture.name="EffectComposer.rt1"}else this._pixelRatio=1,this._width=s.width,this._height=s.height;this.renderTarget1=s,this.renderTarget2=s.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],j===void 0&&console.error("THREE.EffectComposer relies on CopyShader"),ee===void 0&&console.error("THREE.EffectComposer relies on ShaderPass"),this.copyPass=new ee(j),this.clock=new ve}swapBuffers(){const e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,s){this.passes.splice(s,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){const s=this.passes.indexOf(e);s!==-1&&this.passes.splice(s,1)}isLastEnabledPass(e){for(let s=e+1;s<this.passes.length;s++)if(this.passes[s].enabled)return!1;return!0}render(e){e===void 0&&(e=this.clock.getDelta());const s=this.renderer.getRenderTarget();let t=!1;for(let r=0,o=this.passes.length;r<o;r++){const i=this.passes[r];if(i.enabled!==!1){if(i.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(r),i.render(this.renderer,this.writeBuffer,this.readBuffer,e,t),i.needsSwap){if(t){const a=this.renderer.getContext(),l=this.renderer.state.buffers.stencil;l.setFunc(a.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),l.setFunc(a.EQUAL,1,4294967295)}this.swapBuffers()}me!==void 0&&(i instanceof me?t=!0:i instanceof Ze&&(t=!1))}}this.renderer.setRenderTarget(s)}reset(e){if(e===void 0){const s=this.renderer.getSize(new b);this._pixelRatio=this.renderer.getPixelRatio(),this._width=s.width,this._height=s.height,e=this.renderTarget1.clone(),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,s){this._width=e,this._height=s;const t=this._width*this._pixelRatio,r=this._height*this._pixelRatio;this.renderTarget1.setSize(t,r),this.renderTarget2.setSize(t,r);for(let o=0;o<this.passes.length;o++)this.passes[o].setSize(t,r)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}}new ge(-1,1,1,-1,0,1);const be=new te;be.setAttribute("position",new q([-1,3,0,-1,-1,0,3,-1,0],3));be.setAttribute("uv",new q([0,2,0,0,2,0],2));class tt extends H{constructor(e,s,t,r,o){super(),this.scene=e,this.camera=s,this.overrideMaterial=t,this.clearColor=r,this.clearAlpha=o!==void 0?o:0,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this._oldClearColor=new P}render(e,s,t){const r=e.autoClear;e.autoClear=!1;let o,i;this.overrideMaterial!==void 0&&(i=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor&&(e.getClearColor(this._oldClearColor),o=e.getClearAlpha(),e.setClearColor(this.clearColor,this.clearAlpha)),this.clearDepth&&e.clearDepth(),e.setRenderTarget(this.renderToScreen?null:t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),e.render(this.scene,this.camera),this.clearColor&&e.setClearColor(this._oldClearColor,o),this.overrideMaterial!==void 0&&(this.scene.overrideMaterial=i),e.autoClear=r}}const pe={uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new P(0)},defaultOpacity:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			vec3 luma = vec3( 0.299, 0.587, 0.114 );

			float v = dot( texel.xyz, luma );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`};class k extends H{constructor(e,s,t,r){super(),this.strength=s!==void 0?s:1,this.radius=t,this.threshold=r,this.resolution=e!==void 0?new b(e.x,e.y):new b(256,256),this.clearColor=new P(0,0,0);const o={minFilter:I,magFilter:I,format:se};this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let i=Math.round(this.resolution.x/2),a=Math.round(this.resolution.y/2);this.renderTargetBright=new W(i,a,o),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let c=0;c<this.nMips;c++){const w=new W(i,a,o);w.texture.name="UnrealBloomPass.h"+c,w.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(w);const x=new W(i,a,o);x.texture.name="UnrealBloomPass.v"+c,x.texture.generateMipmaps=!1,this.renderTargetsVertical.push(x),i=Math.round(i/2),a=Math.round(a/2)}pe===void 0&&console.error("THREE.UnrealBloomPass relies on LuminosityHighPassShader");const l=pe;this.highPassUniforms=Z.clone(l.uniforms),this.highPassUniforms.luminosityThreshold.value=r,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new U({uniforms:this.highPassUniforms,vertexShader:l.vertexShader,fragmentShader:l.fragmentShader,defines:{}}),this.separableBlurMaterials=[];const u=[3,5,7,9,11];i=Math.round(this.resolution.x/2),a=Math.round(this.resolution.y/2);for(let c=0;c<this.nMips;c++)this.separableBlurMaterials.push(this.getSeperableBlurMaterial(u[c])),this.separableBlurMaterials[c].uniforms.texSize.value=new b(i,a),i=Math.round(i/2),a=Math.round(a/2);this.compositeMaterial=this.getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=s,this.compositeMaterial.uniforms.bloomRadius.value=.1,this.compositeMaterial.needsUpdate=!0;const f=[1,.8,.6,.4,.2];this.compositeMaterial.uniforms.bloomFactors.value=f,this.bloomTintColors=[new S(1,1,1),new S(1,1,1),new S(1,1,1),new S(1,1,1),new S(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,j===void 0&&console.error("THREE.UnrealBloomPass relies on CopyShader");const p=j;this.copyUniforms=Z.clone(p.uniforms),this.copyUniforms.opacity.value=1,this.materialCopy=new U({uniforms:this.copyUniforms,vertexShader:p.vertexShader,fragmentShader:p.fragmentShader,blending:xe,depthTest:!1,depthWrite:!1,transparent:!0}),this.enabled=!0,this.needsSwap=!1,this._oldClearColor=new P,this.oldClearAlpha=1,this.basic=new ie,this.fsQuad=new we(null)}dispose(){for(let e=0;e<this.renderTargetsHorizontal.length;e++)this.renderTargetsHorizontal[e].dispose();for(let e=0;e<this.renderTargetsVertical.length;e++)this.renderTargetsVertical[e].dispose();this.renderTargetBright.dispose()}setSize(e,s){let t=Math.round(e/2),r=Math.round(s/2);this.renderTargetBright.setSize(t,r);for(let o=0;o<this.nMips;o++)this.renderTargetsHorizontal[o].setSize(t,r),this.renderTargetsVertical[o].setSize(t,r),this.separableBlurMaterials[o].uniforms.texSize.value=new b(t,r),t=Math.round(t/2),r=Math.round(r/2)}render(e,s,t,r,o){e.getClearColor(this._oldClearColor),this.oldClearAlpha=e.getClearAlpha();const i=e.autoClear;e.autoClear=!1,e.setClearColor(this.clearColor,0),o&&e.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this.fsQuad.material=this.basic,this.basic.map=t.texture,e.setRenderTarget(null),e.clear(),this.fsQuad.render(e)),this.highPassUniforms.tDiffuse.value=t.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this.fsQuad.material=this.materialHighPassFilter,e.setRenderTarget(this.renderTargetBright),e.clear(),this.fsQuad.render(e);let a=this.renderTargetBright;for(let l=0;l<this.nMips;l++)this.fsQuad.material=this.separableBlurMaterials[l],this.separableBlurMaterials[l].uniforms.colorTexture.value=a.texture,this.separableBlurMaterials[l].uniforms.direction.value=k.BlurDirectionX,e.setRenderTarget(this.renderTargetsHorizontal[l]),e.clear(),this.fsQuad.render(e),this.separableBlurMaterials[l].uniforms.colorTexture.value=this.renderTargetsHorizontal[l].texture,this.separableBlurMaterials[l].uniforms.direction.value=k.BlurDirectionY,e.setRenderTarget(this.renderTargetsVertical[l]),e.clear(),this.fsQuad.render(e),a=this.renderTargetsVertical[l];this.fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,e.setRenderTarget(this.renderTargetsHorizontal[0]),e.clear(),this.fsQuad.render(e),this.fsQuad.material=this.materialCopy,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,o&&e.state.buffers.stencil.setTest(!0),this.renderToScreen?(e.setRenderTarget(null),this.fsQuad.render(e)):(e.setRenderTarget(t),this.fsQuad.render(e)),e.setClearColor(this._oldClearColor,this.oldClearAlpha),e.autoClear=i}getSeperableBlurMaterial(e){return new U({defines:{KERNEL_RADIUS:e,SIGMA:e},uniforms:{colorTexture:{value:null},texSize:{value:new b(.5,.5)},direction:{value:new b(.5,.5)}},vertexShader:`varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,fragmentShader:`#include <common>
				varying vec2 vUv;
				uniform sampler2D colorTexture;
				uniform vec2 texSize;
				uniform vec2 direction;

				float gaussianPdf(in float x, in float sigma) {
					return 0.39894 * exp( -0.5 * x * x/( sigma * sigma))/sigma;
				}
				void main() {
					vec2 invSize = 1.0 / texSize;
					float fSigma = float(SIGMA);
					float weightSum = gaussianPdf(0.0, fSigma);
					vec3 diffuseSum = texture2D( colorTexture, vUv).rgb * weightSum;
					for( int i = 1; i < KERNEL_RADIUS; i ++ ) {
						float x = float(i);
						float w = gaussianPdf(x, fSigma);
						vec2 uvOffset = direction * invSize * x;
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset).rgb;
						diffuseSum += (sample1 + sample2) * w;
						weightSum += 2.0 * w;
					}
					gl_FragColor = vec4(diffuseSum/weightSum, 1.0);
				}`})}getCompositeMaterial(e){return new U({defines:{NUM_MIPS:e},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},dirtTexture:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,fragmentShader:`varying vec2 vUv;
				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform sampler2D dirtTexture;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor(const in float factor) {
					float mirrorFactor = 1.2 - factor;
					return mix(factor, mirrorFactor, bloomRadius);
				}

				void main() {
					gl_FragColor = bloomStrength * ( lerpBloomFactor(bloomFactors[0]) * vec4(bloomTintColors[0], 1.0) * texture2D(blurTexture1, vUv) +
						lerpBloomFactor(bloomFactors[1]) * vec4(bloomTintColors[1], 1.0) * texture2D(blurTexture2, vUv) +
						lerpBloomFactor(bloomFactors[2]) * vec4(bloomTintColors[2], 1.0) * texture2D(blurTexture3, vUv) +
						lerpBloomFactor(bloomFactors[3]) * vec4(bloomTintColors[3], 1.0) * texture2D(blurTexture4, vUv) +
						lerpBloomFactor(bloomFactors[4]) * vec4(bloomTintColors[4], 1.0) * texture2D(blurTexture5, vUv) );
				}`})}}k.BlurDirectionX=new b(1,0);k.BlurDirectionY=new b(0,1);const st={uniforms:{tDiffuse:{value:null}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 tex = texture2D( tDiffuse, vUv );

			gl_FragColor = LinearTosRGB( tex ); // optional: LinearToGamma( tex, float( GAMMA_FACTOR ) );

		}`},O=typeof matchMedia=="function"&&matchMedia("(prefers-reduced-motion: reduce)").matches,it={cyan:2610175,blue:3894271,violet:9067519,orange:16742972,mint:3073702,pink:16731533,gold:16761421,white:15397631,panel:793413},F=n=>new P(n).convertSRGBToLinear();function ot(n,e,s){const t=document.createElement("canvas");t.width=4,t.height=256;const r=t.getContext("2d"),o=r.createLinearGradient(0,0,0,256);o.addColorStop(0,n),o.addColorStop(.55,e),o.addColorStop(1,s),r.fillStyle=o,r.fillRect(0,0,4,256);const i=new A(t);return i.encoding=L,i}function ft(n,e){const s=new ye({canvas:n,antialias:e.bloom===0,alpha:!1,powerPreference:"high-performance"});s.outputEncoding=L;const t=new Re,r=e.sky||["#040A1C","#0A1B45","#0E2A63"];t.background=ot(r[0],r[1],r[2]);const o=e.fog||[40,130];t.fog=new Pe(F(e.fogColor==null?662341:e.fogColor),o[0],o[1]);const i=new Fe(e.fov||30,1,.5,400);let a=1,l=1,u=new De(2,2,{format:se});u.samples=de()>=1.75?2:4;const f=new et(s,u);f.addPass(new tt(t,i));const p=new k(new b(2,2),e.bloom==null?.85:e.bloom,.65,.22);f.addPass(p),f.addPass(new ee(st)),t.userData.sky=!0;let c=e.bloom!==0;const w=[],x=new ve,h={pos:new S(0,10,40),look:new S,fov:e.fov||30},C={pos:new S(0,10,40),look:new S,fov:e.fov||30};let K=!0,ae=0,V=0,Q=0;const T=document.createElement("div");T.className="gl-labels",T.setAttribute("aria-hidden","true");let X=[],ne=0;const B=new S;function Se(){var _;const d=n.parentElement;if(d&&T.parentElement!==d&&d.insertBefore(T,n.nextSibling),T.style.left=n.offsetLeft+"px",T.style.top=n.offsetTop+"px",T.style.width=a+"px",T.style.height=l+"px",ne--<=0){ne=20;const g=[];t.traverse(m=>{m.userData.lbl&&g.push(m)});for(const m of X)g.includes(m)||((_=m.userData.el)==null||_.remove(),delete m.userData.el);X=g}const v=[],D=[];for(const g of X){let m=g.userData.el;if(!m){const y=g.userData.lbl;m=document.createElement("div"),m.className="gl-lb",m.style.setProperty("--c",y.color);const R=document.createElement("b");if(R.textContent=y.text,m.appendChild(R),y.sub){const he=document.createElement("span");he.textContent=y.sub,m.appendChild(he)}T.appendChild(m),g.userData.el=m}g.getWorldPosition(B),B.project(i);const E=(B.x*.5+.5)*a,M=(-B.y*.5+.5)*l,z=B.z<1&&E>-60&&E<a+60&&M>-20&&M<l+40;m.style.opacity=z?"1":"0",z&&D.push({el:m,x:E,y:M,z:B.z})}D.sort((g,m)=>g.z-m.z);for(const g of D){const m=g.el.offsetWidth||90,E=g.el.offsetHeight||34;let M=g.y;for(let z=0;z<6;z++){const y=v.find(R=>Math.abs(R.x-g.x)<(R.w+m)/2+4&&M>R.y-R.h-4&&M-E<R.y+4);if(!y)break;M=y.y-y.h-6}v.push({x:g.x,y:M,w:m,h:E}),g.el.style.transform=`translate(${g.x.toFixed(1)}px,${M.toFixed(1)}px) translate(-50%,-100%)`}}const Ce=Ye();function $(){const d=n.getBoundingClientRect();a=Math.max(1,d.width),l=Math.max(1,d.height);const v=de();s.setPixelRatio(v),s.setSize(a,l,!1),f.setPixelRatio(v),f.setSize(a,l),p.setSize(Math.round(a*v*.5),Math.round(l*v*.5)),i.aspect=a/l,a>900&&e.offsetX!==0?i.setViewOffset(a,l,-a*(e.offsetX==null?.17:e.offsetX),0,a,l):i.clearViewOffset(),i.updateProjectionMatrix()}$();const Me=$e(()=>{$(),!O&&e.bloom!==0&&(c=!0)}),le=new ResizeObserver($);le.observe(n);const ue=new IntersectionObserver(d=>{K=d[0].isIntersecting});ue.observe(n);let G=0;function fe(){if(ae=requestAnimationFrame(fe),!K)return;const d=performance.now();if(d-V<15)return;const v=Math.min(.05,(d-V)/1e3);Ce(d-V),V=d;const D=x.getElapsedTime(),_=O?1:Math.min(1,v*(Q>0?3.2:2.4));h.pos.lerp(C.pos,_),h.look.lerp(C.look,_),h.fov+=(C.fov-h.fov)*_,Q>0&&(Q-=v);const g=O?0:1;i.position.set(h.pos.x+Math.sin(D*.21)*.9*g,h.pos.y+Math.sin(D*.17)*.4*g,h.pos.z),i.lookAt(h.look),Math.abs(i.fov-h.fov)>.01&&(i.fov=h.fov,i.updateProjectionMatrix());for(const m of w)m(D,v);c?f.render(v):s.render(t,i),Se(),v*1e3>40?G++:G=Math.max(0,G-1),G>40&&c&&(c=!1,s.setPixelRatio(Math.min(s.getPixelRatio(),1)))}return fe(),{scene:t,camera:i,onTick(d){w.push(d)},fly(d,v){C.pos.set(...d.pos),C.look.set(...d.look),C.fov=d.fov||e.fov||30,Q=2.5,(v||O)&&(h.pos.copy(C.pos),h.look.copy(C.look),h.fov=C.fov)},project(d){const v=d.clone().project(i);return{x:(v.x*.5+.5)*a,y:(-v.y*.5+.5)*l,behind:v.z>1}},visible:()=>K,dispose(){T.remove(),cancelAnimationFrame(ae),Me(),le.disconnect(),ue.disconnect(),u.dispose(),s.dispose(),t.traverse(d=>{d.geometry&&d.geometry.dispose()})}}}const J={};function rt(n,e="#EAF2FF",s=256){const t=n+e+s;if(J[t])return J[t];const r=document.createElement("canvas");r.width=r.height=s;const o=r.getContext("2d"),i=new A(r);if(i.encoding=L,i.anisotropy=4,J[t]=i,n.startsWith("brand:")){const a=Xe[n.slice(6)];a&&(o.save(),o.scale(s/24,s/24),o.fillStyle=e,o.fill(new Path2D(a.p)),o.restore(),i.needsUpdate=!0)}else if(ce[n]){const a=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ce[n]}</svg>`,l=new Image;l.onload=()=>{o.clearRect(0,0,s,s),o.drawImage(l,s*.08,s*.08,s*.84,s*.84),i.needsUpdate=!0},l.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(a)}return i}function ht(n,e,s=1.5,t=""){const r=new Ae;return r.userData.lbl={text:n,sub:t,color:"#"+new P(e).getHexString()},r}const Te=(n,e=1)=>new ie({color:F(n).multiplyScalar(e),toneMapped:!1});function ct(n=it.panel,e=731759,s=.5){return new oe({color:F(n),roughness:.28,metalness:.55,emissive:F(e),emissiveIntensity:s,envMapIntensity:1})}function dt(n=1780309,e=.35){return new oe({color:F(n),roughness:e,metalness:.7})}function mt(n,e,s,t=.2,r=3){t=Math.min(t,n/2-.01,s/2-.01,e/2-.01);const o=new ke,i=-n/2+t,a=-s/2+t,l=n-2*t,u=s-2*t;o.moveTo(i,a-t),o.lineTo(i+l,a-t),o.quadraticCurveTo(i+l+t,a-t,i+l+t,a),o.lineTo(i+l+t,a+u),o.quadraticCurveTo(i+l+t,a+u+t,i+l,a+u+t),o.lineTo(i,a+u+t),o.quadraticCurveTo(i-t,a+u+t,i-t,a+u),o.lineTo(i-t,a),o.quadraticCurveTo(i-t,a-t,i,a-t);const f=new Le(o,{depth:Math.max(.01,e-2*t*.4),bevelEnabled:!0,bevelThickness:t*.4,bevelSize:t*.4,bevelSegments:r,curveSegments:6});return f.rotateX(-Math.PI/2),f.translate(0,t*.4,0),f}function pt(n,e,s=1.2){return new ze(new He(n,25),new Ve({color:F(e).multiplyScalar(s),toneMapped:!1}))}function gt(n,e,s,t=.07,r=!1){const o=new Qe(e,r,"catmullrom",.3),i=new N(new Ge(o,Math.max(24,e.length*14),t,8,r),Te(s,.9));return n.add(i),o}function vt(n,e,s,t,r=.28,o=.08,i){const a=[];for(let l=0;l<s;l++){const u=new N(i||new Oe(r,10,8),Te(t,1.6));n.add(u),a.push(u)}return l=>a.forEach((u,f)=>{const p=(l*o+f/s)%1;u.position.copy(e.getPointAt(p));const c=Math.min(1,p*10,(1-p)*10);u.scale.setScalar(Math.max(.001,c))})}function xt(n,e,s,t=0,r=2){const o=document.createElement("canvas");o.width=o.height=512;const i=o.getContext("2d");i.fillStyle="rgba(0,0,0,0)",i.fillRect(0,0,512,512);const a="#"+new P(s).getHexString();i.strokeStyle=a,i.lineWidth=2,i.globalAlpha=.55;const l=Math.round(e/r);for(let h=0;h<=8;h++)i.beginPath(),i.moveTo(h*64,0),i.lineTo(h*64,512),i.moveTo(0,h*64),i.lineTo(512,h*64),i.stroke();const u=new A(o);u.wrapS=u.wrapT=Ee,u.repeat.set(l/8,l/8),u.anisotropy=4,u.encoding=L;const f=document.createElement("canvas");f.width=f.height=256;const p=f.getContext("2d"),c=p.createRadialGradient(128,128,20,128,128,128);c.addColorStop(0,"#fff"),c.addColorStop(1,"#000"),p.fillStyle=c,p.fillRect(0,0,256,256);const w=new A(f),x=new N(new Ue(e,e),new ie({map:u,alphaMap:w,transparent:!0,depthWrite:!1,toneMapped:!1,opacity:.9,fog:!1}));return x.rotation.x=-Math.PI/2,x.position.y=t,n.add(x),x}function wt(n,e,s,t,r=9417983,o=5){const i=new Float32Array(e*3);let a=5;const l=()=>(a=(a*9301+49297)%233280)/233280;for(let h=0;h<e;h++)i[h*3]=t[0]+(l()-.5)*s[0],i[h*3+1]=t[1]+(l()-.5)*s[1],i[h*3+2]=t[2]+(l()-.5)*s[2];const u=new te;u.setAttribute("position",new We(i,3));const f=document.createElement("canvas");f.width=f.height=32;const p=f.getContext("2d"),c=p.createRadialGradient(16,16,0,16,16,16);c.addColorStop(0,"rgba(255,255,255,1)"),c.addColorStop(1,"rgba(255,255,255,0)"),p.fillStyle=c,p.fillRect(0,0,32,32);const w=new Ie({map:new A(f),color:F(r),size:o,sizeAttenuation:!1,transparent:!0,depthWrite:!1,blending:xe,toneMapped:!1,opacity:.8,fog:!1}),x=new je(u,w);return n.add(x),h=>{x.rotation.y=h*.012,w.opacity=.6+.2*Math.sin(h*1.3)}}function bt(n){n.add(new _e(6192383,659504,.9));const e=new Y(12571903,1.1);e.position.set(-20,40,25),n.add(e);const s=new Y(16742972,1.3);s.position.set(-30,12,-26),n.add(s);const t=new Y(2610175,1.4);return t.position.set(34,14,-30),n.add(t),{key:e,a:s,b:t}}function Tt(){const n=[];for(let s=0;s<6;s++){const t=document.createElement("canvas");t.width=t.height=128;const r=t.getContext("2d"),o=r.createLinearGradient(0,0,0,128);o.addColorStop(0,"#1B2A66"),o.addColorStop(1,"#070D26"),r.fillStyle=o,r.fillRect(0,0,128,128);const i=(a,l,u,f,p,c)=>{r.save(),r.shadowColor=p,r.shadowBlur=c,r.fillStyle=p,r.fillRect(a,l,u,f),r.restore()};s===0&&i(52,10,24,100,"#27D3FF",20),s===1&&i(52,10,24,100,"#FF7A3C",20),s===2&&i(30,30,68,68,"#7C8CFF",26),s===4&&i(20,30,88,24,"#9AB4FF",18),s===5&&i(20,60,88,20,"#27D3FF",18),n.push(t)}const e=new Be(n);return e.encoding=L,e.needsUpdate=!0,e}function at(n=3,e=4,s=16,t=.3){const r=document.createElement("canvas");r.width=e*16,r.height=s*8;const o=r.getContext("2d");o.fillStyle="#05102C",o.fillRect(0,0,r.width,r.height);let i=n;const a=()=>(i=(i*9301+49297)%233280)/233280;for(let u=0;u<s;u++)for(let f=0;f<e;f++)a()<.5&&(o.fillStyle=a()<t?"#FF9A5C":"#4FD8FF",o.fillRect(f*16+3,u*8+2,10,4));const l=new A(r);return l.encoding=L,l.magFilter=Ke,l}function St(n=3,e=4,s=16,t=726848,r=.3){const o=at(n,e,s,r);return new oe({map:o,emissiveMap:o,emissive:new P(16777215),emissiveIntensity:1.1,color:F(t),roughness:.5,metalness:.3})}function Ct(n,e=1.8,s="#FFFFFF"){const t=new Ne(new qe({map:rt(n,s),transparent:!0,depthWrite:!1,toneMapped:!1,fog:!1}));return t.scale.set(e,e,1),t.renderOrder=9,t}export{it as P,O as R,F as a,gt as b,Te as c,wt as d,pt as e,ct as f,xt as g,bt as h,Ct as i,ft as j,rt as k,ht as l,dt as m,Tt as n,vt as p,mt as r,St as w};
