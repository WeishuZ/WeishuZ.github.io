# mini-vLLM serving terminal

A browser teaching model for paged KV allocation, decode-first continuous batching, chunked prefill and recompute preemption. Commands advance real local state rather than replaying a recorded trace. The model runner is simulated; emitted words are scripted. It does not load weights, use a GPU, execute shell commands or start a service.

- `engine.js`: bounded KV pool, request state and scheduler. It preserves generated tokens across recompute eviction, frees blocks on completion and checks ownership/token invariants.
- `lab.js`: terminal parser/history, run/pause controls and synchronized request/block inspection.
- `serving-lab.ipynb`: executes the actual Python mini-vLLM implementation at a pinned source revision, with step inspection, batching comparison and memory pressure. All code cells have been executed on CPU.

Run `node projects/mini-vllm/engine.test.cjs` from the repository root for allocation, one-token decode, continuous admission, recovering preemption and invalid-budget checks.

The browser scheduler is a smaller conceptual implementation, not a bit-for-bit vLLM port. It omits prefix caching, distributed workers and GPU attention kernels. Simulated time and occupancy are teaching outputs, not real-vLLM benchmarks. The notebook connects the browser concepts to the repository implementation. Official vLLM metric/tuning references are linked in the page and notebook.
