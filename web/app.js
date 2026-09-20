"use strict";

const status=document.getElementById("status");
const screenContainer=document.getElementById("screen_container");
const progressBar=document.getElementById("progress_bar");
const progressText=document.getElementById("progress_text");
const bootScreen=document.getElementById("boot_screen");
const osScreen=document.getElementById("os_screen");
const EXPECTED_IMAGE_SIZE=1474560;

function setStatus(m){status.textContent=m}
function setProgress(p){const v=Math.max(0,Math.min(100,p));progressBar.style.width=v+"%";progressText.textContent=Math.round(v)+"%"}
function show(id){document.getElementById(id).hidden=false}
function hide(id){document.getElementById(id).hidden=true}

function openExe(){window.open("https://www.boxedwine.org/app/wine-shell/","_blank","noopener,noreferrer")}
function openWeb(){window.open("https://www.google.com/","_blank","noopener,noreferrer")}

document.getElementById("btn-start").onclick=()=>document.getElementById("start_menu").hidden=!document.getElementById("start_menu").hidden;
document.getElementById("btn-files").onclick=()=>{hide("start_menu");show("files_window");renderFiles()};
document.getElementById("btn-exe").onclick=()=>{hide("start_menu");openExe()};
document.getElementById("btn-browser").onclick=()=>{hide("start_menu");openWeb()};
document.getElementById("btn-fullscreen").onclick=async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen()}catch(e){}};
document.querySelectorAll("[data-action]").forEach(b=>b.onclick=()=>{hide("start_menu");const a=b.dataset.action;if(a==="files"){show("files_window");renderFiles()}else if(a==="exe")openExe();else if(a==="browser")openWeb();else if(a==="about")show("about_window")});
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>hide(b.dataset.close));

function tickClock(){const d=new Date();document.getElementById("clock").textContent=d.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}
setInterval(tickClock,1000);tickClock();

const DB_NAME="safiros-files",STORE="files";
const dbp=new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE,{keyPath:"id",autoIncrement:true});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
async function store(mode,cb){const db=await dbp;return new Promise((resolve,reject)=>{const t=db.transaction(STORE,mode),s=t.objectStore(STORE),v=cb(s);t.oncomplete=()=>resolve(v);t.onerror=()=>reject(t.error)})}
async function allFiles(){const db=await dbp;return new Promise((resolve,reject)=>{const r=db.transaction(STORE).objectStore(STORE).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function size(n){return n<1024?n+" B":n<1048576?(n/1024).toFixed(1)+" KB":(n/1048576).toFixed(1)+" MB"}
async function renderFiles(){const list=document.getElementById("file_list"),fs=await allFiles();if(!fs.length){list.textContent="(empty)";return}list.textContent=fs.map(f=>f.name+"  ["+size(f.size)+"]").join("\n")}

document.getElementById("file_import").onclick=async()=>{for(const f of document.getElementById("file_picker").files)await store("readwrite",s=>s.add({name:f.name,size:f.size,type:f.type,blob:f}));document.getElementById("file_picker").value="";await renderFiles()};
document.getElementById("file_clear").onclick=async()=>{for(const f of await allFiles())await store("readwrite",s=>s.delete(f.id));await renderFiles()};
document.getElementById("file_export_all").onclick=async()=>{for(const f of await allFiles()){const a=document.createElement("a");a.href=URL.createObjectURL(f.blob);a.download=f.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}};

async function loadImage(){
 const r=await fetch("SafirOS.img",{cache:"no-store"});
 if(!r.ok)throw new Error("SafirOS.img HTTP "+r.status);
 const total=Number(r.headers.get("Content-Length"))||EXPECTED_IMAGE_SIZE;
 if(!r.body){const b=await r.arrayBuffer();setProgress(100);return b}
 const rd=r.body.getReader(),chunks=[],n={v:0};
 while(true){const x=await rd.read();if(x.done)break;if(x.value){chunks.push(x.value);n.v+=x.value.length}setProgress(n.v/total*100);setStatus("SYSTEM BOOT\nSafirOS.img "+n.v.toLocaleString()+" / "+total.toLocaleString()+" bytes")}
 const b=new Uint8Array(n.v);let o=0;for(const x of chunks){b.set(x,o);o+=x.length}setProgress(100);return b.buffer
}

async function boot(){
 try{
  setStatus("SYSTEM BOOT\nLoading SafirOS.img...");
  const image=await loadImage();
  if(image.byteLength!==EXPECTED_IMAGE_SIZE)throw new Error("Bad image size: "+image.byteLength);
  setStatus("SYSTEM BOOT\nDisk image OK\nStarting SafirOS...");
  window.emulator=new V86({
   wasm_path:"https://cdn.jsdelivr.net/npm/v86@0.5.458/build/v86.wasm",
   memory_size:16*1024*1024,
   vga_memory_size:2*1024*1024,
   screen_container:screenContainer,
   bios:{url:"https://raw.githubusercontent.com/copy/v86/master/bios/seabios.bin"},
   vga_bios:{url:"https://raw.githubusercontent.com/copy/v86/master/bios/vgabios.bin"},
   fda:{buffer:image},
   boot_order:0x321,
   disable_speaker:true,
   autostart:true
  });
  setProgress(100);
  setStatus("SYSTEM BOOT\nSafirOS READY");
  setTimeout(()=>{bootScreen.style.display="none";osScreen.style.display="block"},900);
 }catch(e){console.error(e);setStatus("BOOT FAILED\n\n"+e.message)}
}
boot();
