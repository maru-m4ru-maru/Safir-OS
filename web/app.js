"use strict";

const status=document.getElementById("status");
const screenContainer=document.getElementById("screen_container");
const progressBar=document.getElementById("progress_bar");
const bootScreen=document.getElementById("boot_screen");

window.addEventListener("keydown",event=>{
  if(event.ctrlKey&&event.shiftKey&&event.code==="KeyR"){
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.href=window.location.pathname+"?reload="+Date.now();
  }
},true);

function setStatus(message){
  status.textContent=message;
}

function setProgress(value){
  const progress=Math.max(0,Math.min(100,value));
  progressBar.style.width=progress+"%";
}

function createVgaTextWatcher(emulator){
  const rows=Array.from({length:25},()=>Array(80).fill(" "));
  let resolved=false;

  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{
      if(!resolved){
        resolved=true;
        reject(new Error("SafirOSのLong Mode画面を確認できませんでした"));
      }
    },15000);

    emulator.add_listener("screen-put-char",event=>{
      if(resolved){
        return;
      }

      const row=event[0];
      const col=event[1];
      const chr=event[2];

      if(row<0||row>=25||col<0||col>=80){
        return;
      }

      rows[row][col]=String.fromCharCode(chr);

      for(const line of rows){
        if(line.join("").includes("SafirOS 64-bit Long Mode")){
          resolved=true;
          clearTimeout(timer);
          resolve();
          return;
        }
      }
    });
  });
}

async function boot(){
  try{
    setStatus("Safir OSを起動しています...");
    setProgress(5);

    window.emulator=new V86({
      wasm_path:"https://cdn.jsdelivr.net/npm/v86@0.5.458/build/v86.wasm",
      memory_size:16*1024*1024,
      vga_memory_size:2*1024*1024,
      screen_container:screenContainer,
      bios:{
        url:"https://raw.githubusercontent.com/copy/v86/master/bios/seabios.bin"
      },
      vga_bios:{
        url:"https://raw.githubusercontent.com/copy/v86/master/bios/vgabios.bin"
      },
      fda:{
        url:"SafirOS.img?v="+Date.now()
      },
      boot_order:0x321,
      disable_speaker:true,
      autostart:true
    });

    window.emulator.keyboard_set_enabled(true);

    screenContainer.addEventListener("mousedown",()=>{
      if(window.emulator){
        window.emulator.keyboard_set_enabled(true);
      }
    });

    window.emulator.add_listener("download-progress",event=>{
      if(event.file_name==="SafirOS.img"){
        setProgress(event.total ? event.loaded/event.total*90+5 : 50);
      }
    });

    setProgress(15);

    await createVgaTextWatcher(window.emulator);

    setProgress(100);
    setStatus("Safir OS 起動完了");

    setTimeout(()=>{
      bootScreen.remove();
    },500);
  }catch(error){
    setStatus("Safir OS BOOT FAILED\n"+error.message);
  }
}

boot();
