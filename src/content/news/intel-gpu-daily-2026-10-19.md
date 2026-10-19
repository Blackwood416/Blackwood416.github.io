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

- **`[Merged]`** **Intel Triton 后端修复 vLLM INT4 unified_attention 测试参考值**：修正 INT4 缓存旋转域不匹配，确保 per-token-head 测试正确。
- **`[Merged]`** **Intel Triton 后端改进循环内下沉门控的嵌套区域压力计数**：在 ReduceVariableLiveness 中计入嵌套区域压力，优化点积操作数下沉。

## 下游优化与加速库 (intel/llm-scaler / Triton / OpenVINO)

- **[Triton XPU] [vLLM] Fix INT4 unified_attention per-token-head test reference**：测试 test_triton_unified_attention_per_token_head_scale 填充 INT4 缓存时使用了未旋转的 K/V，但 unified_attention_int4 将缓存视为 RHT 域（对 Q 旋转、对 K/V 逆旋转），导致测试参考值不匹配。修复通过调整测试填充逻辑，使缓存与实现预期一致。 [[Commit 9fbfb83](https://github.com/intel/intel-xpu-backend-for-triton/commit/9fbfb83a724bfb5406eba22b25b9e6ae456fd0dc)]
  > **影响：** 修复了 vLLM INT4 unified_attention 在 per-token-head 场景下的测试失败，确保测试正确性。
- **[Triton XPU] [ReduceVariableLiveness] Count nested-region pressure in the in-loop sink gate**：该提交修复了 ReduceVariableLiveness 中 in-loop sink gate 对嵌套区域压力计算不准确的问题。此前压力计算未考虑嵌套区域内的压力，导致点积操作数下沉决策可能不优。通过修正压力计算，使下沉门控更准确。 [[Commit dd5efd3](https://github.com/intel/intel-xpu-backend-for-triton/commit/dd5efd3207a233e0d5a27f22bf05b8ce519e95ef)]
  > **影响：** 优化了循环内点积操作数的下沉决策，可能减少寄存器压力，提升性能。