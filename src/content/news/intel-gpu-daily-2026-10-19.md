---
title: "Intel GPU 技术生态日报 (2026-10-19)"
description: "今日 Intel GPU 动态速览：包含驱动内核演进、算子与推理引擎适配进展。"
pubDate: "2026-10-19T08:30:00.000Z"
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

- **`[Merged]`** **Intel Triton 后端修复 vLLM INT4 unified_attention 测试引用错误**：修正 INT4 缓存旋转域不匹配，确保 per-token-head 测试正确。
- **`[Merged]`** **Intel Triton 后端改进循环内下沉门的嵌套区域压力计数**：修复 ReduceVariableLiveness 对嵌套区域压力计算，优化寄存器分配。
- **`[Merged]`** **SGLang XPU 默认启用融合 QK-norm + RoPE 内核**：将 Qwen3-MoE 的融合内核从可选改为默认，提升 XPU 性能。

## 下游优化与加速库 (intel/llm-scaler / Triton / OpenVINO)

- **[Triton XPU] [vLLM] Fix INT4 unified_attention per-token-head test reference**：测试 test_triton_unified_attention_per_token_head_scale 填充 INT4 缓存时未旋转 K/V，但 unified_attention_int4 内核将缓存视为 RHT 域（旋转 Q 并逆旋转 K/V），导致测试引用错误。修复调整测试填充逻辑以匹配内核的旋转约定，确保测试正确性。 [[Commit 9fbfb83](https://github.com/intel/intel-xpu-backend-for-triton/commit/9fbfb83a724bfb5406eba22b25b9e6ae456fd0dc)]
  > **影响：** 修复 INT4 unified_attention 测试的引用错误，使测试结果准确反映内核行为，避免误报。
- **[Triton XPU] [ReduceVariableLiveness] Count nested-region pressure in the in-loop sink gate**：in-loop sink gate (#8139) 用于将 dot 操作数加载下沉到循环内，但未正确计算嵌套区域内的压力，导致压力评估不准确。此提交基于 #8159 修正了嵌套区域内 pressureAt 的计算，并在此处纳入嵌套区域压力计数，从而改进下沉决策。 [[Commit dd5efd3](https://github.com/intel/intel-xpu-backend-for-triton/commit/dd5efd3207a233e0d5a27f22bf05b8ce519e95ef)]
  > **影响：** 改进寄存器压力评估，使循环内下沉决策更准确，可能减少寄存器溢出并提升性能。
- **[SGLang XPU] [Perf] [XPU] server_args: Enable fused QK-norm + RoPE by default**：此前 #40190 将融合 QK-norm + RoPE 内核（sgl_kernel.fused_inplace_qknorm_rope）接入 Qwen3-MoE 的 XPU 路径，但需通过 --enable-fused-qk-norm-rope 手动开启。A/B 测试显示该内核在 XPU 上性能更优，因此此 PR 将其设为默认启用，简化用户配置。 [[PR #43345](https://github.com/sgl-project/sglang/pull/43345)]
  > **影响：** XPU 上 Qwen3-MoE 推理默认启用融合内核，提升性能并减少用户手动调优负担。

## 驱动、内核与图形栈 (Windows 驱动 / Linux drm/xe / Mesa ANV)

- **[Linux drm/xe] Emulation graphical glitches/corruption (Vulkan rendering; UHD Graphics 730)**：用户报告在 gopher64/ares 模拟器（使用 ParaLLEl-RDP）中遇到 Vulkan 渲染图形故障/损坏，设备为 UHD Graphics 730，已使用最新驱动。报告者推测可能与 Vulkan 驱动或模拟器兼容性有关，但尚未得到官方确认。 [[Issue #1591](https://github.com/IGCIT/Intel-GPU-Community-Issue-Tracker-IGCIT/issues/1591)]
  > **影响：** 影响使用 Vulkan 模拟器的用户，可能导致图形异常；需进一步调查驱动或应用层根因。