"use strict";

const status=document.getElementById("status");
const serialConsole=document.getElementById("serial_console");
const progressBar=document.getElementById("progress_bar");
const bootScreen=document.getElementById("boot_screen");

const expected="SafirOS 64-bit Long Mode";
let serialOutput="";
let ptyMaster=null;
let ptySource=null;
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

const moduleConfig=window.Module;

moduleConfig.print=data=>{
  appendSerial(data);
};

moduleConfig.printErr=data=>{
  appendSerial(data);
};

moduleConfig.monitorRunDependencies=count=>{
  lastDependencyCount=count;

  if(count>0){
    setStatus("QEMU依存リソースを読み込んでいます... 残り "+count);
  }
};

moduleConfig.onAbort=reason=>{
  const message=reason&&reason.message
    ?reason.message
    :String(reason);

  appendSerial("[QEMU abort] "+message+"\n");
};

moduleConfig.setStatus=message=>{
  if(message){
    setStatus("QEMU: "+message);
  }
};

moduleConfig.preRun=moduleConfig.preRun||[];
moduleConfig.preRun.push(module=>{
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
        "、PTY="+String(Boolean(ptyMaster))+
        "、PTY接続="+String(Boolean(ptySource))+
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

    if(typeof openpty!=="function"){
      throw new Error("QEMU用PTYの初期化に失敗しました");
    }

    const pty=openpty();
    ptyMaster=pty.master;
    moduleConfig.pty=pty.slave;

    if(!moduleConfig.pty||typeof moduleConfig.pty.onSignal!=="function"){
      throw new Error("QEMU用PTY slaveの初期化に失敗しました");
    }

    ptySource={
      write(data){
        if(data instanceof Uint8Array){
          appendSerial(new TextDecoder().decode(data));
          return;
        }

        appendSerial(String(data));
      },
      onData(){
        return {
          dispose(){}
        };
      },
      onBinary(){
        return {
          dispose(){}
        };
      },
      onResize(){
        return {
          dispose(){}
        };
      }
    };

    ptyMaster.activate(ptySource);

    appendSerial("[boot] PTY master connected\n");

    setProgress(10);

    setStatus("QEMU ROMデータを確認しています...");
    setProgress(15);

    appendSerial(
      "[boot] PTY initialized="+String(Boolean(moduleConfig.pty))+
      ", onSignal="+String(typeof moduleConfig.pty.onSignal==="function")+"\n"
    );

    const {default:initEmscriptenModule}=await import("./qemu/out.js");

    setStatus("QEMU Wasmを起動しています...");
    setProgress(40);

    const startedAt=performance.now();

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

      appendSerial("[boot] PTY poll connected\n");
    }

    await waitForRuntime(startedAt);

    setProgress(100);
  }catch(error){
    setStatus("Safir OS BOOT FAILED\n"+error.message);
  }
}

boot();
