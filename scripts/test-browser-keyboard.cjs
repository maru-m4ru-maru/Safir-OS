const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const modulesDirectory = process.env.SAFIROS_TEST_MODULES || path.resolve(
  __dirname,
  "../build/browser-test/node_modules"
);
const { chromium } = require(path.join(modulesDirectory, "playwright"));
const xtermDirectory = path.join(modulesDirectory, "@xterm/xterm");

const assets = {
  "/xterm.js": path.join(xtermDirectory, "lib/xterm.js"),
  "/xterm.css": path.join(xtermDirectory, "css/xterm.css"),
  "/keyboard-input.js": path.join(__dirname, "../web/keyboard-input.js"),
  "/xterm-pty.js": path.join(__dirname, "../web/qemu/xterm-pty.js")
};

const html = [
  "<!doctype html>",
  '<html lang="ja">',
  "<head>",
  '  <meta charset="utf-8">',
  '  <meta name="viewport" content="width=device-width,initial-scale=1">',
  '  <link rel="stylesheet" href="/xterm.css">',
  "  <style>html,body{margin:0;background:#000}#terminal{width:800px;height:320px}</style>",
  '  <script src="/xterm.js"></script>',
  '  <script src="/xterm-pty.js"></script>',
  '  <script src="/keyboard-input.js"></script>',
  "</head>",
  "<body>",
  '  <div id="terminal"></div>',
  "  <script>",
  "    window.__received = [];",
  '    window.__terminal = new Terminal({cols:80,rows:24});',
  '    window.__terminal.open(document.getElementById("terminal"));',
  "    const pty = openpty();",
  '    const termios = pty.slave.ioctl("TCGETS");',
  "    termios.iflag |= 0x0100;",
  "    termios.iflag &= ~(0x0020 | 0x0400 | 0x0800);",
  "    termios.lflag &= ~(0x0001 | 0x0002 | 0x0008 | 0x8000);",
  '    pty.slave.ioctl("TCSETS",termios);',
  "    window.__pty = pty.slave;",
  "    window.__terminal.loadAddon(pty.master);",
  "    window.__terminal.onData(data => window.__received.push(data));",
  "    window.__readPty = () => new TextDecoder().decode(Uint8Array.from(window.__pty.read()));",
  '    window.__keyboard = SafirOSKeyboardInput.install(window.__terminal,{enabled:true});',
  "    window.__targetKeyEvents = 0;",
  "    window.__targetInputEvents = 0;",
  "    window.__nativeCompositionEvents = {start:0,update:0,end:0,input:0};",
  '    window.__terminal.textarea.addEventListener("keydown",() => window.__targetKeyEvents++,true);',
  '    window.__terminal.textarea.addEventListener("input",() => window.__targetInputEvents++,true);',
  '    window.__terminal.element.addEventListener("compositionstart",() => window.__nativeCompositionEvents.start++);',
  '    window.__terminal.element.addEventListener("compositionupdate",() => window.__nativeCompositionEvents.update++);',
  '    window.__terminal.element.addEventListener("compositionend",() => window.__nativeCompositionEvents.end++);',
  '    window.__terminal.element.addEventListener("input",event => { if(event.isComposing) window.__nativeCompositionEvents.input++; });',
  "    window.__terminal.focus();",
  "    window.__dispatchKey = (key,options={}) => {",
  '      const event = new KeyboardEvent("keydown",{key,code:options.code || "",bubbles:true,cancelable:true,ctrlKey:Boolean(options.ctrlKey),shiftKey:Boolean(options.shiftKey),altKey:Boolean(options.altKey)});',
  '      if (options.keyCode !== undefined) Object.defineProperty(event,"keyCode",{get:()=>options.keyCode});',
  '      document.querySelector(".xterm-helper-textarea").dispatchEvent(event);',
  "      return event.defaultPrevented;",
  "    };",
  "    window.__dispatchKeyUp = (key,options={}) => {",
  '      const event = new KeyboardEvent("keyup",{key,code:options.code || "",bubbles:true,cancelable:true});',
  '      if (options.keyCode !== undefined) Object.defineProperty(event,"keyCode",{get:()=>options.keyCode});',
  '      document.querySelector(".xterm-helper-textarea").dispatchEvent(event);',
  "    };",
  "    window.__dispatchInput = (data,options={}) => {",
  '      const textarea = document.querySelector(".xterm-helper-textarea");',
  "      textarea.value = options.value === undefined ? data : options.value;",
  '      if (typeof textarea.setSelectionRange === "function") textarea.setSelectionRange(textarea.value.length,textarea.value.length);',
  '      textarea.dispatchEvent(new InputEvent("input",{bubbles:true,composed:options.composed !== false,data,inputType:options.inputType || "insertText",isComposing:Boolean(options.isComposing)}));',
  "    };",
  "    window.__dispatchComposition = (type,data=\"\") => {",
  '      document.querySelector(".xterm-helper-textarea").dispatchEvent(new CompositionEvent(type,{bubbles:true,composed:true,data}));',
  "    };",
  "    window.__clearReceived = () => { window.__received.length = 0; };",
  "  </script>",
  "</body>",
  "</html>"
].join("\n");

