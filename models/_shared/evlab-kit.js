/* EVLab shared kit: drawings (plan, 4 elevations, 2 sections) + export (DXF, SVG, PNG, STL, IFC, CSV, ZIP, software package).
   Drop-in for any model page that has a three.js `model` group (metres, Y-up), a `spec` object and the usual
   #view / #fmt / #dl controls. Load it as the LAST script of the page:  <script src="../../../_shared/evlab-kit.js"></script>
   Optional page config (define before this script):  window.EV_KIT={noGround:true, title:'...', cuts(bb){...}, before(){}, after(){}}
   For pages that keep their scene private (IIFE): window.EV_PAGE={get model(){...}, get spec(){...}, get clips(){...}}
   All text is English. Units mm in every exported file. */
(function(){
'use strict';
if(window.EVKit)return;

/* ---------- zip (store) ---------- */
const CT=new Uint32Array(256).map((_,n)=>{for(let k=0;k<8;k++)n=n&1?0xEDB88320^n>>>1:n>>>1;return n>>>0});
const crc32=u=>{let c=~0;for(const b of u)c=CT[(c^b)&255]^c>>>8;return~c>>>0};
function zipStore(fs){const e=new TextEncoder(),P=[],Cd=[];let o=0;
 for(const f of fs){const nm=e.encode(f.n),c=crc32(f.d),h=new DataView(new ArrayBuffer(30));h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint32(14,c,true);h.setUint32(18,f.d.length,true);h.setUint32(22,f.d.length,true);h.setUint16(26,nm.length,true);
  const d=new DataView(new ArrayBuffer(46));d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint32(16,c,true);d.setUint32(20,f.d.length,true);d.setUint32(24,f.d.length,true);d.setUint16(28,nm.length,true);d.setUint32(42,o,true);
  P.push(h.buffer,nm,f.d);Cd.push(d.buffer,nm);o+=30+nm.length+f.d.length}
 const cs=Cd.reduce((a,b)=>a+b.byteLength,0),z=new DataView(new ArrayBuffer(22));z.setUint32(0,0x06054b50,true);z.setUint16(8,fs.length,true);z.setUint16(10,fs.length,true);z.setUint32(12,cs,true);z.setUint32(16,o,true);
 return new Blob([...P,...Cd,z.buffer],{type:'application/zip'})}

/* ---------- vector drawing engine (same code as docs/vdraw-engine.js) ---------- */
const vdDot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],vdCross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],vdNorm=a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return[a[0]/l,a[1]/l,a[2]/l]};
function vdCollect(model){const out=[];model.updateMatrixWorld(true);
 model.traverse(o=>{if(!o.isMesh)return;let p=o,ok=true;while(p){if(!p.visible){ok=false;break}if(p===model)break;p=p.parent}if(!ok)return;
  const g=o.geometry,pa=g.attributes.position,e=o.matrixWorld.elements,P=new Float64Array(pa.count*3);
  for(let i=0;i<pa.count;i++){const x=pa.getX(i),y=pa.getY(i),z=pa.getZ(i);P[3*i]=(e[0]*x+e[4]*y+e[8]*z+e[12])*1000;P[3*i+1]=(e[1]*x+e[5]*y+e[9]*z+e[13])*1000;P[3*i+2]=(e[2]*x+e[6]*y+e[10]*z+e[14])*1000}
  const T=g.index?Array.from(g.index.array):Array.from({length:pa.count},(_,i)=>i);
  out.push({P,T,glass:!!(o.material&&o.material.userData&&o.material.userData.glass)})});return out}
function vdEdges(m){const{P,T}=m,nv=P.length/3,idm=new Map(),vid=new Int32Array(nv);let c=0;
 for(let i=0;i<nv;i++){const k=Math.round(P[3*i]*100)+'_'+Math.round(P[3*i+1]*100)+'_'+Math.round(P[3*i+2]*100);let v=idm.get(k);if(v===undefined){v=c++;idm.set(k,v)}vid[i]=v}
 const em=new Map();
 for(let t=0;t<T.length;t+=3){const a=T[t],b=T[t+1],c2=T[t+2],ux=P[3*b]-P[3*a],uy=P[3*b+1]-P[3*a+1],uz=P[3*b+2]-P[3*a+2],vx=P[3*c2]-P[3*a],vy=P[3*c2+1]-P[3*a+1],vz=P[3*c2+2]-P[3*a+2];
  let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const l=Math.hypot(nx,ny,nz);if(l<1e-9)continue;nx/=l;ny/=l;nz/=l;
  for(const [p,q] of[[a,b],[b,c2],[c2,a]]){const i1=vid[p],i2=vid[q];if(i1===i2)continue;const k=i1<i2?i1*4194304+i2:i2*4194304+i1;let r=em.get(k);if(!r){r={p,q,n:[[nx,ny,nz]]};em.set(k,r)}else r.n.push([nx,ny,nz])}}
 const out=[];for(const r of em.values()){const n=r.n;out.push({a:[P[3*r.p],P[3*r.p+1],P[3*r.p+2]],b:[P[3*r.q],P[3*r.q+1],P[3*r.q+2]],f:n.length!=2||vdDot(n[0],n[1])<.9063,n1:n[0],n2:n[1]||null})}return out}
function vdClip(poly,w0){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ia=a[2]<=w0,ib=b[2]<=w0;if(ia)out.push(a);if(ia!==ib){const t=(w0-a[2])/(b[2]-a[2]);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,w0])}}return out}
function vdTri(zb,idb,id,W,H,a,b,c){const D=(a[0]-c[0])*(b[1]-c[1])-(b[0]-c[0])*(a[1]-c[1]);if(Math.abs(D)<1e-9)return;
 const A=((a[2]-c[2])*(b[1]-c[1])-(b[2]-c[2])*(a[1]-c[1]))/D,B=((a[0]-c[0])*(b[2]-c[2])-(b[0]-c[0])*(a[2]-c[2]))/D,C=c[2]-A*c[0]-B*c[1];
 const y0=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),y1=Math.min(H-1,Math.ceil(Math.max(a[1],b[1],c[1]))),E=[[a,b],[b,c],[c,a]];
 for(let y=y0;y<=y1;y++){const yc=y+.5;let xl=1e18,xr=-1e18;for(const [p,q] of E){if((p[1]<=yc&&q[1]>yc)||(q[1]<=yc&&p[1]>yc)){const x=p[0]+(q[0]-p[0])*(yc-p[1])/(q[1]-p[1]);if(x<xl)xl=x;if(x>xr)xr=x}}
  if(xl>xr)continue;const xa=Math.max(0,Math.ceil(xl-.5)),xb=Math.min(W-1,Math.floor(xr-.5));for(let x=xa;x<=xb;x++){const z=A*(x+.5)+B*yc+C,i=y*W+x;if(z>zb[i]){zb[i]=z;idb[i]=id}}}}
function vdFill(zb,idb,id,W,H,loops,z){let y0=1e18,y1=-1e18;loops.forEach(l=>l.forEach(p=>{y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1])}));
 for(let y=Math.max(0,Math.floor(y0));y<=Math.min(H-1,Math.ceil(y1));y++){const yc=y+.5,xs=[];
  for(const l of loops)for(let i=0;i<l.length;i++){const p=l[i],q=l[(i+1)%l.length];if((p[1]<=yc&&q[1]>yc)||(q[1]<=yc&&p[1]>yc))xs.push(p[0]+(q[0]-p[0])*(yc-p[1])/(q[1]-p[1]))}
  xs.sort((a,b)=>a-b);for(let k=0;k+1<xs.length;k+=2){const xa=Math.max(0,Math.ceil(xs[k]-.5)),xb=Math.min(W-1,Math.floor(xs[k+1]-.5));for(let x=xa;x<=xb;x++){const i=y*W+x;if(z>zb[i]){zb[i]=z;idb[i]=id}}}}}
function vdCutSegs(m,d,p0){const{P,T}=m,s=i=>(P[3*i]-p0[0])*d[0]+(P[3*i+1]-p0[1])*d[1]+(P[3*i+2]-p0[2])*d[2],out=[];
 for(let t=0;t<T.length;t+=3){const ids=[T[t],T[t+1],T[t+2]],sv=ids.map(s),pos=sv.map(x=>x>1e-6);if(pos[0]===pos[1]&&pos[1]===pos[2])continue;const pts=[];
  for(let k=0;k<3;k++){const k2=(k+1)%3;if(pos[k]!==pos[k2]){const a=ids[k],b=ids[k2],q=sv[k]/(sv[k]-sv[k2]);pts.push([P[3*a]+(P[3*b]-P[3*a])*q,P[3*a+1]+(P[3*b+1]-P[3*a+1])*q,P[3*a+2]+(P[3*b+2]-P[3*a+2])*q])}}
  if(pts.length==2)out.push(pts)}return out}
function vdLoops(segs){const K=(u,v)=>Math.round(u*100)+'_'+Math.round(v*100),adj=new Map();
 segs.forEach((s,i)=>{for(const k of[K(s[0],s[1]),K(s[2],s[3])]){let a=adj.get(k);if(!a){a=[];adj.set(k,a)}a.push(i)}});
 const used=new Uint8Array(segs.length),loops=[];
 for(let i=0;i<segs.length;i++){if(used[i])continue;used[i]=1;const pts=[[segs[i][0],segs[i][1]],[segs[i][2],segs[i][3]]],start=K(segs[i][0],segs[i][1]);let cur=K(segs[i][2],segs[i][3]);
  while(cur!==start){const nx=(adj.get(cur)||[]).find(j=>!used[j]);if(nx===undefined)break;used[nx]=1;const s=segs[nx];if(K(s[0],s[1])===cur){pts.push([s[2],s[3]]);cur=K(s[2],s[3])}else{pts.push([s[0],s[1]]);cur=K(s[0],s[1])}}
  const closed=cur===start;if(closed)pts.pop();loops.push({pts,closed})}return loops}
