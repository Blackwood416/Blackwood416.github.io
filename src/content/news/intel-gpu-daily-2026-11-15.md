---
title: "Intel GPU 技术生态日报 (2026-11-15)"
description: "llama.cpp 为 Intel UMA 启用 GPU 拷贝路径；vLLM XPU 修复 MXFP8 线性层 3D 输入崩溃"
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

- <span class="news-badge news-badge--merged">Merged</span> **llama.cpp 为 Intel UMA 启用 GPU 拷贝路径** [详情 →](#llamacpp-sycl)
- <span class="news-badge news-badge--merged">Merged</span> **vLLM XPU 修复 MXFP8 线性层 3D 输入崩溃** [详情 →](#vllm-xpu)

## 主流框架与上游集成

### llama.cpp SYCL

- **Intel UMA 启用 GPU 拷贝路径**：此前仅对 AMD 启用 slow_host_read 路径，现扩展到 Intel iGPU，因为 Intel 在 UMA 上使用 uncached 内存时 GPU 拷贝更优。 [PR #32024](https://github.com/ggml-org/llama.cpp/pull/32024)

  > **影响：** 使用 Intel iGPU 的 llama.cpp 用户，拷贝性能可能提升。

- **oneDNN 注意力支持空 mask 优化**：为 oneDNN 注意力添加空 mask 支持，提升 mtmd 图像处理速度，尤其对 mask 层较少的模型。 [PR #32109](https://github.com/ggml-org/llama.cpp/pull/32109)

  > **影响：** 使用 llama.cpp SYCL 后端且处理多模态图像的模型，推理速度可能提升。

<details class="news-minor">
<summary>其他 1 项小改动</summary>

- 文档补充 OpenVINO 算子支持矩阵：补充 OpenVINO 算子矩阵文档 [PR #32259](https://github.com/ggml-org/llama.cpp/pull/32259)

</details>

### vLLM XPU

- **XPU MXFP8 线性层支持 3D 输入**：Transformers 后端传入 3D 激活，但 XPU 的 per_token_group_fp8_quant 仅接受 2D，导致引擎初始化失败。通过 reshape 为 2D 并恢复前导维度修复。 [PR #66494](https://github.com/vllm-project/vllm/pull/66494)

  > **影响：** 使用 XPU 且启用 MXFP8 的 vLLM 用户，引擎初始化不再失败。

- **XPU 注册 FLASH_ATTN_MLA 后端**：将 FLASH_ATTN_MLA 后端枚举注册到 XPUFlashAttnMLABackend，使 XPU 平台能选择该实现，并更新测试解析。 [PR #64255](https://github.com/vllm-project/vllm/pull/64255)

  > **影响：** XPU 上启用 MLA 的 vLLM 用户，可使用 FlashAttention MLA 后端。

- **DeepSeek-V4 XPU 内核 token 索引改 int64**：qnorm/RoPE 内核用 int32 计算 token_idx * num_heads * HEAD_DIM，当 token 数超过 65536 时地址回绕。改为 int64 避免溢出。 [PR #64515](https://github.com/vllm-project/vllm/pull/64515)

  > **影响：** 使用 DeepSeek-V4 且长上下文的 XPU 用户，避免地址回绕错误。
