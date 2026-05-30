# vLLM 学习与贡献计划

> 目标：用 vLLM 当锚点项目深入学习 AI infra（特别是 GPU 上的"操作系统"层），同时积累可写进简历的 OSS 贡献。
> 作者：WeishuZ · 起始日期：2026-05-10 · 节奏：6 个月主线 + 后续延伸

---

## 0. 总目标 (North Star)

6 个月内达成：
1. **3+ 个 merged PR** 进入 `vllm-project/vllm`，其中至少 1 个非平凡（>100 行 / 涉及 scheduler / block manager / kernel 任一）
2. **1 篇技术 blog**，把 vLLM 核心机制对照 OS 经典概念写清楚（虚拟内存、调度、page cache）
3. **1 个原创小项目**：从零实现一个 mini paged-attention KV cache（CUDA + Python），跑通对比 benchmark
4. 简历上能写："Contributor to vLLM (X PRs merged), built mini-vLLM serving engine, blog reaches Y readers"

---

## 1. 为什么是 vLLM（不是 torch.compile / Megatron / Ray）

| 维度 | 评估 |
|---|---|
| **硬件门槛** | 单卡（云上 A10 ~$0.4/hr）能跑大部分实验 |
| **OS 学习价值** | ⭐⭐⭐⭐⭐ —— PagedAttention 论文明确以 OS 虚拟内存为灵感 |
| **市场需求** | 每家 serving LLM 的公司都用或对标 |
| **社区活跃度** | 每周数十 PR，reviewer 响应快，GFI 标签真实在用 |
| **代码梯度** | Python 顶层 → C++ 中层 → CUDA kernel，逐级加深 |
| **Rust 衔接** | 不直接，但调度/内存思维与 Rust async 系统设计相通，未来转 Monarch 平滑 |

vLLM 核心机制 ↔ OS 概念对照（学习时随手对账）：

| OS 概念 | vLLM 模块 | 关键源码位置（待校验） |
|---|---|---|
| 虚拟内存 / 分页 | PagedAttention KV cache | `vllm/core/block_manager.py`, `csrc/attention/` |
| 进程调度 / 抢占 | Continuous batching | `vllm/core/scheduler.py` |
| 页缓存 (page cache) | Automatic prefix caching | `vllm/core/block/prefix_caching_block.py` |
| 内存分配器 | Block allocator | `vllm/core/block/` |
| Swap (page-out) | CPU offload | `vllm/worker/cache_engine.py` |
| IPC / RPC | TP/PP worker 通信 | `vllm/distributed/` |
| 多租户隔离 | Multi-LoRA | `vllm/lora/` |
| mmap 文件 | Weight loading | `vllm/model_executor/model_loader/` |

> 路径名以最新 main 为准，做笔记时再校对。

---

## 2. 前置准备 (Week 0)

### 2.1 环境
- [ ] mac 本地：clone 仓库，跑通 Python-only 单测（不依赖 GPU 的逻辑测试占比不小）
- [ ] 注册 RunPod / Vast.ai 账号，跑通一次 A10 实例
  - 推荐镜像：`pytorch/pytorch:2.x-cuda12.x-cudnn-devel`
  - 一次 1‑2 小时实验，单次预算控制在 $1 内
- [ ] GitHub 账号 `WeishuZ` 准备：fork vllm-project/vllm，本地配好 upstream remote
- [ ] 装 `pre-commit`，跑通 vLLM 的 lint/format（reviewer 第一关）

### 2.2 必读材料
- [ ] PagedAttention 论文 (Kwon et al., SOSP 2023) —— 全文精读
- [ ] vLLM 官方架构博客（blog.vllm.ai 上的 Architecture / Continuous Batching 系列）
- [ ] Continuous batching 原始博客 (Anyscale, 2023)
- [ ] OS 教材重看 3 章：虚拟内存 / 进程调度 / 文件系统页缓存（OSTEP 对应章节最快）

### 2.3 预算
- 云 GPU：$30‑80/月，按需开关，6 个月 ~$300
- 域名 + blog 托管（可选，GitHub Pages 免费）
- 总预算 < $500

---

## 3. 月度路线（6 个月）

### Month 1 — 跑通 + 读懂入口
**学习**
- 跑通 `vllm serve meta-llama/Llama-3.1-8B-Instruct`（云端 A10）
- 读 `vllm/entrypoints/`、`vllm/engine/llm_engine.py`，画一张请求生命周期图
- 读 scheduler 的主循环 `step()`，理解 prefill vs decode、admission control

**贡献**
- 第 1 个 PR（保底）：文档错别字 / example 修补 / typing 修补
- 目标只是**走通流程**：fork → branch → 跑 lint → PR → 拿到 merge

**产出**
- 笔记：vLLM 请求从 HTTP 进入到 token 流出的完整调用链

---

