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
  "/xterm-pty.js": path.join(__dirname, "../web/qemu/xterm-pty.js"),
  "/ime-input-compat.js": path.join(__dirname, "../web/ime-input-compat.js")
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
  '  <script src="/ime-input-compat.js"></script>',
  "</head>",
  "<body>",
  '  <div id="terminal"></div>',
  "  <script>",
  "    window.__received = [];",
  '    window.__terminal = new Terminal({cols:80,rows:24});',
  '    window.__terminal.open(document.getElementById("terminal"));',
  "    window.__inputCompatibility = SafirOSInputCompatibility.install(window.__terminal);",
  "    const pty = openpty();",
  '    const termios = pty.slave.ioctl("TCGETS");',
  "    termios.iflag |= 0x0100;",
  "    termios.iflag &= ~(0x0020 | 0x0400 | 0x0800);",
  "    termios.lflag &= ~(0x0001 | 0x0002 | 0x0008 | 0x8000);",
  '    pty.slave.ioctl("TCSETS",termios);',
  "    window.__pty = pty.slave;",
  "    window.__terminal.loadAddon(pty.master);",
  "    window.__eventTrace = [];",
  '    window.__terminal.textarea.addEventListener("keydown",event => window.__eventTrace.push(["keydown",event.key,event.keyCode,window.__terminal.textarea.value]),true);',
  '    window.__terminal.textarea.addEventListener("keyup",event => window.__eventTrace.push(["keyup",event.key,event.keyCode,window.__terminal.textarea.value]),true);',
  '    window.__terminal.textarea.addEventListener("input",event => window.__eventTrace.push(["input",event.data,event.inputType,window.__terminal.textarea.value]),true);',
  "    window.__terminal.onData(data => { window.__received.push(data); window.__eventTrace.push(['onData',data]); });",
  "    window.__readPty = () => new TextDecoder().decode(Uint8Array.from(window.__pty.read()));",
  "    window.__clearReceived = () => { window.__received.length = 0; };",
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
  "      const value = options.value === undefined ? textarea.value + data : options.value;",
  "      textarea.value = value;",
  '      if (typeof textarea.setSelectionRange === "function") textarea.setSelectionRange(value.length,value.length);',
  '      textarea.dispatchEvent(new InputEvent("input",{bubbles:true,composed:options.composed !== false,data,inputType:options.inputType || "insertText",isComposing:Boolean(options.isComposing)}));',
  "    };",
  "    window.__dispatchComposition = (type,data=\"\") => {",
  '      document.querySelector(".xterm-helper-textarea").dispatchEvent(new CompositionEvent(type,{bubbles:true,composed:true,data}));',
  "    };",
  "    window.__nativeCompositionEvents = {start:0,update:0,end:0,input:0};",
  '    window.__terminal.element.addEventListener("compositionstart",() => window.__nativeCompositionEvents.start++);',
  '    window.__terminal.element.addEventListener("compositionupdate",() => window.__nativeCompositionEvents.update++);',
  '    window.__terminal.element.addEventListener("compositionend",() => window.__nativeCompositionEvents.end++);',
  '    window.__terminal.element.addEventListener("input",event => { if(event.isComposing) window.__nativeCompositionEvents.input++; });',
  "    window.__terminal.focus();",
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
    await page.waitForFunction(() => window.__terminal && window.__terminal.textarea);

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

    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => window.__received.join("")),"help\r");
    assert.equal(await page.evaluate(() => window.__readPty()),"\n");

    await page.evaluate(() => {
      window.__clearReceived();
      const textarea = window.__terminal.textarea;
      textarea.value = "h";
      textarea.setSelectionRange(1,1);
      window.__dispatchKey("Process",{keyCode:229,code:"KeyH"});
      window.__dispatchKeyUp("Process",{keyCode:229,code:"KeyH"});
    });
    await page.waitForFunction(() => window.__received.join("") === "h");
    assert.equal(await page.evaluate(() => window.__readPty()),"h");

    await page.evaluate(() => {
      window.__clearReceived();
      const textarea = window.__terminal.textarea;
      textarea.value = "";
      window.__dispatchKey("Enter",{keyCode:13,code:"Enter"});
    });
    assert.equal(await page.evaluate(() => window.__received.join("")),"\r");
    assert.equal(await page.evaluate(() => window.__readPty()),"\n");

    await page.evaluate(() => {
      window.__clearReceived();
      const textarea = window.__terminal.textarea;
      textarea.value = "h";
      textarea.setSelectionRange(1,1);
      window.__dispatchKey("Process",{keyCode:229,code:"KeyH"});
      window.__dispatchKeyUp("Process",{keyCode:229,code:"KeyH"});
    });
    await page.waitForFunction(() => window.__received.join("") === "h");
    assert.equal(await page.evaluate(() => window.__readPty()),"h");

    await page.evaluate(() => {
      window.__clearReceived();
      const textarea = window.__terminal.textarea;
      textarea.value = "";
      window.__dispatchKey("Process",{keyCode:229,code:"KeyM"});
      window.__dispatchInput("m",{value:"m",inputType:"insertText",composed:true});
      window.__dispatchKeyUp("Process",{keyCode:229,code:"KeyM"});
    });
    await page.waitForFunction(() => window.__received.join("") === "m");
    assert.equal(await page.evaluate(() => window.__readPty()),"m");

    await page.evaluate(() => {
      window.__clearReceived();
      const textarea = window.__terminal.textarea;
      textarea.value = "";
      window.__dispatchInput("o",{value:"o",inputType:"insertText",composed:true});
      window.__dispatchKey("Process",{keyCode:229,code:"KeyO"});
      window.__dispatchKeyUp("Process",{keyCode:229,code:"KeyO"});
    });
    await page.waitForFunction(() => window.__received.join("") === "o");
    assert.equal(await page.evaluate(() => window.__readPty()),"o");

    await page.evaluate(() => {
      window.__clearReceived();
      window.__eventTrace.length = 0;
      const textarea = window.__terminal.textarea;
      textarea.value = "";
      window.__dispatchKey("Process",{keyCode:229,code:"KeyH"});
      window.__dispatchInput("h",{value:"h",inputType:"insertText",composed:true});
      window.__dispatchKeyUp("Process",{keyCode:229,code:"KeyH"});
    });
    await page.waitForTimeout(30);
    const hDiagnostic = await page.evaluate(() => ({
      received:window.__received.join(""),
      pty:window.__readPty(),
      textarea:window.__terminal.textarea.value,
      trace:window.__eventTrace
    }));
    assert.equal(hDiagnostic.received,"h",JSON.stringify(hDiagnostic));
    assert.equal(hDiagnostic.pty,"h",JSON.stringify(hDiagnostic));

    await page.evaluate(() => {
      const textarea = window.__terminal.textarea;
      textarea.value = "";
      window.__dispatchKey("Process",{keyCode:229,code:"KeyI"});
      window.__dispatchInput("i",{value:"i",inputType:"insertText",composed:true});
      window.__dispatchKeyUp("Process",{keyCode:229,code:"KeyI"});
    });
    await page.waitForFunction(() => window.__received.join("") === "hi");
    assert.equal(await page.evaluate(() => window.__readPty()),"i");

    await page.evaluate(() => {
      window.__clearReceived();
      const textarea = window.__terminal.textarea;
      textarea.value = "";
      textarea.dispatchEvent(new InputEvent("beforeinput",{
        bubbles:true,
        composed:true,
        data:"b",
        inputType:"insertText"
      }));
      textarea.value = "b";
      textarea.setSelectionRange(1,1);
      window.__dispatchKey("Process",{keyCode:229,code:"KeyB"});
      window.__dispatchKeyUp("Process",{keyCode:229,code:"KeyB"});
    });
    await page.waitForFunction(() => window.__received.join("") === "b");
    assert.equal(await page.evaluate(() => window.__readPty()),"b");

    await page.evaluate(() => {
      window.__clearReceived();
      const textarea = window.__terminal.textarea;
      textarea.value = "b";
      textarea.value = "c";
      textarea.setSelectionRange(1,1);
      window.__dispatchKey("Process",{keyCode:229,code:"KeyC"});
      window.__dispatchKeyUp("Process",{keyCode:229,code:"KeyC"});
    });
    await page.waitForFunction(() => window.__received.join("") === "bc");
    assert.equal(await page.evaluate(() => window.__readPty()),"c");

    await page.evaluate(() => {
      window.__clearReceived();
      const textarea = window.__terminal.textarea;
      textarea.value = "";
      window.__dispatchKey("Process",{keyCode:229,code:"KeyN"});
      textarea.value = "n";
      textarea.setSelectionRange(1,1);
      window.__dispatchKeyUp("Process",{keyCode:229,code:"KeyN"});
    });
    await page.waitForFunction(() => window.__received.join("") === "n");
    assert.equal(await page.evaluate(() => window.__readPty()),"n");

    await page.evaluate(() => {
      window.__clearReceived();
      const textarea = window.__terminal.textarea;
      textarea.value = "";
      window.__dispatchKey("Process",{keyCode:229,code:"KeyT"});
      textarea.value = "t";
      textarea.setSelectionRange(1,1);
    });
    await page.waitForFunction(() => window.__received.join("") === "t");
    assert.equal(await page.evaluate(() => window.__readPty()),"t");

    await page.evaluate(() => {
      window.__clearReceived();
      const textarea = window.__terminal.textarea;
      textarea.value = "";
      window.__dispatchKey("Process",{keyCode:229,code:"KeyF"});
      window.__dispatchInput("f",{value:"f",inputType:"insertFromComposition",composed:true});
      window.__dispatchKeyUp("Process",{keyCode:229,code:"KeyF"});
    });
    await page.waitForFunction(() => window.__received.join("") === "f");
    assert.equal(await page.evaluate(() => window.__readPty()),"f");

    await page.evaluate(() => {
      window.__clearReceived();
      const textarea = window.__terminal.textarea;
      textarea.value = "";
      window.__dispatchInput("j",{value:"j",inputType:"insertText",composed:true});
      window.__dispatchKey("j",{keyCode:229,code:"KeyJ"});
    });
    await page.waitForFunction(() => window.__received.join("") === "j");
    await page.waitForTimeout(30);

    await page.evaluate(() => {
      const textarea = window.__terminal.textarea;
      window.__dispatchInput("k",{value:"jk",inputType:"insertText",composed:true});
      window.__dispatchKey("k",{keyCode:229,code:"KeyK"});
    });
    await page.waitForTimeout(30);
    assert.equal(
      await page.evaluate(() => window.__received.join("")),
      "jk",
      "Rapid input-before-keydown rollover must not drop the next character"
    );
    assert.equal(await page.evaluate(() => window.__readPty()),"jk");

    await page.evaluate(() => {
      window.__dispatchKeyUp("j",{keyCode:74,code:"KeyJ"});
      window.__dispatchKeyUp("k",{keyCode:75,code:"KeyK"});
    });

    await page.evaluate(() => {
      window.__clearReceived();
      const textarea = window.__terminal.textarea;
      textarea.value = "";
      window.__dispatchComposition("compositionstart");
      window.__dispatchComposition("compositionupdate","に");
      window.__dispatchInput("に",{value:"に",inputType:"insertCompositionText",isComposing:true});
      window.__dispatchComposition("compositionupdate","日本語");
      window.__dispatchInput("日本語",{value:"日本語",inputType:"insertCompositionText",isComposing:true});
      const compositionView = document.querySelector(".composition-view");
      window.__compositionPreview = {
        active:compositionView?.classList.contains("active") || false,
        text:compositionView?.textContent || ""
      };
      window.__dispatchComposition("compositionend","日本語");
    });
    await page.waitForTimeout(5);
    assert.deepEqual(
      await page.evaluate(() => window.__compositionPreview),
      {active:true,text:"日本語"}
    );
    assert.equal(await page.evaluate(() => window.__received.join("")),"日本語");
    assert.equal(await page.evaluate(() => window.__readPty()),"日本語");
    assert.deepEqual(
      await page.evaluate(() => window.__nativeCompositionEvents),
      {start:1,update:2,end:1,input:2}
    );

    await page.evaluate(() => {
      window.__clearReceived();
      const textarea = window.__terminal.textarea;
      textarea.value = "";
      window.__dispatchKey("Process",{keyCode:229,code:"KeyA"});
      window.__dispatchInput("a",{value:"a",inputType:"insertText",composed:true});
      window.__dispatchKeyUp("Process",{keyCode:229,code:"KeyA"});
    });
    await page.waitForTimeout(10);
    assert.equal(
      await page.evaluate(() => window.__received.join("")),
      "a",
      "The first character after an IME commit must not be suppressed"
    );
    assert.equal(await page.evaluate(() => window.__readPty()),"a");

    await page.evaluate(() => {
      window.__clearReceived();
      const textarea = window.__terminal.textarea;
      textarea.value = "";
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
      window.__dispatchKey("a",{ctrlKey:true,keyCode:65,code:"KeyA"});
      window.__dispatchKeyUp("a",{keyCode:65,code:"KeyA"});
      window.__dispatchKey("e",{ctrlKey:true,keyCode:69,code:"KeyE"});
      window.__dispatchKeyUp("e",{keyCode:69,code:"KeyE"});
      window.__dispatchKey("ArrowLeft",{ctrlKey:true,keyCode:37,code:"ArrowLeft"});
      window.__dispatchKeyUp("ArrowLeft",{keyCode:37,code:"ArrowLeft"});
      window.__dispatchKey("Backspace",{ctrlKey:true,keyCode:8,code:"Backspace"});
      window.__dispatchKeyUp("Backspace",{keyCode:8,code:"Backspace"});
      window.__dispatchKey("Enter",{keyCode:13,code:"Enter"});
      window.__dispatchKeyUp("Enter",{keyCode:13,code:"Enter"});
    });
    assert.equal(
      await page.evaluate(() => window.__received.join("")),
      "\x01\x05\x1b[1;5D\b\r"
    );
    assert.equal(
      await page.evaluate(() => window.__readPty()),
      "\x01\x05\x1b[1;5D\b\n"
    );

    await page.evaluate(() => {
      window.__clearReceived();
      window.__terminal.paste("paste text");
    });
    assert.equal(await page.evaluate(() => window.__received.join("")),"paste text");
    assert.equal(await page.evaluate(() => window.__readPty()),"paste text");

    assert.deepEqual(errors,[]);
    process.stdout.write(
      "Browser keyboard regression passed: native xterm keypress input, keyCode 229 in both event orders, IME composition and cancellation, control keys, and paste.\n"
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
