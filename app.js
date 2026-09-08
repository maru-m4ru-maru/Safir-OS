"use strict";

const status = document.getElementById("status");
const screenContainer = document.getElementById("screen_container");

function setStatus(message, type = "") {
  status.textContent = message;
  status.className = "status " + type;
}

async function loadSafirOSImage() {
  const imageUrl = "SafirOS.img";

  setStatus("SafirOS.img を読み込んでいます...");

  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(
      "SafirOS.img の取得に失敗しました: HTTP " +
      response.status
    );
  }

  const total =
    Number(response.headers.get("Content-Length")) || 1024;

  const reader = response.body.getReader();

  const chunks = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    chunks.push(value);
    received += value.length;

    const percent = Math.min(
      100,
      Math.round((received / total) * 100)
    );

    setStatus(
      "SafirOS.img を読み込み中...\n" +
      percent + "%"
    );
  }

  const buffer = new Uint8Array(received);

  let offset = 0;

  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }

  return buffer.buffer;
}

async function startSafirOS() {
  try {
    const imageBuffer = await loadSafirOSImage();

    const size = imageBuffer.byteLength;

    if (size !== 1024) {
      throw new Error(
        "SafirOS.img のサイズが1024バイトではありません。\n" +
        "実際: " + size + " bytes"
      );
    }

    setStatus(
      "① SafirOS.img: HTTP 200 OK\n" +
      "② サイズ: 1024 bytes\n" +
      "③ 読み込み完了\n" +
      "④ v86 を起動しています...",
      "ok"
    );

    window.emulator = new V86({
      wasm_path:
        "https://cdn.jsdelivr.net/npm/v86@0.5.458/build/v86.wasm",

      memory_size:
        16 * 1024 * 1024,

      vga_memory_size:
        2 * 1024 * 1024,

      screen_container:
        screenContainer,

      bios: {
        url:
          "https://raw.githubusercontent.com/copy/v86/master/bios/seabios.bin"
      },

      vga_bios: {
        url:
          "https://raw.githubusercontent.com/copy/v86/master/bios/vgabios.bin"
      },

      fda: {
        buffer: imageBuffer
      },

      boot_order: 0x321,

      disable_speaker: true,

      autostart: true
    });

    setStatus(
      "SafirOS.img: OK\n" +
      "v86: 起動中\n" +
      "SafirOS: BOOT"
    );

  } catch (error) {
    console.error(error);

    setStatus(
      "SafirOSの起動に失敗しました。\n\n" +
      error.message,
      "error"
    );
  }
}

startSafirOS();
