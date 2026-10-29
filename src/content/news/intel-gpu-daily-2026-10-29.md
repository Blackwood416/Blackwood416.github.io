---
title: "Intel GPU 技术生态日报 (2026-10-29)"
description: "Triton XPU 通过 SPV_INTEL 显式请求 GRF 模式，替代旧机制；vLLM XPU 修复 FP8 融合测试，因默认路径不产生量化算子"
pubDate: "2026-10-29T08:30:00.000Z"
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

- <span class="news-badge news-badge--merged">Merged</span> **Triton XPU 通过 SPV_INTEL 显式请求 GRF 模式，替代旧机制** [详情 →](#triton-xpu-后端)
- <span class="news-badge news-badge--merged">Merged</span> **vLLM XPU 修复 FP8 融合测试，因默认路径不产生量化算子** [详情 →](#vllm-xpu)

## 主流框架与上游集成

### vLLM XPU

- **vLLM XPU 升级 xpu-kernels 至 v0.1.16.2**：将 vllm-xpu-kernels 依赖升级到 v0.1.16.2，可能包含性能优化或 bug 修复。 [PR #61956](https://github.com/vllm-project/vllm/pull/61956)

  > **影响：** 使用 vLLM XPU 的用户应更新依赖以获取修复。

<details class="news-minor">
<summary>其他 1 项小改动</summary>

- 修复 XPU FP8 融合测试失败：修复 FP8 融合测试，需设置 linear_backend [PR #63975](https://github.com/vllm-project/vllm/pull/63975)

</details>

## 编译器与加速库

### Triton XPU 后端

- **显式 GRF 模式通过 SPV_INTEL 设置**：在 kernel 上通过 SPV_INTEL_maximum_registers 执行模式显式设置 grf_mode（'128'、'256'、'512' 或 'auto'），替代原先通过其他方式传递的模式。这使 GRF 模式控制更直接，便于针对不同硬件配置优化。 [commit 7e61b7e](https://github.com/intel/intel-xpu-backend-for-triton/commit/7e61b7e4101564e2b1942d67ec0405c7ff2df349)

  > **影响：** 使用 Triton XPU 后端的开发者可受益于更精确的 GRF 控制，但需注意新执行模式与旧驱动/工具的兼容性。

- **合并相同守卫的 if 块**：在 PrepareIfCombining 中，当代码位于相同守卫的 if 块之间时，现在可以合并这些 if 块。这解决了 RemoveMasks 为每个掩码循环生成独立 scf.if 导致的问题，减少代码膨胀。 [commit 06610e5](https://github.com/intel/intel-xpu-backend-for-triton/commit/06610e5d96e1d7fb75aa7aac61e4ef61af54a4d3)

  > **影响：** 可能改善 Triton XPU 编译后的代码大小和性能，但需验证。

<details class="news-minor">
<summary>其他 6 项小改动</summary>

- 移除核心文件中无用的 fork 改动：清理无用代码，无功能影响 [commit a8144a0](https://github.com/intel/intel-xpu-backend-for-triton/commit/a8144a07ebd08756c57f083d6c3cb8e3138dbda3)
- 基准测试改用 TRITON_XPU_GEN_NATIVE_CODE 环境变量：基准测试加速，使用新环境变量 [commit dc550bd](https://github.com/intel/intel-xpu-backend-for-triton/commit/dc550bd41e4f5f2757c5e6f87a0d8fe7d8dc6e61)
- 跳过 vLLM ngram 解码测试变体：跳过非确定性 ngram 测试 [commit a451e15](https://github.com/intel/intel-xpu-backend-for-triton/commit/a451e15434df4c65b9a4aeddeccf9b5805ae1c5c)
- 移除 mamba 测试排序补丁：移除不再需要的测试补丁 [commit ad463da](https://github.com/intel/intel-xpu-backend-for-triton/commit/ad463da60cbf4c8722c0c3c7c9685109386d2e16)
- HistogramOp 转换基类对齐上游：重构基类，无功能变化 [commit fd8da97](https://github.com/intel/intel-xpu-backend-for-triton/commit/fd8da9768986fe03457af09b23a167399af6892f)
- E2E 测试对齐 transformers 和 timm 版本：对齐依赖版本，保证测试一致性 [commit 68ea6b7](https://github.com/intel/intel-xpu-backend-for-triton/commit/68ea6b73796ca72ffb955afe15f1d79025e9752b)

</details>

## 驱动、内核与图形栈

### compute-runtime

<details class="news-minor">
<summary>2 项小改动</summary>

- compute-runtime 26.40 更新 IGC 至 v2.42.14：更新 IGC 版本 [26.40.40196.15](https://github.com/intel/compute-runtime/releases/tag/26.40.40196.15)
- compute-runtime 26.35 修复后备压力检查：修复后备压力检查 [26.35.39758.20](https://github.com/intel/compute-runtime/releases/tag/26.35.39758.20)

</details>
