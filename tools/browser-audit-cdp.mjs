const port = Number(process.env.CDP_PORT || 9222);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function json(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  }
  return response.json();
}

function createCdpClient(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const events = [];

  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) {
        reject(new Error(message.error.message || JSON.stringify(message.error)));
      } else {
        resolve(message.result);
      }
      return;
    }
    if (message.method) {
      events.push(message);
    }
  });

  const open = new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  return {
    async send(method, params = {}) {
      await open;
      const id = nextId++;
      const result = new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
      });
      ws.send(JSON.stringify({ id, method, params }));
      return result;
    },
    events,
    close() {
      ws.close();
    },
  };
}

async function getPosTab() {
  let tabs = await json(`http://127.0.0.1:${port}/json`);
  let tab = tabs.find((item) => item.url?.startsWith("http://127.0.0.1:5173"));

  if (!tab) {
    tab = await json(
      `http://127.0.0.1:${port}/json/new?${encodeURIComponent("http://127.0.0.1:5173/login")}`,
      { method: "PUT" }
    );
  }

  return tab;
}

async function snapshot() {
  const tab = await getPosTab();
  const cdp = createCdpClient(tab.webSocketDebuggerUrl);
  await cdp.send("Runtime.enable");
  await cdp.send("Log.enable");
  await cdp.send("Page.enable");
  if (process.env.NAVIGATE_URL) {
    await cdp.send("Page.navigate", { url: process.env.NAVIGATE_URL });
    await sleep(1500);
  }
  let evalResult = null;
  if (process.env.EVAL_JS) {
    evalResult = await cdp.send("Runtime.evaluate", {
      expression: process.env.EVAL_JS,
      awaitPromise: true,
      returnByValue: true,
    });
    await sleep(Number(process.env.POST_EVAL_SLEEP_MS || 1000));
  }
  await cdp.send("Runtime.evaluate", {
    expression: `document.readyState === "complete"`,
    awaitPromise: true,
  });
  await sleep(1000);

  const state = await cdp.send("Runtime.evaluate", {
    expression: `JSON.stringify({
      url: location.href,
      title: document.title,
      bodyText: document.body ? document.body.innerText.slice(0, 4000) : "",
      inputs: Array.from(document.querySelectorAll("input, textarea, select")).map((el) => ({
        tag: el.tagName,
        type: el.getAttribute("type"),
        name: el.getAttribute("name"),
        placeholder: el.getAttribute("placeholder"),
        ariaLabel: el.getAttribute("aria-label"),
        value: el.type === "password" ? "" : el.value
      })),
      buttons: Array.from(document.querySelectorAll("button, a")).slice(0, 80).map((el) => ({
        tag: el.tagName,
        text: (el.innerText || el.textContent || "").trim(),
        href: el.href || null,
        disabled: !!el.disabled
      }))
    })`,
    returnByValue: true,
  });

  const logs = cdp.events
    .filter((event) => ["Runtime.consoleAPICalled", "Log.entryAdded"].includes(event.method))
    .slice(-30);

  cdp.close();
  return {
    tab: { id: tab.id, title: tab.title, url: tab.url },
    state: JSON.parse(state.result.value),
    evalResult: evalResult?.result?.value ?? null,
    logs,
  };
}

const result = await snapshot();
if (process.env.COMPACT === "1") {
  const text = result.state.bodyText;
  const compact = {
    url: result.state.url,
    title: result.state.title,
    header: text.split("\n").filter(Boolean).slice(0, 30),
    inputs: result.state.inputs,
    actions: result.state.buttons
      .filter((item) => item.text && !item.text.includes("\n\n"))
      .map((item) => ({ tag: item.tag, text: item.text, href: item.href, disabled: item.disabled }))
      .slice(-25),
    seriousLogs: result.logs
      .filter((event) => {
        const level = event.params?.type || event.params?.entry?.level;
        return ["error", "warning"].includes(level);
      })
      .map((event) => ({
        method: event.method,
        level: event.params?.type || event.params?.entry?.level,
        text:
          event.params?.args?.map((arg) => arg.value).filter(Boolean).join(" ") ||
          event.params?.entry?.text ||
          "",
        url: event.params?.entry?.url,
      }))
      .slice(-10),
  };
  if (result.evalResult !== null) {
    compact.evalResult = result.evalResult;
  }
  console.log(JSON.stringify(compact, null, 2));
} else {
  console.log(JSON.stringify(result, null, 2));
}
