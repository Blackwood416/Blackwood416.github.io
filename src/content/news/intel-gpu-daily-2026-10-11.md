---
title: "Intel GPU 技术生态日报 (2026-10-11)"
description: "今日 Intel GPU 动态速览：包含驱动内核演进、算子与推理引擎适配进展。"
pubDate: "2026-10-11T08:30:00.000Z"
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

- **`[Merged]`** **vLLM XPU 全部 1600 个 GDN 注意力测试在 BMG 上通过，移除跳过列表**：Triton XPU 后端取消 vllm_gdn_attn 测试跳过，全部测试在 BMG 上通过。
- **`[Merged]`** **CRI 上 GEMM 基准自动调优新增 512-GRF 配置**：Triton XPU 在 CRI 上为 GEMM 基准增加 512-GRF 模式下的 tile 配置自动调优。

## 下游优化与加速库 (intel/llm-scaler / Triton / OpenVINO)

- **[Triton XPU] vLLM XPU 取消 GDN 注意力测试跳过列表**：该提交移除了 vllm_gdn_attn 测试的跳过列表，因为所有 1600 个测试在 BMG 上全部通过。此前这些测试因 XPU 后端功能不完整或性能问题被跳过，现在功能已完善，测试恢复执行。 [[Commit f84f7d0](https://github.com/intel/intel-xpu-backend-for-triton/commit/f84f7d07148e5ae18a670374bbdb94daf4aac65c)]
  > **影响：** 恢复了对 vLLM GDN 注意力内核在 XPU 上的完整回归测试覆盖，确保后续改动不会破坏该功能。
- **[Triton XPU] CRI GEMM 基准自动调优增加 512-GRF 配置**：在 CRI 平台上，GEMM 基准的自动调优现在会尝试 grf_mode='512' 下的若干 tile 配置，包括 batched kernel 的 256x128 和 64x128，以及非 batched 的 256x256 和 batched 的 256x128。这扩展了调优空间，以探索 512-GRF 模式下的性能潜力。 [[Commit 2834e8d](https://github.com/intel/intel-xpu-backend-for-triton/commit/2834e8dc0fadc6265cf00b283d75d0de8139ea73)]
  > **影响：** 为 CRI 上的 GEMM 基准提供更全面的性能调优覆盖，可能发现更优的 tile 配置，提升内核性能。