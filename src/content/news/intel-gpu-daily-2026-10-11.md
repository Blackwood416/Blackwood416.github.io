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

- **`[Merged]`** **vLLM GDN attention 测试在 BMG 上全部通过，移除跳过列表**：1600 个 vllm_gdn_attn 测试在 BMG 上全部通过，移除跳过列表。
- **`[Merged]`** **Triton XPU 为 CRI 的 GEMM 基准添加 512-GRF 自动调优配置**：在 CRI 上为 GEMM 基准测试添加 512-GRF 模式下的 tile 配置。

## 下游优化与加速库 (intel/llm-scaler / Triton / OpenVINO)

- **[vLLM XPU] Unskip vllm_gdn_attn tests that run Triton kernel on XPU**：该提交移除了 vllm_gdn_attn 测试的跳过列表，因为所有 1600 个测试在 BMG 上均通过。这表示之前因功能不完整或性能问题而跳过的测试现已稳定，可能得益于 Triton XPU 后端的改进。 [[Commit f84f7d0](https://github.com/intel/intel-xpu-backend-for-triton/commit/f84f7d07148e5ae18a670374bbdb94daf4aac65c)]
  > **影响：** 增加了 vLLM 在 XPU 上的测试覆盖，确保 GDN 注意力相关功能在 BMG 上得到验证。

## 主流框架与上游集成 (PyTorch / vLLM / SGLang / llama.cpp / Ollama)

- **[Triton XPU] Autotune gemm benchmarks with 512-GRF configs**：该提交为 CRI 上的 GEMM 基准测试添加了 512-GRF 模式下的自动调优配置，包括 batched 和 non-batched 内核的特定 tile 尺寸。这扩展了自动调优的搜索空间，以探索更高 GRF 模式下的性能潜力。 [[Commit 2834e8d](https://github.com/intel/intel-xpu-backend-for-triton/commit/2834e8dc0fadc6265cf00b283d75d0de8139ea73)]
  > **影响：** 为 CRI 上的 GEMM 基准测试提供更多调优选项，可能带来性能提升，但需要验证实际效果。