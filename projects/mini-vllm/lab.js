"use strict";
(() => {
  const $ = (s) => document.querySelector(s),
    output = $("#terminal"),
    input = $("#command");
  let lab = new ServingLab(),
    timer = null,
    history = [],
    historyIndex = 0,
    runSteps = 0;
  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  function log(text, kind = "") {
    const line = document.createElement("div");
    line.className = `terminal-line ${kind}`;
    line.textContent = text;
    output.append(line);
    while (output.children.length > 450) output.firstChild.remove();
    output.scrollTop = output.scrollHeight;
  }
  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    $("#run").textContent = "Run";
  }
  function render() {
    const c = lab.config,
      used = c.blocks - lab.free.length;
    $("#pool-caption").textContent =
      `${c.blocks} blocks · ${c.blockSize} tokens / block`;
    $("#blocks").style.gridTemplateColumns =
      `repeat(${Math.min(c.blocks, 12)}, minmax(0,1fr))`;
    $("#blocks").innerHTML = Array.from({ length: c.blocks }, (_, i) => {
      const owner = lab.requests.find((r) => r.blocks.includes(i));
      return `<button class="block ${owner ? "owned owner-" + (lab.requests.indexOf(owner) % 4) : ""} ${owner?.id === lab.selected ? "selected" : ""}" data-block="${i}" ${owner ? `data-request="${owner.id}"` : ""} aria-label="Block ${i}, ${owner ? owner.id : "free"}"><span>${i}</span></button>`;
    }).join("");
    $("#queue").innerHTML =
      lab.requests
        .map(
          (r) =>
            `<tr class="${r.id === lab.selected ? "selected" : ""}"><td><button data-request="${r.id}">${r.id}</button></td><td class="state-${r.status}">${r.status}</td><td>${r.computed} / ${r.prompt + r.generated}</td><td>${r.generated} / ${r.max}</td></tr>`,
        )
        .join("") ||
      '<tr><td colspan="4">No requests. Type submit to queue one.</td></tr>';
    const r = lab.requests.find((r) => r.id === lab.selected);
    $("#request-detail").innerHTML = r
      ? `<strong>${r.id}</strong> · logical → physical: [${r.blocks.join(", ")}]<br>recomputes=${r.preemptions} · first token=${r.firstToken === null ? "pending" : (r.firstToken - r.arrival).toFixed(1) + " simulated ms"}<div class="mock-stream">${esc(lab.output(r) || "Scripted token stream appears after prefill.")}</div>`
      : "Select a request or allocated block.";
    $("#clock").textContent = `${lab.clock.toFixed(1)} ms · ${lab.steps} steps`;
    $("#occupancy").textContent =
      `${used} / ${c.blocks} (${Math.round((100 * used) / c.blocks)}%)`;
    $("#preemptions").textContent = String(lab.preemptions);
  }
  function step(count = 1) {
    for (let i = 0; i < count; i++) {
      const r = lab.step();
      if (!r.progress) {
        log(
          r.done
            ? "queue empty"
            : "No progress: use a smaller request or larger KV pool.",
          "event",
        );
        stop();
        break;
      }
      log(
        `[step ${String(lab.steps).padStart(3, "0")}] prefill=${r.prefill} decode=${r.decode} budget=${r.budgetUsed}/${lab.config.tokenBudget}`,
      );
      r.events.forEach((e) => log("  " + e, "event"));
      if (r.done) {
        log(
          "All requests finished; KV blocks returned to the pool.",
          "success",
        );
        stop();
        break;
      }
    }
    render();
  }
  function run() {
    if (timer) {
      stop();
      return;
    }
    runSteps = 0;
    $("#run").textContent = "Pause";
    timer = setInterval(() => {
      step();
      if (++runSteps >= 1000) {
        stop();
        log("Stopped at the browser lab step limit.", "event");
      }
    }, 100);
  }
  const optionMap = {
    "--blocks": "blocks",
    "--block-size": "blockSize",
    "--max-seqs": "maxSeqs",
    "--token-budget": "tokenBudget",
  };
  function execute(command, echo = true) {
    if (!command.trim()) return;
    if (echo) {
      log("lab $ " + command, "command");
      history.push(command);
      if (history.length > 100) history.shift();
      historyIndex = history.length;
    }
    const tokens = command.trim().split(/\s+/),
      name = tokens.shift();
    try {
      const flags = {};
      for (let i = 0; i < tokens.length; i++)
        if (tokens[i].startsWith("--")) {
          if (tokens[i + 1] === undefined)
            throw Error(`Missing value for ${tokens[i]}`);
          flags[tokens[i]] = Number(tokens[++i]);
        }
      if (name === "help") {
        log(
          "serve --blocks 12 --block-size 16 --max-seqs 4 --token-budget 32\nsubmit --prompt-tokens 48 --max-tokens 16\nstep [1…100]  |  run (pause/run)  |  status  |  inspect req-01\npreset pressure  |  preset batching  |  reset  |  clear\nLab commands run locally. Model output and compute time are simulated.",
        );
      } else if (name === "serve") {
        stop();
        const cfg = { ...lab.config };
        for (const flag of Object.keys(flags)) {
          if (!optionMap[flag]) throw Error("Unknown serve option: " + flag);
          cfg[optionMap[flag]] = flags[flag];
        }
        lab = new ServingLab(cfg);
        log(
          `mock-llm ready · ${cfg.blocks * cfg.blockSize} token slots; previous scenario reset.`,
          "success",
        );
      } else if (name === "submit") {
        for (const flag of Object.keys(flags))
          if (!["--prompt-tokens", "--max-tokens"].includes(flag))
            throw Error("Unknown submit option: " + flag);
        const r = lab.submit(
          flags["--prompt-tokens"] ?? 48,
          flags["--max-tokens"] ?? 16,
        );
        log(`queued ${r.id} (prompt=${r.prompt}, max=${r.max})`, "success");
      } else if (name === "step") {
        stop();
        const n = tokens.length ? Number(tokens[0]) : 1;
        if (!Number.isInteger(n) || n < 1 || n > 100)
          throw Error("step accepts 1…100 iterations.");
        step(n);
      } else if (name === "run") run();
      else if (name === "status")
        log(
          `running=${lab.running.length} waiting=${lab.waiting.length} finished=${lab.finished.length} KV=${lab.config.blocks - lab.free.length}/${lab.config.blocks} preemptions=${lab.preemptions}`,
        );
      else if (name === "inspect") {
        const r = lab.requests.find((r) => r.id === tokens[0]);
        if (!r)
          throw Error("Unknown request. Use status or select a queue row.");
        lab.selected = r.id;
        log(
          `${r.id}: ${r.status}, KV=[${r.blocks}], computed=${r.computed}, generated=${r.generated}, recomputes=${r.preemptions}`,
        );
      } else if (name === "preset") {
        if (!["pressure", "batching"].includes(tokens[0]))
          throw Error("Use preset pressure or preset batching.");
        preset(tokens[0]);
      } else if (name === "reset") preset("batching");
      else if (name === "clear") output.replaceChildren();
      else throw Error(`Unknown lab command: ${name}. Type help.`);
    } catch (error) {
      log(error.message, "error");
    }
    render();
  }
  function preset(name) {
    stop();
    output.replaceChildren();
    lab = new ServingLab({ blocks: name === "pressure" ? 8 : 12 });
    log("Mock LLM · simulated compute · no GPU", "event");
    log(
      `lab $ serve --blocks ${lab.config.blocks} --block-size 16 --max-seqs 4 --token-budget 32`,
      "command",
    );
    log(`mock-llm ready · ${lab.config.blocks * 16} token slots`, "success");
    if (name === "pressure") {
      [1, 2, 3].forEach(() =>
        execute("submit --prompt-tokens 48 --max-tokens 48", false),
      );
      step(4);
    } else {
      execute("submit --prompt-tokens 48 --max-tokens 16");
      execute("submit --prompt-tokens 32 --max-tokens 10");
      step(3);
    }
    render();
  }
  $("#command-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const command = input.value;
    input.value = "";
    execute(command);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      historyIndex = Math.max(0, historyIndex - 1);
      input.value = history[historyIndex] || "";
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      historyIndex = Math.min(history.length, historyIndex + 1);
      input.value = history[historyIndex] || "";
    }
  });
  $("#step").addEventListener("click", () => {
    stop();
    step();
  });
  $("#run").addEventListener("click", run);
  $("#reset").addEventListener("click", () => preset("batching"));
  $("#pressure").addEventListener("click", () => preset("pressure"));
  $("#batching").addEventListener("click", () => preset("batching"));
  document.addEventListener("click", (e) => {
    const target = e.target.closest("[data-request]");
    if (target) {
      lab.selected = target.dataset.request;
      render();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
  });
  globalThis.MiniVllmLab = Object.freeze({
    get state() {
      return lab;
    },
    execute,
  });
  preset("batching");
})();
