---
title: "Intel GPU 技术生态日报 (2026-10-27)"
description: "vLLM XPU MoE 内核调整网格顺序与 tile 大小以提升性能；Triton XPU 后端将 exp2 降级为 tl.math.exp2 加速 f16/f32；vLLM XPU 改用 per-token 动态 FP8 量化，兼容…"
pubDate: "2026-10-27T08:30:00.000Z"
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

- <span class="news-badge news-badge--merged">Merged</span> **vLLM XPU MoE 内核调整网格顺序与 tile 大小以提升性能** [详情 →](#vllm-xpu)
- <span class="news-badge news-badge--merged">Merged</span> **Triton XPU 后端将 exp2 降级为 tl.math.exp2 加速 f16/f32** [详情 →](#triton-xpu-后端)
- <span class="news-badge news-badge--merged">Merged</span> **vLLM XPU 改用 per-token 动态 FP8 量化，兼容图执行** [详情 →](#vllm-xpu)

## 主流框架与上游集成

### vLLM XPU

- **调整 MoE 内核网格顺序与 tile 大小**：将专家 ID 设为最快变化的网格轴，使连续程序访问不同专家的权重，改善内存访问局部性；同时调整 tile 大小以匹配专家批处理场景。 [PR #51605](https://github.com/vllm-project/vllm/pull/51605)

  > **影响：** 使用 vLLM XPU 的 MoE 模型推理性能可能提升，需重新基准测试。

- **改用 per-token 动态 FP8 激活量化**：将 FP8 激活量化从 per-tensor 改为 per-token 动态，以提升性能并避免图执行时 padding 导致的量化问题。 [PR #61362](https://github.com/vllm-project/vllm/pull/61362)

  > **影响：** vLLM XPU 上使用 FP8 的模型推理性能提升，图执行兼容性改善。

- **修复 MLA 缓存操作参数**：上游 vLLM 为 concat_and_cache_mla 添加了 skip_scale 参数，XPU 实现未同步导致兼容性问题，已修复参数。 [PR #63530](https://github.com/vllm-project/vllm/pull/63530)

  > **影响：** 修复 vLLM XPU 上 MLA 缓存功能，确保与上游一致。

- **修复 Kimi-Linear 模型在 XPU 上的分发**：Kimi-Linear 模型在 XPU 上错误地回退到 NVIDIA 实现，已修复分发逻辑，使其在 XPU 上正确运行。 [PR #63531](https://github.com/vllm-project/vllm/pull/63531)

  > **影响：** vLLM XPU 可运行 Kimi-Linear 模型，依赖 MLA 修复。

<details class="news-minor">
<summary>其他 2 项小改动</summary>

- 在 XPU 上启用 test_fusion_rmsnorm_quant：启用 XPU 融合 RMSNorm 量化测试 [PR #63658](https://github.com/vllm-project/vllm/pull/63658)
- XPU 测试依赖添加 PEFT 以支持 LoRA：添加 PEFT 依赖，修复 LoRA 测试 [PR #63694](https://github.com/vllm-project/vllm/pull/63694)

</details>

### SGLang XPU

- **SGLang 防护 CuTe DSL 导入**：wanvideo.py 模块级导入 CuTe DSL 相关函数，在 XPU 上不可用，已添加防护避免导入错误。 [PR #46393](https://github.com/sgl-project/sglang/pull/46393)

  > **影响：** SGLang 在 XPU 上运行 diffusion/wan 模型不再崩溃。

## 编译器与加速库

### Triton XPU 后端

- **bf16 保留统一注意力重关联，fp8 移除**：对 bf16 的 Q 保留预缩放方式，对 fp8 的 Q 改用原始逐 tile 乘法，以适配不同数据类型的数值特性。 [commit fb34fa5](https://github.com/intel/intel-xpu-backend-for-triton/commit/fb34fa5fb6f5f03114bc22310568b431f811b639)

  > **影响：** 影响 vLLM 在 XPU 上使用 fp8 或 bf16 的注意力计算，需验证数值正确性。

- **将 libdevice.exp2 降级为 tl.math.exp2**：将 f16/f32 的 exp2 调用从 libdevice 降级到 tl.math.exp2，实测 f16 下更快且更准确。 [commit f9d05af](https://github.com/intel/intel-xpu-backend-for-triton/commit/f9d05af93339586046f1e014be5ec73f8e198cc3)

  > **影响：** 使用 Triton 编译的 f16/f32 指数运算性能提升，精度改善。

<details class="news-minor">
<summary>其他 3 项小改动</summary>

- 允许 namedtuple 字段退出 JIT 特化：namedtuple 字段可跳过 JIT 特化 [commit 8d81295](https://github.com/intel/intel-xpu-backend-for-triton/commit/8d8129515f777782dbe5a302c598dc8dd78fb2f9)
- 统一二进制加载流程并重命名 SPIRVRunner：统一加载流程，重命名 runner [commit db648bc](https://github.com/intel/intel-xpu-backend-for-triton/commit/db648bc13e706dcfeb5e16e436ab3dd42b51e0e3)
- 取消跳过 MRV2 draft_model 推测解码测试：恢复 MRV2 推测解码测试 [commit 8cc4b03](https://github.com/intel/intel-xpu-backend-for-triton/commit/8cc4b03f24093bf8f9cb8e153a4ed7e5b39b5f40)

</details>

## 驱动、内核与图形栈

### Level Zero

<details class="news-minor">
<summary>1 项小改动</summary>

- Level Zero Loader v1.35.0 发布：Level Zero Loader 发布 v1.35.0 [v1.35.0](https://github.com/oneapi-src/level-zero/releases/tag/v1.35.0)

</details>
