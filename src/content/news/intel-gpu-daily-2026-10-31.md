---
title: "Intel GPU 技术生态日报 (2026-10-31)"
description: "vLLM 修复 XPU 上 DeepSeek-V3.2 等模型崩溃；Intel Triton 修复 2D 块访问越界问题"
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

- <span class="news-badge news-badge--merged">Merged</span> **vLLM 修复 XPU 上 DeepSeek-V3.2 等模型崩溃** [详情 →](#vllm-xpu)
- <span class="news-badge news-badge--merged">Merged</span> **Intel Triton 修复 2D 块访问越界问题** [详情 →](#triton-xpu-后端)

## 主流框架与上游集成

### vLLM XPU

- **为 XPUMLASparseImpl 补充缺失方法**：MLAAttention.forward 在稀疏层调用 record_logical_topk_ready，但 XPUMLASparseImpl 未定义该方法，导致 DeepSeek-V3.2 和 GLM-5.x 在 XPU 上首次前向时抛出 AttributeError。修复为 XPU 实现添加该方法。 [PR #64065](https://github.com/vllm-project/vllm/pull/64065)

  > **影响：** 使用 vLLM 在 XPU 上运行 DeepSeek-V3.2 或 GLM-5.x 的用户，升级后不再崩溃。

<details class="news-minor">
<summary>其他 2 项小改动</summary>

- vLLM XPU 内核改用 GitHub Pages 索引：更新 XPU 内核安装源 [PR #64633](https://github.com/vllm-project/vllm/pull/64633)
- 在 XPU 上启用流式输入 e2e 测试：启用 XPU 流式输入测试 [PR #64285](https://github.com/vllm-project/vllm/pull/64285)

</details>

## 编译器与加速库

### Triton XPU 后端

- **保留喂给 llvm.assume 的比较**：范围分析从假设本身推导出比较结果，导致 FoldTrueCmpI 将所有 tl.assume 条件折叠为 true，使 llvm.intr.assume 收到常量 true，失去优化信息。修复为保留喂给 assume 的比较，避免错误折叠。 [commit 61732f9](https://github.com/intel/intel-xpu-backend-for-triton/commit/61732f9cfd0e81d8a2a06625ff309d14699b7cf8)

  > **影响：** 使用 Intel Triton 后端的用户，编译优化更准确，可能影响性能。

- **修复 2D 块访问左越界问题**：64 字节基址对齐补偿导致 2D 块消息在真实基址前最多偏移 63 字节，硬件只对加载零填充，导致越界访问。修复为在列 0 左侧填充或丢弃描述符 2D 块访问。 [commit 2f23516](https://github.com/intel/intel-xpu-backend-for-triton/commit/2f23516c4be1dd4b75514e6a791a2813febd58b0)

  > **影响：** 使用 Intel Triton 后端且涉及 2D 块访问的用户，修复潜在内存错误。

<details class="news-minor">
<summary>其他 1 项小改动</summary>

- 从 xe2 跳过列表移除已通过的 MoE 测试：移除已通过的 MoE 测试跳过 [commit e0da8c8](https://github.com/intel/intel-xpu-backend-for-triton/commit/e0da8c815db53d1d2121aadb91dbff0854e7efed)

</details>

## 驱动、内核与图形栈

### compute-runtime

<details class="news-minor">
<summary>1 项小改动</summary>

- 修复中线程抢占表面延迟备份：修复中线程抢占表面备份 [26.35.39758.21](https://github.com/intel/compute-runtime/releases/tag/26.35.39758.21)

</details>

### IGC 图形编译器

<details class="news-minor">
<summary>1 项小改动</summary>

- IGC 版本提升至 v2.43.1：IGC 发布 v2.43.1 [v2.43.1](https://github.com/intel/intel-graphics-compiler/releases/tag/v2.43.1)

</details>
