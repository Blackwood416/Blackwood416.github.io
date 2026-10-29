---
title: "Intel GPU 技术生态日报 (2026-10-29)"
description: "Triton XPU 后端移除核心中死代码，并迁移错误类到后端；vLLM XPU 修复 FP8 融合测试并重新启用 phi3v 测试"
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

- <span class="news-badge news-badge--merged">Merged</span> **Triton XPU 后端移除核心中死代码，并迁移错误类到后端** [详情 →](#triton-xpu-后端)
- <span class="news-badge news-badge--merged">Merged</span> **vLLM XPU 修复 FP8 融合测试并重新启用 phi3v 测试** [详情 →](#vllm-xpu)

## 主流框架与上游集成

### vLLM XPU

<details class="news-minor">
<summary>3 项小改动</summary>

- 修复 XPU 上 FP8 融合测试失败：测试调整，根因是默认路径不同。 [PR #63975](https://github.com/vllm-project/vllm/pull/63975)
- 重新启用 XPU 上的 phi3v 文本测试：重新启用 phi3v 测试。 [PR #64228](https://github.com/vllm-project/vllm/pull/64228)
- 升级 vllm-xpu-kernels 到 v0.1.16.2：依赖升级，带来新特性或修复。 [PR #61956](https://github.com/vllm-project/vllm/pull/61956)

</details>

## 编译器与加速库

### Triton XPU 后端

- **通过 SPV_INTEL_maximum_registers 显式请求 GRF 模式**：现在通过 SPV_INTEL_maximum_registers 执行模式在 kernel 上显式设置 grf_mode（'128'、'256'、'512' 或 'auto'），而不是通过其他方式，使 GRF 模式控制更明确。 [commit 7e61b7e](https://github.com/intel/intel-xpu-backend-for-triton/commit/7e61b7e4101564e2b1942d67ec0405c7ff2df349)

  > **影响：** Triton XPU 后端开发者，需更新相关代码以使用新机制。

- **合并相同守卫的 if 块**：在 PrepareIfCombining 中，当代码位于相同守卫的 if 块之间时，现在可以合并它们，解决 RemoveMasks 版本化循环时产生多个 scf.if 的问题，减少代码膨胀。 [commit 06610e5](https://github.com/intel/intel-xpu-backend-for-triton/commit/06610e5d96e1d7fb75aa7aac61e4ef61af54a4d3)

  > **影响：** Triton XPU 编译器优化，可能改善生成代码质量。

<details class="news-minor">
<summary>其他 5 项小改动</summary>

- 移除核心中无用的 fork 代码：清理核心中死代码，简化维护。 [commit a8144a0](https://github.com/intel/intel-xpu-backend-for-triton/commit/a8144a07ebd08756c57f083d6c3cb8e3138dbda3)
- 将 IntelGPUError 迁移到 Intel 后端：错误类归属调整，减少核心污染。 [commit 1b619c9](https://github.com/intel/intel-xpu-backend-for-triton/commit/1b619c9a49a37dcbd8c309d466292bc9f241d4f5)
- 基准测试改用环境变量控制原生代码生成：基准测试配置优化，加速预热。 [commit dc550bd](https://github.com/intel/intel-xpu-backend-for-triton/commit/dc550bd41e4f5f2757c5e6f87a0d8fe7d8dc6e61)
- 跳过 vLLM ngram 测试变体：跳过非确定性失败的测试变体。 [commit a451e15](https://github.com/intel/intel-xpu-backend-for-triton/commit/a451e15434df4c65b9a4aeddeccf9b5805ae1c5c)
- 移除 vLLM mamba 测试排序补丁：移除不再需要的测试补丁。 [commit ad463da](https://github.com/intel/intel-xpu-backend-for-triton/commit/ad463da60cbf4c8722c0c3c7c9685109386d2e16)

</details>

## 驱动、内核与图形栈

### compute-runtime

<details class="news-minor">
<summary>2 项小改动</summary>

- compute-runtime 更新 IGC 版本：驱动更新，IGC 版本升级。 [26.40.40196.15](https://github.com/intel/compute-runtime/releases/tag/26.40.40196.15)
- compute-runtime 修复内存压力检查：驱动修复，改进内存压力处理。 [26.35.39758.20](https://github.com/intel/compute-runtime/releases/tag/26.35.39758.20)

</details>
