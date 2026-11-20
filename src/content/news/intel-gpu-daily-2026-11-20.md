---
title: "Intel GPU 技术生态日报 (2026-11-20)"
description: "XPU 后端新增可配置回归门禁，支持按运行和基线窗口测试；vLLM XPU 修复 AWQ MoE 权重布局不匹配导致的测试失败；llama.cpp OpenVINO 后端修复 CI 并支持 Mamba 架构"
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

- <span class="news-badge news-badge--merged">Merged</span> **XPU 后端新增可配置回归门禁，支持按运行和基线窗口测试** [详情 →](#triton-xpu-后端)
- <span class="news-badge news-badge--merged">Merged</span> **vLLM XPU 修复 AWQ MoE 权重布局不匹配导致的测试失败** [详情 →](#vllm-xpu)
- <span class="news-badge news-badge--merged">Merged</span> **llama.cpp OpenVINO 后端修复 CI 并支持 Mamba 架构** [详情 →](#llamacpp-sycl)

## 主流框架与上游集成

### SGLang XPU

- **SGLang 新增 Wan2.2-S2V 语音转视频 XPU 支持**：将 Wan2.2-S2V-14B 语音转视频模型移植到 sglang-diffusion，并针对 XPU 适配，同时减少对共享文件的改动以保持其他模型行为不变。 [PR #43279](https://github.com/sgl-project/sglang/pull/43279)

  > **影响：** 使用 SGLang 的 XPU 用户可运行 Wan2.2-S2V 模型。

- **XPU 支持 W8A8 int8 压缩张量**：为 compressed-tensors 添加 XPU 上的 W8A8 int8 支持，并量化 Whisper MLP 线性层，使 whisper-large-v3-turbo-quantized.w8a8 可在 XPU 上服务。 [PR #48353](https://github.com/sgl-project/sglang/pull/48353)

  > **影响：** 使用 W8A8 量化 Whisper 模型的 XPU 用户。

### vLLM XPU

- **快速修复 _compact_sampling_mask_xpu 仅支持 float32**：当前 compact_sampling_mask 内核仅接受 float32 logits，导致测试失败。此提交为快速修复，属于测试规避，根因未解决。 [PR #68624](https://github.com/vllm-project/vllm/pull/68624)

  > **影响：** vLLM XPU 上使用非 float32 logits 的用户。

- **新增环境变量控制 FP8 query 量化**：XPU 上 flash_attn_supports_quant_query_input() 始终返回 False，导致即使有 FP8 KV cache 也不量化 query。新增 VLLM_XPU_SUPPORT_FP8_QUERY 环境变量，允许用户启用 FP8 query 以利用 Xe3p 内核的全 FP8 注意力。 [PR #67860](https://github.com/vllm-project/vllm/pull/67860)

  > **影响：** 使用 FP8 KV cache 的 vLLM XPU 用户可启用全 FP8 注意力。

<details class="news-minor">
<summary>其他 1 项小改动</summary>

- 修复 AWQ MoE 权重布局不匹配导致的测试失败：AWQ MoE 权重转换为 GPTQ 布局以修复测试。 [PR #48552](https://github.com/vllm-project/vllm/pull/48552)

</details>

### llama.cpp SYCL

<details class="news-minor">
<summary>1 项小改动</summary>

- OpenVINO 后端修复 CI 并支持 Mamba 架构：OpenVINO 后端修复并支持 Mamba。 [PR #32590](https://github.com/ggml-org/llama.cpp/pull/32590)

</details>

## 编译器与加速库

### Triton XPU 后端

- **修复 Inductor 布局冲突回退时 KeyError**：当 MultiTemplateBuffer 发生布局冲突时，Inductor 的 extern fallback 会因缺少 timing 信息而抛出 KeyError，此补丁使其容忍无 timing 的选择，避免崩溃。 [commit 90bd83c](https://github.com/intel/intel-xpu-backend-for-triton/commit/90bd83c432f7da67d6faef58bfb81d30a2ea5ef6)

  > **影响：** 使用 PyTorch Inductor 且遇到布局冲突的 XPU 用户。

- **根据寄存器预算选择 K tile 大小**：原先 K tile 仅按 A 操作数大小设定，导致 FMA 降低时寄存器溢出。现根据寄存器预算动态选择 K tile，避免过大。 [commit 1bdd5e6](https://github.com/intel/intel-xpu-backend-for-triton/commit/1bdd5e6d9730334d926bff454b5851d9fbc1f859)

  > **影响：** 使用 StageLargeFMADotsViaSLM 的 Triton 编译用户，可能提升性能。

<details class="news-minor">
<summary>其他 3 项小改动</summary>

- benchmark_monitor 回归门禁支持可配置改进锁定：回归门禁新增可配置改进锁定与基线窗口测试。 [commit f76952b](https://github.com/intel/intel-xpu-backend-for-triton/commit/f76952b44f593444d84e81b9ded2ba8700b53c1f)
- 后端 Python 文件支持独立打包加载：后端 Python 文件可独立于 triton 包加载。 [commit 303a02d](https://github.com/intel/intel-xpu-backend-for-triton/commit/303a02d04526e00f2cf2e1b2672a1b7284294440)
- CRI 教程 03a 自动调优配置更新：CRI 教程自动调优配置调整。 [commit 6b7ac03](https://github.com/intel/intel-xpu-backend-for-triton/commit/6b7ac032f2a97ba10717c1262f7cab76442f2d7a)

</details>

### torch-xpu-ops

- **实现 philox key fold 的 tensor 重载**：为 torch-xpu-ops 添加 _philox_key_fold_in.Tensor 的 XPU 实现，复用已有的 Philox fold 逻辑，解决 issue #4062。 [PR #5451](https://github.com/intel/torch-xpu-ops/pull/5451)

  > **影响：** 使用 philox 随机数生成的 PyTorch XPU 用户。

<details class="news-minor">
<summary>其他 2 项小改动</summary>

- CI 禁用队列解析兼容新格式：CI 禁用队列解析适配新格式。 [PR #6245](https://github.com/intel/torch-xpu-ops/pull/6245)
- 移除 ARC BKC 到 infra 仓库：ARC BKC 迁移至 infra 仓库。 [PR #6292](https://github.com/intel/torch-xpu-ops/pull/6292)

</details>

### vllm-xpu-kernels

- **SYCL 内核移植：量化与融合量化内核**：将内部 csrc/quantization/ 和融合 norm/act-quant 内核移植到 SYCL，缩减二进制大小，并为 Xe3P 添加内联汇编快速路径，支持 per_token_group fp8/mxfp8/mxfp4 等。 [PR #704](https://github.com/vllm-project/vllm-xpu-kernels/pull/704)

  > **影响：** 使用 vllm-xpu-kernels 的量化功能用户。

### IntelLabs/Xe-Forge

<details class="news-minor">
<summary>1 项小改动</summary>

- Xe-Forge 新增端到端代理：Xe-Forge 新增端到端代理。 [commit 0c0dfd7](https://github.com/IntelLabs/Xe-Forge/commit/0c0dfd799974f3ecfd60dc9b9a2d37a7514758fc)

</details>

## 驱动、内核与图形栈

### compute-runtime

<details class="news-minor">
<summary>1 项小改动</summary>

- compute-runtime 26.44.40734.10 发布：compute-runtime 更新至 26.44.40734.10。 [26.44.40734.10](https://github.com/intel/compute-runtime/releases/tag/26.44.40734.10)

</details>

### IGC 图形编译器

- **IGC 修复 SLM 指针标签折叠问题**：SLM 指针可能携带 VALID_LOCAL_HIGH_BITS 标签，硬件在加立即数前检查 A32 寄存器偏移，若偏移为负则不能折叠立即数。此修复避免标签被借位清除。 [v2.43.10](https://github.com/intel/intel-graphics-compiler/releases/tag/v2.43.10)

  > **影响：** 使用 IGC 编译的 Intel GPU 用户，可能影响 SLM 相关代码。

### Linux 图形栈

<details class="news-minor">
<summary>1 项小改动</summary>

- Mesa 26.3.1 发布，修复 Intel Jay 编译器：Mesa 26.3.1 发布。 [Phoronix](https://www.phoronix.com/news/Mesa-26.3.1-Released)

</details>

## 社区反馈

### IGCIT 问题追踪

- **WSL2 下 NV12 复制和 H.264 解码崩溃问题**：报告者称在 WSL2 下，CopyTextureRegion 到 NV12 plane 1 会损坏 plane 0，且 H.264 DecodeFrame 在 libigd12dxva64.so 中崩溃。报告者认为这是驱动问题，但未确认根因。 [#1622](https://github.com/IGCIT/Intel-GPU-Community-Issue-Tracker-IGCIT/issues/1622)

  > **影响：** WSL2 下使用 Mesa d3d12 VA-API 驱动的用户。
