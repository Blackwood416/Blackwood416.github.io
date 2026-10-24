---
title: "Intel GPU 技术生态日报 (2026-10-24)"
description: "今日 Intel GPU 动态速览：包含驱动内核演进、算子与推理引擎适配进展。"
pubDate: "2026-10-24T08:30:00.000Z"
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

- **`[Merged]`** **Intel Triton 后端优化 FP8E4M3 到 FP16 的成对 upcast 以提升性能**：合并两个补丁，将 dot B 操作数按对 upcast，消除 compare/select 指令，减少寄存器压力。
- **`[Merged]`** **vLLM XPU 启用更多单元测试并修复 FP8 内核选择**：启用 kernel/sampler 测试，modernbert_fp8 改用 W8A8 内核，并新增 prefix-caching 测试。
- **`[Merged]`** **SGLang XPU 修复 rotary embeddings 和 tokenizer padding 问题**：修复 XPU 上部分 rotary embeddings 崩溃和自定义 tokenizer 的 padding 覆盖问题。

## 下游优化与加速库 (intel/llm-scaler / Triton / OpenVINO)

- **[vLLM XPU] 启用 kernel/sampler 单元测试**：许多 kernel/sampler/speculator 单元测试在 XPU 上可运行但被 CUDA 门控跳过，此 PR 移除这些门控以在 XPU 上启用测试，扩大测试覆盖。 [[PR #62419](https://github.com/vllm-project/vllm/pull/62419)]
  > **影响：** 增加 XPU 上的测试覆盖，但属于测试启用而非功能修复。
- **[vLLM XPU] modernbert_fp8 测试改用 W8A8 内核**：在 XPU 上，modernbert_fp8 单元测试调用 W8A16 内核失败，而 CUDA 使用 W8A8。此 PR 将 XPU 测试改为使用 W8A8 内核以对齐 CUDA 并使其通过。 [[PR #63281](https://github.com/vllm-project/vllm/pull/63281)]
  > **影响：** 修复测试失败，但属于测试对齐而非内核功能修复。
- **[vLLM XPU] 新增 prefix-caching 测试**：为 GDN、Mamba 和 pooling 模型在 XPU 上添加 prefix-caching 正确性测试，镜像 CUDA 的测试作业，确保缓存状态和输出正确。 [[PR #62683](https://github.com/vllm-project/vllm/pull/62683)]
  > **影响：** 增强 XPU 上 prefix-caching 功能的验证，属于测试补充。
- **[SGLang XPU] 修复 XPU rotary embeddings 和 tokenizer padding**：两个独立问题：部分 rotary embeddings 在 XPU 的 fallback kernel 路径崩溃；自定义远程代码 tokenizer 的过时 _pad() 覆盖在 padding_side 改变后导致每次请求崩溃。 [[PR #41213](https://github.com/sgl-project/sglang/pull/41213)]
  > **影响：** 修复 XPU 上 rotary embeddings 和 tokenizer 的崩溃问题，提升稳定性。
- **[SGLang XPU] FLUX.2 XPU norm-fusion 测试仅限 XPU 套件**：FLUX.2 norm-fusion 测试被错误注册到 CPU 套件，但其 CPU 路径导入 XPU 特定模块，导致失败。此 PR 将其限制在 XPU 套件运行。 [[PR #46040](https://github.com/sgl-project/sglang/pull/46040)]
  > **影响：** 修复 CI 测试配置错误，属于测试调整。
- **[SGLang XPU] FLUX.2 融合 LayerNorm 和 gated residual norm**：为 FLUX.2 在 XPU 上实现 bit-exact 的 LayerNorm 和 gated residual norm 融合，使用 Triton 内核复现 CUDA aten 的 vectorized_layer_norm_kernel，提升性能。 [[PR #41942](https://github.com/sgl-project/sglang/pull/41942)]
  > **影响：** 提升 FLUX.2 在 XPU 上的推理性能，减少内核调用开销。
- **[SGLang XPU] 使用 AOT SYCL 融合 residual-norm-scale-shift 内核**：在 XPU 上，ScaleResidualLayerNormScaleShift 的 Triton 内核阻碍 torch.compile，Inductor 重新降低后 Intel Triton 编译失败。改用 AOT SYCL 融合内核避免此问题。 [[PR #41401](https://github.com/sgl-project/sglang/pull/41401)]
  > **影响：** 解决 torch.compile 编译失败，提升 Wan2.2 DiT 块的编译和运行性能。

## 主流框架与上游集成 (PyTorch / vLLM / SGLang / llama.cpp / Ollama)

- **[Triton XPU] FP8E4M3 到 FP16 成对 upcast 消除 compare/select**：该补丁修复了 FP8E4M3 到 FP16 的 upcast 路径，通过成对处理避免生成 compare 和 select 指令，从而减少指令数并降低寄存器压力。依赖 #8488 确保 dot B 操作数由每个 warp 持有。 [[PR #8519](https://github.com/intel/intel-xpu-backend-for-triton/commit/55ebfbceac1cebb1c43d74d3a7f88f955a081ae5)]
  > **影响：** 提升 FP8 矩阵乘法的编译效率和运行时性能，减少寄存器占用。
- **[Triton XPU] dot B 操作数按对 upcast 优化**：当所有 warp 沿 M 维度分布时，每个 warp 需要 upcast 整个 B tile。原先逐元素或从 32 位加载的 dword 进行 upcast 导致更多值保持活跃，现改为成对 upcast 以减少活跃值数量，降低寄存器压力。 [[PR #8488](https://github.com/intel/intel-xpu-backend-for-triton/commit/a663a48033762cb1c1cd99eeb53a4b3bc8bc6bdb)]
  > **影响：** 减少寄存器压力，提升 FP8 点积操作的性能，尤其适用于统一注意力解码场景。
- **[Triton XPU] 更新 spirv-llvm-translator 配置**：自动更新 spirv-llvm-translator 的 commit id，以同步上游翻译器的改进。 [[PR #8525](https://github.com/intel/intel-xpu-backend-for-triton/commit/2cbe3f9d87f99a10e65096b8d4f7af60323a51e2)]
  > **影响：** 保持与最新 SPIR-V LLVM 翻译器的兼容性，可能带来编译优化。