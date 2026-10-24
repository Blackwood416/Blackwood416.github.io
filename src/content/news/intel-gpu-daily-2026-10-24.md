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

- **`[Merged]`** **Intel Triton 后端优化 FP8E4M3 到 FP16 的成对 upcast，消除 compare/select 指令**：合并 #8488 与 #8519，改进 dot B 操作数在每 warp 持有时的 upcast 效率，减少指令数。
- **`[Merged]`** **SGLang XPU 修复 rotary embedding 与 tokenizer padding 问题**：修复 XPU 上部分 rotary embedding 崩溃及自定义 tokenizer 的 _pad 覆盖问题。
- **`[Merged]`** **vLLM XPU 启用更多单元测试并调整 FP8 内核选择**：启用 kernel/sampler 测试，modernbert_fp8 改用 W8A8 内核，并新增 prefix-caching 测试。

## 下游优化与加速库 (intel/llm-scaler / Triton / OpenVINO)

- **[SGLang XPU] 修复 XPU rotary embeddings 和 tokenizer padding**：两个独立问题：1) 部分 rotary embedding 在 XPU 的 fallback kernel 路径上崩溃，可能是由于 kernel 实现未覆盖某些配置；2) 自定义 remote-code tokenizer 的 _pad() 覆盖在 padding_side 改变后导致每次请求崩溃。修复了相关逻辑。 [[PR #41213](https://github.com/sgl-project/sglang/pull/41213)]
  > **影响：** 修复 XPU 上 rotary embedding 和 tokenizer 的稳定性问题，提升 SGLang 在 XPU 上的可靠性。
- **[SGLang XPU] diffusion: 避免 flash attention 中的 QKV 拷贝**：XPUAttentionImpl.forward 在每次 flash-attention 调用前对 q、k、v 调用 .contiguous() 并 reshape，导致不必要的内存拷贝。该改动移除冗余的 contiguous 调用，直接使用已有内存布局，减少内存带宽消耗。 [[PR #41944](https://github.com/sgl-project/sglang/pull/41944)]
  > **影响：** 减少内存拷贝，提升 diffusion 模型在 XPU 上的推理性能。
- **[SGLang XPU] flux2: 融合 bit-exact LayerNorm 和 gated residual norm**：FLUX.2 在 CUDA 上有两个 eager fast path：LN(x) * (1 + scale) + shift 融合为 fused_layernorm_modulate_raw，以及 gated residual norm。该改动为 XPU 实现等效的融合 kernel，复现 CUDA aten 的 vectorized_layer_norm_kernel 位级行为，提升数值一致性和性能。 [[PR #41942](https://github.com/sgl-project/sglang/pull/41942)]
  > **影响：** 为 XPU 提供与 CUDA 对齐的融合 kernel，提升 FLUX.2 在 XPU 上的性能并保证数值一致性。
- **[SGLang XPU] diffusion: 使用 AOT SYCL 融合 residual-norm-scale-shift kernel**：XPU 上 ScaleResidualLayerNormScaleShift.forward_xpu 使用 triton kernel，但该 kernel 阻碍了 Wan2.2 DiT 块的 torch.compile，因为 Inductor 重新 lower 后 Intel triton 编译失败。该改动改用 AOT SYCL 融合 kernel，避免编译问题并提升性能。 [[PR #41401](https://github.com/sgl-project/sglang/pull/41401)]
  > **影响：** 解决 torch.compile 兼容性问题，提升 Wan2.2 在 XPU 上的编译和运行效率。
- **[SGLang XPU] CI: 将 FLUX.2 XPU norm-fusion 测试限定到 XPU 套件**：FLUX.2 XPU norm-fusion 测试被注册到 CPU 套件，但其 CPU 可运行路径导入 sglang.multimodal_gen.runtime.models.dits.fl... 导致失败。该改动将测试限定到 XPU 套件，避免 CPU 套件误跑。 [[PR #46040](https://github.com/sgl-project/sglang/pull/46040)]
  > **影响：** 修复 CI 测试套件配置问题，避免 CPU 套件失败，属于测试范围调整。
- **[vLLM XPU] 启用 kernel/sampler 单元测试于 Intel XPU**：许多 kernel/sampler/speculator 单元测试使用 Triton kernel，在 XPU 上可达，但被 CUDA 门控（如 torch.cuda.is_available() 跳过、is_cuda() 跳过等）。该改动移除这些门控，使测试在 XPU 上运行。 [[PR #62419](https://github.com/vllm-project/vllm/pull/62419)]
  > **影响：** 扩大 XPU 测试覆盖，提升代码质量，但属于测试启用而非功能修复。
- **[vLLM XPU] modernbert_fp8 单元测试改用 W8A8 FP8 linear kernel**：在 modernbert_fp8 单元测试中，XPU 调用 W8A16 FP8 linear kernel 导致失败，而 CUDA 使用 W8A8。该改动将 XPU 测试改为使用 W8A8 内核，与 CUDA 对齐并使测试通过。 [[PR #63281](https://github.com/vllm-project/vllm/pull/63281)]
  > **影响：** 修复测试失败，但属于测试适配而非内核修复，可能掩盖 XPU 上 W8A16 内核的问题。
- **[vLLM XPU] 为 GDN、Mamba 和 pooling 模型运行 prefix-caching 测试**：Intel CI 已检查 prefix-cache 命中率，但未检查缓存状态或输出的正确性。该改动为 GDN、Mamba 和 pooling 模型添加三个测试任务，镜像现有测试，确保 XPU 上缓存正确性。 [[PR #62683](https://github.com/vllm-project/vllm/pull/62683)]
  > **影响：** 增强 XPU 测试覆盖，但属于测试增强，不影响运行时功能。

## 主流框架与上游集成 (PyTorch / vLLM / SGLang / llama.cpp / Ollama)

- **[Triton XPU] FP8E4M3 成对 upcast 用于每 warp 持有的 dot B 操作数**：当 dot 的所有 warp 沿 M 维度分布时，每个 warp 需要 upcast 整个 B tile。原先逐元素或从 32 位加载的 dword 进行 upcast，导致较多值保持活跃。该改动改为成对 upcast，减少活跃值数量，提升寄存器利用率和性能。 [[PR #8488](https://github.com/intel/intel-xpu-backend-for-triton/commit/a663a48033762cb1c1cd99eeb53a4b3bc8bc6bdb)]
  > **影响：** 改善 FP8E4M3 到 FP16 转换的指令效率和寄存器压力，对注意力等依赖 dot 运算的场景有性能提升。
- **[Triton XPU] FP8E4M3 -> FP16 成对 upcast 中移除 compare 和 select**：在 #8488 基础上，进一步优化 FP8E4M3 到 FP16 的成对 upcast，避免生成 compare 和 select 指令。该改动修复了 #8478 问题，并依赖 #8488 的合并。通过消除条件指令，降低指令数并提升执行效率。 [[PR #8519](https://github.com/intel/intel-xpu-backend-for-triton/commit/55ebfbceac1cebb1c43d74d3a7f88f955a081ae5)]
  > **影响：** 减少指令数，提升 FP8 转换路径的吞吐，对使用 FP8 的模型推理有积极影响。