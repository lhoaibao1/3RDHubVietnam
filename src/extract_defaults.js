const fs=require('fs'),vm=require('vm');
const pre=fs.readFileSync('pre-modules.html','utf8'),pj=fs.readFileSync('pages.js','utf8'),en=JSON.parse(fs.readFileSync('en.json','utf8'));
function grab(src,re){const m=src.match(re);if(!m)throw new Error('not found '+re);return m[0]}
const PT=vm.runInNewContext('('+grab(pre,/var PT=(\[\[[\s\S]*?\]\]);/).replace(/^var PT=/,'').replace(/;$/,'')+')');
const LG=vm.runInNewContext('('+grab(pre,/var LG=(\{[^}]*\});/).replace(/^var LG=/,'').replace(/;$/,'')+')');
const FQ=vm.runInNewContext('('+grab(pj,/var FQ=(\[[\s\S]*?\n  \]);/).replace(/^var FQ=/,'').replace(/;$/,'')+')');
const tr=s=>en[s]!=null?en[s]:s;
// seed logos
const names={};
for(const [k,v] of Object.entries(LG)){const m=v.match(/^data:image\/(\w+);base64,(.*)$/);fs.writeFileSync('cms/seed/'+k+'.'+m[1],Buffer.from(m[2],'base64'));names[k]=k+'.'+m[1]}
const homeIdx=[0,3,7,12,14,15];
const faq=FQ.map((q,i)=>({id:'f'+(i+1),cat:{vi:q[0],en:tr(q[0])},q:{vi:q[1],en:tr(q[1])},a:{vi:q[2],en:tr(q[2])},home:homeIdx.includes(i)}));
const partners=PT.map((p,i)=>({id:'p'+(i+1),name:p[0],url:p[1],logo:'/uploads/seed-'+names[p[2]],group:{vi:p[3],en:tr(p[3])}}));
const legal=JSON.parse(fs.readFileSync('legal.json','utf8'));
fs.writeFileSync('cms/defaults.json',JSON.stringify({faq,partners,legal,settings:{signup_url:'https://app.3rdvn.io.vn/auth/login?tab=signup',email:'admin_support@3rdvn.io.vn',hotline:'(+84) 398 192 414',hotline_tel:'+84398192414',company_name:'3RDVN Technology',tax_id:'4001342613',address:'',working_hours:'',working_hours_en:'',facebook:'',zalo:'',tiktok:'',youtube:'',instagram:'',site_title:'',meta_description:'',analytics_id:''}},null,1));
console.log('faq',faq.length,'partners',partners.length,'logos',Object.values(names).join(','));