function vdSimp(pts,closed){let p=pts.slice(),ch=true;while(ch&&p.length>2){ch=false;for(let i=0;i<p.length;i++){if(!closed&&(i==0||i==p.length-1))continue;const a=p[(i+p.length-1)%p.length],b=p[i],c=p[(i+1)%p.length],cr=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]),l=Math.hypot(c[0]-a[0],c[1]-a[1])||1;if(Math.abs(cr)/l<.05){p.splice(i,1);ch=true;break}}}return p}
function vdHatch(loops,hs,out){let mnS=1e18,mxS=-1e18,mnT=1e18,mxT=-1e18;const R=Math.SQRT1_2,L=loops.map(l=>l.pts.map(p=>[(p[0]+p[1])*R,(p[1]-p[0])*R]));
 L.forEach(l=>l.forEach(p=>{mnS=Math.min(mnS,p[0]);mxS=Math.max(mxS,p[0]);mnT=Math.min(mnT,p[1]);mxT=Math.max(mxT,p[1])}));if(mxS-mnS<hs*1.5&&mxT-mnT<hs*1.5)return;
 for(let s=Math.ceil(mnS/hs)*hs;s<mxS;s+=hs){const ts=[];for(const l of L)for(let i=0;i<l.length;i++){const p=l[i],q=l[(i+1)%l.length];if((p[0]<=s&&q[0]>s)||(q[0]<=s&&p[0]>s))ts.push(p[1]+(q[1]-p[1])*(s-p[0])/(q[0]-p[0]))}
  ts.sort((a,b)=>a-b);for(let k=0;k+1<ts.length;k+=2)out.push([(s-ts[k])*R,(s+ts[k])*R,(s-ts[k+1])*R,(s+ts[k+1])*R])}}
function vdMerge(segs,tol){const g=new Map();
 for(const s of segs){let dx=s[2]-s[0],dy=s[3]-s[1];const l=Math.hypot(dx,dy);if(l<1e-9)continue;dx/=l;dy/=l;let x1=s[0],y1=s[1],x2=s[2],y2=s[3];if(dx<-1e-9||(Math.abs(dx)<=1e-9&&dy<0)){dx=-dx;dy=-dy;[x1,y1,x2,y2]=[x2,y2,x1,y1]}
  const k=Math.round(Math.atan2(dy,dx)*2000)+'|'+Math.round((-dy*x1+dx*y1)/tol);let a=g.get(k);if(!a){a=[];g.set(k,a)}a.push([x1*dx+y1*dy,x2*dx+y2*dy,dx,dy,-dy*x1+dx*y1])}
 const out=[];for(const a of g.values()){a.sort((p,q)=>p[0]-q[0]);let cur=null;const emit=c=>{const dx=c[2],dy=c[3],off=c[4];out.push([c[0]*dx-off*dy,c[0]*dy+off*dx,c[1]*dx-off*dy,c[1]*dy+off*dx])};
  for(const r of a){if(cur&&r[0]<=cur[1]+tol*2){if(r[1]>cur[1])cur[1]=r[1]}else{if(cur)emit(cur);cur=r.slice()}}if(cur)emit(cur)}return out}
function vdView(meshes,EDG,v,N){
 const px=Math.max(v.w,v.h)/1600||1,W=Math.ceil(v.w/px)+6,H=Math.ceil(v.h/px)+6,zb=new Float32Array(W*H).fill(-1e30),idb=new Int32Array(W*H).fill(-1),X=u=>(u-v.u0)/px+3,Y=w=>(v.v1-w)/px+3,cut=v.cut,w0=cut?vdDot(cut.p,v.d):1e18,vis=[],cutL=[],hatch=[];
 const prj=(P,i)=>{const x=P[3*i],y=P[3*i+1],z=P[3*i+2];return[x*v.ax[0]+y*v.ax[1]+z*v.ax[2],x*v.ay[0]+y*v.ay[1]+z*v.ay[2],x*v.d[0]+y*v.d[1]+z*v.d[2]]};
 meshes.forEach((m,mi)=>{if(m.glass)return;const{P,T}=m,PV=[];for(let i=0;i<P.length/3;i++)PV.push(prj(P,i));
  for(let t=0;t<T.length;t+=3){let poly=[PV[T[t]],PV[T[t+1]],PV[T[t+2]]];if(cut){poly=vdClip(poly,w0);if(poly.length<3)continue}const q=poly.map(p=>[X(p[0]),Y(p[1]),p[2]]);for(let k=1;k<q.length-1;k++)vdTri(zb,idb,mi,W,H,q[0],q[k],q[k+1])}});
 if(cut)meshes.forEach((m,mi)=>{const segs=vdCutSegs(m,v.d,cut.p).map(s=>{const a=[vdDot(s[0],v.ax),vdDot(s[0],v.ay)],b=[vdDot(s[1],v.ax),vdDot(s[1],v.ay)];return[a[0],a[1],b[0],b[1]]});if(!segs.length)return;
  const loops=vdLoops(segs).map(l=>({pts:vdSimp(l.pts,l.closed),closed:l.closed}));
  loops.forEach(l=>{const n=l.pts.length;for(let i=0;i<(l.closed?n:n-1);i++){const a=l.pts[i],b=l.pts[(i+1)%n];cutL.push([a[0],a[1],b[0],b[1]])}});
  if(!m.glass){const cl=loops.filter(l=>l.closed&&l.pts.length>2);if(cl.length){vdFill(zb,idb,mi,W,H,cl.map(l=>l.pts.map(p=>[X(p[0]),Y(p[1])])),w0+px*.5);vdHatch(cl,2.5*N,hatch)}}});
 const z=(ix,iy)=>{if(ix<0||iy<0||ix>=W||iy>=H)return-1e30;return zb[iy*W+ix]};
 const visAt=(u,vv,w,mi,sil)=>{const x=X(u),y=Y(vv),ix=Math.floor(x),iy=Math.floor(y);let z0=z(ix,iy),g=0,id=(ix<0||iy<0||ix>=W||iy>=H)?-1:idb[iy*W+ix];
  if(z0<-1e29){let lo=1e30,bi=-1;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const q=z(ix+dx,iy+dy);if(q>-1e29){if(q>z0){z0=q;bi=idb[(iy+dy)*W+ix+dx]}lo=Math.min(lo,q)}}if(z0<-1e29)return true;g=z0-lo;id=bi}
  else for(const q of[z(ix+1,iy),z(ix-1,iy),z(ix,iy+1),z(ix,iy-1)])if(q>-1e29)g=Math.max(g,Math.abs(q-z0));
  if(sil&&id===mi)return true;return w>=z0-(2*px+g)};
 EDG.forEach((E,mi)=>E.forEach(e=>{const sil=!e.f&&e.n2&&vdDot(e.n1,v.d)*vdDot(e.n2,v.d)<0;if(!(e.f||sil))return;
  let a=[vdDot(e.a,v.ax),vdDot(e.a,v.ay),vdDot(e.a,v.d)],b=[vdDot(e.b,v.ax),vdDot(e.b,v.ay),vdDot(e.b,v.d)];
  if(cut){if(a[2]>w0&&b[2]>w0)return;const lp=(p,q)=>{const t=(w0-p[2])/(q[2]-p[2]);return[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t,w0]};if(a[2]>w0)a=lp(b,a);else if(b[2]>w0)b=lp(a,b)}
  const len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<.3*px)return;
  const at=t=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t],vt=t=>{const p=at(t);return visAt(p[0],p[1],p[2],mi,sil)},n=Math.min(3000,Math.max(2,Math.ceil(len/px)));
  const bis=(lo,hi)=>{const hv=vt(hi);let l=lo,h=hi;for(let k=0;k<7;k++){const m2=(l+h)/2;if(vt(m2)===hv)h=m2;else l=m2}return(l+h)/2};
  let prev=vt(0),st=prev?0:-1,pt=0;
  for(let i=1;i<=n;i++){const t=i/n,cv=vt(t);if(cv!==prev){if(cv)st=bis(pt,t);else{const en=bis(pt,t),p1=at(st),p2=at(en);vis.push([p1[0],p1[1],p2[0],p2[1]]);st=-1}prev=cv}pt=t}
  if(prev&&st>=0){const p1=at(st),p2=at(1);vis.push([p1[0],p1[1],p2[0],p2[1]])}}));
 return{vis:vdMerge(vis.filter(s=>Math.hypot(s[2]-s[0],s[3]-s[1])>.3*px),.6*px),cut:vdMerge(cutL,.6*px),hatch}}
