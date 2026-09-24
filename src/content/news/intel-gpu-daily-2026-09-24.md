---
title: "Intel GPU 技术生态日报 (2026-09-24)"
description: "今日 Intel GPU 动态速览：包含驱动内核演进、算子与推理引擎适配进展。"
pubDate: "2026-09-24T08:30:00.000Z"
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

- **`[Merged]`** **XPU 后端模拟亚字原子加载/存储，解决 8/16 位原子操作缺失**：Intel GPU 无 8 位原子，16 位需扩展，现通过模拟实现兼容。
- **`[Merged]`** **vLLM XPU 启用 SYCL rotary embedding 内核，替代原生回退**：接入 SYCL 内核避免 CUDA 模块依赖，减少内核数量。
- **`[Merged]`** **vLLM XPU 升级至 PyTorch 2.14**：XPU 平台升级 PyTorch 版本，提升兼容性与性能。

## 下游优化与加速库 (intel/llm-scaler / Triton / OpenVINO)

- **[Triton XPU] 模拟亚字原子加载/存储**：Intel GPU 硬件不支持 8 位原子操作，16 位原子需要 SPV_INTEL_16bit_atomics 扩展，导致 tt.atomic_load/store 在多数目标上编译失败。该提交通过模拟实现这些亚字原子操作，确保功能可用。 [[PR #8128](https://github.com/intel/intel-xpu-backend-for-triton/commit/101f7b126df9fca3292f3f5cf61e6e324ecce777)]
  > **影响：** 扩展了 Triton XPU 对原子操作的支持，使依赖 8/16 位原子的内核能在 Intel GPU 上编译运行。
- **[vLLM XPU] 接入 SYCL apply_rotary_emb 内核**：此前 ApplyRotaryEmb 的 forward_cuda 导入 CUDA 专用模块，导致 XPU 回退到原生实现（约 8 个 elementwise 内核）。该 PR 接入 SYCL 内核，提供 forward_xpu 覆盖，减少内核数量并提升性能。 [[PR #55721](https://github.com/vllm-project/vllm/pull/55721)]
  > **影响：** 提升 vLLM 在 XPU 上的 rotary embedding 性能，减少内核启动开销。
- **[vLLM XPU] 升级至 PyTorch 2.14**：将 XPU 平台的 PyTorch 依赖升级至 2.14，以利用新版本特性与修复，提升整体兼容性和性能。 [[PR #56013](https://github.com/vllm-project/vllm/pull/56013)]
  > **影响：** vLLM XPU 用户可获得 PyTorch 2.14 的改进，包括可能的性能优化和 bug 修复。
- **[Triton XPU] LTS 驱动下 bfloat16 翻译回退**：LTS 驱动附带的 IGC 不支持 SPV_KHR_bfloat16 扩展，因此 SPIRV-LLVM-Translator 将 bfloat 翻译为 fp16 作为回退。该提交将回退条件限定在允许的扩展集内，避免在支持扩展时错误回退。 [[PR #8141](https://github.com/intel/intel-xpu-backend-for-triton/commit/d769d00e91a16d25730de2dc6bfd99086750d216)]
  > **影响：** 确保在 LTS 驱动上 bfloat16 内核可编译，同时不影响支持扩展的驱动。
- **[vLLM XPU] 移除 Dynamo 流注册修复的测试跳过**：上游 vLLM PR #43092 修复了 issue #7160（Dynamo 流注册问题），本提交移除/重新分类了之前因该问题跳过的 mrv2 测试，恢复测试覆盖。 [[PR #8116](https://github.com/intel/intel-xpu-backend-for-triton/commit/3859a333d24fa73c25c65ab2ea67239194a8ea7e)]
  > **影响：** 恢复相关测试，确保 Dynamo 流注册功能在 XPU 上得到验证。
- **[vLLM XPU] 重新启用 batched experts 测试**：在 PR #7776 修复 MoE 相关问题后，重新启用 PVC 和 Xe2 上的 batched-experts 测试，CI 显示 288 个用例通过。 [[PR #8153](https://github.com/intel/intel-xpu-backend-for-triton/commit/9ec6091971392c52f56d929c02e98a3c918696b2)]
  > **影响：** 恢复 MoE 相关测试覆盖，验证修复有效性。
- **[Triton XPU] 移动 Intel 测试 passes 到独立目录**：将五个 Intel 专属测试 passes（TestAxisInfo 等）从 test/lib/Analysis 移动到 third_party/intel/test/lib/Analysis，以更好地组织代码结构。 [[PR #8127](https://github.com/intel/intel-xpu-backend-for-triton/commit/8e62dbd60e83fff885ba677e2ec8becb1e8f9a8b)]
  > **影响：** 代码结构更清晰，便于维护和区分 Intel 专属测试。
- **[Triton XPU] 更新 SPIRV-LLVM-Translator 版本**：自动更新 spirv-llvm-translator.conf 中的 translator commit id，以同步上游修复和改进。 [[PR #8155](https://github.com/intel/intel-xpu-backend-for-triton/commit/4950541981130ff85d9483ac864e952be6254177)]
  > **影响：** 保持与最新 translator 同步，可能带来 bug 修复和性能提升。
- **[SGLang XPU] BMG 作业安装 sgl-kernel-xpu**：SGLang 的 ModelRegistry 在缺少 sgl_kernel 时会吞掉 ImportError，导致 208/219 架构无法加载。该提交在 BMG 作业中构建并安装 sgl-kernel-xpu，确保 e2e 测试能加载模型。 [[PR #8130](https://github.com/intel/intel-xpu-backend-for-triton/commit/88aa538d528f8973f1f044f88104fb0e8dd84419)]
  > **影响：** 修复 BMG 作业的测试环境，使 SGLang e2e 测试能够正常运行。
- **[SGLang XPU] Qwen3.8-flash-next 支持**：为 Qwen3.8-Flash-Next 模型添加 XPU 支持，该模型引入稀疏注意力索引器（QSA）、HyperConnection 等新架构特性。 [[PR #37213](https://github.com/sgl-project/sglang/pull/37213)]
  > **影响：** SGLang XPU 用户可运行 Qwen3.8-Flash-Next 模型，扩展模型支持范围。
- **[SGLang XPU] NGRAM 投机解码支持**：为 XPU 目标添加 NGRAM 投机解码支持，提升解码效率。 [[PR #31362](https://github.com/sgl-project/sglang/pull/31362)]
  > **影响：** XPU 用户可使用 NGRAM 投机解码，加速推理。
- **[vLLM XPU] 禁用特定 MTP 测试**：在 XPU CI 中禁用 test_glm_mtp_defers_lm_head 测试，可能因该测试在 XPU 上不稳定或未实现。 [[PR #58237](https://github.com/vllm-project/vllm/pull/58237)]
  > **影响：** 减少 CI 失败，但可能掩盖 XPU 上的潜在问题。
- **[oneDNN] 发布 v3.13.1**：oneDNN 发布 v3.13.1 版本，包含性能优化和 bug 修复，对 Intel GPU 上的深度学习推理有积极影响。 [[Release v3.13.1](https://github.com/uxlfoundation/oneDNN/releases/tag/v3.13.1)]
  > **影响：** 开发者可升级 oneDNN 获得改进，提升 Intel GPU 上的推理性能。