---
title: "Intel GPU 技术生态日报 (2026-11-22)"
description: "llama.cpp SYCL 融合算子与量化重排显著提速；Triton XPU 改用官方内置函数获取硬件 ID"
pubDate: "2026-11-22T08:30:00.000Z"
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

- <span class="news-badge news-badge--merged">Merged</span> **llama.cpp SYCL 融合算子与量化重排显著提速** [详情 →](#llamacpp-sycl)
- <span class="news-badge news-badge--merged">Merged</span> **Triton XPU 改用官方内置函数获取硬件 ID** [详情 →](#triton-xpu-后端)

## 主流框架与上游集成

### llama.cpp SYCL

- **融合 ADD/RMS_NORM/MUL 并向量化 RMS**：将连续 RMS norm 向量化，并融合 ADD、RMS_NORM、MUL 三个算子，减少内核启动和内存往返。在 Qwen3.8-27B Q3_K_P 模型上，-fa on -ctk q4_0 -ctv q4_0 -b 1024 -ub 1024 配置下吞吐提升显著（具体数值见 PR）。 [PR #31753](https://github.com/ggml-org/llama.cpp/pull/31753)

  > **影响：** 使用 SYCL 后端的 llama.cpp 用户，尤其是运行 Qwen 系列模型的，可获得推理性能提升。

- **SYCL 限制 CONV_TRANSPOSE_1D 输入迭代范围**：通过限制每个输出只读取满足 `i*s0 <= idx < i*s0 + K` 的输入，保持原有升序访问，减少无效内存访问。在 Arc Pro B70 上使用 oneAPI 2026.1 测试，`test-backend-ops perf` 性能有提升。 [PR #31109](https://github.com/ggml-org/llama.cpp/pull/31109)

  > **影响：** 使用 SYCL 后端且涉及 CONV_TRANSPOSE_1D 的 llama.cpp 用户，可获得性能改善。

- **SYCL 添加 IQ4_NL 和 IQ4_XS 权重重排**：为 IQ4_NL 和 IQ4_XS 量化格式添加权重重排，显著优化使用 IQ4 模型权重时的性能。在 Intel Arc B70 上测试 `test-backend-ops perf -b SYCL0 -o MUL_MAT`，m=4096 等配置下性能提升明显。 [PR #31998](https://github.com/ggml-org/llama.cpp/pull/31998)

  > **影响：** 使用 IQ4 量化模型的 SYCL 用户，推理性能将大幅提升。

- **SYCL 列块化 gated_delta_net 内核**：将 gated_delta_net 内核从每个 warp 处理 1 个状态列扩展到 4 个，每个 warp 加载一次 token 的 q/k 并在 4 列间共享，减少重复加载，提升小规模启动时的效率。 [PR #32456](https://github.com/ggml-org/llama.cpp/pull/32456)

  > **影响：** 使用 SYCL 后端且运行 gated_delta_net 模型的用户，可获得性能提升。

## 编译器与加速库

### Triton XPU 后端

<details class="news-minor">
<summary>2 项小改动</summary>

- Triton XPU 改用官方内置函数获取硬件 ID：替换 IGC 内部内置函数为公开 API [commit a2f88ca](https://github.com/intel/intel-xpu-backend-for-triton/commit/a2f88ca23a91456ffe6f3e7bd7042419205c6ebc)
- 基准测试忽略缺失结果计算几何均值：修复基准统计中零值干扰 [commit 239d431](https://github.com/intel/intel-xpu-backend-for-triton/commit/239d431a4b8e1db1e1d6344c9e68e71dde2aebae)

</details>