function vdBuild(meshes,cfg){
 const V=[['PLAN',[0,1,0],[0,0,-1]],['FRONT ELEVATION',[0,0,1],[0,1,0]],['BACK ELEVATION',[0,0,-1],[0,1,0]],['LEFT ELEVATION',[-1,0,0],[0,1,0]],['RIGHT ELEVATION',[1,0,0],[0,1,0]]].filter(([n])=>!(cfg.skip&&cfg.skip.indexOf(n)>-1)).map(([n,d,u])=>({n,d,u}));
 cfg.cuts.forEach(c=>V.push({n:c.label,d:c.d,u:c.up,cut:{n:c.n,p:c.p.map(x=>x*1000)}}));
 const items=[],L=(l,x1,y1,x2,y2,vi)=>items.push({t:'L',l,x1,y1,x2,y2,vi}),sh={N:1,W:420,H:297,items,views:V};
 if(!meshes.length)return sh;
 const mn=[1e18,1e18,1e18],mx=[-1e18,-1e18,-1e18];meshes.forEach(m=>{const P=m.P;for(let i=0;i<P.length;i+=3)for(let k=0;k<3;k++){if(P[i+k]<mn[k])mn[k]=P[i+k];if(P[i+k]>mx[k])mx[k]=P[i+k]}});
 const cs=[];for(const x of[mn[0],mx[0]])for(const y of[mn[1],mx[1]])for(const z of[mn[2],mx[2]])cs.push([x,y,z]);
 V.forEach(v=>{v.ax=vdNorm(vdCross(v.u,v.d));v.ay=vdNorm(vdCross(v.d,v.ax));let a=1e18,b=-1e18,c=1e18,e=-1e18;cs.forEach(p=>{const u=vdDot(p,v.ax),w=vdDot(p,v.ay);a=Math.min(a,u);b=Math.max(b,u);c=Math.min(c,w);e=Math.max(e,w)});Object.assign(v,{u0:a,u1:b,v0:c,v1:e,w:b-a,h:e-c})});
 const N=[1,2,5,10,15,20,25,30,40,50,60,75,100,150,200,250,500,1000,2000,5000].find(n=>V.every(v=>v.w/n<=60&&v.h/n<=90))||5000;Object.assign(sh,{N,W:420*N,H:297*N});
 const T=(l,x,y,h,s,rot=0,al='l')=>{const w=.55*h*s.length,sx=al=='c'?-w/2:0;items.push({t:'T',l,x:x+sx*Math.cos(rot*Math.PI/180),y:y+sx*Math.sin(rot*Math.PI/180),h,s,rot})},EDG=meshes.map(vdEdges);
 const rect=(l,x0,y0,x1,y1)=>{L(l,x0,y0,x1,y0);L(l,x1,y0,x1,y1);L(l,x1,y1,x0,y1);L(l,x0,y1,x0,y0)};
 rect('A-FRAME',5*N,5*N,415*N,292*N);rect('A-FRAME',10*N,10*N,410*N,287*N);
 const tick=(x,y)=>L('A-DIM',x-N,y-N,x+N,y+N);
 const dimH=(x1,x2,y,txt)=>{L('A-DIM',x1,y,x2,y);tick(x1,y);tick(x2,y);T('A-DIM',(x1+x2)/2,y+1.2*N,2.5*N,txt,0,'c')},dimV=(y1,y2,x,txt)=>{L('A-DIM',x,y1,x,y2);tick(x,y1);tick(x,y2);T('A-DIM',x-1.2*N,(y1+y2)/2,2.5*N,txt,90,'c')};
 V.forEach((v,i)=>{const col=i%4,row=Math.floor(i/4),cx0=(10+col*100)*N,cy0=(287-(row+1)*138.5)*N,tx=cx0+42*N-(v.u0+v.u1)/2,ty=cy0+(69.25+12)*N-(v.v0+v.v1)/2;
  rect('A-FRAME',cx0,cy0,cx0+100*N,cy0+138.5*N);
  const r=vdView(meshes,EDG,v,N);r.vis.forEach(s=>L('A-VIS',s[0]+tx,s[1]+ty,s[2]+tx,s[3]+ty,i));r.cut.forEach(s=>L('A-CUT',s[0]+tx,s[1]+ty,s[2]+tx,s[3]+ty,i));r.hatch.forEach(s=>L('A-HATCH',s[0]+tx,s[1]+ty,s[2]+tx,s[3]+ty,i));
  const xl=v.u0+tx,xr=v.u1+tx,yb=v.v0+ty,yt=v.v1+ty;
  L('A-DIM',xl,yb-N,xl,yb-9.5*N);L('A-DIM',xr,yb-N,xr,yb-9.5*N);L('A-DIM',xr+N,yb,xr+9.5*N,yb);L('A-DIM',xr+N,yt,xr+9.5*N,yt);
  dimH(xl,xr,yb-8*N,String(Math.round(v.w)));dimV(yb,yt,xr+8*N,String(Math.round(v.h)));
  if(cfg.ground&&Math.abs(v.d[1])<1e-6){const gy=cfg.ground.y*1000+ty;if(gy>cy0+16*N&&gy<cy0+138*N){L('A-GROUND',cx0+2*N,gy,cx0+98*N,gy);T('A-TEXT',cx0+3*N,gy+1.2*N,2.5*N,cfg.ground.label)}}
  cfg.cuts.forEach(c=>{const n=c.d;if(Math.abs(vdDot(n,v.d))>1e-6)return;const dir=vdNorm(vdCross(n,v.d)),p0=c.p.map(x=>x*1000),u0=vdDot(p0,v.ax),w0=vdDot(p0,v.ay),du=vdDot(dir,v.ax),dv=vdDot(dir,v.ay),cu=(v.u0+v.u1)/2,cv=(v.v0+v.v1)/2,ext=(Math.abs(du)*v.w+Math.abs(dv)*v.h)/2+4*N+Math.hypot(u0-cu,w0-cv),ar=[-vdDot(n,v.ax),-vdDot(n,v.ay)];
   const E=[[u0-du*ext+tx,w0-dv*ext+ty],[u0+du*ext+tx,w0+dv*ext+ty]];L('A-SECT',E[0][0],E[0][1],E[1][0],E[1][1]);
   E.forEach(([ex,ey])=>{const tx2=ex+ar[0]*8*N,ty2=ey+ar[1]*8*N,an=Math.atan2(ty2-ey,tx2-ex);L('A-SECT',ex,ey,tx2,ty2);L('A-SECT',tx2,ty2,tx2-2.5*N*Math.cos(an-.4),ty2-2.5*N*Math.sin(an-.4));L('A-SECT',tx2,ty2,tx2-2.5*N*Math.cos(an+.4),ty2-2.5*N*Math.sin(an+.4));T('A-TEXT',ex+ar[0]*12*N-1.2*N,ey+ar[1]*12*N-1.5*N,4*N,c.n)})});
  T('A-TEXT',cx0+3*N,cy0+12*N,4*N,v.n);T('A-TEXT',cx0+3*N,cy0+6*N,3*N,'SCALE 1:'+N)});
 const bx=(10+300)*N,by=10*N,flat=(o,p,r)=>{for(const k in o){const q=o[k];if(q&&typeof q=='object'&&!Array.isArray(q))flat(q,p+k+'.',r);else r.push(p+k+': '+(Array.isArray(q)?q.join(', '):q))}return r};
 T('A-TEXT',bx+3*N,by+128*N,5*N,'EVLab 3D Hub');T('A-TEXT',bx+3*N,by+120*N,4*N,cfg.title);T('A-TEXT',bx+3*N,by+114*N,2.5*N,cfg.name);
 flat(cfg.spec||{},'',[]).filter(s=>!/^(name|units|groups|animations|note)/.test(s)).slice(0,17).forEach((s,k)=>T('A-TEXT',bx+3*N,by+107*N-k*5.5*N,2.5*N,s.slice(0,46)));
 T('A-TEXT',bx+3*N,by+11*N,3*N,'SCALE 1:'+N+'   UNITS: mm   SHEET '+(cfg.sheet||'1/1'));T('A-TEXT',bx+3*N,by+6*N,2.2*N,new Date().toISOString().slice(0,10)+'  Indicative drawing from the 3D model.');T('A-TEXT',bx+3*N,by+2.5*N,2.2*N,'Verify all dimensions before manufacture or construction.');
 return sh}
const VDL={'A-VIS':[7,'CONTINUOUS','#000',1.6],'A-CUT':[1,'CONTINUOUS','#c00',3.2],'A-HATCH':[3,'CONTINUOUS','#0a7',.9],'A-DIM':[5,'CONTINUOUS','#00a',1],'A-TEXT':[7,'CONTINUOUS','#000',1],'A-SECT':[1,'DASHDOT','#c00',1.8],'A-GROUND':[8,'DASHED','#555',2],'A-FRAME':[8,'CONTINUOUS','#999',1]};
function vdDXF(sh){const o=[],f=x=>(+x).toFixed(3),p=(c,v)=>{o.push(String(c));o.push(String(v))},N=sh.N;
 p(0,'SECTION');p(2,'HEADER');p(9,'$ACADVER');p(1,'AC1009');p(9,'$EXTMIN');p(10,0);p(20,0);p(30,0);p(9,'$EXTMAX');p(10,f(sh.W));p(20,f(sh.H));p(30,0);p(0,'ENDSEC');
 p(0,'SECTION');p(2,'TABLES');
 p(0,'TABLE');p(2,'LTYPE');p(70,3);
 p(0,'LTYPE');p(2,'CONTINUOUS');p(70,0);p(3,'Solid line');p(72,65);p(73,0);p(40,0);
 p(0,'LTYPE');p(2,'DASHED');p(70,0);p(3,'Dashed');p(72,65);p(73,2);p(40,f(9*N));p(49,f(6*N));p(49,f(-3*N));
 p(0,'LTYPE');p(2,'DASHDOT');p(70,0);p(3,'Dash dot');p(72,65);p(73,4);p(40,f(15*N));p(49,f(9*N));p(49,f(-3*N));p(49,0);p(49,f(-3*N));p(0,'ENDTAB');
 const ks=Object.keys(VDL);p(0,'TABLE');p(2,'LAYER');p(70,ks.length);ks.forEach(k=>{p(0,'LAYER');p(2,k);p(70,0);p(62,VDL[k][0]);p(6,VDL[k][1])});p(0,'ENDTAB');
 p(0,'TABLE');p(2,'STYLE');p(70,1);p(0,'STYLE');p(2,'STANDARD');p(70,0);p(40,0);p(41,1);p(50,0);p(71,0);p(42,f(2.5*N));p(3,'txt');p(4,'');p(0,'ENDTAB');p(0,'ENDSEC');
 p(0,'SECTION');p(2,'ENTITIES');
 sh.items.forEach(it=>{if(it.t=='L'){p(0,'LINE');p(8,it.l);p(10,f(it.x1));p(20,f(it.y1));p(30,0);p(11,f(it.x2));p(21,f(it.y2));p(31,0)}
  else{p(0,'TEXT');p(8,it.l);p(10,f(it.x));p(20,f(it.y));p(30,0);p(40,f(it.h));p(1,it.s);if(it.rot)p(50,f(it.rot))}});
 p(0,'ENDSEC');p(0,'EOF');return o.join('\n')+'\n'}
function vdCanvas(sh){const k=6/sh.N,c=document.createElement('canvas');c.width=Math.round(420*6);c.height=Math.round(297*6);const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.lineCap='round';
 const X=v=>v*k,Y=v=>(sh.H-v)*k;
 for(const it of sh.items){const st=VDL[it.l]||VDL['A-VIS'];if(it.t=='L'){x.strokeStyle=st[2];x.lineWidth=st[3];x.setLineDash(st[1]=='DASHED'?[16,6]:st[1]=='DASHDOT'?[30,8,4,8]:[]);x.beginPath();x.moveTo(X(it.x1),Y(it.y1));x.lineTo(X(it.x2),Y(it.y2));x.stroke()}
  else{x.save();x.setLineDash([]);x.fillStyle=st[2];x.font=Math.max(6,it.h*k)+'px Arial';x.translate(X(it.x),Y(it.y));if(it.rot)x.rotate(-it.rot*Math.PI/180);x.fillText(it.s,0,0);x.restore()}}return c}
