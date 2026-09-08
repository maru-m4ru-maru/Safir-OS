"use strict";

const status = document.getElementById("status");
const screenContainer = document.getElementById("screen_container");

const EXPECTED_IMAGE_SIZE = 1474560;

function setStatus(message, type = "") {
  status.textContent = message;
  status.className = "status";

  if (type) {
    status.classList.add(type);
  }
}

async function loadSafirOSImage() {
  const imageUrl = "SafirOS.img";

  setStatus(
    "SafirOS.img を読み込んでいます...\n" +
    "0%"
  );

  const response = await fetch(imageUrl, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(
      "SafirOS.img の取得に失敗しました: HTTP " +
      response.status
    );
  }

  const contentLength =
    Number(response.headers.get("Content-Length"));

  const total =
    contentLength > 0
      ? contentLength
      : EXPECTED_IMAGE_SIZE;

  if (!response.body) {
    const buffer = await response.arrayBuffer();

    setStatus(
      "SafirOS.img を読み込み中...\n" +
      "100%"
    );

    return buffer;
  }

  const reader = response.body.getReader();

  const chunks = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    if (value) {
      chunks.push(value);
      received += value.length;
    }

    const percent = Math.min(
      100,
      Math.round((received / total) * 100)
    );

    setStatus(
      "SafirOS.img を読み込み中...\n" +
      percent +
      "%"
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

    if (size !== EXPECTED_IMAGE_SIZE) {
      throw new Error(
        "SafirOS.img のサイズが正しくありません。\n" +
        "期待値: " +
        EXPECTED_IMAGE_SIZE +
        " bytes\n" +
        "実際: " +
        size +
        " bytes"
      );
    }

    setStatus(
      "① SafirOS.img: HTTP 200 OK\n" +
      "② サイズ: " +
      size +
      " bytes\n" +
      "③ 1.44 MB フロッピーイメージ確認\n" +
      "④ 読み込み完了\n" +
      "⑤ v86 を起動しています..."
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
      error.message
    );
  }
}

startSafirOS();