const server = http.createServer((request,response) => {
  const pathname = new URL(request.url,"http://127.0.0.1").pathname;

  if (pathname === "/") {
    response.writeHead(200,{"content-type":"text/html; charset=utf-8"});
    response.end(html);
    return;
  }

  const file = assets[pathname];
  if (!file) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  const contentType = pathname.endsWith(".css")
    ? "text/css; charset=utf-8"
    : "text/javascript; charset=utf-8";

  response.writeHead(200,{"content-type":contentType});
  fs.createReadStream(file).pipe(response);
});

async function main() {
  await new Promise(resolve => server.listen(0,"127.0.0.1",resolve));
  const address = server.address();
  let browser;

  try {
    browser = await chromium.launch({headless:true,args:["--no-sandbox"]});
    const page = await browser.newPage();
    const errors = [];

    page.on("pageerror",error => errors.push(error.message));
    await page.goto("http://127.0.0.1:" + address.port + "/");
    await page.waitForFunction(() => window.__keyboard && window.__terminal.textarea);

    const textarea = page.locator(".xterm-helper-textarea");
    await textarea.focus();

    let expected = "";
    for (const character of "help") {
      await page.keyboard.type(character);
      expected += character;
      await page.waitForFunction(value => window.__received.join("") === value,expected);
      assert.equal(await page.evaluate(() => window.__readPty()),character);
    }

    assert.equal(await page.evaluate(() => window.__received.join("")),"help");
    assert.equal(await textarea.inputValue(),"");
    assert.equal(await page.evaluate(() => window.__targetKeyEvents),0);
    assert.equal(await page.evaluate(() => window.__targetInputEvents),0);

    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => window.__received.join("")),"help\r");
    assert.equal(await page.evaluate(() => window.__readPty()),"\n");

    await page.evaluate(() => {
      window.__clearReceived();
      window.__dispatchInput("m",{value:"m",composed:true});
      window.__dispatchKey("Process",{keyCode:229,code:"KeyM"});
      window.__dispatchKeyUp("m",{keyCode:77,code:"KeyM"});
      window.__dispatchInput("o",{value:"o",composed:true});
      window.__dispatchKey("Process",{keyCode:229,code:"KeyO"});
      window.__dispatchKeyUp("o",{keyCode:79,code:"KeyO"});
    });
    await page.waitForFunction(() => window.__received.join("") === "mo");
    await page.waitForTimeout(20);
    assert.equal(await page.evaluate(() => window.__received.join("")),"mo");
    assert.equal(await page.evaluate(() => window.__readPty()),"mo");

    await page.evaluate(() => {
      window.__clearReceived();
      window.__dispatchKey("Process",{keyCode:229,code:"KeyH"});
      window.__dispatchInput("h",{value:"h",composed:true});
      window.__dispatchKey("Process",{keyCode:229,code:"KeyI"});
      window.__dispatchInput("i",{value:"hi",composed:true});
      window.__dispatchKeyUp("h",{keyCode:72,code:"KeyH"});
      window.__dispatchKeyUp("i",{keyCode:73,code:"KeyI"});
    });
    await page.waitForFunction(() => window.__received.join("") === "hi");
    await page.waitForTimeout(20);
    assert.equal(await page.evaluate(() => window.__received.join("")),"hi");
    assert.equal(await page.evaluate(() => window.__readPty()),"hi");

    await page.evaluate(() => {
      window.__clearReceived();
      window.__dispatchComposition("compositionstart");
      window.__dispatchComposition("compositionupdate","に");
      window.__dispatchInput("に",{value:"に",inputType:"insertCompositionText",isComposing:true});
      window.__dispatchComposition("compositionupdate","日本語");
      window.__dispatchInput("日本語",{value:"日本語",inputType:"insertCompositionText",isComposing:true});
      window.__dispatchComposition("compositionend","日本語");
    });
    await page.waitForTimeout(20);
    const nativeComposition = await page.evaluate(() => ({
      received:window.__received.join(""),
      textareaValue:window.__terminal.textarea.value,
      selectionEnd:window.__terminal.textarea.selectionEnd,
      events:window.__nativeCompositionEvents,
      compositionView:document.querySelector(".composition-view")?.className || ""
    }));
    assert.equal(
      nativeComposition.received,
      "日本語",
      "Native IME commit mismatch: " + JSON.stringify(nativeComposition)
    );
    assert.equal(await page.evaluate(() => window.__readPty()),"日本語");
    assert.deepEqual(
      nativeComposition.events,
      {start:1,update:2,end:1,input:2}
    );

    await page.evaluate(() => {
      window.__clearReceived();
      window.__dispatchComposition("compositionstart");
      window.__dispatchComposition("compositionupdate","かな");
      window.__dispatchInput("かな",{value:"かな",inputType:"insertCompositionText",isComposing:true});
      window.__dispatchComposition("compositionupdate","");
      window.__dispatchInput("",{value:"",inputType:"deleteCompositionText",isComposing:true});
      window.__dispatchComposition("compositionend","");
    });
    await page.waitForTimeout(20);
    assert.equal(
      await page.evaluate(() => window.__received.join("")),
      "",
      "Cancelled composition must not be sent to the PTY"
    );
    assert.equal(await page.evaluate(() => window.__readPty()),"");

    await page.evaluate(() => {
      window.__clearReceived();
      window.__dispatchKey("a",{ctrlKey:true,code:"KeyA"});
      window.__dispatchKey("e",{ctrlKey:true,code:"KeyE"});
      window.__dispatchKey("ArrowLeft",{ctrlKey:true,code:"ArrowLeft"});
      window.__dispatchKey("Backspace",{ctrlKey:true,code:"Backspace"});
      window.__dispatchKey("Enter",{code:"Enter"});
    });
    assert.equal(
      await page.evaluate(() => window.__received.join("")),
      "\x01\x05\x1b[1;5D\x17\r"
    );
    assert.equal(
      await page.evaluate(() => window.__readPty()),
      "\x01\x05\x1b[1;5D\x17\n"
    );

    await page.evaluate(() => {
      window.__clearReceived();
      const textarea = document.querySelector(".xterm-helper-textarea");
      const event = new Event("paste",{bubbles:true,cancelable:true});
      Object.defineProperty(event,"clipboardData",{
        value:{getData:type => type === "text/plain" ? "paste text" : ""}
      });
      textarea.dispatchEvent(event);
    });
    assert.equal(await page.evaluate(() => window.__received.join("")),"paste text");
    assert.equal(await page.evaluate(() => window.__readPty()),"paste text");

    assert.deepEqual(errors,[]);
    process.stdout.write(
      "Browser keyboard regression passed: per-key input around keyCode 229, native xterm IME composition, Enter, Ctrl shortcuts, and paste.\n"
    );
  } finally {
    if (browser) {
      await browser.close();
    }
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  process.stderr.write(String(error.stack || error) + "\n");
  process.exitCode = 1;
});
