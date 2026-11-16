---
title: "Intel GPU 技术生态日报 (2026-11-16)"
description: "vLLM XPU 支持 BF16 MoE LoRA，绕过 Triton 专家路径；Triton XPU 后端修复描述符 gather 偏移 i32 溢出"
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

- <span class="news-badge news-badge--merged">Merged</span> **vLLM XPU 支持 BF16 MoE LoRA，绕过 Triton 专家路径** [详情 →](#vllm-xpu)
- <span class="news-badge news-badge--merged">Merged</span> **Triton XPU 后端修复描述符 gather 偏移 i32 溢出** [详情 →](#triton-xpu-后端)

## 主流框架与上游集成

### vLLM XPU

- **XPU 支持 BF16 MoE LoRA 路由至 XpuFusedMoe**：将 LoRAExpertsMixin 混入 XPUExperts，使未量化（BF16）MoE LoRA 通过 XpuFusedMoe 的 activation_hook/output_hook 执行，替代 Triton 专家路径。 [PR #62807](https://github.com/vllm-project/vllm/pull/62807)

  > **影响：** 使用 vLLM XPU 后端且启用 MoE LoRA 的用户可获得更优性能。

### Strata

- **层拆分时预留 draft head 空间避免缓存溢出**：层拆分最后阶段运行 drafter，其 draft head 和 logits 在绑定后分配，可能超出专家缓存。现将其空间从最后一张卡的缓存中预留。 [PR #4549](https://github.com/Niko1221/Strata/pull/4549)

  > **影响：** 使用 Strata 双卡层拆分的用户可避免缓存溢出。

- **Battlemage 上可选启用混合 IQ3 解码优化**：针对 Arc Pro B70 的原生混合 IQ3 解码路径存在重复工作，此补丁保留生产覆盖的解码优化，作为可选启用。 [PR #4185](https://github.com/Niko1221/Strata/pull/4185)

  > **影响：** 使用 Battlemage 且启用混合 IQ3 解码的用户可获性能提升。

- **Qwen3.8-Flash-Next IQ2_XS 单 B70 端到端预览**：未修改的 0.2.0-beta SYCL 引擎在单 B70 上 IQ2_XS 推理延迟较高，组合引擎预览可降低延迟。实测 32K 工作负载下客户端解码速率 67.10 tok/s。 [PR #3153](https://github.com/Niko1221/Strata/pull/3153)

  > **影响：** 使用 Strata SYCL 引擎且运行 Qwen3.8-Flash-Next IQ2_XS 的用户可关注预览版本。

- **流水线两阶段拆分按慢阶段定价**：--pipeline-windows 2 使两阶段重叠，但 --layer-split auto 仍按两阶段时间总和定价，导致负载不均衡。现改为按较慢阶段定价。 [PR #4534](https://github.com/Niko1221/Strata/pull/4534)

  > **影响：** 使用 Strata 双卡流水线拆分的用户可获得更均衡的负载。

- **自动层拆分时也裁剪每卡稠密权重**：此前仅在显式 --layer-split 时裁剪稠密权重，自动模式未裁剪。现自动模式也进行裁剪，减少内存占用。 [PR #4522](https://github.com/Niko1221/Strata/pull/4522)

  > **影响：** 使用 Strata --layer-split auto 的用户可减少内存占用。

## 编译器与加速库

### Triton XPU 后端

- **修复描述符 gather 偏移 i32 截断导致越界**：computeGatherScatterOperands 在计算 index*stride 时使用 i32，导致大偏移截断。现改为 i64 计算，避免描述符 gather/scatter 越界。 [commit 2c71820](https://github.com/intel/intel-xpu-backend-for-triton/commit/2c7182060cddb0b0d779805e82449c57eb1008bc)

  > **影响：** 使用 Triton XPU 后端且涉及大张量 gather/scatter 的用户可能遇到错误，需更新后端。

- **2D 块加载边界匹配支持索引在右侧的约束**：matchBoundaryCheckMask 仅接受 slt(index, bound) 形式，但 K > offs_k 会生成 sgt(bound, index)，导致边界检查未生效。现支持两种形式。 [commit 5ac6e5a](https://github.com/intel/intel-xpu-backend-for-triton/commit/5ac6e5a35a31d7790a1f9d2f5b38b1e951dec345)

  > **影响：** 使用 Triton XPU 后端且依赖 2D 块加载边界检查的用户可能获得正确性提升。

<details class="news-minor">
<summary>其他 2 项小改动</summary>

- AOT link.py 不再导入 torch 以加速链接：Triton AOT 链接去除 torch 依赖。 [commit 88b2e82](https://github.com/intel/intel-xpu-backend-for-triton/commit/88b2e82389b0a29c60d0cd61b5c1098daa40492c)
- SGLANG 依赖 pin 更新至 ab84df6：SGLANG pin 更新。 [commit 19432c3](https://github.com/intel/intel-xpu-backend-for-triton/commit/19432c342da8b540b1f1daf10817f2878d890cea)

</details>

## 社区反馈

### IGCIT 问题追踪

<details class="news-minor">
<summary>1 项小改动</summary>

- Star Citizen 在 Arc iGPU 上 Vulkan 初始化失败：Star Citizen 在 Arc iGPU 上启动崩溃。 [#1618](https://github.com/IGCIT/Intel-GPU-Community-Issue-Tracker-IGCIT/issues/1618)

</details>
