import{M as L,u as N,O as ne,_ as z,$ as y,a0 as I,a1 as x,a2 as U,a3 as $,a4 as A,k as le,n as S,V as T,y as ue,j as q,W as xe,s as M,S as we,F as Te,m as Se,a5 as Ce,t as be,H as Me,D as G,l as b,R as ye,a as Re,i as X,d as he,e as fe,c as Fe,E as Pe,L as Be,z as _e,J as De,g as Ee,h as Ue,p as Ae,v as ke,w as Le,x as ze,Z as He}from"./three-tEx7zMEh.js";import{H as Ve,L as se}from"./index-Dq3CgrZE.js";import{k as ie,o as Oe,q as Qe}from"./LeadForm.vue_vue_type_script_setup_true_lang-BzA4gqxh.js";var k={uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

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

		}`};class F{constructor(){this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}}const Ge=new ne(-1,1,1,-1,0,1),K=new N;K.setAttribute("position",new z([-1,3,0,-1,-1,0,3,-1,0],3));K.setAttribute("uv",new z([0,2,0,0,2,0],2));class ce{constructor(e){this._mesh=new L(K,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,Ge)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}}class j extends F{constructor(e,s){super(),this.textureID=s!==void 0?s:"tDiffuse",e instanceof y?(this.uniforms=e.uniforms,this.material=e):e&&(this.uniforms=I.clone(e.uniforms),this.material=new y({defines:Object.assign({},e.defines),uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader})),this.fsQuad=new ce(this.material)}render(e,s,i){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=i.texture),this.fsQuad.material=this.material,this.renderToScreen?(e.setRenderTarget(null),this.fsQuad.render(e)):(e.setRenderTarget(s),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this.fsQuad.render(e))}}class oe extends F{constructor(e,s){super(),this.scene=e,this.camera=s,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,s,i){const r=e.getContext(),t=e.state;t.buffers.color.setMask(!1),t.buffers.depth.setMask(!1),t.buffers.color.setLocked(!0),t.buffers.depth.setLocked(!0);let o,n;this.inverse?(o=0,n=1):(o=1,n=0),t.buffers.stencil.setTest(!0),t.buffers.stencil.setOp(r.REPLACE,r.REPLACE,r.REPLACE),t.buffers.stencil.setFunc(r.ALWAYS,o,4294967295),t.buffers.stencil.setClear(n),t.buffers.stencil.setLocked(!0),e.setRenderTarget(i),this.clear&&e.clear(),e.render(this.scene,this.camera),e.setRenderTarget(s),this.clear&&e.clear(),e.render(this.scene,this.camera),t.buffers.color.setLocked(!1),t.buffers.depth.setLocked(!1),t.buffers.stencil.setLocked(!1),t.buffers.stencil.setFunc(r.EQUAL,1,4294967295),t.buffers.stencil.setOp(r.KEEP,r.KEEP,r.KEEP),t.buffers.stencil.setLocked(!0)}}class We extends F{constructor(){super(),this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}}class Ie{constructor(e,s){if(this.renderer=e,s===void 0){const i={minFilter:A,magFilter:A,format:$},r=e.getSize(new x);this._pixelRatio=e.getPixelRatio(),this._width=r.width,this._height=r.height,s=new U(this._width*this._pixelRatio,this._height*this._pixelRatio,i),s.texture.name="EffectComposer.rt1"}else this._pixelRatio=1,this._width=s.width,this._height=s.height;this.renderTarget1=s,this.renderTarget2=s.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],k===void 0&&console.error("THREE.EffectComposer relies on CopyShader"),j===void 0&&console.error("THREE.EffectComposer relies on ShaderPass"),this.copyPass=new j(k),this.clock=new le}swapBuffers(){const e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,s){this.passes.splice(s,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){const s=this.passes.indexOf(e);s!==-1&&this.passes.splice(s,1)}isLastEnabledPass(e){for(let s=e+1;s<this.passes.length;s++)if(this.passes[s].enabled)return!1;return!0}render(e){e===void 0&&(e=this.clock.getDelta());const s=this.renderer.getRenderTarget();let i=!1;for(let r=0,t=this.passes.length;r<t;r++){const o=this.passes[r];if(o.enabled!==!1){if(o.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(r),o.render(this.renderer,this.writeBuffer,this.readBuffer,e,i),o.needsSwap){if(i){const n=this.renderer.getContext(),l=this.renderer.state.buffers.stencil;l.setFunc(n.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),l.setFunc(n.EQUAL,1,4294967295)}this.swapBuffers()}oe!==void 0&&(o instanceof oe?i=!0:o instanceof We&&(i=!1))}}this.renderer.setRenderTarget(s)}reset(e){if(e===void 0){const s=this.renderer.getSize(new x);this._pixelRatio=this.renderer.getPixelRatio(),this._width=s.width,this._height=s.height,e=this.renderTarget1.clone(),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,s){this._width=e,this._height=s;const i=this._width*this._pixelRatio,r=this._height*this._pixelRatio;this.renderTarget1.setSize(i,r),this.renderTarget2.setSize(i,r);for(let t=0;t<this.passes.length;t++)this.passes[t].setSize(i,r)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}}new ne(-1,1,1,-1,0,1);const de=new N;de.setAttribute("position",new z([-1,3,0,-1,-1,0,3,-1,0],3));de.setAttribute("uv",new z([0,2,0,0,2,0],2));class je extends F{constructor(e,s,i,r,t){super(),this.scene=e,this.camera=s,this.overrideMaterial=i,this.clearColor=r,this.clearAlpha=t!==void 0?t:0,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this._oldClearColor=new S}render(e,s,i){const r=e.autoClear;e.autoClear=!1;let t,o;this.overrideMaterial!==void 0&&(o=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor&&(e.getClearColor(this._oldClearColor),t=e.getClearAlpha(),e.setClearColor(this.clearColor,this.clearAlpha)),this.clearDepth&&e.clearDepth(),e.setRenderTarget(this.renderToScreen?null:i),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),e.render(this.scene,this.camera),this.clearColor&&e.setClearColor(this._oldClearColor,t),this.overrideMaterial!==void 0&&(this.scene.overrideMaterial=o),e.autoClear=r}}const re={uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new S(0)},defaultOpacity:{value:0}},vertexShader:`

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

		}`};class R extends F{constructor(e,s,i,r){super(),this.strength=s!==void 0?s:1,this.radius=i,this.threshold=r,this.resolution=e!==void 0?new x(e.x,e.y):new x(256,256),this.clearColor=new S(0,0,0);const t={minFilter:A,magFilter:A,format:$};this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let o=Math.round(this.resolution.x/2),n=Math.round(this.resolution.y/2);this.renderTargetBright=new U(o,n,t),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let f=0;f<this.nMips;f++){const v=new U(o,n,t);v.texture.name="UnrealBloomPass.h"+f,v.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(v);const g=new U(o,n,t);g.texture.name="UnrealBloomPass.v"+f,g.texture.generateMipmaps=!1,this.renderTargetsVertical.push(g),o=Math.round(o/2),n=Math.round(n/2)}re===void 0&&console.error("THREE.UnrealBloomPass relies on LuminosityHighPassShader");const l=re;this.highPassUniforms=I.clone(l.uniforms),this.highPassUniforms.luminosityThreshold.value=r,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new y({uniforms:this.highPassUniforms,vertexShader:l.vertexShader,fragmentShader:l.fragmentShader,defines:{}}),this.separableBlurMaterials=[];const u=[3,5,7,9,11];o=Math.round(this.resolution.x/2),n=Math.round(this.resolution.y/2);for(let f=0;f<this.nMips;f++)this.separableBlurMaterials.push(this.getSeperableBlurMaterial(u[f])),this.separableBlurMaterials[f].uniforms.texSize.value=new x(o,n),o=Math.round(o/2),n=Math.round(n/2);this.compositeMaterial=this.getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=s,this.compositeMaterial.uniforms.bloomRadius.value=.1,this.compositeMaterial.needsUpdate=!0;const h=[1,.8,.6,.4,.2];this.compositeMaterial.uniforms.bloomFactors.value=h,this.bloomTintColors=[new T(1,1,1),new T(1,1,1),new T(1,1,1),new T(1,1,1),new T(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,k===void 0&&console.error("THREE.UnrealBloomPass relies on CopyShader");const d=k;this.copyUniforms=I.clone(d.uniforms),this.copyUniforms.opacity.value=1,this.materialCopy=new y({uniforms:this.copyUniforms,vertexShader:d.vertexShader,fragmentShader:d.fragmentShader,blending:ue,depthTest:!1,depthWrite:!1,transparent:!0}),this.enabled=!0,this.needsSwap=!1,this._oldClearColor=new S,this.oldClearAlpha=1,this.basic=new q,this.fsQuad=new ce(null)}dispose(){for(let e=0;e<this.renderTargetsHorizontal.length;e++)this.renderTargetsHorizontal[e].dispose();for(let e=0;e<this.renderTargetsVertical.length;e++)this.renderTargetsVertical[e].dispose();this.renderTargetBright.dispose()}setSize(e,s){let i=Math.round(e/2),r=Math.round(s/2);this.renderTargetBright.setSize(i,r);for(let t=0;t<this.nMips;t++)this.renderTargetsHorizontal[t].setSize(i,r),this.renderTargetsVertical[t].setSize(i,r),this.separableBlurMaterials[t].uniforms.texSize.value=new x(i,r),i=Math.round(i/2),r=Math.round(r/2)}render(e,s,i,r,t){e.getClearColor(this._oldClearColor),this.oldClearAlpha=e.getClearAlpha();const o=e.autoClear;e.autoClear=!1,e.setClearColor(this.clearColor,0),t&&e.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this.fsQuad.material=this.basic,this.basic.map=i.texture,e.setRenderTarget(null),e.clear(),this.fsQuad.render(e)),this.highPassUniforms.tDiffuse.value=i.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this.fsQuad.material=this.materialHighPassFilter,e.setRenderTarget(this.renderTargetBright),e.clear(),this.fsQuad.render(e);let n=this.renderTargetBright;for(let l=0;l<this.nMips;l++)this.fsQuad.material=this.separableBlurMaterials[l],this.separableBlurMaterials[l].uniforms.colorTexture.value=n.texture,this.separableBlurMaterials[l].uniforms.direction.value=R.BlurDirectionX,e.setRenderTarget(this.renderTargetsHorizontal[l]),e.clear(),this.fsQuad.render(e),this.separableBlurMaterials[l].uniforms.colorTexture.value=this.renderTargetsHorizontal[l].texture,this.separableBlurMaterials[l].uniforms.direction.value=R.BlurDirectionY,e.setRenderTarget(this.renderTargetsVertical[l]),e.clear(),this.fsQuad.render(e),n=this.renderTargetsVertical[l];this.fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,e.setRenderTarget(this.renderTargetsHorizontal[0]),e.clear(),this.fsQuad.render(e),this.fsQuad.material=this.materialCopy,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,t&&e.state.buffers.stencil.setTest(!0),this.renderToScreen?(e.setRenderTarget(null),this.fsQuad.render(e)):(e.setRenderTarget(i),this.fsQuad.render(e)),e.setClearColor(this._oldClearColor,this.oldClearAlpha),e.autoClear=o}getSeperableBlurMaterial(e){return new y({defines:{KERNEL_RADIUS:e,SIGMA:e},uniforms:{colorTexture:{value:null},texSize:{value:new x(.5,.5)},direction:{value:new x(.5,.5)}},vertexShader:`varying vec2 vUv;
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
				}`})}getCompositeMaterial(e){return new y({defines:{NUM_MIPS:e},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},dirtTexture:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`varying vec2 vUv;
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
				}`})}}R.BlurDirectionX=new x(1,0);R.BlurDirectionY=new x(0,1);const Ne={uniforms:{tDiffuse:{value:null}},vertexShader:`

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

		}`},D=typeof matchMedia=="function"&&matchMedia("(prefers-reduced-motion: reduce)").matches,$e={cyan:2610175,blue:3894271,violet:9067519,orange:16742972,mint:3073702,pink:16731533,gold:16761421,white:15397631,panel:793413},E='"Nunito",system-ui,sans-serif',C=a=>new S(a).convertSRGBToLinear();function qe(a,e,s){const i=document.createElement("canvas");i.width=4,i.height=256;const r=i.getContext("2d"),t=r.createLinearGradient(0,0,0,256);t.addColorStop(0,a),t.addColorStop(.55,e),t.addColorStop(1,s),r.fillStyle=t,r.fillRect(0,0,4,256);const o=new b(i);return o.encoding=M,o}function et(a,e){const s=new xe({canvas:a,antialias:e.bloom===0,alpha:!1,powerPreference:"high-performance"});s.outputEncoding=M;const i=new we,r=e.sky||["#040A1C","#0A1B45","#0E2A63"];i.background=qe(r[0],r[1],r[2]);const t=e.fog||[40,130];i.fog=new Te(C(e.fogColor==null?662341:e.fogColor),t[0],t[1]);const o=new Se(e.fov||30,1,.5,400);let n=1,l=1,u=new Ce(2,2,{format:$});u.samples=ie()>=1.75?2:4;const h=new Ie(s,u);h.addPass(new je(i,o));const d=new R(new x(2,2),e.bloom==null?.85:e.bloom,.65,.22);h.addPass(d),h.addPass(new j(Ne)),i.userData.sky=!0;let f=e.bloom!==0;const v=[],g=new le,c={pos:new T(0,10,40),look:new T,fov:e.fov||30},w={pos:new T(0,10,40),look:new T,fov:e.fov||30};let H=!0,Y=0,P=0,B=0;const pe=Qe();function V(){const m=a.getBoundingClientRect();n=Math.max(1,m.width),l=Math.max(1,m.height);const p=ie();s.setPixelRatio(p),s.setSize(n,l,!1),h.setPixelRatio(p),h.setSize(n,l),d.setSize(Math.round(n*p*.5),Math.round(l*p*.5)),o.aspect=n/l,n>900&&e.offsetX!==0?o.setViewOffset(n,l,-n*(e.offsetX==null?.17:e.offsetX),0,n,l):o.clearViewOffset(),o.updateProjectionMatrix()}V();const ge=Oe(()=>{V(),!D&&e.bloom!==0&&(f=!0)}),J=new ResizeObserver(V);J.observe(a);const Z=new IntersectionObserver(m=>{H=m[0].isIntersecting});Z.observe(a);let _=0;function ee(){if(Y=requestAnimationFrame(ee),!H)return;const m=performance.now();if(m-P<15)return;const p=Math.min(.05,(m-P)/1e3);pe(m-P),P=m;const O=g.getElapsedTime(),Q=D?1:Math.min(1,p*(B>0?3.2:2.4));c.pos.lerp(w.pos,Q),c.look.lerp(w.look,Q),c.fov+=(w.fov-c.fov)*Q,B>0&&(B-=p);const te=D?0:1;o.position.set(c.pos.x+Math.sin(O*.21)*.9*te,c.pos.y+Math.sin(O*.17)*.4*te,c.pos.z),o.lookAt(c.look),Math.abs(o.fov-c.fov)>.01&&(o.fov=c.fov,o.updateProjectionMatrix());for(const ve of v)ve(O,p);f?h.render(p):s.render(i,o),p*1e3>40?_++:_=Math.max(0,_-1),_>40&&f&&(f=!1,s.setPixelRatio(Math.min(s.getPixelRatio(),1)))}return ee(),{scene:i,camera:o,onTick(m){v.push(m)},fly(m,p){w.pos.set(...m.pos),w.look.set(...m.look),w.fov=m.fov||e.fov||30,B=2.5,(p||D)&&(c.pos.copy(w.pos),c.look.copy(w.look),c.fov=w.fov)},project(m){const p=m.clone().project(o);return{x:(p.x*.5+.5)*n,y:(-p.y*.5+.5)*l,behind:p.z>1}},visible:()=>H,dispose(){cancelAnimationFrame(Y),ge(),J.disconnect(),Z.disconnect(),u.dispose(),s.dispose(),i.traverse(m=>{m.geometry&&m.geometry.dispose()})}}}const W={};function Xe(a,e="#EAF2FF",s=256){const i=a+e+s;if(W[i])return W[i];const r=document.createElement("canvas");r.width=r.height=s;const t=r.getContext("2d"),o=new b(r);if(o.encoding=M,o.anisotropy=4,W[i]=o,a.startsWith("brand:")){const n=Ve[a.slice(6)];n&&(t.save(),t.scale(s/24,s/24),t.fillStyle=e,t.fill(new Path2D(n.p)),t.restore(),o.needsUpdate=!0)}else if(se[a]){const n=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${se[a]}</svg>`,l=new Image;l.onload=()=>{t.clearRect(0,0,s,s),t.drawImage(l,s*.08,s*.08,s*.84,s*.84),o.needsUpdate=!0},l.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(n)}return o}function ae(a,e,s,i,r,t){a.beginPath(),a.moveTo(e+t,s),a.arcTo(e+i,s,e+i,s+r,t),a.arcTo(e+i,s+r,e,s+r,t),a.arcTo(e,s+r,e,s,t),a.arcTo(e,s,e+i,s,t),a.closePath()}function tt(a,e,s=1.5,i=""){const r=document.createElement("canvas"),t=r.getContext("2d");t.font=`900 52px ${E}`;const o=Math.ceil(t.measureText(a).width);t.font=`700 30px ${E}`;const n=i?Math.ceil(t.measureText(i).width):0,l=Math.max(o,n)+96,u=i?148:100;r.width=l,r.height=u;const h="#"+new S(e).getHexString();t.fillStyle="rgba(7,16,43,.78)",ae(t,4,4,l-8,u-8,30),t.fill(),t.strokeStyle=h,t.lineWidth=5,ae(t,4,4,l-8,u-8,30),t.stroke(),t.textAlign="center",t.textBaseline="middle",t.fillStyle="#FFFFFF",t.font=`900 52px ${E}`,t.fillText(a,l/2,i?52:u/2+3),i&&(t.fillStyle=h,t.font=`700 30px ${E}`,t.fillText(i,l/2,108));const d=new b(r);d.encoding=M;const f=new he(new fe({map:d,transparent:!0,depthWrite:!1,toneMapped:!1,fog:!1}));return f.scale.set(s*l/u,s,1),f.renderOrder=10,f}const me=(a,e=1)=>new q({color:C(a).multiplyScalar(e),toneMapped:!1});function st(a=$e.panel,e=731759,s=.5){return new X({color:C(a),roughness:.28,metalness:.55,emissive:C(e),emissiveIntensity:s,envMapIntensity:1})}function it(a=1780309,e=.35){return new X({color:C(a),roughness:e,metalness:.7})}function ot(a,e,s,i=.2,r=3){i=Math.min(i,a/2-.01,s/2-.01,e/2-.01);const t=new Fe,o=-a/2+i,n=-s/2+i,l=a-2*i,u=s-2*i;t.moveTo(o,n-i),t.lineTo(o+l,n-i),t.quadraticCurveTo(o+l+i,n-i,o+l+i,n),t.lineTo(o+l+i,n+u),t.quadraticCurveTo(o+l+i,n+u+i,o+l,n+u+i),t.lineTo(o,n+u+i),t.quadraticCurveTo(o-i,n+u+i,o-i,n+u),t.lineTo(o-i,n),t.quadraticCurveTo(o-i,n-i,o,n-i);const h=new Pe(t,{depth:Math.max(.01,e-2*i*.4),bevelEnabled:!0,bevelThickness:i*.4,bevelSize:i*.4,bevelSegments:r,curveSegments:6});return h.rotateX(-Math.PI/2),h.translate(0,i*.4,0),h}function rt(a,e,s=1.2){return new Be(new _e(a,25),new De({color:C(e).multiplyScalar(s),toneMapped:!1}))}function at(a,e,s,i=.07,r=!1){const t=new Ee(e,r,"catmullrom",.3),o=new L(new Ue(t,Math.max(24,e.length*14),i,8,r),me(s,.9));return a.add(o),t}function nt(a,e,s,i,r=.28,t=.08,o){const n=[];for(let l=0;l<s;l++){const u=new L(o||new Ae(r,10,8),me(i,1.6));a.add(u),n.push(u)}return l=>n.forEach((u,h)=>{const d=(l*t+h/s)%1;u.position.copy(e.getPointAt(d));const f=Math.min(1,d*10,(1-d)*10);u.scale.setScalar(Math.max(.001,f))})}function lt(a,e,s,i=0,r=2){const t=document.createElement("canvas");t.width=t.height=512;const o=t.getContext("2d");o.fillStyle="rgba(0,0,0,0)",o.fillRect(0,0,512,512);const n="#"+new S(s).getHexString();o.strokeStyle=n,o.lineWidth=2,o.globalAlpha=.55;const l=Math.round(e/r);for(let c=0;c<=8;c++)o.beginPath(),o.moveTo(c*64,0),o.lineTo(c*64,512),o.moveTo(0,c*64),o.lineTo(512,c*64),o.stroke();const u=new b(t);u.wrapS=u.wrapT=ye,u.repeat.set(l/8,l/8),u.anisotropy=4,u.encoding=M;const h=document.createElement("canvas");h.width=h.height=256;const d=h.getContext("2d"),f=d.createRadialGradient(128,128,20,128,128,128);f.addColorStop(0,"#fff"),f.addColorStop(1,"#000"),d.fillStyle=f,d.fillRect(0,0,256,256);const v=new b(h),g=new L(new Re(e,e),new q({map:u,alphaMap:v,transparent:!0,depthWrite:!1,toneMapped:!1,opacity:.9,fog:!1}));return g.rotation.x=-Math.PI/2,g.position.y=i,a.add(g),g}function ut(a,e,s,i,r=9417983,t=5){const o=new Float32Array(e*3);let n=5;const l=()=>(n=(n*9301+49297)%233280)/233280;for(let c=0;c<e;c++)o[c*3]=i[0]+(l()-.5)*s[0],o[c*3+1]=i[1]+(l()-.5)*s[1],o[c*3+2]=i[2]+(l()-.5)*s[2];const u=new N;u.setAttribute("position",new ke(o,3));const h=document.createElement("canvas");h.width=h.height=32;const d=h.getContext("2d"),f=d.createRadialGradient(16,16,0,16,16,16);f.addColorStop(0,"rgba(255,255,255,1)"),f.addColorStop(1,"rgba(255,255,255,0)"),d.fillStyle=f,d.fillRect(0,0,32,32);const v=new Le({map:new b(h),color:C(r),size:t,sizeAttenuation:!1,transparent:!0,depthWrite:!1,blending:ue,toneMapped:!1,opacity:.8,fog:!1}),g=new ze(u,v);return a.add(g),c=>{g.rotation.y=c*.012,v.opacity=.6+.2*Math.sin(c*1.3)}}function ht(a){a.add(new Me(6192383,659504,.9));const e=new G(12571903,1.1);e.position.set(-20,40,25),a.add(e);const s=new G(16742972,1.3);s.position.set(-30,12,-26),a.add(s);const i=new G(2610175,1.4);return i.position.set(34,14,-30),a.add(i),{key:e,a:s,b:i}}function ft(){const a=[];for(let s=0;s<6;s++){const i=document.createElement("canvas");i.width=i.height=128;const r=i.getContext("2d"),t=r.createLinearGradient(0,0,0,128);t.addColorStop(0,"#1B2A66"),t.addColorStop(1,"#070D26"),r.fillStyle=t,r.fillRect(0,0,128,128);const o=(n,l,u,h,d,f)=>{r.save(),r.shadowColor=d,r.shadowBlur=f,r.fillStyle=d,r.fillRect(n,l,u,h),r.restore()};s===0&&o(52,10,24,100,"#27D3FF",20),s===1&&o(52,10,24,100,"#FF7A3C",20),s===2&&o(30,30,68,68,"#7C8CFF",26),s===4&&o(20,30,88,24,"#9AB4FF",18),s===5&&o(20,60,88,20,"#27D3FF",18),a.push(i)}const e=new be(a);return e.encoding=M,e.needsUpdate=!0,e}function Ke(a=3,e=4,s=16,i=.3){const r=document.createElement("canvas");r.width=e*16,r.height=s*8;const t=r.getContext("2d");t.fillStyle="#05102C",t.fillRect(0,0,r.width,r.height);let o=a;const n=()=>(o=(o*9301+49297)%233280)/233280;for(let u=0;u<s;u++)for(let h=0;h<e;h++)n()<.5&&(t.fillStyle=n()<i?"#FF9A5C":"#4FD8FF",t.fillRect(h*16+3,u*8+2,10,4));const l=new b(r);return l.encoding=M,l.magFilter=He,l}function ct(a=3,e=4,s=16,i=726848,r=.3){const t=Ke(a,e,s,r);return new X({map:t,emissiveMap:t,emissive:new S(16777215),emissiveIntensity:1.1,color:C(i),roughness:.5,metalness:.3})}function dt(a,e=1.8,s="#FFFFFF"){const i=new he(new fe({map:Xe(a,s),transparent:!0,depthWrite:!1,toneMapped:!1,fog:!1}));return i.scale.set(e,e,1),i.renderOrder=9,i}export{$e as P,D as R,ht as a,me as b,et as c,tt as d,rt as e,ut as f,st as g,lt as h,dt as i,at as j,Xe as k,C as l,it as m,ft as n,nt as p,ot as r,ct as w};