/* ===== software export: Blender add-on, SketchUp extension, AutoCAD LSP + 3D DXF, Revit script, IFC, DAE, STL (units mm, Z-up) ===== */
const zU=(x,y,z)=>[x,-z,y],f3=x=>(+x).toFixed(3),san=s=>String(s).replace(/[^A-Za-z0-9_\-]/g,'_'),r2=x=>Math.round(x*100)/100;
function evExtract(model,clipsFn){model.updateMatrixWorld(true);const anims=[],tn=new Set();
 if(clipsFn){try{for(const c of clipsFn()){const tr=c.tracks.map(t=>{const k=t.name.lastIndexOf('.');return{node:t.name.slice(0,k),prop:t.name.slice(k+1),times:Array.from(t.times),values:Array.from(t.values)}});tr.forEach(t=>tn.add(t.node));anims.push({name:c.name,tracks:tr})}}catch(e){}}
 const nodes={};tn.forEach(n=>{const o=model.getObjectByName(n);if(!o)return;const e=o.matrixWorld.elements,q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().extractRotation(o.matrixWorld));nodes[n]={pos:[e[12]*1000,e[13]*1000,e[14]*1000],q:[q.x,q.y,q.z,q.w],lp:o.position.toArray()}});
 const meshes=[],v3=new THREE.Vector3();
 model.traverse(o=>{if(!o.isMesh)return;let p=o,ok=true;while(p){if(!p.visible){ok=false;break}if(p===model)break;p=p.parent}if(!ok)return;
  const path=[];let anc=null;for(p=o.parent;p&&p!==model;p=p.parent){if(p.name){path.unshift(p.name);if(!anc&&nodes[p.name])anc=p}}
  const m=o.material,g=o.geometry,pa=g.attributes.position;let col=m.color?[m.color.r,m.color.g,m.color.b]:[.7,.7,.7];
  if(m.map&&m.map.image&&m.map.image.getContext){try{const cv=m.map.image,d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;let r=0,gg=0,b=0,n=0;for(let i=0;i<d.length;i+=64){r+=d[i];gg+=d[i+1];b+=d[i+2];n++}col=[r/n/255,gg/n/255,b/n/255]}catch(e){}}
  const P=new Float64Array(pa.count*3),PL=anc?new Float64Array(pa.count*3):null,mm=anc?new THREE.Matrix4().multiplyMatrices(new THREE.Matrix4().copy(anc.matrixWorld).invert(),o.matrixWorld):null;
  for(let i=0;i<pa.count;i++){v3.set(pa.getX(i),pa.getY(i),pa.getZ(i));if(anc){const l=v3.clone().applyMatrix4(mm);PL[3*i]=l.x;PL[3*i+1]=l.y;PL[3*i+2]=l.z}v3.applyMatrix4(o.matrixWorld);P[3*i]=v3.x*1000;P[3*i+1]=v3.y*1000;P[3*i+2]=v3.z*1000}
  meshes.push({top:path[0]||o.name||'Part',node:anc?anc.name:'',col,op:m.transparent?m.opacity:1,met:m.metalness||0,rou:m.roughness==null?.6:m.roughness,P,PL,T:g.index?Array.from(g.index.array):Array.from({length:pa.count},(_,i)=>i)})});
 return{meshes,nodes,anims}}
function evCluster(d,local){const M=new Map();for(const m of d.meshes){const useL=local&&m.node,k=m.top+'|'+(local?m.node:'')+'|'+m.col.map(x=>x.toFixed(2))+'|'+m.op.toFixed(2);let c=M.get(k);if(!c){c={top:m.top,node:local?m.node:'',col:m.col,op:m.op,met:m.met,rou:m.rou,P:[],T:[]};M.set(k,c)}
  const src=useL?m.PL:m.P,off=c.P.length/3;for(let i=0;i<src.length;i+=3){const z=zU(src[i],src[i+1],src[i+2]);c.P.push(r2(z[0]),r2(z[1]),r2(z[2]))}for(const t of m.T)c.T.push(t+off)}
 const out=[...M.values()];out.forEach((c,i)=>c.name=san(c.top)+(c.node?'_'+san(c.node):'')+'_'+(i+1));return out}
const aci=c=>{const p=[[1,[1,0,0]],[2,[1,1,0]],[3,[0,1,0]],[4,[0,1,1]],[5,[0,0,1]],[6,[1,0,1]],[7,[1,1,1]],[8,[.3,.3,.3]],[9,[.6,.6,.6]],[30,[1,.5,0]],[34,[.5,.3,.1]],[250,[.2,.2,.2]]];let b=7,bd=1e9;for(const [i,q] of p){const d=(q[0]-c[0])**2+(q[1]-c[1])**2+(q[2]-c[2])**2;if(d<bd){bd=d;b=i}}return b};
function genSTL(cl){let n=0;cl.forEach(c=>n+=c.T.length/3);const b=new ArrayBuffer(84+50*n),dv=new DataView(b);dv.setUint32(80,n,true);let o=84;
 for(const c of cl)for(let t=0;t<c.T.length;t+=3){const a=c.T[t]*3,bb=c.T[t+1]*3,cc=c.T[t+2]*3,P=c.P,ux=P[bb]-P[a],uy=P[bb+1]-P[a+1],uz=P[bb+2]-P[a+2],vx=P[cc]-P[a],vy=P[cc+1]-P[a+1],vz=P[cc+2]-P[a+2];let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const l=Math.hypot(nx,ny,nz)||1;
  [nx/l,ny/l,nz/l,P[a],P[a+1],P[a+2],P[bb],P[bb+1],P[bb+2],P[cc],P[cc+1],P[cc+2]].forEach(x=>{dv.setFloat32(o,x,true);o+=4});o+=2}return new Uint8Array(b)}
function genDAE(cl,name){const x=['<?xml version="1.0" encoding="UTF-8"?>\n<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1"><asset><contributor><authoring_tool>EVLab 3D Hub</authoring_tool></contributor><unit name="millimeter" meter="0.001"/><up_axis>Z_UP</up_axis></asset>'];
 x.push('<library_effects>');cl.forEach((c,i)=>x.push('<effect id="e'+i+'"><profile_COMMON><technique sid="common"><phong><diffuse><color>'+c.col.map(v=>v.toFixed(3)).join(' ')+' 1</color></diffuse><transparent opaque="A_ONE"><color>1 1 1 '+c.op.toFixed(2)+'</color></transparent></phong></technique></profile_COMMON></effect>'));x.push('</library_effects><library_materials>');
 cl.forEach((c,i)=>x.push('<material id="m'+i+'" name="'+c.name+'"><instance_effect url="#e'+i+'"/></material>'));x.push('</library_materials><library_geometries>');
 cl.forEach((c,i)=>x.push('<geometry id="g'+i+'" name="'+c.name+'"><mesh><source id="g'+i+'p"><float_array id="g'+i+'pa" count="'+c.P.length+'">'+c.P.join(' ')+'</float_array><technique_common><accessor source="#g'+i+'pa" count="'+c.P.length/3+'" stride="3"><param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/></accessor></technique_common></source><vertices id="g'+i+'v"><input semantic="POSITION" source="#g'+i+'p"/></vertices><triangles material="mat" count="'+c.T.length/3+'"><input semantic="VERTEX" source="#g'+i+'v" offset="0"/><p>'+c.T.join(' ')+'</p></triangles></mesh></geometry>'));
 x.push('</library_geometries><library_visual_scenes><visual_scene id="S" name="'+san(name)+'">');const tops=[...new Set(cl.map(c=>c.top))];
 tops.forEach(t=>{x.push('<node id="n_'+san(t)+'" name="'+san(t)+'">');cl.forEach((c,i)=>{if(c.top===t)x.push('<node id="c'+i+'" name="'+c.name+'"><instance_geometry url="#g'+i+'"><bind_material><technique_common><instance_material symbol="mat" target="#m'+i+'"/></technique_common></bind_material></instance_geometry></node>')});x.push('</node>')});
 x.push('</visual_scene></library_visual_scenes><scene><instance_visual_scene url="#S"/></scene></COLLADA>');return x.join('')}
