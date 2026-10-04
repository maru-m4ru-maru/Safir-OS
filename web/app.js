"use strict";

const status=document.getElementById("status");
const serialConsole=document.getElementById("serial_console");
const progressBar=document.getElementById("progress_bar");
const bootScreen=document.getElementById("boot_screen");

const expected="SafirOS 64-bit Long Mode";
let serialOutput="";

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

function appendSerial(data){
  if(typeof data!=="string"){
    data=String(data);
  }

  serialOutput+=data;
  serialConsole.textContent=serialOutput.slice(-12000);
  serialConsole.scrollTop=serialConsole.scrollHeight;

  if(serialOutput.includes(expected)){
    setProgress(100);
    setStatus("Safir OS 起動完了");

    setTimeout(()=>{
      bootScreen.remove();
    },500);
  }
}

Module.print=data=>{
  appendSerial(data);
};

Module.printErr=data=>{
  appendSerial(data);
};

Module.preRun=Module.preRun||[];
Module.preRun.push(module=>{
  const dependency="safiros-image";
  module.addRunDependency(dependency);

  fetch("./SafirOS.img?v="+Date.now())
    .then(response=>{
      if(!response.ok){
        throw new Error("SafirOS.imgの読み込みに失敗しました");
      }

      return response.arrayBuffer();
    })
    .then(buffer=>{
      module.FS.writeFile(
        "/SafirOS.img",
        new Uint8Array(buffer)
      );
    })
    .catch(error=>{
      setStatus("Safir OS BOOT FAILED\n"+error.message);
      throw error;
    })
    .finally(()=>{
      module.removeRunDependency(dependency);
    });
});

async function boot(){
  try{
    setStatus("QEMU Wasmを起動しています...");
    setProgress(20);

    const {default:initEmscriptenModule}=await import("./qemu/out.js");

    setProgress(40);

    await initEmscriptenModule(Module);

    setProgress(100);

    if(!serialOutput.includes(expected)){
      throw new Error("SafirOSのLong Mode起動を確認できませんでした");
    }
  }catch(error){
    setStatus("Safir OS BOOT FAILED\n"+error.message);
  }
}

boot();