### Month 2 — 内存子系统
**学习**
- 啃 `block_manager.py` + `block/` 目录，理解 logical block / physical block 映射
- 复现 PagedAttention 的内存碎片对比（与 naive contiguous KV cache）
- 对照 OS 虚拟内存：page table、TLB miss、copy-on-write 在这里如何映射

**贡献**
- 找一个 block manager 或 prefix cache 相关的小 issue（GFI 或 help wanted），动手
- 候选方向：metric 暴露不全、edge case bug、test 覆盖补齐

**产出**
- 笔记：vLLM 内存模型 vs OS 虚拟内存对照表（blog 草稿 v1）

---

### Month 3 — 调度器
**学习**
- 啃 `core/scheduler.py`，理解 SchedulingBudget、preemption、swap-in/swap-out
- 对比：Linux CFS、Borg/Kubernetes scheduler 的设计权衡
- 写一个 mini 版 continuous batching 调度器（纯 Python，假数据），不上 GPU

**贡献**
- 第 2 个 PR：scheduler 相关，例如新增 metric、修复 preemption 边界、优化某个调度策略
- 这个 PR 期望 >50 行，需要写测试

**产出**
- mini scheduler 代码（自己 repo）
- blog 草稿 v2：加上调度章节

---

### Month 4 — Kernel & 性能
**学习**
- 读 `csrc/` 下的 CUDA kernel（attention、cache ops）
- 学 Triton 基础（官方 tutorial 1‑5），理解 block-level 编程模型
- 跑 benchmark：`benchmarks/` 目录下的现有脚本，画图对比 batch size / context len

**贡献**
- 第 3 个 PR：kernel 或 benchmark 方向。可以是补 benchmark、修小 bug、加 Triton 实现的某 op

**产出**
- benchmark 报告：在自己租的 A10 上的吞吐/延迟数据，写进 blog

---

### Month 5 — 原创项目：mini-vLLM
**目标**：从零写一个能跑的 mini paged-attention serving engine（限制在 7B 单卡 fp16）

**功能切片**
- 极简 HTTP API（FastAPI 即可）
- 自己的 block manager（512 token 块，固定大小）
- continuous batching scheduler（FIFO + preemption）
- 调用 vLLM 或 FlashAttention 的 kernel（不重写 kernel，重点在 control plane）
- benchmark 与 vLLM 同模型对比，写差距分析

**产出**
- GitHub 仓库 `mini-vllm`，README 含设计文档与对比图
- blog 第 2 篇：「我从零写了一个 mini vLLM，这是我学到的」

---

### Month 6 — 收口 + 求职准备
- 把所有 PR、blog、原创项目整理到个人主页 / 简历
- 主动认领一个 vLLM 中等难度 issue 作为收官 PR
- 投递目标：Anthropic / OpenAI / xAI / Together / Fireworks / Modal / Anyscale / DeepSeek / Moonshot 的 infra 岗
- 同时申请相关 maintainer 推荐信（如果某个 reviewer 与你互动多）

---

## 4. 后续延伸（Month 7+）

按兴趣选一支深入：

- **A. 编译器方向**：开始啃 torch.compile / Inductor / Triton，目标贡献到 PyTorch core
- **B. 训练方向**：torchtitan / Megatron-LM，需要多卡（要么云上租，要么找实习）
- **C. 分布式调度**：Ray / KubeRay / SkyPilot，不需要 GPU
- **D. 回到 Monarch**：这时候已有 Rust + 分布式系统直觉，能真正参与了

---

## 5. 风险与对策

| 风险 | 对策 |
|---|---|
| 云 GPU 账单失控 | 每次实验前算预算上限，跑完立刻关机；用 spot 实例 |
| PR 卡 review 不动 | 每 5 天 ping 一次，同时推进下一个 PR，不阻塞 |
| 学得太散 | 每月只做一个主题，月末写笔记强制收口 |
| 失去动力 | 公开 commitment（blog / Twitter），用社交压力当杠杆 |
| 原创项目烂尾 | 切到最小可跑版本（能 serve 一个请求）即视为 v0.1 成功 |

---

## 6. 进度跟踪

每月月底回顾，更新这一节：

### 2026-05 (Month 1)
- [ ] 环境就绪
- [ ] 跑通 vLLM serve
- [ ] 读完请求生命周期
- [ ] 提交第 1 个 PR
- [ ] 笔记 v0

### 2026-06 (Month 2)
- 待填

（后续月份同样格式追加）

---

## 7. 资源索引

- vLLM 仓库：https://github.com/vllm-project/vllm
- vLLM 文档：https://docs.vllm.ai
- PagedAttention 论文：Kwon et al., "Efficient Memory Management for Large Language Model Serving with PagedAttention", SOSP 2023
- OSTEP（操作系统教材）：https://pages.cs.wisc.edu/~remzi/OSTEP/
- Triton tutorial：https://triton-lang.org/main/getting-started/tutorials/index.html
- Anyscale continuous batching blog（2023）
- vLLM Slack（官方）：贡献者交流主战场
