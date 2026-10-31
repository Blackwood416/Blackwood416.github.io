---
title: "Intel GPU 技术生态日报 (2026-10-31)"
description: "vLLM XPU 修复稀疏注意力崩溃，DeepSeek-V3.2 等可运行；Triton XPU 修复 2D 块访问越界，避免错误数据"
pubDate: "2026-10-31T08:30:00.000Z"
tags:
  - Intel
  - GPU
  - Arc
  - oneAPI
  - XPU
  - 日报
categories:
  - 技术日报
  - 显卡
draft: false
---

## 核心速览

- <span class="news-badge news-badge--merged">Merged</span> **vLLM XPU 修复稀疏注意力崩溃，DeepSeek-V3.2 等可运行** [详情 →](#vllm-xpu)
- <span class="news-badge news-badge--merged">Merged</span> **Triton XPU 修复 2D 块访问越界，避免错误数据** [详情 →](#triton-xpu-后端)

## 主流框架与上游集成

### vLLM XPU

- **为 XPUMLASparseImpl 补充 record_logical_topk_ready**：MLAAttention.forward 在每个稀疏层调用 impl.record_logical_topk_ready()，但 XPUMLASparseImpl 未定义该方法，导致 DeepSeek-V3.2 和 GLM-5.x 在 XPU 上首次前向时抛出 AttributeError。修复为 XPU 实现添加该方法，使稀疏注意力路径正常工作。 [PR #64065](https://github.com/vllm-project/vllm/pull/64065)

  > **影响：** 使用 DeepSeek-V3.2 或 GLM-5.x 的 vLLM XPU 用户可避免崩溃，需更新到包含此修复的版本。

<details class="news-minor">
<summary>其他 2 项小改动</summary>

- vLLM XPU 改用 GitHub Pages 索引安装内核包：改用 GitHub Pages 索引安装 XPU 内核包 [PR #64633](https://github.com/vllm-project/vllm/pull/64633)
- 在 XPU CI 启用流式输入端到端测试：启用 XPU 流式输入端到端测试 [PR #64285](https://github.com/vllm-project/vllm/pull/64285)

</details>

## 编译器与加速库

### Triton XPU 后端

- **保留喂给 llvm.intr.assume 的比较，避免误折叠**：范围分析能从假设本身证明假设的比较，导致 FoldTrueCmpI 将每个 tl.assume 条件折叠为 %true，留下 llvm.intr.assume %true，可能使后续优化失效。修复保留喂给 assume 的比较，确保假设信息不被错误消除。 [commit 61732f9](https://github.com/intel/intel-xpu-backend-for-triton/commit/61732f9cfd0e81d8a2a06625ff309d14699b7cf8)

  > **影响：** 使用 Triton XPU 后端的用户可能获得更准确的优化结果，但具体影响需验证。

- **修复 2D 块访问在列 0 左侧的填充或丢弃**：由于 64 字节基址对齐补偿，2D 块消息可能在实际基址前最多 63 字节开始，硬件只对加载进行零填充，导致越界访问。修复在列 0 左侧进行填充或丢弃，确保访问安全。 [commit 2f23516](https://github.com/intel/intel-xpu-backend-for-triton/commit/2f23516c4be1dd4b75514e6a791a2813febd58b0)

  > **影响：** 使用 Triton XPU 后端且涉及 2D 块访问的用户可避免潜在错误数据或崩溃。

<details class="news-minor">
<summary>其他 1 项小改动</summary>

- 从 xe2 skiplist 移除已通过的 MoE 测试：移除已通过的 MoE 测试跳过项 [commit e0da8c8](https://github.com/intel/intel-xpu-backend-for-triton/commit/e0da8c815db53d1d2121aadb91dbff0854e7efed)

</details>

## 驱动、内核与图形栈

### compute-runtime

<details class="news-minor">
<summary>1 项小改动</summary>

- compute-runtime 修复中线程抢占表面延迟分配：修复中线程抢占表面分配 [26.35.39758.21](https://github.com/intel/compute-runtime/releases/tag/26.35.39758.21)

</details>

### IGC 图形编译器

<details class="news-minor">
<summary>1 项小改动</summary>

- IGC 发布 v2.43.1，版本号升至 43：IGC 发布 v2.43.1 [v2.43.1](https://github.com/intel/intel-graphics-compiler/releases/tag/v2.43.1)

</details>