const ifcGuid=()=>{const A='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';let s=A[Math.floor(Math.random()*4)];for(let i=0;i<21;i++)s+=A[Math.floor(Math.random()*64)];return s};
function genIFC(cl,name,spec){const L=[];let n=0;const E=s=>{L.push('#'+(++n)+'='+s+';');return n},q=s=>"'"+String(s).replace(/'/g,"''")+"'";
 const o=E('IFCCARTESIANPOINT((0.,0.,0.))'),dz=E('IFCDIRECTION((0.,0.,1.))'),dx=E('IFCDIRECTION((1.,0.,0.))'),ax=E('IFCAXIS2PLACEMENT3D(#'+o+',#'+dz+',#'+dx+')'),ctx=E('IFCGEOMETRICREPRESENTATIONCONTEXT($,\'Model\',3,1.E-05,#'+ax+',$)'),sub=E('IFCGEOMETRICREPRESENTATIONSUBCONTEXT(\'Body\',\'Model\',*,*,*,*,#'+ctx+',$,.MODEL_VIEW.,$)');
 const u1=E('IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.)'),u2=E('IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)'),u3=E('IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)'),u4=E('IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.)'),ua=E('IFCUNITASSIGNMENT((#'+u1+',#'+u2+',#'+u3+',#'+u4+'))');
 const pr=E('IFCPROJECT(\''+ifcGuid()+'\',$,'+q(name)+',$,$,$,$,(#'+ctx+'),#'+ua+')'),p0=E('IFCLOCALPLACEMENT($,#'+ax+')'),site=E('IFCSITE(\''+ifcGuid()+'\',$,\'Site\',$,$,#'+p0+',$,$,.ELEMENT.,$,$,$,$,$)'),p1=E('IFCLOCALPLACEMENT(#'+p0+',#'+ax+')'),bld=E('IFCBUILDING(\''+ifcGuid()+'\',$,\'Building\',$,$,#'+p1+',$,$,.ELEMENT.,$,$,$)'),p2=E('IFCLOCALPLACEMENT(#'+p1+',#'+ax+')'),st=E('IFCBUILDINGSTOREY(\''+ifcGuid()+'\',$,\'Level 0\',$,$,#'+p2+',$,$,.ELEMENT.,0.)');
 E('IFCRELAGGREGATES(\''+ifcGuid()+'\',$,$,$,#'+pr+',(#'+site+'))');E('IFCRELAGGREGATES(\''+ifcGuid()+'\',$,$,$,#'+site+',(#'+bld+'))');E('IFCRELAGGREGATES(\''+ifcGuid()+'\',$,$,$,#'+bld+',(#'+st+'))');
 const props=[];(function fl(o2,p){for(const k in o2){const v=o2[k];if(v&&typeof v=='object'&&!Array.isArray(v))fl(v,p+k+'.');else props.push([p+k,Array.isArray(v)?v.join(', '):v])}})(spec||{},'');
 if(!props.length)props.push(['name',name]);const pl=props.slice(0,40).map(([k,v])=>E('IFCPROPERTYSINGLEVALUE('+q(k)+',$,IFCLABEL('+q(v)+'),$)')),ps=E('IFCPROPERTYSET(\''+ifcGuid()+'\',$,\'EVLab_Parameters\',$,('+pl.map(i=>'#'+i).join(',')+'))'),els=[];
 for(const t of [...new Set(cl.map(c=>c.top))]){const items=[];for(const c of cl){if(c.top!==t)continue;const pts=[];for(let i=0;i<c.P.length;i+=3)pts.push('('+f3(c.P[i])+','+f3(c.P[i+1])+','+f3(c.P[i+2])+')');const idx=[];for(let i=0;i<c.T.length;i+=3)idx.push('('+(c.T[i]+1)+','+(c.T[i+1]+1)+','+(c.T[i+2]+1)+')');
   const pa=E('IFCCARTESIANPOINTLIST3D(('+pts.join(',')+'))'),fs=E('IFCTRIANGULATEDFACESET(#'+pa+',$,$,('+idx.join(',')+'),$)'),col=E('IFCCOLOURRGB($,'+c.col.map(v=>v.toFixed(3)).join(',')+')'),sr=E('IFCSURFACESTYLERENDERING(#'+col+','+(1-c.op).toFixed(2)+',$,$,$,$,$,$,.NOTDEFINED.)'),ss=E('IFCSURFACESTYLE($,.BOTH.,(#'+sr+'))');E('IFCSTYLEDITEM(#'+fs+',(#'+ss+'),$)');items.push(fs)}
  const rep=E('IFCSHAPEREPRESENTATION(#'+sub+',\'Body\',\'Tessellation\',('+items.map(i=>'#'+i).join(',')+'))'),pd=E('IFCPRODUCTDEFINITIONSHAPE($,$,(#'+rep+'))'),lp=E('IFCLOCALPLACEMENT(#'+p2+',#'+ax+')');els.push(E('IFCBUILDINGELEMENTPROXY(\''+ifcGuid()+'\',$,'+q(t)+',$,$,#'+lp+',#'+pd+',$,.NOTDEFINED.)'))}
 const el='('+els.map(i=>'#'+i).join(',')+')';E('IFCRELDEFINESBYPROPERTIES(\''+ifcGuid()+'\',$,$,$,'+el+',#'+ps+')');E('IFCRELCONTAINEDINSPATIALSTRUCTURE(\''+ifcGuid()+'\',$,$,$,'+el+',#'+st+')');
 return"ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');\nFILE_NAME('"+san(name)+".ifc','"+new Date().toISOString().slice(0,19)+"',('EVLab'),('EVLab 3D Hub'),'EVLab 3D Hub','EVLab 3D Hub','');\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\n"+L.join('\n')+"\nENDSEC;\nEND-ISO-10303-21;\n"}
function genDXF3D(cl,name){const o=[],p=(c,v)=>{o.push(String(c));o.push(String(v))},tops=[...new Set(cl.map(c=>c.top))],lay=t=>'EVLAB_'+san(t).slice(0,22);
 p(0,'SECTION');p(2,'HEADER');p(9,'$ACADVER');p(1,'AC1009');p(0,'ENDSEC');p(0,'SECTION');p(2,'TABLES');p(0,'TABLE');p(2,'LTYPE');p(70,1);p(0,'LTYPE');p(2,'CONTINUOUS');p(70,0);p(3,'Solid line');p(72,65);p(73,0);p(40,0);p(0,'ENDTAB');
 p(0,'TABLE');p(2,'LAYER');p(70,tops.length);tops.forEach(t=>{const c=cl.find(k=>k.top===t);p(0,'LAYER');p(2,lay(t));p(70,0);p(62,aci(c.col));p(6,'CONTINUOUS')});p(0,'ENDTAB');p(0,'ENDSEC');p(0,'SECTION');p(2,'ENTITIES');
 for(const c of cl)for(let t=0;t<c.T.length;t+=3){const a=c.T[t]*3,b=c.T[t+1]*3,d=c.T[t+2]*3,P=c.P;p(0,'3DFACE');p(8,lay(c.top));p(62,aci(c.col));
  [[10,a],[11,b],[12,d],[13,d]].forEach(([g,i])=>{p(g,f3(P[i]));p(g+10,f3(P[i+1]));p(g+20,f3(P[i+2]))})}
 p(0,'ENDSEC');p(0,'EOF');return o.join('\n')+'\n'}
function genLSP(cl,sh,name){const out=[';;; EVLab 3D Hub - '+name+'\n;;; AutoCAD / Civil 3D / BricsCAD: APPLOAD this file, then type EVLAB-3D (3D faces) or EVLAB-2D (plan, sections, elevations) or EVLAB-ALL.',
 '(defun evl-layer (n c) (if (not (tblsearch "LAYER" n)) (entmake (list (quote (0 . "LAYER")) (quote (100 . "AcDbSymbolTableRecord")) (quote (100 . "AcDbLayerTableRecord")) (cons 2 n) (quote (70 . 0)) (cons 62 c) (quote (6 . "Continuous"))))))',
 '(defun evl-face (l p1 p2 p3) (entmake (list (quote (0 . "3DFACE")) (cons 8 l) (cons 10 p1) (cons 11 p2) (cons 12 p3) (cons 13 p3))))',
 '(defun evl-line (l x1 y1 x2 y2) (entmake (list (quote (0 . "LINE")) (cons 8 l) (cons 10 (list x1 y1 0.0)) (cons 11 (list x2 y2 0.0)))))',
 '(defun evl-text (l x y h s r) (entmake (list (quote (0 . "TEXT")) (cons 8 l) (cons 10 (list x y 0.0)) (cons 40 h) (cons 1 s) (cons 50 r))))'];
 const lay=t=>'EVLAB_'+san(t).slice(0,22),tops=[...new Set(cl.map(c=>c.top))],ch=[];let cur=[],k=0;
 const flush=()=>{if(!cur.length)return;k++;ch.push('evl-3d-'+k);out.push('(defun evl-3d-'+k+' () '+cur.join('\n')+')');cur=[]};
 for(const c of cl)for(let t=0;t<c.T.length;t+=3){const P=c.P,pt=i=>'(quote ('+f3(P[i*3])+' '+f3(P[i*3+1])+' '+f3(P[i*3+2])+'))';cur.push('(evl-face "'+lay(c.top)+'" '+pt(c.T[t])+' '+pt(c.T[t+1])+' '+pt(c.T[t+2])+')');if(cur.length>=1500)flush()}flush();
 out.push('(defun c:EVLAB-3D () '+tops.map(t=>'(evl-layer "'+lay(t)+'" '+aci(cl.find(c=>c.top===t).col)+')').join(' ')+' '+ch.map(f=>'('+f+')').join(' ')+' (command "_.ZOOM" "_E") (princ "\\nEVLab 3D model created.") (princ))');
 const sc={'A-VIS':7,'A-CUT':1,'A-HATCH':3,'A-DIM':5,'A-TEXT':7,'A-SECT':1,'A-GROUND':8,'A-FRAME':8},c2=[];let cur2=[],k2=0;const fl2=()=>{if(!cur2.length)return;k2++;c2.push('evl-2d-'+k2);out.push('(defun evl-2d-'+k2+' () '+cur2.join('\n')+')');cur2=[]};
 for(const it of sh.items){cur2.push(it.t=='L'?'(evl-line "'+it.l+'" '+f3(it.x1)+' '+f3(it.y1)+' '+f3(it.x2)+' '+f3(it.y2)+')':'(evl-text "'+it.l+'" '+f3(it.x)+' '+f3(it.y)+' '+f3(it.h)+' "'+String(it.s).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'" '+f3((it.rot||0)*Math.PI/180)+')');if(cur2.length>=1500)fl2()}fl2();
 out.push('(defun c:EVLAB-2D () '+Object.keys(sc).map(l=>'(evl-layer "'+l+'" '+sc[l]+')').join(' ')+' '+c2.map(f=>'('+f+')').join(' ')+' (command "_.ZOOM" "_E") (princ "\\nEVLab drawings created (plan, sections, elevations).") (princ))');
 out.push('(defun c:EVLAB-ALL () (c:EVLAB-3D) (c:EVLAB-2D))\n(princ "\\nEVLab loaded: EVLAB-3D, EVLAB-2D, EVLAB-ALL")\n(princ)');return out.join('\n')+'\n'}
function genBlender(cl,d,name,spec){const nodes={};for(const n in d.nodes)nodes[n]={pos:d.nodes[n].pos.map(r2),q:d.nodes[n].q,lp:d.nodes[n].lp};
 const CL=cl.map(c=>({name:c.name,top:c.top,node:c.node,col:c.col.map(v=>+v.toFixed(3)),op:+c.op.toFixed(2),met:+c.met.toFixed(2),rou:+c.rou.toFixed(2),v:c.P,f:c.T}));
 return`bl_info={"name":"EVLab ${san(name)}","author":"EVLab 3D Hub","version":(1,0,0),"blender":(2,80,0),"location":"View3D > Add > Mesh","description":"EVLab model with groups, materials, parameters and Open/Close actions","category":"Add Mesh"}
# Install: Edit > Preferences > Add-ons > Install... or open in the Scripting tab and press Alt+P.
import bpy, json
NAME=${JSON.stringify(name)}
PARAMS=json.loads(${JSON.stringify(JSON.stringify(spec||{}))})
NODES=json.loads(${JSON.stringify(JSON.stringify(nodes))})
ANIMS=json.loads(${JSON.stringify(JSON.stringify(d.anims))})
CL=json.loads(${JSON.stringify(JSON.stringify(CL))})
S=0.001
def zup(x,y,z): return (x*S,-z*S,y*S)
def build(ctx):
    coll=bpy.data.collections.new(NAME); ctx.scene.collection.children.link(coll)
    root=bpy.data.objects.new(NAME,None); coll.objects.link(root); root["evlab_parameters"]=json.dumps(PARAMS)
    tops={}; nodes={}; mats={}
    def top_of(t):
        if t not in tops:
            e=bpy.data.objects.new(t,None); e.parent=root; coll.objects.link(e); tops[t]=e
        return tops[t]
    for n,v in NODES.items():
        e=bpy.data.objects.new(n,None); coll.objects.link(e); nodes[n]=e
        e.location=zup(*v["pos"]); e.rotation_mode='QUATERNION'; qx,qy,qz,qw=v["q"]; e.rotation_quaternion=(qw,qx,-qz,qy)
    for c in CL:
        key=(tuple(c["col"]),c["op"])
        if key not in mats:
            m=bpy.data.materials.new("EVLab_%d"%len(mats)); m.use_nodes=True; b=m.node_tree.nodes.get("Principled BSDF")
            if b:
                b.inputs["Base Color"].default_value=(c["col"][0],c["col"][1],c["col"][2],1.0); b.inputs["Metallic"].default_value=c["met"]; b.inputs["Roughness"].default_value=c["rou"]
                if c["op"]<1.0:
                    b.inputs["Alpha"].default_value=c["op"]
                    try: m.blend_method='BLEND'
                    except Exception: pass
            m.diffuse_color=(c["col"][0],c["col"][1],c["col"][2],c["op"]); mats[key]=m
        vs=c["v"]; verts=[(vs[i]*S,vs[i+1]*S,vs[i+2]*S) for i in range(0,len(vs),3)]; fs=c["f"]; faces=[tuple(fs[i:i+3]) for i in range(0,len(fs),3)]
        me=bpy.data.meshes.new(c["name"]); me.from_pydata(verts,[],faces); me.update(); me.materials.append(mats[key])
        ob=bpy.data.objects.new(c["name"],me); coll.objects.link(ob)
        if c["node"] in nodes:
            nd=nodes[c["node"]]
            if nd.parent is None: nd.parent=top_of(c["top"])
            ob.parent=nd
        else: ob.parent=top_of(c["top"])
    fps=24; acts={}
    for a in ANIMS:
        for t in a["tracks"]:
            ob=nodes.get(t["node"])
            if ob is None: continue
            nd=NODES[t["node"]]; key=(a["name"],t["node"])
            if key not in acts:
                acts[key]=bpy.data.actions.new(a["name"]+"_"+t["node"])
            act=acts[key]; vals=t["values"]; times=t["times"]
            if t["prop"]=="quaternion": comps=4; path="rotation_quaternion"
            else: comps=3; path="location" if t["prop"]=="position" else "scale"
            for k in range(len(times)):
                v=vals[k*comps:(k+1)*comps]
                if path=="rotation_quaternion": out=(v[3],v[0],-v[2],v[1])
                elif path=="location":
                    lp=nd["lp"]; dx,dy,dz=v[0]-lp[0],v[1]-lp[1],v[2]-lp[2]; w=nd["pos"]; out=zup(w[0]+dx,w[1]+dy,w[2]+dz)
                else: out=(v[0],v[2],v[1])
                for i in range(comps):
                    fc=act.fcurves.find(path,index=i) or act.fcurves.new(path,index=i)
                    fc.keyframe_points.insert(1+times[k]*fps,out[i])
            ob.animation_data_create()
            if a["name"]=="Open": ob.animation_data.action=act
            else: act.use_fake_user=True
    ctx.scene.frame_start=1; ctx.scene.frame_end=25
class EVLAB_OT_add(bpy.types.Operator):
    bl_idname="mesh.add_evlab_model"; bl_label="EVLab ${san(name)}"; bl_options={'REGISTER','UNDO'}
    def execute(self,context): build(context); return {'FINISHED'}
def menu_func(self,context): self.layout.operator(EVLAB_OT_add.bl_idname,icon='MESH_CUBE')
def register(): bpy.utils.register_class(EVLAB_OT_add); bpy.types.VIEW3D_MT_mesh_add.append(menu_func)
def unregister(): bpy.types.VIEW3D_MT_mesh_add.remove(menu_func); bpy.utils.unregister_class(EVLAB_OT_add)
if __name__=="__main__":
    register(); build(bpy.context)
`}
function genRevit(cl,name,spec){const C=cl.map(c=>[c.name,c.top,c.col.map(v=>+v.toFixed(3)),c.P,c.T]);
 return`# -*- coding: utf-8 -*-
# EVLab ${san(name)} -> Revit (pyRevit / RevitPythonShell). Creates one DirectShape (Generic Model) per group and colour.
# Open a project (or a Family-free Generic Model workflow), run this script. It is NOT a parametric .rfa family.
import clr, json
clr.AddReference('RevitAPI')
from System.Collections.Generic import List
from Autodesk.Revit.DB import *
doc=__revit__.ActiveUIDocument.Document
F=1.0/304.8
PARAMS=json.loads(${JSON.stringify(JSON.stringify(spec||{}))})
DATA=json.loads(${JSON.stringify(JSON.stringify(C))})
t=Transaction(doc,'EVLab ${san(name)}'); t.Start()
for name,top,col,P,T in DATA:
    b=TessellatedShapeBuilder(); b.OpenConnectedFaceSet(False)
    for i in range(0,len(T),3):
        pts=List[XYZ]([XYZ(P[T[i+k]*3]*F,P[T[i+k]*3+1]*F,P[T[i+k]*3+2]*F) for k in range(3)])
        try: b.AddFace(TessellatedFace(pts,ElementId.InvalidElementId))
        except Exception: pass
    b.CloseConnectedFaceSet(); b.Target=TessellatedShapeBuilderTarget.AnyGeometry; b.Fallback=TessellatedShapeBuilderFallback.Mesh
    try: b.Build()
    except Exception: continue
    ds=DirectShape.CreateElement(doc,ElementId(BuiltInCategory.OST_GenericModel))
    ds.SetShape(b.GetBuildResult().GetGeometricalObjects()); ds.Name=name
    for bip,val in ((BuiltInParameter.ALL_MODEL_MARK,top),(BuiltInParameter.ALL_MODEL_INSTANCE_COMMENTS,json.dumps(PARAMS)[:250])):
        p=ds.get_Parameter(bip)
        if p is not None and not p.IsReadOnly: p.Set(val)
t.Commit()
`}
function genSketchUp(cl,name,spec){const id=san(name).toLowerCase().slice(0,40),C=cl.map(c=>[c.name,c.top,c.col.map(v=>+v.toFixed(3)),c.op,c.P,c.T]);
 const loader=`require 'sketchup.rb'
require 'extensions.rb'
module EVLab
  module M_${id.replace(/[^a-z0-9]/g,'_')}
    unless file_loaded?(__FILE__)
      ex=SketchupExtension.new('EVLab ${name}','evlab_${id}/main')
      ex.description='EVLab 3D Hub model: ${name}'; ex.version='1.0.0'; ex.creator='EVLab 3D Hub'
      Sketchup.register_extension(ex,true)
      file_loaded(__FILE__)
    end
  end
end
`,main=`require 'sketchup.rb'
require 'json'
module EVLab
  module M_${id.replace(/[^a-z0-9]/g,'_')}
    PARAMS=JSON.parse(${JSON.stringify(JSON.stringify(spec||{}))})
    DATA=JSON.parse(${JSON.stringify(JSON.stringify(C))})
    def self.insert
      model=Sketchup.active_model; model.start_operation('Insert EVLab ${name}',true)
      root=model.entities.add_group; root.name='${name}'
      PARAMS.each{|k,v| root.set_attribute('EVLab',k.to_s,v.to_s)}
      tops={}
      DATA.each do |nm,top,col,op,pts,tri|
        tops[top]||=(g=root.entities.add_group; g.name=top; g)
        g=tops[top].entities.add_group; g.name=nm
        mat=model.materials.add('EVLab_'+nm); mat.color=Sketchup::Color.new((col[0]*255).round,(col[1]*255).round,(col[2]*255).round); mat.alpha=op
        mesh=Geom::PolygonMesh.new
        i=0
        while i<tri.length
          ids=(0..2).map{|k| j=tri[i+k]*3; mesh.add_point(Geom::Point3d.new(pts[j].mm,pts[j+1].mm,pts[j+2].mm))}
          mesh.add_polygon(ids) if ids.uniq.length==3
          i+=3
        end
        g.entities.add_faces_from_mesh(mesh,0,mat)
      end
      model.commit_operation
    end
    unless file_loaded?(__FILE__)
      UI.menu('Extensions').add_item('Insert EVLab ${name}'){ M_${id.replace(/[^a-z0-9]/g,'_')}.insert }
      file_loaded(__FILE__)
    end
  end
end
`;return{id,loader,main}}
function evReadme(name,spec,n){return'EVLab 3D Hub - software package: '+name+'\n'+'='.repeat(60)+`
Folders
  blender/   EVLab_*_addon.py   add-on: groups, materials, parameters, Open / Close actions
  sketchup/  EVLab_*.rbz         extension (Window > Extension Manager > Install Extension), then Extensions > Insert EVLab...
             EVLab_*.dae         COLLADA, File > Import
  autocad/   EVLab_*_3d.dxf      3D faces, one layer per group (AutoCAD, Civil 3D, BricsCAD: DXFIN / open)
             EVLab_*.lsp         AutoLISP: APPLOAD, then EVLAB-3D, EVLAB-2D (plan, sections, elevations) or EVLAB-ALL
             EVLab_*_drawings.dxf  vector drawing sheet (plan, 2 sections, 4 elevations)
  revit/     EVLab_*.ifc         IFC4 (Revit: Open or Link IFC; ArchiCAD, Navisworks, BIM 360 also read it)
             EVLab_*_revit.py    pyRevit / RevitPythonShell: Generic Model DirectShapes with parameters
  generic/   EVLab_*.stl         mesh for 3D printing, SolidWorks, Fusion
             bim-data.json       parameters, groups and animations for developers

Honest limits
  - Revit family (.rfa), SketchUp (.skp) and Blender (.blend) are binary files that only those programs write. This package gives you
    an add-on / extension / script that builds the model inside the program, not the native file.
  - The IFC and Revit script carry the geometry as meshes (Generic Model), not parametric family types.
  - Animations (Open / Close) are in the Blender add-on and in the GLB file. SketchUp, AutoCAD and Revit get the closed / rest pose.
  - Plant 3D, Civil 3D pipe networks, WaterGEMS need catalogs / hydraulic data (ports, specs). Not generated yet.
  - Z-up, millimetres. Dimensions are indicative, verify before manufacture or construction.
Triangles: `+n+'\n'}
function evBimJson(name,spec,d,cl){return JSON.stringify({name,units:'mm',axis:'Z-up',parameters:spec,groups:[...new Set(cl.map(c=>c.top))],animations:d.anims.map(a=>({name:a.name,nodes:[...new Set(a.tracks.map(t=>t.node))]})),clusters:cl.map(c=>({name:c.name,group:c.top,triangles:c.T.length/3,colour:c.col,opacity:c.op}))},null,1)}

/* ---------- page access ---------- */
const PV=n=>{try{if(window.EV_PAGE&&n in window.EV_PAGE)return window.EV_PAGE[n]}catch(e){}
 try{return new Function('return typeof '+n+'!=="undefined"?'+n+':undefined')()}catch(e){return undefined}};
const CFG=()=>window.EV_KIT||{};
const clipsFn=()=>{const c=PV('clips');return typeof c=='function'?c:null};
const dispName=m=>String(m&&m.name||'model').replace(/[^A-Za-z0-9_\-]/g,'_');

/* ---------- sheet ---------- */
function meshBox(ms){const mn=[1e18,1e18,1e18],mx=[-1e18,-1e18,-1e18];ms.forEach(m=>{const P=m.P;for(let i=0;i<P.length;i+=3)for(let k=0;k<3;k++){if(P[i+k]<mn[k])mn[k]=P[i+k];if(P[i+k]>mx[k])mx[k]=P[i+k]}});return{mn,mx,c:[0,1,2].map(k=>(mn[k]+mx[k])/2)}}
const STD=['PLAN','FRONT ELEVATION','BACK ELEVATION','LEFT ELEVATION','RIGHT ELEVATION'];
/* Returns one A3 sheet, or two when the page asks for more than two cuts (for example floor plans and sections of a building). */
function sheetsBuild(){const model=PV('model'),spec=PV('spec')||{},kc=CFG();if(!model)throw new Error('No model yet');
 const own=PV('sheetBuild');if(typeof own=='function'&&(document.getElementById('dw')||kc.useOwnSheet))return[own()];
 const ms=vdCollect(model);if(!ms.length)throw new Error('The model is empty');
 const bb=meshBox(ms),ce=bb.c.map(v=>v/1000);
 const cuts=kc.cuts?kc.cuts({centre:ce,min:bb.mn.map(v=>v/1000),max:bb.mx.map(v=>v/1000)}):[
  {n:'A',label:'SECTION A-A (vertical, through centre)',d:[1,0,0],up:[0,1,0],p:[ce[0],ce[1],ce[2]]},
  {n:'B',label:'SECTION B-B (vertical, through centre)',d:[0,0,1],up:[0,1,0],p:[ce[0],ce[1],ce[2]]}];
 const t=String(kc.title||document.title.replace(/^EVLab 3D Hub\s*[–-]\s*/,'')).toUpperCase(),base={model,spec,title:t,name:model.name||'',ground:kc.noGround?null:{y:0,label:kc.groundLabel||'FFL ±0.000'}};
 if(cuts.length<=2)return[vdBuild(ms,Object.assign({},base,{cuts}))];
 return[vdBuild(ms,Object.assign({},base,{cuts:cuts.slice(0,2),sheet:'1/2'})),vdBuild(ms,Object.assign({},base,{cuts:cuts.slice(2,4),skip:STD,ground:null,sheet:'2/2',title:t+' (SECTIONS)'}))]}
const sheetBuild=()=>sheetsBuild()[0];

function vdSVG(sh){const N=sh.N,k=6/N,esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),f=x=>(+x).toFixed(2);
 const o=['<?xml version="1.0" encoding="UTF-8"?>','<svg xmlns="http://www.w3.org/2000/svg" width="420mm" height="297mm" viewBox="0 0 '+f(sh.W)+' '+f(sh.H)+'" font-family="Arial, Helvetica, sans-serif"><rect width="'+f(sh.W)+'" height="'+f(sh.H)+'" fill="#fff"/>'];
 for(const it of sh.items){const st=VDL[it.l]||VDL['A-VIS'];
  if(it.t=='L'){const da=st[1]=='DASHED'?[16,6]:st[1]=='DASHDOT'?[30,8,4,8]:null;
   o.push('<line x1="'+f(it.x1)+'" y1="'+f(sh.H-it.y1)+'" x2="'+f(it.x2)+'" y2="'+f(sh.H-it.y2)+'" stroke="'+st[2]+'" stroke-width="'+f(st[3]/k)+'" stroke-linecap="round"'+(da?' stroke-dasharray="'+da.map(v=>f(v/k)).join(' ')+'"':'')+'/>')}
  else{const x=f(it.x),y=f(sh.H-it.y);o.push('<text x="'+x+'" y="'+y+'" font-size="'+f(Math.max(6/k,it.h))+'" fill="'+st[2]+'"'+(it.rot?' transform="rotate('+f(-it.rot)+' '+x+' '+y+')"':'')+'>'+esc(it.s)+'</text>')}}
 o.push('</svg>');return o.join('\n')}
