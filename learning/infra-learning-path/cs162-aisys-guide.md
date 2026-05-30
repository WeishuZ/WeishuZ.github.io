# CS162 × Berkeley AISys Fa2024 · Infra 向学习指南

> 哲学：**用到再学 (just-in-time)**。这份指南不是大纲，是一张"触发表"——当你在 vLLM 路线（见 `vllm-learning-plan.md`）遇到某个机制时，去对应位置补 CS162 的 OS 概念 + AISys 的对应论文。
>
> 原则：不求覆盖完整课，只挖**对 AI infra 有杠杆**的部分。

---

## 0. 一句话定位

- **CS162** = 给你 OS 的"母语"。AI infra 的内存/调度/并发/缓存几乎全是 OS 概念在 GPU 上的重写。
- **AISys** = 给你 LLM 系统的"现代论文地图"。每个 lecture 对应一个工业界仍在迭代的方向。
- **vLLM 项目** = 你的实验场。两门课的概念都拿来跟 vLLM 源码对账。

---

## 1. CS162：高 ROI 章节（必学）

按对 AI infra 的杠杆排序：

| 优先级 | CS162 主题 | 学到什么 | 在 AI infra 哪里用 |
|---|---|---|---|
| 🔴 必 | **虚拟内存 / 分页 / TLB / page table** | 物理↔逻辑映射、碎片、页大小权衡 | PagedAttention KV cache 的全部设计 |
| 🔴 必 | **页面置换 (LRU, Clock, Working Set)** | eviction 策略与 hit rate | Prefix cache 驱逐、H2O 论文的 heavy hitter |
| 🔴 必 | **进程调度 (FIFO, RR, MLFQ, CFS)** | 抢占、公平性、优先级反转 | Continuous batching、Sarathi-Serve 的 chunk 调度 |
| 🔴 必 | **同步原语 (lock, CV, monitor, semaphore)** | 临界区、死锁、惊群 | vLLM 多 worker、scheduler 主循环 |
| 🟡 重 | **进程 vs 线程、地址空间、fork/exec/mmap** | 隔离与共享 | Multi-LoRA 隔离、模型权重 mmap 加载 |
| 🟡 重 | **I/O 模型 (阻塞/非阻塞/async/epoll)** | 高并发 server 设计 | vLLM HTTP 入口、batching 队列 |
| 🟡 重 | **分布式基础 (RPC, 一致性, 2PC, 心跳)** | 故障模型 | TP/PP worker、Monarch 这类多机系统 |
| 🟢 略读 | **文件系统 (inode, journaling, page cache)** | 仅"page cache 类比" | Prefix cache 的概念类比 |

### CS162 可跳过 / 极简带过

- 设备驱动、中断细节、bootloader
- 经典 FS 实现（FAT、ext2 内部结构）
- 安全/权限子系统（除非你做 multi-tenant serving）
- C 内存安全、shell 实现这些 lab 套路（已经会写代码就跳）

### 推荐替代材料（比看完整 CS162 视频快）

- **OSTEP** (《Operating Systems: Three Easy Pieces》免费在线)：直接读 Virtualization 全部 + Concurrency 前 5 章 + Persistence 仅第 1 章。**~150 页**搞定上表的 🔴 + 🟡。
- 看不进书时：**MIT 6.S081** 的 lecture video（虚拟内存、调度、locking 三段就够）。
- CS162 官方 slides 当索引：哪节标题不熟才回去翻。

---

## 2. AISys Fa2024：高 ROI 讲座（infra 向）

把 24 节课按"对 vLLM 路线的相关度"分三层：

### 🔴 第一波必读（Month 1–4 核心）

| Lecture | 论文 | 为什么必读 |
|---|---|---|
| 09/09 Inference Memory | **PagedAttention (vLLM)** | 你做的就是这个 |
| 09/09 Inference Memory | SGLang | RadixAttention prefix cache，对照学 |
| 09/11 Inference Scheduling | **Orca** | continuous batching 的 OG paper |
| 09/11 Inference Scheduling | **Sarathi-Serve** | chunked prefill，调度细化 |
| 10/21 Training Kernels | **FlashAttention** | 即使做 inference 也必须懂的 IO-aware kernel |
| 11/06 PEFT | **S-LoRA** | multi-LoRA serving，vLLM 已支持 |
| 11/25 Sparse Attention | **H2O** | KV cache 驱逐 = OS 页置换的现代版 |

读这 7 篇 ≈ 读懂 vLLM 设计的 80%。

### 🟡 第二波（Month 5+ 看兴趣）

| Lecture | 论文 | 为什么 |
|---|---|---|
| 09/16 Speculative Decoding | Medusa / Speculative Sampling | 解码加速，原创项目可选方向 |
| 10/07 Quantization | AWQ / GPTQ | serving 时降本必备 |
| 10/09 DL Compiler | **PyTorch 2 (torch.compile)** | 衔接你后续学编译器 |
| 10/23 Model Parallelism | Megatron-LM / Alpa | 训练 infra，也是 TP 的源头 |
| 10/28 Training Optimizer | **ZeRO** / PipeDream | 分布式训练经典 |
| 11/18 MoE | MegaBlocks | serving MoE 的工程要点 |

