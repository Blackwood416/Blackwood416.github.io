---
title: "Intel GPU 技术生态日报 (2026-11-15)"
description: "llama.cpp 为 Intel iGPU 启用 UMA 非缓存内存 GPU 拷贝；torch-xpu-ops 修复 xpu_equal 对 NaN 的错误返回"
pubDate: "2026-11-15T08:30:00.000Z"
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

- <span class="news-badge news-badge--merged">Merged</span> **llama.cpp 为 Intel iGPU 启用 UMA 非缓存内存 GPU 拷贝** [详情 →](#llamacpp-sycl)
- <span class="news-badge news-badge--merged">Merged</span> **torch-xpu-ops 修复 xpu_equal 对 NaN 的错误返回** [详情 →](#torch-xpu-ops)

## 主流框架与上游集成

### llama.cpp SYCL

- **Intel iGPU 启用 UMA 非缓存内存 GPU 拷贝**：此前仅对 AMD 启用 slow_host_read 路径，现扩展至 Intel iGPU，因其同样存在拷贝性能问题。该改动通过使用 GPU 拷贝替代主机读取，提升 UMA 内存上的拷贝效率。 [PR #32024](https://github.com/ggml-org/llama.cpp/pull/32024)

  > **影响：** 使用 Intel iGPU 且启用 UMA 的 llama.cpp 用户，拷贝性能可能提升。

- **SYCL 优化 mtmd 图像处理支持空掩码**：为 oneDNN attention 添加空掩码支持，提升 mtmd 图像处理速度，尤其对掩码层较少的模型效果更明显。 [PR #32109](https://github.com/ggml-org/llama.cpp/pull/32109)

  > **影响：** 使用 llama.cpp SYCL 后端处理 mtmd 图像的用户，速度提升。

<details class="news-minor">
<summary>其他 1 项小改动</summary>

- llama.cpp 文档添加 OpenVINO 后端算子矩阵：文档更新算子矩阵。 [PR #32259](https://github.com/ggml-org/llama.cpp/pull/32259)

</details>

### vLLM XPU

- **vLLM XPU 注册 MLA FlashAttention 后端**：将 FLASH_ATTN_MLA 后端枚举注册到 XPUFlashAttnMLABackend 实现类，使 XPU 平台能够选择该后端，支持 MLA 注意力加速。 [PR #64255](https://github.com/vllm-project/vllm/pull/64255)

  > **影响：** 使用 vLLM 且启用 MLA 的 XPU 用户，可获得 FlashAttention 加速。

- **修复 DeepSeek-V4 qnorm/RoPE 内核 token 索引溢出**：内核中 token_idx * num_heads * HEAD_DIM 使用 int32 计算，当步长超过 2^31 个 Q 元素时地址回绕。改为 int64 索引，避免大 token 数下的地址错误。 [PR #64515](https://github.com/vllm-project/vllm/pull/64515)

  > **影响：** 使用 DeepSeek-V4 且 token 数大的 XPU 用户，避免地址溢出错误。

## 编译器与加速库

### torch-xpu-ops

- **修复 xpu_equal 对含 NaN 张量的错误返回**：xpu_equal 在相同存储快速路径上无条件返回 true，导致含 NaN 的张量比较错误。现仅对整型和布尔类型返回 true，其他类型返回 !self.isnan() 结果，符合 torch.equal 语义。 [PR #5765](https://github.com/intel/torch-xpu-ops/pull/5765)

  > **影响：** 使用 torch.equal 比较含 NaN 张量的 XPU 用户，结果将正确。

- **LayerNorm 前向短行使用多行工作组**：原实现每行一个工作组，当行向量数少于 SIMD 宽度时部分通道空闲。现改为多行工作组，提高短行场景下的硬件利用率，提升性能。 [PR #5977](https://github.com/intel/torch-xpu-ops/pull/5977)

  > **影响：** 使用向量化 LayerNorm 前向的 XPU 用户，短行场景性能提升。

<details class="news-minor">
<summary>其他 1 项小改动</summary>

- 清理 torch-xpu-ops 上游不存在的测试跳过项：清理无效测试跳过项。 [PR #6195](https://github.com/intel/torch-xpu-ops/pull/6195)

</details>