function pngBytes(sh){const cv=vdCanvas(sh),b=atob(cv.toDataURL('image/png').split(',')[1]),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u}

/* ---------- parts list and parameters (CSV) ---------- */
const csvq=v=>{v=v==null?'':String(v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
function partsCSV(model){const rows=[['Group','Triangles','Width_mm (X)','Height_mm (Y)','Depth_mm (Z)']];model.updateMatrixWorld(true);
 const vis=o=>{for(let p=o;p;p=p.parent){if(!p.visible)return false;if(p===model)break}return true};
 const one=(name,obj)=>{let tri=0;obj.traverse(o=>{if(o.isMesh&&vis(o)){const g=o.geometry;tri+=g.index?g.index.count/3:g.attributes.position.count/3}});if(!tri)return;
  const b=new THREE.Box3().setFromObject(obj),s=b.getSize(new THREE.Vector3());rows.push([name,Math.round(tri),Math.round(s.x*1000),Math.round(s.y*1000),Math.round(s.z*1000)])};
 let loose=null;model.children.forEach((c,i)=>{if(!vis(c))return;if(c.isMesh){(loose=loose||new THREE.Group()).add(c.clone())}else one(c.name||('Part '+(i+1)),c)});
 if(loose)one('(loose parts)',loose);
 return rows.map(r=>r.map(csvq).join(',')).join('\n')+'\n'}
function paramsCSV(spec){const rows=[['Parameter','Value']];(function fl(o,p){for(const k in o){const v=o[k];if(v&&typeof v=='object'&&!Array.isArray(v))fl(v,p+k+'.');else rows.push([p+k,Array.isArray(v)?v.join(' / '):v])}})(spec||{},'');return rows.map(r=>r.map(csvq).join(',')).join('\n')+'\n'}

/* ---------- software package ---------- */
async function softPack(){const model=PV('model'),spec=PV('spec')||{},nm=dispName(model),e=new TextEncoder(),d=evExtract(model,clipsFn()),cl=evCluster(d,false),cb=evCluster(d,true),shs=sheetsBuild(),sh=shs[0],su=genSketchUp(cl,nm,spec),F=[];
 let n=0;cl.forEach(c=>n+=c.T.length/3);
 F.push({n:'README.txt',d:e.encode(evReadme(nm,spec,n))});
 F.push({n:'blender/EVLab_'+nm+'_addon.py',d:e.encode(genBlender(cb,d,nm,spec))});
 F.push({n:'sketchup/EVLab_'+nm+'.rbz',d:new Uint8Array(await zipStore([{n:'evlab_'+su.id+'.rb',d:e.encode(su.loader)},{n:'evlab_'+su.id+'/main.rb',d:e.encode(su.main)}]).arrayBuffer())});
 F.push({n:'sketchup/EVLab_'+nm+'.dae',d:e.encode(genDAE(cl,nm))});
 F.push({n:'autocad/EVLab_'+nm+'_3d.dxf',d:e.encode(genDXF3D(cl,nm))});
 F.push({n:'autocad/EVLab_'+nm+'.lsp',d:e.encode(genLSP(cl,sh,nm))});
 shs.forEach((q,i)=>F.push({n:'autocad/EVLab_'+nm+'_drawings'+(i?'_'+(i+1):'')+'.dxf',d:e.encode(vdDXF(q))}));
 F.push({n:'revit/EVLab_'+nm+'.ifc',d:e.encode(genIFC(cl,nm,spec))});
 F.push({n:'revit/EVLab_'+nm+'_revit.py',d:e.encode(genRevit(cl,nm,spec))});
 F.push({n:'generic/EVLab_'+nm+'.stl',d:genSTL(cl)});
 F.push({n:'generic/EVLab_'+nm+'_parts.csv',d:e.encode(partsCSV(model))});
 F.push({n:'generic/bim-data.json',d:e.encode(evBimJson(nm,spec,d,cl))});
 return F}

/* extra files that go into the page's own ZIP, and the single-file formats */
function extras(){const model=PV('model'),spec=PV('spec')||{},nm=dispName(model),e=new TextEncoder(),F=[];
 try{sheetsBuild().forEach((q,i)=>{const sf=i?'_'+(i+1):'';F.push({n:nm+'_drawings'+sf+'.dxf',d:e.encode(vdDXF(q))});F.push({n:nm+'_drawings'+sf+'.svg',d:e.encode(vdSVG(q))});F.push({n:nm+'_drawings'+sf+'.png',d:pngBytes(q)})})}catch(x){console.warn('EVLab kit: drawings skipped',x)}
 try{const cl=evCluster(evExtract(model,clipsFn()),false);F.push({n:nm+'.stl',d:genSTL(cl)});F.push({n:nm+'.ifc',d:e.encode(genIFC(cl,nm,spec))})}catch(x){console.warn('EVLab kit: STL / IFC skipped',x)}
 try{F.push({n:nm+'_parts.csv',d:e.encode(partsCSV(model))});F.push({n:nm+'_parameters.csv',d:e.encode(paramsCSV(spec))})}catch(x){console.warn('EVLab kit: CSV skipped',x)}
 return F}
const TE=x=>new TextEncoder().encode(x);
const SINGLE={
 dxf:{ext:'dxf',lbl:'Drawings only (DXF: plan, elevations, sections)',mk:async()=>sheetsBuild().map((q,i)=>({sf:i?'_drawings_'+(i+1):'_drawings',d:TE(vdDXF(q))}))},
 svg:{ext:'svg',lbl:'Drawing sheet (SVG, vector)',mk:async()=>sheetsBuild().map((q,i)=>({sf:i?'_drawings_'+(i+1):'_drawings',d:TE(vdSVG(q))}))},
 png:{ext:'png',lbl:'Drawing sheet (PNG)',mk:async()=>sheetsBuild().map((q,i)=>({sf:i?'_drawings_'+(i+1):'_drawings',d:pngBytes(q)}))},
 stl:{ext:'stl',lbl:'STL (3D print, SolidWorks, Fusion; mm, Z-up)',mk:async()=>[{sf:'',d:genSTL(evCluster(evExtract(PV('model'),clipsFn()),false))}]},
 ifc:{ext:'ifc',lbl:'IFC4 (Revit, ArchiCAD, Navisworks)',mk:async()=>[{sf:'',d:TE(genIFC(evCluster(evExtract(PV('model'),clipsFn()),false),dispName(PV('model')),PV('spec')||{}))}]},
 csv:{ext:'csv',lbl:'Parts list + parameters (CSV)',mk:async()=>[{sf:'',d:TE(partsCSV(PV('model'))+'\nParameter,Value\n'+paramsCSV(PV('spec')||{}).split('\n').slice(1).join('\n'))}]}};
const SOFT={lbl:'Software package (Blender, SketchUp, AutoCAD, Revit, IFC, DAE, STL)'};

function save(blob,name,msg){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);if(msg)msg('Downloaded '+name)}

/* ---------- interface ---------- */
function init(){
 const view=document.getElementById('view');if(!view||document.getElementById('evk-panel'))return;
 const dl=document.getElementById('dl'),fmt=document.getElementById('fmt'),msgEl=document.getElementById('msg');
 let fb=null;const say=t=>{if(msgEl)msgEl.textContent=t;else if(fb)fb.textContent=t};
 const btn=(id,t)=>'<button type="button" id="'+id+'" style="display:block;width:100%;margin-top:8px;padding:9px 10px;border-radius:8px;border:1px solid var(--bd,#cfd6dd);background:var(--bg,#fff);color:var(--fg,#15202b);cursor:pointer;font:inherit;font-size:14px;text-align:center">'+t+'</button>';
 const panel=document.createElement('div');panel.id='evk-panel';panel.style.cssText='margin-top:6px';
 const xo=!!document.getElementById('dw')||!!CFG().exportOnly;   /* page already shows its own drawings: add the missing export formats only */
 panel.innerHTML=(xo?'':btn('evk-dw','Show drawings (plan, 4 elevations, 2 sections)')+btn('evk-dxf','Export DXF (plan, elevations, sections)'))+btn('evk-soft','Software package (Blender · SketchUp · AutoCAD · Revit · IFC)')+(fmt?'':'<label style="display:block;margin-top:10px;font-size:13px">Format <select id="evk-fmt" style="width:100%;padding:6px"></select></label>'+btn('evk-dl','Download'));
 if(!msgEl){fb=document.createElement('div');fb.style.cssText='font-size:12px;margin-top:8px;color:var(--mut,#5b6773)';panel.appendChild(fb)}
 if(dl)dl.insertAdjacentElement('afterend',panel);else{const cards=document.querySelectorAll('main .card'),host=cards[cards.length-1]||document.body;const sm=host.querySelector('small');sm?sm.insertAdjacentElement('beforebegin',panel):host.appendChild(panel)}
 const sel=fmt||document.getElementById('evk-fmt'),has=v=>[...sel.options].some(o=>o.value===v),pre=[...sel.options].map(o=>o.value);
 if(!fmt){sel.add(new Option('ZIP (GLB + drawings + STL + IFC + CSV)','zip'));sel.add(new Option('GLB only (Blender)','glb'))}
 const zo=[...sel.options].find(o=>o.value==='zip');if(zo&&fmt)zo.textContent='ZIP (GLB + OBJ + spec.json + drawings + STL + IFC + CSV)';
 const add=(v,l)=>{if(!has(v))sel.add(new Option(l,v))};
 add('soft',SOFT.lbl);for(const k in SINGLE)add(k,SINGLE[k].lbl);

 /* drawings view */
 if(!xo){
 if(getComputedStyle(view).position==='static')view.style.position='relative';
 const ov=document.createElement('div');ov.style.cssText='display:none;position:absolute;left:0;top:0;right:0;bottom:0;overflow:auto;background:#fff;z-index:30;-webkit-overflow-scrolling:touch';view.appendChild(ov);
 let on=false,last='',tm=null;const sig=()=>{const m=PV('model');return (m?m.uuid:'')+'|'+JSON.stringify(PV('spec')||{})};
 function draw(){ov.innerHTML='<p style="padding:24px;font:14px system-ui;color:#555">Drawing plan, elevations and sections...</p>';
  setTimeout(()=>{try{const L=sheetsBuild().map(q=>{const c=vdCanvas(q);c.style.cssText='width:100%;display:block;margin-bottom:6px';return c});ov.innerHTML='';L.forEach(c=>ov.appendChild(c));last=sig()}catch(x){ov.innerHTML='<p style="padding:24px;font:14px system-ui;color:#b00">Drawing failed: '+String(x&&x.message||x).replace(/</g,'&lt;')+'</p>'}},40)}
 document.getElementById('evk-dw').onclick=()=>{on=!on;ov.style.display=on?'block':'none';document.getElementById('evk-dw').textContent=on?'Back to 3D view':'Show drawings (plan, 4 elevations, 2 sections)';if(on)draw()};
 setInterval(()=>{if(on&&sig()!==last){clearTimeout(tm);tm=setTimeout(draw,300)}},900);
 document.getElementById('evk-dxf').onclick=()=>run('dxf');
 }
 document.getElementById('evk-soft').onclick=()=>run('soft');

 /* one download routine for every new format */
 async function run(fm){if(PV('bad'))return;const kc=CFG();try{say('Preparing '+fm.toUpperCase()+'...');kc.before&&kc.before();await new Promise(r=>setTimeout(r,30));
   const nm=dispName(PV('model'));
   if(fm==='soft'){const F=await softPack();save(zipStore(F),'EVLab_'+nm+'_software.zip',say)}
   else{const S=SINGLE[fm],L=await S.mk();if(L.length===1)save(new Blob([L[0].d]),'EVLab_'+nm+L[0].sf+'.'+S.ext,say);else save(zipStore(L.map(q=>({n:'EVLab_'+nm+q.sf+'.'+S.ext,d:q.d}))),'EVLab_'+nm+'_drawings.zip',say)}
  }catch(x){say('Could not export: '+(x&&x.message||x))}finally{try{kc.after&&kc.after()}catch(e){}}}
 if(dl){const orig=dl.onclick;dl.onclick=function(ev){const fm=sel.value;if(fm==='soft'||(SINGLE[fm]&&pre.indexOf(fm)<0))return run(fm);return orig&&orig.call(this,ev)}}
 else document.getElementById('evk-dl').onclick=async()=>{const fm=sel.value,nm=dispName(PV('model'));
  if(fm==='soft'||SINGLE[fm])return run(fm);
  try{say('Preparing...');const fs=[];if(fm==='zip'||fm==='glb'){const root=PV('model'),b=await new Promise(r=>new THREE.GLTFExporter().parse(root,r,{binary:true}));fs.push({n:nm+'.glb',d:new Uint8Array(b)})}
   if(fm==='zip'){fs.push({n:nm+'_spec.json',d:new TextEncoder().encode(JSON.stringify(PV('spec')||{},null,2))});extras().forEach(f=>fs.push(f));save(zipStore(fs),'EVLab_'+nm+'.zip',say)}else save(new Blob([fs[0].d]),'EVLab_'+nm+'.glb',say)}catch(x){say('Could not export: '+(x&&x.message||x))}};

 /* the page's own ZIP also gets the drawings, STL, IFC and CSV files */
 const oz=window.zip;if(typeof oz==='function'&&dl&&!xo){window.zip=function(fs){try{const have=new Set(fs.map(f=>f.n));extras().forEach(f=>{if(!have.has(f.n))fs.push(f)})}catch(x){console.warn(x)}return oz(fs)}}
}
window.EVKit={sheetBuild,sheetsBuild,vdSVG,partsCSV,paramsCSV,softPack,zipStore,extras,version:'1.2'};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
