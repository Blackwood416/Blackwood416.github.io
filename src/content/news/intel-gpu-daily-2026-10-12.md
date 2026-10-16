---
title: "Intel GPU 技术生态日报 (2026-10-12)"
description: "今日 Intel GPU 动态速览：包含驱动内核演进、算子与推理引擎适配进展。"
pubDate: "2026-10-12T08:30:00.000Z"
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

- **`[Merged]`** **vLLM XPU 启用 CUDA Graph 测试并移除硬编码**：移除 tests/v1/cudagraph/ 中的 CUDA 硬编码，使 XPU 可运行图测试。
- **`[Merged]`** **vLLM XPU 限制 FlashAttention 块大小为 64 的倍数**：在 XPU 上强制 flash_attn_varlen_func 的 block_size 为 64 的倍数以提升性能。

## 下游优化与加速库 (intel/llm-scaler / Triton / OpenVINO)

- **[vLLM XPU] Enable XPU graph in graph tests**：该 PR 移除了 tests/v1/cudagraph/ 中硬编码的 CUDA 依赖，使图测试能够在 XPU 后端运行。这属于测试基础设施的通用化改动，不涉及运行时逻辑变更。 [[PR #60784](https://github.com/vllm-project/vllm/pull/60784)]
  > **影响：** XPU 后端现在可以运行 CUDA Graph 相关测试，提升 CI 覆盖度，便于发现 XPU 上的图执行问题。
- **[vLLM XPU] Limit FA kernel block size to multipleOf 64**：在 XPU 平台上，flash_attn_varlen_func 从性能角度偏好 block_size 为 64 的倍数。该 PR 在 get_preferred_block_size 中为 XPU 添加了相应路径，强制块大小对齐到 64 的倍数，以匹配硬件偏好。 [[PR #57297](https://github.com/vllm-project/vllm/pull/57297)]
  > **影响：** 提升 XPU 上 FlashAttention 内核的执行效率，减少因块大小不对齐导致的性能损失。