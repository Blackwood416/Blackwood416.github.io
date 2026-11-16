---
title: "Intel GPU 技术生态日报 (2026-11-16)"
description: "vLLM XPU 支持未量化 MoE LoRA，统一走 XpuFusedMoe 路径；torch-xpu-ops 修复 cdist 反向大输入越界写"
pubDate: "2026-11-16T08:30:00.000Z"
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

- <span class="news-badge news-badge--merged">Merged</span> **vLLM XPU 支持未量化 MoE LoRA，统一走 XpuFusedMoe 路径** [详情 →](#vllm-xpu)
- <span class="news-badge news-badge--merged">Merged</span> **torch-xpu-ops 修复 cdist 反向大输入越界写** [详情 →](#torch-xpu-ops)

## 主流框架与上游集成

### vLLM XPU

- **XPU 支持未量化 MoE LoRA**：将 LoRAExpertsMixin 混入 XPUExperts，使 BF16 MoE LoRA 通过 XpuFusedMoe 的 activation_hook/output_hook 执行，替代 Triton experts 路径。 [PR #62807](https://github.com/vllm-project/vllm/pull/62807)

  > **影响：** vLLM XPU 用户可使用未量化 MoE LoRA，获得更优性能。

- **Mamba2 SSD 内核增加张量描述符路径**：为 _chunk_scan_fwd_kernel 和 _chunk_state_fwd_kernel 增加 USE_TD 张量描述符路径，替代掩码指针算术，可能提升性能。 [PR #60801](https://github.com/vllm-project/vllm/pull/60801)

  > **影响：** vLLM XPU Mamba2 用户可能获得性能提升。

- **DeepSeek-V4 稀疏 MLA 内核应用 attn_sink**：XPU 稀疏 MLA 路径未传递 attn_sink，导致 softmax 计算错误。修复调用点并传递参数。 [PR #64252](https://github.com/vllm-project/vllm/pull/64252)

  > **影响：** 修复 DeepSeek-V4 在 XPU 上的注意力计算错误。

<details class="news-minor">
<summary>其他 1 项小改动</summary>

- 修复 LoRA 测试工作区：修复 LoRA 测试工作区 [PR #67824](https://github.com/vllm-project/vllm/pull/67824)

</details>

### Strata

- **层拆分时保留 draft head 空间**：层拆分最后阶段运行 drafter，draft head 和 logits 在绑定后分配，可能超出缓存。现在在缓存大小计算时预留空间。 [PR #4549](https://github.com/Niko1221/Strata/pull/4549)

  > **影响：** 修复 Strata 层拆分时 draft head 内存溢出问题。

- **Battlemage 混合 IQ3 解码优化**：Arc Pro B70 原生混合 IQ3 解码路径重复工作，保留生产覆盖的优化，可能提升性能。 [PR #4185](https://github.com/Niko1221/Strata/pull/4185)

  > **影响：** Strata 用户使用 Battlemage 时 IQ3 解码性能提升。

- **Qwen3.8-Flash-Next IQ2_XS 单卡预览**：组合引擎预览降低单 B70 IQ2_XS 推理延迟，实测 32K 工作负载下客户端解码率 67.10 tok/s。 [PR #3153](https://github.com/Niko1221/Strata/pull/3153)

  > **影响：** Strata 用户可预览 Qwen3.8-Flash-Next IQ2_XS 性能提升。

- **流水线拆分按慢阶段定价**：--layer-split auto 将两阶段时间求和定价，导致流水线重叠时负载不均。改为按较慢阶段定价。 [PR #4534](https://github.com/Niko1221/Strata/pull/4534)

  > **影响：** 修复 Strata 流水线拆分负载均衡问题。

- **自动层拆分也裁剪稠密权重**：显式 --layer-split 时裁剪稠密权重，但 --layer-split auto 未裁剪，导致内存浪费。现在 auto 模式也裁剪。 [PR #4522](https://github.com/Niko1221/Strata/pull/4522)

  > **影响：** 修复 Strata 自动层拆分内存浪费问题。

## 编译器与加速库

### Triton XPU 后端

- **Triton XPU 描述符 gather 偏移改用 i64**：computeGatherScatterOperands 将 stride 截断为 i32 并计算 index*stride，导致大偏移溢出。改为 i64 计算避免溢出。 [commit 2c71820](https://github.com/intel/intel-xpu-backend-for-triton/commit/2c7182060cddb0b0d779805e82449c57eb1008bc)

  > **影响：** 修复大张量 gather/scatter 时的错误，影响 Triton XPU 后端用户。

<details class="news-minor">
<summary>其他 3 项小改动</summary>

- AOT link.py 不再导入 torch：移除 link.py 的 torch 导入 [commit 88b2e82](https://github.com/intel/intel-xpu-backend-for-triton/commit/88b2e82389b0a29c60d0cd61b5c1098daa40492c)
- 2D block load 匹配右索引行限制：修复 2D load 边界匹配 [commit 5ac6e5a](https://github.com/intel/intel-xpu-backend-for-triton/commit/5ac6e5a35a31d7790a1f9d2f5b38b1e951dec345)
- SGLANG pin 更新：更新 SGLANG 依赖 [commit 19432c3](https://github.com/intel/intel-xpu-backend-for-triton/commit/19432c342da8b540b1f1daf10817f2878d890cea)

</details>

### torch-xpu-ops

- **cdist 反向内核改用 64 位索引**：cdist_backward_kernel_impl_func 中行索引、批索引等使用 32 位 int，大输入时溢出导致越界写。改用 64 位索引修复。 [PR #6174](https://github.com/intel/torch-xpu-ops/pull/6174)

  > **影响：** 修复 torch-xpu-ops 中 cdist 反向大输入崩溃，影响使用大 batch 的用户。

<details class="news-minor">
<summary>其他 1 项小改动</summary>

- xpu_profiling 测试调整并纳入 PR CI：调整 profiling 测试并加入 CI [PR #6126](https://github.com/intel/torch-xpu-ops/pull/6126)

</details>

## 社区反馈

### IGCIT 问题追踪

<details class="news-minor">
<summary>1 项小改动</summary>

- Star Citizen 在 Arc iGPU 启动崩溃：Star Citizen 启动崩溃报告 [#1618](https://github.com/IGCIT/Intel-GPU-Community-Issue-Tracker-IGCIT/issues/1618)

</details>
