---
title: "Intel GPU 技术生态日报 (2026-11-22)"
description: "llama.cpp SYCL 融合算子与向量化提升 Qwen3 推理性能；Triton XPU 改用官方内置函数获取 XeCore ID"
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

- <span class="news-badge news-badge--merged">Merged</span> **llama.cpp SYCL 融合算子与向量化提升 Qwen3 推理性能** [详情 →](#llamacpp-sycl)
- <span class="news-badge news-badge--merged">Merged</span> **Triton XPU 改用官方内置函数获取 XeCore ID** [详情 →](#triton-xpu-后端)

## 主流框架与上游集成

### llama.cpp SYCL

- **融合 ADD、RMS_NORM、MUL 并向量化 RMS norm**：将连续的 RMS norm 向量化，并融合 ADD、RMS_NORM、MUL 操作以减少内核启动和内存访问。在 Qwen3.8-27B Q3_K_P 模型上，启用 -fa on 等参数后，推理速度相比基线有提升。 [PR #31753](https://github.com/ggml-org/llama.cpp/pull/31753)

  > **影响：** 使用 SYCL 后端的 llama.cpp 用户，尤其是运行 Qwen3 系列模型的用户，可获得推理性能提升。

- **限制 CONV_TRANSPOSE_1D 输入迭代范围**：通过限制每个输出只读取其对应的输入范围（i*s0 <= idx < i*s0 + K），减少了不必要的内存访问，提升了 SYCL 后端 CONV_TRANSPOSE_1D 的性能。在 Arc Pro B70 上测试，性能有提升。 [PR #31109](https://github.com/ggml-org/llama.cpp/pull/31109)

  > **影响：** 使用 SYCL 后端且涉及转置卷积的 llama.cpp 用户，可获得性能提升。

- **添加 IQ4_NL 和 IQ4_XS 权重重排**：为 IQ4_NL 和 IQ4_XS 量化权重添加重排逻辑，以优化使用这些权重的模型性能。在 Intel Arc B70 上测试，MUL_MAT 性能有显著提升。 [PR #31998](https://github.com/ggml-org/llama.cpp/pull/31998)

  > **影响：** 使用 IQ4_NL 或 IQ4_XS 量化权重的 llama.cpp SYCL 用户，可获得性能提升。

- **gated_delta_net 内核改为列分块**：将 gated_delta_net 内核从每个 warp 处理 1 个状态列扩展到 4 个，每个 warp 加载一次 token 的 q/k 并在 4 列间共享，减少了重复加载，提升了小规模启动的性能。 [PR #32456](https://github.com/ggml-org/llama.cpp/pull/32456)

  > **影响：** 使用 gated_delta_net 模型的 llama.cpp SYCL 用户，可获得性能提升。

## 编译器与加速库

### Triton XPU 后端

- **用 intel_get_slice_id 替换 IGC 内置函数**：将 Triton XPU 后端中用于获取 XeCore ID 的 IGC 内部内置函数替换为公开的 intel_get_slice_id 和 intel_get_dual_subslice_id，以适配新的编译器接口并提高可维护性。 [commit a2f88ca](https://github.com/intel/intel-xpu-backend-for-triton/commit/a2f88ca23a91456ffe6f3e7bd7042419205c6ebc)

  > **影响：** 使用 Triton XPU 后端的开发者，需确保其 IGC 版本支持这些新内置函数。

<details class="news-minor">
<summary>其他 1 项小改动</summary>

- 基准测试忽略缺失结果计算几何平均：基准测试忽略零结果，避免几何平均偏差 [commit 239d431](https://github.com/intel/intel-xpu-backend-for-triton/commit/239d431a4b8e1db1e1d6344c9e68e71dde2aebae)

</details>
