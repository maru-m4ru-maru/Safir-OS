"use strict";

const status=document.getElementById("status");
const screenContainer=document.getElementById("screen_container");
const progressBar=document.getElementById("progress_bar");
const bootScreen=document.getElementById("boot_screen");
const EXPECTED_IMAGE_SIZE=1474560;

function setStatus(message){
  status.textContent=message;
}

function setProgress(value){
  const progress=Math.max(0,Math.min(100,value));
  progressBar.style.width=progress+"%";
}

async function loadImage(){
  const response=await fetch("SafirOS.img",{cache:"no-store"});

  if(!response.ok){
    throw new Error("SafirOS.img HTTP "+response.status);
  }

  const total=Number(response.headers.get("Content-Length"))||EXPECTED_IMAGE_SIZE;

  if(!response.body){
    const buffer=await response.arrayBuffer();
    setProgress(100);
    return buffer;
  }

  const reader=response.body.getReader();
  const chunks=[];
  let size=0;

  while(true){
    const part=await reader.read();

    if(part.done){
      break;
    }

    if(part.value){
      chunks.push(part.value);
      size+=part.value.length;
      setProgress(size/total*100);
    }
  }

  const buffer=new Uint8Array(size);
  let offset=0;

  for(const chunk of chunks){
    buffer.set(chunk,offset);
    offset+=chunk.length;
  }

  setProgress(100);
  return buffer.buffer;
}

async function boot(){
  try{
    setStatus("SafirOSを起動しています...");
    const image=await loadImage();

    if(image.byteLength!==EXPECTED_IMAGE_SIZE){
      throw new Error("Bad image size: "+image.byteLength);
    }

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
        buffer:image
      },
      boot_order:0x321,
      disable_speaker:true,
      autostart:true
    });

    setProgress(100);

    setTimeout(()=>{
      bootScreen.remove();
    },900);
  }catch(error){
    setStatus("SafirOS BOOT FAILED\n"+error.message);
  }
}

boot();
