"use strict";

const status=document.getElementById("status");
const progressBar=document.getElementById("progress_bar");
const bootScreen=document.getElementById("boot_screen");
const bootSubtitle=document.getElementById("boot_subtitle");
const runtimeState=document.getElementById("runtime_state");
const runtimeLabel=document.getElementById("runtime_label");
const terminalMount=document.getElementById("terminal_mount");

const siteBase=window.SAFIROS_BASE||"./";
const qemuBase=siteBase+"qemu/";
const expected="SafirOS 64-bit Long Mode";
const shellPrompt="safiros> ";

let guestOutput="";
let ptyMaster=null;
let ptyActivated=false;
let lastDependencyCount=-1;
let terminalFocusedAtPrompt=false;

const guestDecoder=new TextDecoder();

const terminal=new Terminal({
  allowTransparency:false,
  cols:80,
  rows:24,
  convertEol:true,
  cursorBlink:true,
  cursorStyle:"bar",
  fontFamily:'ui-monospace,"SF Mono","Cascadia Code",Menlo,Consolas,monospace',
  fontSize:14,
  scrollback:10000,
  theme:{
    background:"#000000",
    foreground:"#ffffff",
    cursor:"#ffffff",
    cursorAccent:"#000000",
    selectionBackground:"#ffffff",
    selectionForeground:"#000000",
    black:"#000000",
    red:"#ffffff",
    green:"#ffffff",
    yellow:"#ffffff",
    blue:"#ffffff",
    magenta:"#ffffff",
    cyan:"#ffffff",
    white:"#ffffff",
    brightBlack:"#ffffff",
    brightRed:"#ffffff",
    brightGreen:"#ffffff",
    brightYellow:"#ffffff",
    brightBlue:"#ffffff",
    brightMagenta:"#ffffff",
    brightCyan:"#ffffff",
    brightWhite:"#ffffff"
  }
});

terminal.open(terminalMount);

const originalTerminalWrite=terminal.write.bind(terminal);
terminal.write=function(data,onWrite){
  const output=typeof data==="string"
    ?data
    :guestDecoder.decode(data,{stream:true});

  recordGuestOutput(output);
  return originalTerminalWrite(data,onWrite);
};

terminalMount.addEventListener("mousedown",()=>{
  terminal.focus();
});

function setStatus(message){
  status.textContent=message;
  if(bootSubtitle&&bootScreen.isConnected){
    bootSubtitle.textContent=message;
  }
}

function setRuntimeState(label,state){
  runtimeLabel.textContent=label;
  runtimeState.dataset.state=state;
}

function setProgress(value){
  const progress=Math.max(0,Math.min(100,value));
  progressBar.style.width=progress+"%";
}

function recordGuestOutput(data){
  if(!data){
    return;
  }

  guestOutput=(guestOutput+data).slice(-30000);

  if(bootScreen.isConnected){
    bootScreen.remove();
  }

  if(guestOutput.includes(expected)){
    setProgress(100);
    setStatus("SafirOS kernel reached Long Mode");
    setRuntimeState("Running","running");
  }

  if(guestOutput.includes(shellPrompt)&&!terminalFocusedAtPrompt){
    terminalFocusedAtPrompt=true;
    requestAnimationFrame(()=>terminal.focus());
  }
}

function appendSerial(data){
  const output=typeof data==="string"
    ?data
    :String(data);

  terminal.write(output);
}

window.addEventListener("error",event=>{
  const message=event.error&&event.error.message
    ?event.error.message
    :event.message;

  if(message){
    appendSerial("\r\n[browser] "+message+"\r\n");
  }
});

window.addEventListener("unhandledrejection",event=>{
  const reason=event.reason&&event.reason.message
    ?event.reason.message
    :String(event.reason);

  appendSerial("\r\n[promise] "+reason+"\r\n");
});

const moduleConfig=window.Module;

moduleConfig.print=data=>{
  appendSerial(String(data)+"\r\n");
};

moduleConfig.printErr=data=>{
  appendSerial(String(data)+"\r\n");
};

moduleConfig.monitorRunDependencies=count=>{
  lastDependencyCount=count;

  if(count>0){
    setStatus("Loading QEMU resources · "+count+" remaining");
  }else if(count===0){
    setStatus("QEMU resources ready · waiting for guest output");
  }
};

