/* Browser teaching model: paged KV, decode-first batching and recompute preemption.
 * Compute and output words are synthetic. This is not the vLLM runtime. */
"use strict";
class ServingLab {
  constructor(config = {}) {
    this.reset(config);
  }
  reset(config = {}) {
    this.config = {
      blocks: 12,
      blockSize: 16,
      maxSeqs: 4,
      tokenBudget: 32,
      ...config,
    };
    const c = this.config;
    for (const [key, min, max] of [
      ["blocks", 2, 64],
      ["blockSize", 4, 32],
      ["maxSeqs", 1, 12],
      ["tokenBudget", 1, 512],
    ])
      if (!Number.isInteger(c[key]) || c[key] < min || c[key] > max)
        throw new Error(`${key} must be an integer in ${min}…${max}`);
    this.free = Array.from({ length: c.blocks }, (_, i) => i);
    this.requests = [];
    this.waiting = [];
    this.running = [];
    this.finished = [];
    this.steps = 0;
    this.clock = 0;
    this.preemptions = 0;
    this.selected = null;
  }
  submit(promptTokens = 48, maxTokens = 16) {
    if (
      !Number.isInteger(promptTokens) ||
      !Number.isInteger(maxTokens) ||
      promptTokens < 1 ||
      maxTokens < 1
    )
      throw new Error("Token counts must be positive integers.");
    if (promptTokens + maxTokens > this.config.blocks * this.config.blockSize)
      throw new Error(
        "One request exceeds the entire KV pool. Increase --blocks or shorten the request.",
      );
    if (this.requests.length >= 40)
      throw new Error(
        "This browser lab is limited to 40 requests. Reset to start another scenario.",
      );
    const request = {
      id: `req-${String(this.requests.length + 1).padStart(2, "0")}`,
      prompt: promptTokens,
      max: maxTokens,
      computed: 0,
      generated: 0,
      blocks: [],
      status: "waiting",
      preemptions: 0,
      arrival: this.clock,
      firstToken: null,
      finish: null,
    };
    this.requests.push(request);
    this.waiting.push(request);
    this.selected ??= request.id;
    return request;
  }
  release(request) {
    this.free.push(...request.blocks);
    this.free.sort((a, b) => a - b);
    request.blocks = [];
  }
  preempt(request, events) {
    this.release(request);
    request.computed = 0;
    request.status = "waiting";
    request.preemptions++;
    this.preemptions++;
    this.running = this.running.filter((r) => r !== request);
    this.waiting.unshift(request);
    events.push(
      `preempt ${request.id}: free KV, retain ${request.generated} output tokens, recompute on readmission`,
    );
  }
  grow(request, target, events, scheduled, allowPreempt) {
    const needed = () =>
      Math.max(
        0,
        Math.ceil(target / this.config.blockSize) - request.blocks.length,
      );
    while (needed() > this.free.length) {
      if (!allowPreempt) return false;
      const victim = [...this.running]
        .reverse()
        .find((r) => r !== request && !scheduled.has(r));
      if (victim) this.preempt(victim, events);
      else {
        this.preempt(request, events);
        return false;
      }
    }
    while (needed() > 0) request.blocks.push(this.free.shift());
    return true;
  }
  step() {
    const events = [],
      scheduled = new Set();
    let budget = this.config.tokenBudget,
      prefill = 0,
      decode = 0;
    const beforePreempt = this.preemptions;
    // Decode-ready requests are selected before prefills. Each emits one token.
    const order = [
      ...this.running.filter((r) => r.computed === r.prompt + r.generated),
      ...this.running.filter((r) => r.computed < r.prompt + r.generated),
    ];
    for (const request of order) {
      if (budget <= 0 || request.status !== "running") continue;
      const remaining = request.prompt + request.generated - request.computed;
      const count = remaining > 0 ? Math.min(remaining, budget) : 1;
      if (
        !this.grow(request, request.computed + count, events, scheduled, true)
      )
        continue;
      request.computed += count;
      budget -= count;
      scheduled.add(request);
      if (remaining > 0) {
        prefill += count;
        events.push(`prefill ${request.id}: +${count} KV tokens`);
      } else {
        request.generated++;
        decode++;
        events.push(`decode ${request.id}: +1 scripted token`);
      }
    }
    // Admit new work only if this step did not shed load.
    while (
      this.preemptions === beforePreempt &&
      this.waiting.length &&
      this.running.length < this.config.maxSeqs &&
      budget > 0
    ) {
      const request = this.waiting[0],
        remaining = request.prompt + request.generated - request.computed;
      const count = Math.min(remaining, budget);
      if (
        !this.grow(request, request.computed + count, events, scheduled, false)
      )
        break;
      this.waiting.shift();
      request.status = "running";
      this.running.push(request);
      request.computed += count;
      budget -= count;
      prefill += count;
      scheduled.add(request);
      events.push(
        `admit ${request.id}: prefill +${count}, block table [${request.blocks.join(", ")}]`,
      );
    }
    const active = prefill + decode > 0;
    if (active || this.preemptions > beforePreempt) {
      this.steps++;
      this.clock += active
        ? 0.5 + 0.1 * prefill + (decode ? 6 + 0.35 * decode : 0)
        : 0.5;
      for (const request of this.running) {
        if (request.generated > 0 && request.firstToken === null)
          request.firstToken = this.clock;
        if (request.generated >= request.max) {
          request.status = "finished";
          request.finish = this.clock;
          this.release(request);
          this.finished.push(request);
          events.push(`finish ${request.id}: release KV blocks`);
        }
      }
      this.running = this.running.filter((r) => r.status === "running");
    }
    this.assertValid();
    return {
      events,
      prefill,
      decode,
      progress: active || this.preemptions > beforePreempt,
      done: !this.waiting.length && !this.running.length,
      budgetUsed: this.config.tokenBudget - budget,
    };
  }
  assertValid() {
    const used = this.requests.flatMap((r) => r.blocks),
      all = [...used, ...this.free];
    if (all.length !== this.config.blocks || new Set(all).size !== all.length)
      throw new Error("KV ownership invariant violated");
    for (const r of this.requests) {
      if (r.computed > r.prompt + r.generated || r.generated > r.max)
        throw new Error("Token accounting invariant violated");
      if (
        r.status === "running" &&
        r.blocks.length < Math.ceil(r.computed / this.config.blockSize)
      )
        throw new Error("Missing physical KV block");
      if (r.status !== "running" && r.blocks.length)
        throw new Error("Inactive request retains allocated KV");
    }
    return true;
  }
  output(request) {
    const words =
      "This is a scripted mock token stream for inspecting KV allocation and scheduling behavior .".split(
        " ",
      );
    return Array.from(
      { length: request.generated },
      (_, i) => words[i % words.length],
    ).join(" ");
  }
}
if (typeof module !== "undefined") module.exports = { ServingLab };
else globalThis.ServingLab = ServingLab;
