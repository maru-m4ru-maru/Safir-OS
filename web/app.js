"use strict";

const status=document.getElementById("status");
const serialConsole=document.getElementById("serial_console");
const progressBar=document.getElementById("progress_bar");
const bootScreen=document.getElementById("boot_screen");

const expected="SafirOS 64-bit Long Mode";
let serialOutput="";
let lastDependencyCount=-1;

window.addEventListener("keydown",event=>{
  if(event.ctrlKey&&event.shiftKey&&event.code==="KeyR"){
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.href=window.location.pathname+"?reload="+Date.now();
  }
},true);

window.addEventListener("error",event=>{
  const message=event.error&&event.error.message
    ?event.error.message
    :event.message;

  if(message){
    appendSerial("[browser] "+message+"\n");
  }
});

window.addEventListener("unhandledrejection",event=>{
  const reason=event.reason&&event.reason.message
    ?event.reason.message
    :String(event.reason);

  appendSerial("[promise] "+reason+"\n");
});

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

async function checkResource(path,label){
  setStatus(label+"を確認しています...");

  const controller=new AbortController();
  const timer=setTimeout(()=>{
    controller.abort();
  },10000);

  try{
    const response=await fetch(path+"?bootcheck="+Date.now(),{
      method:"HEAD",
      cache:"no-store",
      signal:controller.signal
    });

    if(!response.ok){
      throw new Error(label+"のHTTP "+response.status);
    }

    return response;
  }catch(error){
    if(error.name==="AbortError"){
      throw new Error(label+"の読み込みがタイムアウトしました");
    }

    throw error;
  }finally{
    clearTimeout(timer);
  }
}

Module.print=data=>{
  appendSerial(data);
};

Module.printErr=data=>{
  appendSerial(data);
};

Module.monitorRunDependencies=count=>{
  lastDependencyCount=count;

  if(count>0){
    setStatus("QEMU依存リソースを読み込んでいます... 残り "+count);
  }
};

Module.onAbort=reason=>{
  const message=reason&&reason.message
    ?reason.message
    :String(reason);

  appendSerial("[QEMU abort] "+message+"\n");
};

Module.setStatus=message=>{
  if(message){
    setStatus("QEMU: "+message);
  }
};

Module.preRun=Module.preRun||[];
Module.preRun.push(module=>{
  const dependency="safiros-image";
  module.addRunDependency(dependency);

  fetch("./SafirOS.img?v="+Date.now(),{
    cache:"no-store"
  })
    .then(response=>{
      if(!response.ok){
        throw new Error("SafirOS.img HTTP "+response.status);
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
      appendSerial("[disk] "+error.message+"\n");
      throw error;
    })
    .finally(()=>{
      module.removeRunDependency(dependency);
    });
});

async function waitForRuntime(startedAt){
  while(true){
    if(serialOutput.includes(expected)){
      return;
    }

    if(performance.now()-startedAt>=30000){
      throw new Error(
        "QEMU起動がタイムアウトしました。依存残り="+lastDependencyCount+
        "、SharedArrayBuffer="+String(typeof SharedArrayBuffer!=="undefined")+
        "、crossOriginIsolated="+String(window.crossOriginIsolated)
      );
    }

    await new Promise(resolve=>setTimeout(resolve,100));
  }
}

async function boot(){
  try{
    setStatus("ブラウザ実行環境を確認しています...");
    setProgress(5);

    if(typeof SharedArrayBuffer==="undefined"){
      throw new Error("SharedArrayBufferが利用できません");
    }

    if(!window.crossOriginIsolated){
      throw new Error("crossOriginIsolatedが有効になっていません");
    }

    setProgress(10);

    await checkResource("./qemu/load-rom.data","QEMU ROMデータ");
    setProgress(15);

    await checkResource("./qemu/out.js","QEMU JavaScript");
    setProgress(20);

    await checkResource("./qemu/qemu-system-x86_64.worker.js","QEMU worker");
    setProgress(25);

    await checkResource("./qemu/qemu-system-x86_64.wasm","QEMU Wasm本体");
    setProgress(35);

    await checkResource("./SafirOS.img","SafirOSディスクイメージ");
    setProgress(40);

    setStatus("QEMU Wasmを起動しています...");

    const {default:initEmscriptenModule}=await import("./qemu/out.js");
    const startedAt=performance.now();

    await initEmscriptenModule(Module);

    await waitForRuntime(startedAt);

    setProgress(100);

    if(serialOutput.includes(expected)){
      return;
    }

    throw new Error("SafirOSのLong Mode起動を確認できませんでした");
  }catch(error){
    setStatus("Safir OS BOOT FAILED\n"+error.message);
  }
}

boot();