### 🟢 暂时可略 / 不挡你简历的

- 09/18 Benchmark/MMLU、10/14 Data/FineWeb、10/16 Scaling Laws、10/30 Inference-time Compute、11/04 Alignment/RLHF/DPO、11/13 Distillation、11/20 S4/RWKV
- 这些更偏研究/算法，infra 岗面试问到也不是核心。等有空 / 写 blog 缺料时再补。

---

## 3. 触发表：vLLM 路线遇到 X，去学 Y

按你 6 个月计划的月份组织。**遇到才学，别提前**。

### Month 1 — 跑通入口
**触发**：读 `entrypoints/`、`engine/llm_engine.py`，看到 async / asyncio / 请求队列
- → CS162：I/O 模型那一章（epoll / async / event loop）只看概念
- → AISys：还不用读论文，先把 vLLM README + Architecture blog 看完

### Month 2 — 内存子系统
**触发**：`block_manager.py`、`block/` 目录
- → CS162：**虚拟内存 + 分页 + page table + TLB**（OSTEP Ch 13–22 选读 13/15/18/21/22）
- → AISys：**PagedAttention 论文精读** + SGLang 论文（对比 prefix cache 设计）
- → 产出对照表：vLLM logical block / physical block ↔ OS virtual page / physical frame

**触发**：prefix cache eviction
- → CS162：**页面置换算法**（LRU、Clock、Second Chance、Working Set）
- → AISys：**H2O 论文**（heavy hitter 当作"工作集"看）

### Month 3 — 调度器
**触发**：`core/scheduler.py` 的 `step()`、preemption、swap
- → CS162：**进程调度**（MLFQ、CFS、优先级反转）+ 同步原语（CV / monitor pattern）
- → AISys：**Orca + Sarathi-Serve 双论文对读**
- → 自检："为什么 vLLM 的 scheduler 不用 CFS 那套？"能答出权衡就过关

**触发**：worker 多线程 / 多进程
- → CS162：进程 vs 线程、共享内存、`fork` 语义
- → AISys：暂不需要

### Month 4 — Kernel & 性能
**触发**：读 `csrc/attention/`、想看 Triton
- → CS162：缓存层级 / 内存带宽（这块 CS162 讲得浅，可去看 CMU 15-418 的 1‑2 节）
- → AISys：**FlashAttention 论文**，IO-aware 的思想是核心
- → 衔接：Triton 官方 tutorial 1‑3

**触发**：benchmark / 量化
- → AISys：AWQ / GPTQ 选一篇

### Month 5 — 原创 mini-vLLM
**触发**：自己写 scheduler + block manager
- → 这时回头复看 CS162 调度 + 虚拟内存章节，体感会完全不同
- → AISys：S-LoRA（如果你想加 multi-LoRA）

### Month 6 — 收口
- 把整个学习过程的对照表整理成 blog
- 面试复习：CS162 必学项 + 上面 7 篇 🔴 论文，能讲清"为什么"

### Month 7+ — 选支深入
- 走编译器：补 AISys 10/09 PyTorch 2 + Triton 深入
- 走训练：补 Megatron / ZeRO / Alpa
- 走 Monarch：CS162 分布式那块认真补 + 学 Rust async

---

## 4. 最小论文集（如果只读 10 篇）

按读的顺序：

1. **PagedAttention** (vLLM) — SOSP'23
2. **Orca** — OSDI'22
3. **Sarathi-Serve** — OSDI'24
4. **SGLang** — NeurIPS'24
5. **FlashAttention** — NeurIPS'22（v1 即可）
6. **H2O** — NeurIPS'23
7. **S-LoRA** — MLSys'24
8. **ZeRO** — SC'20（训练向，但 OS 思维浓）
9. **Megatron-LM** — 训练并行入门
10. **PyTorch 2 (torch.compile)** — ASPLOS'24

读法：每篇 1‑2 小时，写 200 字"问题 / 方法 / 与 OS 类比"三段笔记，存在 `~/infra/papers/`。

---

## 5. 反原则（避免踩坑）

- ❌ 不要先把 CS162 整门刷完再做项目。OSTEP 跟着触发读，2 个月内会自然吃掉 60%。
- ❌ 不要按 AISys schedule 顺序读 24 篇。它是给学生 1 学期的，不是给个人开发者 6 个月的。
- ❌ 不要做读书笔记 PPT。每篇论文一段话 + 跟 vLLM 源码哪一行对得上，比精美笔记有用 10 倍。
- ❌ 不要等"准备好"才提 PR。Month 1 就交第一个 PR，哪怕是 typo。

---

## 6. 资源索引

- OSTEP（免费）：https://pages.cs.wisc.edu/~remzi/OSTEP/
- CS162 官方（slides 即可）：https://cs162.org/
- AISys Fa2024 schedule：https://ucbsky.github.io/aisys-fa2024/schedule/
- MIT 6.S081（视频备选）：https://pdos.csail.mit.edu/6.S081/
- CMU 15-418（并行与缓存层级补强）：http://15418.courses.cs.cmu.edu/
- Triton tutorial：https://triton-lang.org/main/getting-started/tutorials/index.html
