# 云计算 · 从机器向上 — 交互式教材

一本为“快速学习者”设计的云计算教材：**云优先，操作系统（CS162）在你正需要它时即时补齐**。
全站是静态 HTML/CSS/JS，无构建步骤，直接从文件系统或本地服务器打开都可以运行。

## 怎么打开

~~~bash
cd ~/cloud-book
python3 -m http.server 8000
~~~

然后浏览器打开 http://localhost:8000

也可以直接双击 `index.html`，因为全站不用 `fetch`。

## 当前进度

- ✅ 封面 + 全书目录（5 部 14 章）
- ✅ 第 1 章：定制交互标杆
- ✅ 第 2–14 章：完整章节页，每章都有核心流程动画、取舍模拟器、OS/云桥接表、深潜检查点和章节收束
- ✅ 共享交互库：`lib/components.js` + `lib/lesson-widgets.js`

## 章节

- 01 · 云是别人的电脑 — `ch01-what-is-cloud/index.html`
- 02 · 幻觉机器：虚拟化 CPU — `ch02-cpu-virtualization/index.html`
- 03 · 内存的海市蜃楼 — `ch03-virtual-memory/index.html`
- 04 · 同时做很多事：并发 — `ch04-concurrency/index.html`
- 05 · I/O、文件与存储 — `ch05-io-storage/index.html`
- 06 · 虚拟化与 Hypervisor — `ch06-virtualization/index.html`
- 07 · 容器：轻量的幻觉 — `ch07-containers/index.html`
- 08 · 网络即计算机 — `ch08-networking/index.html`
- 09 · 规模化存储 — `ch09-storage-scale/index.html`
- 10 · 当机器们意见不合 — `ch10-distributed/index.html`
- 11 · 编排：Kubernetes — `ch11-kubernetes/index.html`
- 12 · 伸缩与韧性 — `ch12-scaling-resilience/index.html`
- 13 · Serverless — `ch13-serverless/index.html`
- 14 · GPU 与 AI 推理上云 — `ch14-ai-inference/index.html`

## 设计约定

- 每章独立目录，复用 `../styles/design.css` 与共享 JS
- 术语用 `<span class="term" data-gloss="key">…</span>`，在页尾 `window.CB_GLOSS` 里定义释义
- 分步动画用 `CB.StepPlayer` 或 `CB.initGenericChapter`
- 折叠的“深潜”用 `<details class="deep">`
- 要点框用 `.box.intuition / .formal / .pitfall`

## 维护

`scripts/build-chapters.js` 生成第 2–14 章和首页。修改数据后运行：

~~~bash
node scripts/build-chapters.js
~~~
