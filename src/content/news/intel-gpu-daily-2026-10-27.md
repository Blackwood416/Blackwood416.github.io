---
title: "Intel GPU 技术生态日报 (2026-10-27)"
description: "vLLM XPU MoE 调整网格顺序与 tile 尺寸，提升专家批处理性能；vLLM XPU 启用 per-token 动态 FP8 量化，提升性能与图兼容性"
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

- <span class="news-badge news-badge--merged">Merged</span> **vLLM XPU MoE 调整网格顺序与 tile 尺寸，提升专家批处理性能** [详情 →](#vllm-xpu)
- <span class="news-badge news-badge--merged">Merged</span> **vLLM XPU 启用 per-token 动态 FP8 量化，提升性能与图兼容性** [详情 →](#vllm-xpu)

## 主流框架与上游集成

### vLLM XPU

- **调整 MoE 网格顺序与 tile 尺寸**：将 batched_triton_kernel 的网格顺序改为 expert id 作为最快变化轴，使连续程序访问不同专家的权重，并调整 tile 尺寸，以改善专家批处理时的内存访问局部性和负载均衡。 [PR #51605](https://github.com/vllm-project/vllm/pull/51605)

  > **影响：** 使用 vLLM XPU MoE 的推理性能可能提升，需重新测试相关模型。

- **采用 per-token 动态 FP8 激活量化**：将 FP8 激活量化从 per-tensor 改为 per-token 动态量化，以提升性能并增强与 XPU graph 的兼容性，避免 padding 导致的量化问题。 [PR #61362](https://github.com/vllm-project/vllm/pull/61362)

  > **影响：** vLLM XPU 上 FP8 推理性能提升，图执行兼容性改善。

- **修复 XPU MLA 缓存操作参数**：修复 XPU 上 MLA 缓存操作与上游新增 skip_scale 参数的兼容性问题，确保 concat_and_cache_mla 正确调用。 [PR #63530](https://github.com/vllm-project/vllm/pull/63530)

  > **影响：** 修复 MLA 缓存在 XPU 上的潜在错误，影响使用 MLA 的模型。

- **修复 Kimi-Linear 模型在 XPU 上的分发**：修复 Kimi-Linear 模型在 XPU 上错误回退到 NVIDIA 实现的问题，使其能正确使用 XPU 路径，依赖 MLA 修复。 [PR #63531](https://github.com/vllm-project/vllm/pull/63531)

  > **影响：** Kimi-Linear 模型可在 XPU 上运行，但性能可能非最优。

<details class="news-minor">
<summary>其他 2 项小改动</summary>

- 在 XPU 上启用 test_fusion_rmsnorm_quant：启用 XPU 融合 RMSNorm 量化测试 [PR #63658](https://github.com/vllm-project/vllm/pull/63658)
- 为 XPU 测试添加 PEFT 依赖：添加 PEFT 依赖以支持 LoRA 测试 [PR #63694](https://github.com/vllm-project/vllm/pull/63694)

</details>

### SGLang XPU

- **在 XPU 上保护 CuTe DSL 导入**：在 wanvideo.py 中，对 CuTe DSL 的 q/k norm RoPE 导入添加 XPU 保护，避免在 XPU 上因缺少依赖而导入失败。 [PR #46393](https://github.com/sgl-project/sglang/pull/46393)

  > **影响：** 修复 SGLang 在 XPU 上运行 Wan 视频模型的导入错误。

## 编译器与加速库

### Triton XPU 后端

- **bf16 保留统一注意力重关联，fp8 移除**：在 vLLM 注意力中，对 bf16 保留预缩放 Q 的统一重关联优化，对 fp8 则回退到原始逐 tile 乘加，因为 fp8 下预缩放可能引入精度问题。 [commit fb34fa5](https://github.com/intel/intel-xpu-backend-for-triton/commit/fb34fa5fb6f5f03114bc22310568b431f811b639)

  > **影响：** 影响 vLLM XPU 上 bf16 和 fp8 注意力计算的性能与精度，需验证 fp8 场景。

- **将 libdevice.exp2 降级为 tl.math.exp2**：将 f16/f32 的 libdevice.exp2 调用降级为 tl.math.exp2，实测 f16 下更快且更准确，提升数学函数性能。 [commit f9d05af](https://github.com/intel/intel-xpu-backend-for-triton/commit/f9d05af93339586046f1e014be5ec73f8e198cc3)

  > **影响：** 使用 exp2 的 Triton 内核在 XPU 上性能提升，精度改善。

<details class="news-minor">
<summary>其他 3 项小改动</summary>

- 允许 namedtuple 字段退出 JIT 特化：增加 namedtuple 字段特化控制 [commit 8d81295](https://github.com/intel/intel-xpu-backend-for-triton/commit/8d8129515f777782dbe5a302c598dc8dd78fb2f9)
- 统一二进制加载流程并重命名 SPIRVRunner：重构二进制加载流程，统一命名 [commit db648bc](https://github.com/intel/intel-xpu-backend-for-triton/commit/db648bc13e706dcfeb5e16e436ab3dd42b51e0e3)
- 取消跳过 MRV2 draft_model 推测解码测试：启用 MRV2 推测解码测试 [commit 8cc4b03](https://github.com/intel/intel-xpu-backend-for-triton/commit/8cc4b03f24093bf8f9cb8e153a4ed7e5b39b5f40)

</details>

## 驱动、内核与图形栈

### Level Zero

<details class="news-minor">
<summary>1 项小改动</summary>

- 发布 oneAPI Level Zero Loader v1.35.0：Level Zero Loader 发布新版本 [v1.35.0](https://github.com/oneapi-src/level-zero/releases/tag/v1.35.0)

</details>
