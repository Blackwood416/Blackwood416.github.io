---
title: "Intel GPU 技术生态日报 (2026-11-09)"
description: "XPU 上修复隐私过滤测试的 RoPE 缓冲区精度问题；Triton XPU 后端增加资源超限检查，避免非法配置"
pubDate: "2026-11-09T08:30:00.000Z"
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

- <span class="news-badge news-badge--merged">Merged</span> **XPU 上修复隐私过滤测试的 RoPE 缓冲区精度问题** [详情 →](#vllm-xpu)
- <span class="news-badge news-badge--merged">Merged</span> **Triton XPU 后端增加资源超限检查，避免非法配置** [详情 →](#triton-xpu-后端)

## 主流框架与上游集成

### vLLM XPU

- **XPU 新增 MoE 全对全专家并行后端**：为 XPU 添加了批处理 + 路由专家并行（EP）的后端，用于 MoE 模型。目前仍为 WIP，存在端到端性能下降，部分 bug 已修复，依赖即将到来的自动调优。 [PR #46871](https://github.com/vllm-project/vllm/pull/46871)

  > **影响：** XPU 上使用 MoE 模型的用户可尝试此后端，但需注意性能尚未优化。

<details class="news-minor">
<summary>其他 1 项小改动</summary>

- 修复 XPU 隐私过滤测试的 RoPE 缓冲区精度：保留 RoPE 缓冲区 FP32 精度以修复测试 [PR #65323](https://github.com/vllm-project/vllm/pull/65323)

</details>

## 编译器与加速库

### Triton XPU 后端

- **Triton XPU 后端增加资源超限检查**：在 Intel Triton 后端中，validate_options 仅按最小子组大小限制 num_warps，导致当 warp 大小为 32 时可能超出工作组大小。此改动在 num_warps * warp_size 超过工作组大小时抛出 OutOfResources 异常，避免非法配置。 [commit 8686bc8](https://github.com/intel/intel-xpu-backend-for-triton/commit/8686bc85d99a44c872d0f6855f6f1fa341ef01b1)

  > **影响：** 使用 Triton 编译内核的开发者将获得更明确的错误提示，避免运行时崩溃。
