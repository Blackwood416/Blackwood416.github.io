---
title: "Intel GPU 技术生态日报 (2026-11-23)"
description: "Triton XPU 新增回归门禁的黄金向量语料库；torch-xpu-ops 默认 AOT 目标新增 NVL-S 与 CRI"
pubDate: "2026-11-23T08:30:00.000Z"
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

- <span class="news-badge news-badge--merged">Merged</span> **Triton XPU 新增回归门禁的黄金向量语料库** [详情 →](#triton-xpu-后端)
- <span class="news-badge news-badge--merged">Merged</span> **torch-xpu-ops 默认 AOT 目标新增 NVL-S 与 CRI** [详情 →](#torch-xpu-ops)

## 主流框架与上游集成

### vLLM XPU

- **vLLM XPU 支持 modelopt_mxfp8 量化格式**：为 vLLM XPU 添加 modelopt_mxfp8 量化格式，使其能正确分发到对应 XPU 内核。Linear 部分用 Qwen3-0.6B-MXFP8 验证，MoE 部分用单元测试验证。 [PR #68858](https://github.com/vllm-project/vllm/pull/68858)

  > **影响：** 影响 vLLM XPU 用户，支持新的量化格式。

- **XPU 滑动窗口层尊重用户 block size**：修复 XPU 上滑动窗口层 KV cache 配置，使 --block-size 参数生效。此前用户指定 block_size=16 未被尊重，现在已修复。 [PR #68108](https://github.com/vllm-project/vllm/pull/68108)

  > **影响：** 影响 vLLM XPU 用户，滑动窗口层现在能按用户指定 block size 运行。

<details class="news-minor">
<summary>其他 2 项小改动</summary>

- vLLM XPU 安装文档补充 find-links：vLLM XPU 安装文档补充 find-links。 [PR #68626](https://github.com/vllm-project/vllm/pull/68626)
- 恢复 v1/worker 被跳过的测试用例：恢复 v1/worker 被跳过的测试用例。 [PR #68618](https://github.com/vllm-project/vllm/pull/68618)

</details>

## 编译器与加速库

### Triton XPU 后端

- **新增回归门禁黄金向量语料库**：作为 benchmark_monitor 系列第 4 部分，为回归门禁引入 golden-vector 语料库，用于基准测试的回归检测。该语料库基于已合并的前序部分构建，确保门禁能稳定识别性能退化。 [commit cedc6ec](https://github.com/intel/intel-xpu-backend-for-triton/commit/cedc6ececd43284719184b8dcde080d30b953f80)

  > **影响：** 影响 Triton XPU 基准测试的维护者，需确保语料库与门禁逻辑正确集成。

- **广播加载按不同地址计成本**：在 RemoveLayoutConversions 中，对广播加载按不同地址计数成本。GEMM epilogue 中 addmm bias 使用 strides (0,1) 时，通过 BLOCK_M x BLOCK_N 指针张量重复一行地址，isExpensiveLoadOrStore 现在能更准确评估此类加载的成本。 [commit 8843be5](https://github.com/intel/intel-xpu-backend-for-triton/commit/8843be51e7665060ebbcb0683eda483363c94b85)

  > **影响：** 影响 Triton XPU 的布局转换优化，可能改善 GEMM epilogue 的性能。

- **折叠计算 tile 的 tl.trans 到生产者**：修复 #8634，将计算 tile 的 tl.trans 折叠到其生产者中，如 attention backward 中 dot(trans(p), do) 和 dot(trans(ds), q) 场景，避免不必要的转置操作。 [commit f4d9383](https://github.com/intel/intel-xpu-backend-for-triton/commit/f4d938312c17df6b34b06ec22e53c5bac5e96510)

  > **影响：** 影响 Triton XPU 的 attention backward 性能，减少转置开销。

- **无法用 2D block IO 时降级 DescriptorLoadOp**：在 LowerTo2DBlockLoad 中，当 tt.descriptor_load 无法转换为 ttig.2d_block_load 时，将其降级为 tt.load，确保所有加载都能正确 lower。 [commit a562cdc](https://github.com/intel/intel-xpu-backend-for-triton/commit/a562cdc789557eeb5526cb2882c2639c01b5ca9a)

  > **影响：** 影响 Triton XPU 的代码生成，确保 2D block load 不可用时仍能正确执行。

<details class="news-minor">
<summary>其他 1 项小改动</summary>

- 新增 TorchInductor GEMM 基准测试：新增 TorchInductor GEMM 基准测试脚本。 [commit 590d4ba](https://github.com/intel/intel-xpu-backend-for-triton/commit/590d4ba7750d1a78d224cd77637aad8919d5591d)

</details>

### torch-xpu-ops

- **默认 AOT 目标新增 NVL-S 与 CRI**：扩展 Linux 默认 AOT 目标列表，加入 NVL-S 和 CRI，使未指定 TORCH_XPU_ARCH_LIST 的构建默认生成这些架构的原生二进制。Windows 目标保持不变。 [PR #6246](https://github.com/intel/torch-xpu-ops/pull/6246)

  > **影响：** 影响 torch-xpu-ops 的 Linux 用户，默认构建将包含更多架构支持。

<details class="news-minor">
<summary>其他 1 项小改动</summary>

- UpSampleTrilinear3d 重构为自由函数：UpSampleTrilinear3d 重构为自由函数。 [PR #5264](https://github.com/intel/torch-xpu-ops/pull/5264)

</details>

## 社区反馈

### IGCIT 问题追踪

- **Satisfactory 启动后数秒崩溃**：报告者称 Satisfactory 在启动后数秒内崩溃，即使未到标题画面。已使用最新驱动，游戏为正版且无 mod。报告者认为可能与驱动或游戏兼容性有关，但根因未确认。 [#1627](https://github.com/IGCIT/Intel-GPU-Community-Issue-Tracker-IGCIT/issues/1627)

  > **影响：** 影响 Intel GPU 用户运行 Satisfactory，需等待进一步调查。
