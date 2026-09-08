"use strict";

const status = document.getElementById("status");
const screenContainer = document.getElementById("screen_container");
const progressBar = document.getElementById("progress_bar");
const progressText = document.getElementById("progress_text");

const EXPECTED_IMAGE_SIZE = 1474560;

function setStatus(message) {
  status.textContent = message;
}

function setProgress(percent) {
  const value = Math.max(0, Math.min(100, percent));

  progressBar.style.width = value + "%";
  progressText.textContent = Math.round(value) + "%";
}

async function loadSafirOSImage() {
  const imageUrl = "SafirOS.img";

  setStatus(
    "SafirOS.img を読み込んでいます...\n" +
    "フロッピーイメージを取得中"
  );

  setProgress(0);

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

    setProgress(100);

    return buffer;
  }

  const reader = response.body.getReader();

  const chunks = [];
  let received = 0;

  while (true) {
    const result = await reader.read();

    if (result.done) {
      break;
    }

    const value = result.value;

    if (value) {
      chunks.push(value);
      received += value.length;
    }

    const percent =
      Math.min(
        100,
        (received / total) * 100
      );

    setProgress(percent);

    setStatus(
      "SafirOS.img を読み込んでいます...\n" +
      received.toLocaleString() +
      " / " +
      total.toLocaleString() +
      " bytes"
    );
  }

  const buffer = new Uint8Array(received);

  let offset = 0;

  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }

  setProgress(100);

  return buffer.buffer;
}

async function startSafirOS() {

  try {

    setStatus(
      "SAFIROS BOOT\n" +
      "Preparing virtual machine..."
    );

    setProgress(0);

    const imageBuffer =
      await loadSafirOSImage();

    const size =
      imageBuffer.byteLength;

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
      "SAFIROS BOOT\n" +
      "Disk image: OK\n" +
      "Size: " +
      size.toLocaleString() +
      " bytes\n" +
      "Starting v86..."
    );

    setProgress(100);

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
      "SAFIROS BOOT\n" +
      "Disk image: OK\n" +
      "v86: RUNNING\n" +
      "Waiting for bootloader..."
    );

  } catch (error) {

    console.error(error);

    setStatus(
      "SAFIROS BOOT FAILED\n\n" +
      error.message
    );

    setProgress(0);
  }
}

startSafirOS();
