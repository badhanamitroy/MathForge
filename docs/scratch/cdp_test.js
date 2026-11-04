const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const appUrl = 'file:///C:/Users/Dell/Downloads/Textbook-Graph-Suite-main/Textbook-Graph-Suite-main/Coordinates_graph.html';

const chromeProc = spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9222',
  '--disable-gpu',
  '--no-sandbox',
  '--allow-file-access-from-files',
  '--disable-web-security',
  appUrl
]);

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

(async () => {
  try {
    await delay(1500);
    const targets = await getJson('http://localhost:9222/json');
    console.log('Targets:', targets.map(t => ({ title: t.title, url: t.url, ws: t.webSocketDebuggerUrl })));

    const pageTarget = targets.find(t => t.url.includes('Coordinates_graph.html'));
    if (!pageTarget || !pageTarget.webSocketDebuggerUrl) {
      console.log('Could not find page target');
      chromeProc.kill();
      return;
    }

    // Connect via native WebSocket
    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    let id = 1;
    const callbacks = new Map();

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && callbacks.has(msg.id)) {
        callbacks.get(msg.id)(msg);
        callbacks.delete(msg.id);
      }
    };

    function send(method, params = {}) {
      return new Promise((resolve) => {
        const msgId = id++;
        callbacks.set(msgId, resolve);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    await new Promise(r => ws.onopen = r);
    console.log('Connected to Chrome WebSocket');

    await send('Page.enable');
    await send('Runtime.enable');

    // Get canvas position
    const evalRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const c = document.getElementById('canvas');
          const r = c.getBoundingClientRect();
          return { left: r.left, top: r.top, width: r.width, height: r.height };
        })()
      `,
      returnByValue: true
    });
    console.log('Canvas rect from browser:', evalRes.result.value);
    const rect = evalRes.result.value;

    // Check initial viewZoom and viewOffset
    const initialView = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const zoomEl = document.getElementById('viewZoom');
          return { zoom: zoomEl ? zoomEl.value : null };
        })()
      `,
      returnByValue: true
    });
    console.log('Initial view:', initialView.result.value);

    // Let's do a real CDP mouse drag on empty space!
    // Start at center of canvas + 100, +100
    const startX = Math.round(rect.left + rect.width * 0.8);
    const startY = Math.round(rect.top + rect.height * 0.8);
    console.log('Starting mouse drag at:', startX, startY);

    await send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: startX,
      y: startY,
      button: 'left',
      clickCount: 1
    });
    console.log('Mouse pressed');

    for (let i = 1; i <= 5; i++) {
      await send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: startX + i * 20,
        y: startY + i * 20,
        button: 'left'
      });
      await delay(50);
    }
    console.log('Mouse moved to:', startX + 100, startY + 100);

    await send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: startX + 100,
      y: startY + 100,
      button: 'left',
      clickCount: 1
    });
    console.log('Mouse released');

    // Check if anything happened!
    const afterDrag = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const c = document.getElementById('canvas');
          // Let's sample pixel data or check if drag happened
          return {
            classes: c.className
          };
        })()
      `,
      returnByValue: true
    });
    console.log('After drag classes:', afterDrag.result.value);

    // Now test clicking Reset View button!
    const btnRect = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.getElementById('resetViewBtn');
          if (!btn) return null;
          const r = btn.getBoundingClientRect();
          return { left: r.left, top: r.top, width: r.width, height: r.height };
        })()
      `,
      returnByValue: true
    });
    console.log('ResetViewBtn rect:', btnRect.result.value);

    if (btnRect.result.value) {
      const b = btnRect.result.value;
      const clickX = Math.round(b.left + b.width / 2);
      const clickY = Math.round(b.top + b.height / 2);
      console.log('Clicking resetViewBtn at:', clickX, clickY);

      await send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: clickX,
        y: clickY,
        button: 'left',
        clickCount: 1
      });
      await send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: clickX,
        y: clickY,
        button: 'left',
        clickCount: 1
      });
      console.log('ResetViewBtn clicked via CDP');
    }

    ws.close();
    chromeProc.kill();
  } catch (err) {
    console.error('CDP error:', err);
    chromeProc.kill();
  }
})();
