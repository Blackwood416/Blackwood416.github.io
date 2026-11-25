---
title: "Intel GPU 技术生态日报 (2026-11-25)"
description: "torch-xpu-ops 同步上游测试，覆盖显著增加；Triton XPU 修复 dot_scaled 编译与收敛写问题"
pubDate: "2026-11-25T08:30:00.000Z"
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

- <span class="news-badge news-badge--merged">Merged</span> **torch-xpu-ops 同步上游测试，覆盖显著增加** [详情 →](#torch-xpu-ops)
- <span class="news-badge news-badge--merged">Merged</span> **Triton XPU 修复 dot_scaled 编译与收敛写问题** [详情 →](#triton-xpu-后端)

## 主流框架与上游集成

### vLLM XPU

- **XPU Qwen3.5 支持序列并行与流水并行**：为 XPU Qwen3.5 MoE 启用序列并行与流水并行组合，镜像 NVIDIA 的改动，提升多卡扩展性。 [PR #69314](https://github.com/vllm-project/vllm/pull/69314)

  > **影响：** XPU 上使用 Qwen3.5 且 PP>1 的用户可获得 SP 支持。

- **XPU 实现 stateless 分布式初始化**：为 XPU 实现 stateless_init_device_torch_dist_pg，使非 gloo 后端能正确初始化分布式进程组。 [PR #57196](https://github.com/vllm-project/vllm/pull/57196)

  > **影响：** XPU 上使用非 gloo 后端的 vLLM 用户获得支持。

<details class="news-minor">
<summary>其他 1 项小改动</summary>

- 为 Arc Pro 添加 8192 上下文默认值：添加 Arc Pro 上下文默认值 [PR #68901](https://github.com/vllm-project/vllm/pull/68901)

</details>

### bitsandbytes XPU

- **修复 XPU quantize_4bit 形状违规**：XPU 上 quantize_4bit 在输入元素数非倍数时返回形状与 register_fake 不一致的张量，修复以符合操作契约。 [PR #2099](https://github.com/bitsandbytes-foundation/bitsandbytes/pull/2099)

  > **影响：** 使用 quantize_4bit 的 XPU 用户获得正确形状。

- **XPU 优化器支持 skip_zeros**：CUDA 优化器支持 skip_zeros 但 XPU 抛 NotImplementedError，通过 Triton 实现以匹配 CUDA 行为。 [PR #2097](https://github.com/bitsandbytes-foundation/bitsandbytes/pull/2097)

  > **影响：** XPU 上使用 skip_zeros 的用户获得支持。

## 编译器与加速库

### torch-xpu-ops

- **修复 Bessel 函数精度**：更新 MathExtensions.h 中 Bessel 多项式累加器初始化值，对齐 CUDA 的修复，解决精度问题。 [PR #6332](https://github.com/intel/torch-xpu-ops/pull/6332)

  > **影响：** 使用 Bessel 函数的 XPU 用户获得精度提升。

<details class="news-minor">
<summary>其他 4 项小改动</summary>

- 同步 packed_sequence 测试至上游：测试同步，覆盖增加 [PR #6278](https://github.com/intel/torch-xpu-ops/pull/6278)
- 同步 fake_tensor 测试至上游：测试同步，关闭多个 issue [PR #6254](https://github.com/intel/torch-xpu-ops/pull/6254)
- 重构 DilatedMaxPool2d 为自由函数：重构 DilatedMaxPool2d 内核 [PR #5319](https://github.com/intel/torch-xpu-ops/pull/5319)
- 重构 MultiLabelMarginLoss 内核：重构 MultiLabelMarginLoss 内核 [PR #5502](https://github.com/intel/torch-xpu-ops/pull/5502)

</details>

### Triton XPU 后端

- **分解不支持的 dot_scaled 缩放**：当 tl.dot_scaled 使用 e2m1 双端和 E4M3 缩放（NVFP4）时，CRI 在 K=64 编译失败，通过分解为 DPAS 可接受的缩放格式解决。 [commit 1143f23](https://github.com/intel/intel-xpu-backend-for-triton/commit/1143f2375bf4598cf1913d4eed37b7e627570ced)

  > **影响：** 使用 NVFP4 格式的 Triton 用户获得编译支持。

- **将 block_write 建模为收敛写**：triton_gen.sub_group_block_write 声明了 [MemRead] 属性，但实际是写操作，建模为收敛写以支持 descriptor scatter 的正确降级。 [commit aac5f6f](https://github.com/intel/intel-xpu-backend-for-triton/commit/aac5f6f5133aab39b1eb8fc223ef2f8dfd9f8e7f)

  > **影响：** 修复 descriptor scatter 相关功能，影响使用该特性的用户。

- **RVL 避免移动 dot 操作数越过写**：ReduceVariableLiveness 的 moveOperand 克隆循环前的 dot 操作数加载到循环内，但可能越过写操作导致错误，修复为不移动。 [commit 1b947ef](https://github.com/intel/intel-xpu-backend-for-triton/commit/1b947ef4792e3802bed738fd74bf71f27a5f1e39)

  > **影响：** 修复 RVL 优化导致的潜在错误，影响使用该优化的 Triton 用户。

- **流水化 dot_scaled K 循环并加载缩放**：在 CRI 上，fp8 GEMM 的 K 循环使用原生 tl.dot_scaled 时，缩放加载未按 DPAS 布局，通过流水化 K 循环并加载缩放解决。 [commit 0a17f80](https://github.com/intel/intel-xpu-backend-for-triton/commit/0a17f80c0cf3dc19af2eec168d918076260314cb)

  > **影响：** 改善 fp8 GEMM 在 CRI 上的性能。

<details class="news-minor">
<summary>其他 1 项小改动</summary>

- 添加无溢出 flex attention 反向配置：添加无溢出 flex attention 配置 [commit 510242a](https://github.com/intel/intel-xpu-backend-for-triton/commit/510242a0a7691a15168912563bc70cb1fcef129a)

</details>

### vllm-xpu-kernels

- **移植 RoPE 和 DeepSeek V4 内核**：移植 rotary_embedding、fused_qk_norm_rope 等 SYCL 内核，新增 fused_rope_norm_store_kv_fp8 操作，面向 CRI 优化。 [PR #709](https://github.com/vllm-project/vllm-xpu-kernels/pull/709)

  > **影响：** vLLM XPU 用户获得新内核支持。

<details class="news-minor">
<summary>其他 1 项小改动</summary>

- 导出 GDN 预填充检查点：导出 GDN 预填充检查点 [PR #705](https://github.com/vllm-project/vllm-xpu-kernels/pull/705)

</details>

## 社区反馈

### IGCIT 问题追踪

<details class="news-minor">
<summary>2 项小改动</summary>

- Arc A530M 驱动崩溃报告：Arc A530M 驱动崩溃报告 [#1629](https://github.com/IGCIT/Intel-GPU-Community-Issue-Tracker-IGCIT/issues/1629)
- Project Wingman 启动崩溃报告：Project Wingman 启动崩溃报告 [#1628](https://github.com/IGCIT/Intel-GPU-Community-Issue-Tracker-IGCIT/issues/1628)

</details>
