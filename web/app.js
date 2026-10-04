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

async function loadScript(url){
  await new Promise((resolve,reject)=>{
    const script=document.createElement("script");
    script.src=url;
    script.onload=resolve;
    script.onerror=()=>reject(new Error("QEMU ROMデータの読み込みに失敗しました"));
    document.head.appendChild(script);
  });
}

async function boot(){
  try{
    setStatus("Safir OS用QEMUを準備しています...");
    setProgress(10);

    window.Module={
      arguments:[
        "-M","pc",
        "-m","64M",
        "-accel","tcg,tb-size=500",
        "-L","/pack-rom/",
        "-boot","order=a",
        "-fda","/SafirOS.img",
        "-serial","stdio",
        "-monitor","none",
        "-display","none",
        "-nic","none",
        "-no-reboot"
      ],
      locateFile(path){
        return "./qemu/"+path;
      },
      mainScriptUrlOrBlob:new URL("./qemu/out.js",location.href).href,
      print(data){
        appendSerial(data);
      },
      printErr(data){
        appendSerial(data);
      },
      setStatus(message){
        setStatus(message);
      }
    };

    await loadScript("./qemu/load-rom.js");
    setProgress(20);

    Module.preRun=Module.preRun||[];
    Module.preRun.push(async module=>{
      const dependency="safiros-image";
      module.addRunDependency(dependency);

      try{
        const response=await fetch("./SafirOS.img?v="+Date.now());
        if(!response.ok){
          throw new Error("SafirOS.imgの読み込みに失敗しました");
        }

        const buffer=await response.arrayBuffer();
        module.FS.writeFile("/SafirOS.img",new Uint8Array(buffer));
      }finally{
        module.removeRunDependency(dependency);
      }
    });

    setStatus("QEMUを起動しています...");
    setProgress(30);

    const {default:initEmscriptenModule}=await import("./qemu/out.js");

    await initEmscriptenModule(Module);

    setProgress(90);

    if(!serialOutput.includes(expected)){
      throw new Error("SafirOSのLong Mode起動を確認できませんでした");
    }
  }catch(error){
    setStatus("Safir OS BOOT FAILED\n"+error.message);
  }
}

boot();
