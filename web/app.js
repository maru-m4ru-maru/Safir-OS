"use strict";

const status=document.getElementById("status");
const screenContainer=document.getElementById("screen_container");
const progressBar=document.getElementById("progress_bar");
const bootScreen=document.getElementById("boot_screen");

window.addEventListener("keydown",event=>{
  if(event.ctrlKey&&event.shiftKey&&event.code==="KeyR"){
    event.preventDefault();
    window.location.reload();
  }
},true);

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
      screen:{
        container:screenContainer,
        use_graphical_text:true
      },
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

    await new Promise((resolve,reject)=>{
      const start=Date.now();

      const check=()=>{
        if(window.emulator.screen_adapter){
          resolve();
          return;
        }

        if(Date.now()-start>=15000){
          reject(new Error("v86の画面アダプター初期化がタイムアウトしました"));
          return;
        }

        setTimeout(check,100);
      };

      check();
    });

    setProgress(25);

    const screenReady=await window.emulator.wait_until_vga_screen_contains("SafirOS 64-bit Long Mode",{
      timeout_msec:15000
    });

    if(!screenReady){
      throw new Error("SafirOSのLong Mode画面を確認できませんでした");
    }

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
