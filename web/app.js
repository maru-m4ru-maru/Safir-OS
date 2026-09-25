"use strict";

const status=document.getElementById("status");
const screenContainer=document.getElementById("screen_container");
const progressBar=document.getElementById("progress_bar");
const bootScreen=document.getElementById("boot_screen");

function setStatus(message){
  status.textContent=message;
}

function setProgress(value){
  const progress=Math.max(0,Math.min(100,value));
  progressBar.style.width=progress+"%";
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

    window.emulator.add_listener("download-progress",event=>{
      if(event.file_name==="SafirOS.img"){
        setProgress(event.total ? event.loaded/event.total*90+5 : 50);
      }
    });

    await window.emulator.wait_until_vga_screen_contains("SafirOS 64-bit Long Mode",{
      timeout_msec:15000
    });

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
