---
title: "Intel GPU 技术生态日报 (2026-11-09)"
description: "vLLM XPU 内核升级至 0.1.17，MoE 与 MLA 接口同步调整；Triton XPU 后端移除 SpeculateSignedDivRem 规避补丁"
pubDate: "2026-11-09T08:30:00.000Z"
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

- <span class="news-badge news-badge--merged">Merged</span> **vLLM XPU 内核升级至 0.1.17，MoE 与 MLA 接口同步调整** [详情 →](#vllm-xpu)
- <span class="news-badge news-badge--merged">Merged</span> **Triton XPU 后端移除 SpeculateSignedDivRem 规避补丁** [详情 →](#triton-xpu-后端)

## 主流框架与上游集成

### vLLM XPU

- **vLLM XPU 内核升级至 0.1.17，MoE 与 MLA 接口同步调整**：将 vllm_xpu_kernels 升级到 0.1.17，并调整 XPU 上的 MoE 和 MLA 接口以匹配新内核。MoE 方面，XpuFusedMoe 现在拥有权重/缩放布局的所有权，这可能是为了支持新的内核特性或修复布局问题。 [PR #60609](https://github.com/vllm-project/vllm/pull/60609)

  > **影响：** 使用 vLLM XPU 的开发者需要升级内核依赖，并注意 MoE 和 MLA 接口的变更，可能需要调整相关代码。

- **vLLM XPU 新增全对全专家并行后端**：为 XPU 添加 batched + routed 专家并行（EP）后端，目前仍为 WIP，端到端性能有下降，部分 bug 已修复。依赖即将到来的自动调优。 [PR #46871](https://github.com/vllm-project/vllm/pull/46871)

  > **影响：** 影响 vLLM XPU 的 MoE 推理，提供新的 EP 后端，但当前性能未达预期，需等待后续优化。

<details class="news-minor">
<summary>其他 2 项小改动</summary>

- 修复 XPU 隐私过滤测试中 RoPE 缓冲区类型问题：XPU 测试修复 RoPE 缓冲区类型 [PR #65323](https://github.com/vllm-project/vllm/pull/65323)
- vLLM XPU CI 迁移 B70 作业到新集群：vLLM XPU CI 作业迁移 [PR #66034](https://github.com/vllm-project/vllm/pull/66034)

</details>

### SGLang XPU

- **SGLang XPU 启用 HiCache Mamba 主机池**：启用 MambaPoolHost 在 Intel XPU 上的支持，此前因 CUDA/ROCm 的 Mamba 传输内核是 JIT 构建的而拒绝 XPU。这允许混合 Mamba 模式在 XPU 上运行。 [PR #46610](https://github.com/sgl-project/sglang/pull/46610)

  > **影响：** 影响 SGLang XPU 用户，支持混合 Mamba 模式，扩展了模型支持范围。

<details class="news-minor">
<summary>其他 1 项小改动</summary>

- SGLang XPU 内核升级至 0.6.0：SGLang XPU 内核升级 [PR #48583](https://github.com/sgl-project/sglang/pull/48583)

</details>

## 编译器与加速库

### Triton XPU 后端

- **Triton XPU 后端增加资源不足检查**：在 validate_options 中增加检查，当 num_warps * warp_size 超过工作组大小时抛出 OutOfResources。这是因为之前的检查只基于最小子组大小，可能导致实际线程数超出硬件限制。 [commit 8686bc8](https://github.com/intel/intel-xpu-backend-for-triton/commit/8686bc85d99a44c872d0f6855f6f1fa341ef01b1)

  > **影响：** 影响 Intel Triton 后端，增加编译期错误检查，避免运行时资源不足。

<details class="news-minor">
<summary>其他 1 项小改动</summary>

- Triton XPU 后端移除 SpeculateSignedDivRem 规避补丁：移除 Triton XPU 规避补丁 [commit 0589722](https://github.com/intel/intel-xpu-backend-for-triton/commit/05897221cc4cc6a204a0aedc68bd9ca2e9edf125)

</details>
