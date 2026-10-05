---
title: "Intel GPU 技术生态日报 (2026-10-05)"
description: "今日 Intel GPU 动态速览：包含驱动内核演进、算子与推理引擎适配进展。"
pubDate: "2026-10-05T08:30:00.000Z"
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

- **`[Merged]`** **vLLM XPU 修复 DeepSeek V4 FP8 稀疏解码图捕获失败**：修复 XPU 上 DeepSeek-V4-Flash 启用图捕获时因 level_zero 不支持特性而启动失败的问题。
- **`[Merged]`** **Triton Intel GPU 直方图输入计数修复**：移植上游修复，避免源布局复制元素时直方图重复计数。
- **`[Merged]`** **SGLang XPU 启用 Qwen3-MoE 融合 QK-norm+RoPE**：移除 CUDA 门控，使 XPU 使用融合路径，减少内核启动次数。

## 下游优化与加速库 (intel/llm-scaler / Triton / OpenVINO)

- **[vLLM XPU] [Bugfix][XPU] Make DeepSeek V4 FP8 sparse decode graph-capturable**：XPU 上 DeepSeek-V4-Flash 启用图捕获时，xpu_sparse 相关操作触发 level_zero 后端错误 UR_RESULT_ERROR_UNSUPPORTED_FEATURE。修复使稀疏解码路径支持图捕获，避免运行时错误。 [[PR #59159](https://github.com/vllm-project/vllm/pull/59159)]
  > **影响：** 修复 XPU 上 DeepSeek-V4-Flash 启动失败，使图捕获功能可用，提升解码性能。
- **[SGLang XPU] [XPU] Enable fused QK-norm + RoPE for Qwen3-MoE**：Qwen3-MoE 已有融合 QK-norm+RoPE 路径，但门控要求 _is_cuda，导致 XPU 回退到多次内核启动。移除 CUDA 门控，使 XPU 使用融合路径。 [[PR #40190](https://github.com/sgl-project/sglang/pull/40190)]
  > **影响：** 减少 XPU 上每层内核启动次数，提升 Qwen3-MoE 推理性能。

## 主流框架与上游集成 (PyTorch / vLLM / SGLang / llama.cpp / Ollama)

- **[Triton Intel GPU] [TritonIntelGPU] Count each histogram input once (port triton-lang/triton#11767)**：移植上游 triton-lang/triton#11767 修复到 Intel 直方图 lowering。当源布局在 lanes/warps 间复制元素时，每个副本都执行共享内存更新导致重复计数，修复为每个输入只计数一次。 [[Commit 223305f](https://github.com/intel/intel-xpu-backend-for-triton/commit/223305fb2e995c9e28419b2f9bcd74fb54327ec2)]
  > **影响：** 修复直方图内核在复制布局下的计数错误，保证结果正确性。
- **[Triton Intel GPU] [github-bot] Update spirv-llvm-translator.conf**：自动更新 spirv-llvm-translator 提交 ID，以同步上游翻译器修复或改进。 [[Commit f6be955](https://github.com/intel/intel-xpu-backend-for-triton/commit/f6be95507f9b3a1b052532adf2350d8778c239c9)]
  > **影响：** 保持与上游翻译器同步，可能修复 SPIR-V 生成相关问题。