---
title: "Intel GPU 技术生态日报 (2026-10-26)"
description: "Triton XPU 后端报告 IGC 实际编译的 GRF 数；SGLang 修复 XPU 上 dp-attention 的导入崩溃"
pubDate: "2026-10-26T08:30:00.000Z"
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

- <span class="news-badge news-badge--merged">Merged</span> **Triton XPU 后端报告 IGC 实际编译的 GRF 数** [详情 →](#triton-xpu-后端)
- <span class="news-badge news-badge--merged">Merged</span> **SGLang 修复 XPU 上 dp-attention 的导入崩溃** [详情 →](#sglang-xpu)

## 主流框架与上游集成

### SGLang XPU

<details class="news-minor">
<summary>1 项小改动</summary>

- SGLang 跳过 XPU 上的 CustomAllReduceV2 导入：XPU 上跳过不支持的 CustomAllReduceV2 导入 [PR #46417](https://github.com/sgl-project/sglang/pull/46417)

</details>

## 编译器与加速库

### Triton XPU 后端

- **Triton XPU 报告 IGC 实际 GRF 数**：load_binary 原先从构建标志推断 n_regs（256 或 128），但在 grf_mode='auto' 时 IGC 可能选择不同值，导致报告不准确。此改动让 load_binary 报告 IGC 实际编译使用的 GRF 数，提升调试和性能分析的准确性。 [commit c9ae4b3](https://github.com/intel/intel-xpu-backend-for-triton/commit/c9ae4b3fc786095b9459c18643829deacc08ede2)

  > **影响：** 使用 Triton XPU 后端且开启自动 GRF 模式的开发者，可获得更准确的寄存器占用信息。
