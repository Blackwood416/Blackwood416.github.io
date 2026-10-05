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

- **`[Merged]`** **vLLM 修复 DeepSeek V4 FP8 稀疏解码图捕获失败**：修复 XPU 上 DeepSeek-V4-Flash 启用图捕获时因 level_zero 不支持特性而启动失败的问题。
- **`[Merged]`** **Triton Intel GPU 后端修复直方图重复计数**：移植上游修复，确保直方图输入在复制布局下只计数一次，避免共享内存重复累加。
- **`[Merged]`** **SGLang 启用 Qwen3-MoE 融合 QK-norm 与 RoPE**：移除 CUDA 门控，使 XPU 使用融合内核，减少每层 RMSNorm 和 RoPE 启动次数。

## 下游优化与加速库 (intel/llm-scaler / Triton / OpenVINO)

- **[vLLM XPU] [Bugfix][XPU] Make DeepSeek V4 FP8 sparse decode graph-capturable**：XPU 上启用图捕获时，DeepSeek-V4-Flash 因 level_zero 后端返回 UR_RESULT_ERROR_UNSUPPORTED_FEATURE 而启动失败。根因是 xpu_sparse 相关操作在图捕获路径中使用了不受支持的特性，修复通过调整稀疏解码的图捕获逻辑，使其兼容 XPU 后端。 [[PR #59159](https://github.com/vllm-project/vllm/pull/59159)]
  > **影响：** 修复了 XPU 上 DeepSeek-V4-Flash 的启动问题，使图捕获功能可用，提升解码性能。
- **[SGLang XPU] [XPU][CI] Disable test_xpu_graph until tc_piecewise is removed**：XPU CI 中 test_xpu_graph.py 因 torch._dynamo 不支持 tc_piecewise 而持续失败，影响所有 PR。为恢复 CI 稳定性，暂时禁用该测试，直到 tc_piecewise 被移除或修复。 [[PR #42524](https://github.com/sgl-project/sglang/pull/42524)]
  > **影响：** 临时跳过 XPU 图测试，避免 CI 阻塞，但掩盖了潜在问题，需后续修复。
- **[SGLang XPU] [XPU] Enable fused QK-norm + RoPE for Qwen3-MoE**：Qwen3-MoE 已有融合 QK-norm 和 RoPE 的路径，但门控条件要求 _is_cuda，导致 XPU 上回退到多次内核启动。移除 CUDA 门控，使 XPU 也能使用融合内核，减少每层的 RMSNorm 和 RoPE 启动次数。 [[PR #40190](https://github.com/sgl-project/sglang/pull/40190)]
  > **影响：** XPU 上 Qwen3-MoE 推理性能提升，减少内核启动开销，降低延迟。

## 主流框架与上游集成 (PyTorch / vLLM / SGLang / llama.cpp / Ollama)

- **[Triton XPU] [TritonIntelGPU] Count each histogram input once (port triton-lang/triton#11767)**：在 Intel 直方图 lowering 中，当源布局在 lanes 或 warps 间复制元素时，每个副本都会对共享内存进行累加，导致直方图计数重复。移植上游修复，确保每个输入只计数一次，避免结果偏差。 [[Commit 223305f](https://github.com/intel/intel-xpu-backend-for-triton/commit/223305fb2e995c9e28419b2f9bcd74fb54327ec2)]
  > **影响：** 修复直方图内核在复制布局下的计数错误，保证结果正确性，对依赖直方图的算子（如某些注意力机制）有积极影响。
- **[Triton XPU] [github-bot] Update spirv-llvm-translator.conf**：自动更新 SPIR-V LLVM 翻译器的提交 ID，以同步上游修复或新特性，属于常规依赖更新，无功能改动。 [[Commit f6be955](https://github.com/intel/intel-xpu-backend-for-triton/commit/f6be95507f9b3a1b052532adf2350d8778c239c9)]
  > **影响：** 保持与上游翻译器同步，可能带来编译优化或新特性支持，但无直接用户可见影响。