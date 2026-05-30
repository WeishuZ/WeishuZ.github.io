# Infra Learning Path

我个人深入 AI infra 的学习与贡献路线，公开记录用以自我约束 + 给同路人参考。

锚点项目：[vLLM](https://github.com/vllm-project/vllm)。哲学：**用到再学 (just-in-time)**，不刷完整课程，按项目触发补理论。

## 📖 交互式学习站

> **[在线阅读 →](http://weishuz.com/infra-learning-path/)**（GitHub Pages 部署，等待首次 build 完成约 1-2 分钟）

把本仓库的两份大纲重写成了一份问题驱动、可交互的教程站，结构：

- `index.html` — 落地页与导航
- `tutorial/00-mental-model.html` — 心智模型（先读这个）
- `tutorial/01-setup.html` — Week 0 环境配置
- `tutorial/02-entrypoints.html` — M1 入口与请求生命周期
- `tutorial/03-memory.html` — M2 内存 · PagedAttention（皇冠章节）
- `tutorial/04-scheduler.html` — M3 调度器
- `tutorial/05-kernels.html` — M4 Kernel & 性能
- `tutorial/06-mini-vllm.html` — M5 原创项目
- `tutorial/07-papers.html` — 10 篇论文导读
- `tutorial/08-os-bridge.html` — OS ↔ vLLM 速查

每页都贯彻：**驱动问题 → 先猜后看 → OS 概念铺垫 → 示意图 → 去读这些代码 → 自检**。

**本地预览**：

```bash
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```

## 原始文档

- [vllm-learning-plan.md](./vllm-learning-plan.md) — 6 个月 vLLM 贡献 + 学习路线，含月度路线、PR 节奏、原创项目设计
- [cs162-aisys-guide.md](./cs162-aisys-guide.md) — UCB CS162 (OS) × Berkeley AISys Fa2024 整合指南，按"触发表"组织

## 不在这里的内容

- 实际代码项目（mini-vLLM 等）走独立仓
- 论文笔记草稿（先放本地 `papers/`，沉淀后再迁过来）

## 进度

详见各文档末尾"进度跟踪"小节，按月更新。

---

License: 文档 CC BY 4.0