moduleConfig.onAbort=reason=>{
  const message=reason&&reason.message
    ?reason.message
    :String(reason);

  appendSerial("\r\n[QEMU abort] "+message+"\r\n");
  setRuntimeState("Error","error");
};

moduleConfig.setStatus=message=>{
  if(!message){
    return;
  }

  if(lastDependencyCount===0){
    setStatus("QEMU resources ready · waiting for guest output");
    return;
  }

  setStatus("QEMU: "+message);
};

moduleConfig.preRun=moduleConfig.preRun||[];
moduleConfig.preRun.push(module=>{
  const dependency="safiros-image";
  module.addRunDependency(dependency);

  fetch(siteBase+"SafirOS.img?v="+Date.now(),{
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
      appendSerial("\r\n[disk] "+error.message+"\r\n");
      throw error;
    })
    .finally(()=>{
      module.removeRunDependency(dependency);
    });
});

async function waitForRuntime(startedAt){
  while(true){
    if(guestOutput.includes(expected)){
      return;
    }

    if(performance.now()-startedAt>=30000){
      throw new Error(
        "Long Mode到達ログを受信できませんでした。依存残り="+lastDependencyCount+
        "、PTY="+String(Boolean(ptyMaster))+
        "、PTY有効化="+String(ptyActivated)+
        "、SharedArrayBuffer="+String(typeof SharedArrayBuffer!=="undefined")+
        "、crossOriginIsolated="+String(window.crossOriginIsolated)
      );
    }

    await new Promise(resolve=>setTimeout(resolve,100));
  }
}

async function boot(){
  try{
    setRuntimeState("Starting","starting");
    setStatus("Enabling shared memory...");
    setProgress(2);

    if(!window.COI_READY){
      throw new Error("Cross-origin isolation bootstrap is unavailable");
    }

    await window.COI_READY;

    if(typeof SharedArrayBuffer==="undefined"||!window.crossOriginIsolated){
      throw new Error("Cross-origin isolation is not active after service worker startup");
    }

    setStatus("Loading QEMU ROM loader...");
    setProgress(5);

    if(typeof window.loadSafirosRom!=="function"){
      throw new Error("QEMU ROM loader was not configured");
    }

    await window.loadSafirosRom();

    if(typeof openpty!=="function"){
      throw new Error("QEMU PTY is unavailable");
    }

    if(typeof Terminal!=="function"){
      throw new Error("Terminal emulator assets are unavailable");
    }

    const pty=openpty();
    ptyMaster=pty.master;
    moduleConfig.pty=pty.slave;

    if(!moduleConfig.pty||typeof moduleConfig.pty.ioctl!=="function"){
      throw new Error("QEMU PTY slave initialization failed");
    }

    const termios=moduleConfig.pty.ioctl("TCGETS");
    termios.iflag|=0x0100;
    termios.iflag&=~(0x0020|0x0400|0x0800);
    termios.lflag&=~(0x0001|0x0002|0x0008|0x8000);
    moduleConfig.pty.ioctl("TCSETS",termios);

    terminal.loadAddon(ptyMaster);
    ptyActivated=true;

    appendSerial("[webvm] Terminal connected to QEMU serial console\r\n");

    setProgress(15);
    setStatus("Loading QEMU ROM resources...");

    const {default:initEmscriptenModule}=await import(qemuBase+"out.js");

    setStatus("Starting QEMU WebAssembly...");
    setProgress(40);

    await initEmscriptenModule(moduleConfig);

    if(moduleConfig["TTY"]&&moduleConfig["TTY"].stream_ops){
      const oldPoll=moduleConfig["TTY"].stream_ops.poll;
      const pty=moduleConfig["pty"];

      moduleConfig["TTY"].stream_ops.poll=function(stream,timeout){
        if(!pty.readable){
          return (pty.readable?1:0)|(pty.writable?4:0);
        }

        return oldPoll.call(stream,timeout);
      };
    }

    setStatus("QEMU initialized · waiting for SafirOS");
    await waitForRuntime(performance.now());

    setProgress(100);
    setRuntimeState("Running","running");
    setStatus("SafirOS kernel reached Long Mode");

    if(guestOutput.includes(shellPrompt)){
      terminal.focus();
    }
  }catch(error){
    appendSerial("\r\n[boot error] "+error.message+"\r\n");
    setStatus("SafirOS startup failed · "+error.message);
    setRuntimeState("Error","error");
  }
}

boot();
