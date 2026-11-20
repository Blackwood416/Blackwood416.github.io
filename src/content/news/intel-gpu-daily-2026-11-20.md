---
title: "Intel GPU 技术生态日报 (2026-11-20)"
description: "XPU 后端新增可配置回归门，支持基线窗口测试；修复 XPU 上 argmin/argmax 返回错误索引的严重问题"
pubDate: "2026-11-20T08:30:00.000Z"
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

- <span class="news-badge news-badge--merged">Merged</span> **XPU 后端新增可配置回归门，支持基线窗口测试** [详情 →](#triton-xpu-后端)
- <span class="news-badge news-badge--merged">Merged</span> **修复 XPU 上 argmin/argmax 返回错误索引的严重问题** [详情 →](#torch-xpu-ops)

## 主流框架与上游集成

### vLLM XPU

- **修复 XPU 上 AWQ MoE 权重布局转换**：修复 test_awq_load 中因权重布局假设错误导致的 RuntimeError，将 AWQ 打包的 MoE 权重转换为 GPTQ 等效布局。 [PR #48552](https://github.com/vllm-project/vllm/pull/48552)

  > **影响：** 影响使用 AWQ 量化 MoE 模型的 XPU 用户，修复加载错误。

<details class="news-minor">
<summary>其他 1 项小改动</summary>

- 新增环境变量控制 XPU FP8 查询：XPU FP8 查询可配置 [PR #67860](https://github.com/vllm-project/vllm/pull/67860)

</details>

### llama.cpp SYCL

<details class="news-minor">
<summary>1 项小改动</summary>

- OpenVINO 后端修复 CI 并优化：OpenVINO 后端修复与优化 [PR #32590](https://github.com/ggml-org/llama.cpp/pull/32590)

</details>

## 编译器与加速库

### Triton XPU 后端

- **修复 Inductor 布局冲突回退 KeyError**：添加 PyTorch 补丁，使 Inductor 的布局冲突回退在无计时选择时不再抛出 KeyError，避免崩溃。 [commit 90bd83c](https://github.com/intel/intel-xpu-backend-for-triton/commit/90bd83c432f7da67d6faef58bfb81d30a2ea5ef6)

  > **影响：** 影响使用 Inductor 的 PyTorch 用户，修复潜在崩溃。

<details class="news-minor">
<summary>其他 4 项小改动</summary>

- benchmark_monitor 新增可配置回归门：回归门支持基线窗口测试 [commit f76952b](https://github.com/intel/intel-xpu-backend-for-triton/commit/f76952b44f593444d84e81b9ded2ba8700b53c1f)
- 后端 Python 文件支持独立打包加载：后端 Python 文件独立加载 [commit 303a02d](https://github.com/intel/intel-xpu-backend-for-triton/commit/303a02d04526e00f2cf2e1b2672a1b7284294440)
- XPUPTI 分析器支持周期刷新模式：XPUPTI 支持周期刷新 [commit 6bd8bb4](https://github.com/intel/intel-xpu-backend-for-triton/commit/6bd8bb4024c870dbd3c5b61e41d1fe219d2916ef)
- 2D 块加载吸收列边界到 base_width：2D 块加载优化边界处理 [commit 3356336](https://github.com/intel/intel-xpu-backend-for-triton/commit/33563364c429c1f2836f9316f1ae55579992fd82)

</details>

### torch-xpu-ops

- **修复 XPU 上 argmin/argmax 返回错误索引**：Reduce 配置将最大工作组项数向下取整为 2 的幂，修复了 Intel Arc B390 上 float32 输入 argmin/argmax 返回错误索引的问题。 [PR #6247](https://github.com/intel/torch-xpu-ops/pull/6247)

  > **影响：** 影响在 XPU 上使用 argmin/argmax 的用户，修复正确性问题。

## 驱动、内核与图形栈

### compute-runtime

<details class="news-minor">
<summary>1 项小改动</summary>

- compute-runtime 26.44.40734.10 发布：compute-runtime 更新 [26.44.40734.10](https://github.com/intel/compute-runtime/releases/tag/26.44.40734.10)

</details>

### IGC 图形编译器

- **IGC 修复 SLM 指针标签折叠问题**：修复 LSC 立即偏移折叠时可能清除 SLM 指针标签的问题，确保边界检查正确。 [v2.43.10](https://github.com/intel/intel-graphics-compiler/releases/tag/v2.43.10)

  > **影响：** 影响使用 SLM 的 GPU 程序，修复潜在错误。

### Linux 图形栈

<details class="news-minor">
<summary>1 项小改动</summary>

- Mesa 26.3.1 发布修复 Intel Jay 编译器：Mesa 26.3.1 发布 [Phoronix](https://www.phoronix.com/news/Mesa-26.3.1-Released)

</details>

## 社区反馈

### IGCIT 问题追踪

- **WSL2 下 NV12 复制和 H.264 解码崩溃**：报告者认为在 WSL2 下 CopyTextureRegion 到 NV12 plane 1 会损坏 plane 0，且 H.264 解码在 libigd12dxva64.so 中崩溃，使用 Mesa 25.2.8 d3d12 VA-API 驱动。 [#1622](https://github.com/IGCIT/Intel-GPU-Community-Issue-Tracker-IGCIT/issues/1622)

  > **影响：** 影响 WSL2 下使用 NV12 纹理复制和 H.264 解码的用户，需等待驱动修复。
