---
title: "Intel GPU 技术生态日报 (2026-11-10)"
description: "vLLM XPU 修复 greedy_argmax NaN 处理，恢复主分支正确性；Triton XPU 后端优化 2D 块读取布局，提升归约性能"
pubDate: "2026-11-10T08:30:00.000Z"
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

- <span class="news-badge news-badge--merged">Merged</span> **vLLM XPU 修复 greedy_argmax NaN 处理，恢复主分支正确性** [详情 →](#vllm-xpu)
- <span class="news-badge news-badge--merged">Merged</span> **Triton XPU 后端优化 2D 块读取布局，提升归约性能** [详情 →](#triton-xpu-后端)

## 主流框架与上游集成

### vLLM XPU

- **修复 greedy_argmax 的 NaN 处理**：vLLM XPU 主分支因 #57770 引入回归，greedy_argmax 的 torch fallback 未将 NaN 视为 -inf，与文档契约和 Triton 路径不一致。此 PR 修复该行为，使 XPU 主分支恢复正确。 [PR #64897](https://github.com/vllm-project/vllm/pull/64897)

  > **影响：** 使用 vLLM XPU 主分支的开发者需更新至包含此修复的版本，否则贪心解码可能产生错误结果。

- **Gemma4 MoE 路由改用 topk_softmax**：XPU 上 Gemma4 的 MoE 路由从 Triton 内核切换到 topk_softmax MoE 操作，数学等价，但使用 XPU 内核实现，可能提升性能或兼容性。 [PR #63330](https://github.com/vllm-project/vllm/pull/63330)

  > **影响：** 使用 Gemma4 模型的 vLLM XPU 用户将自动受益，无需手动操作。

- **XPU 启用大头部 prefill 配置**：在 Intel Arc Pro B70 上启用 head_size 256 的 tuned_large_head prefill 启动配置，此前仅限 SM100。短多查询批次（推测解码验证）保持 3D 形状，可能提升性能。 [PR #61630](https://github.com/vllm-project/vllm/pull/61630)

  > **影响：** 使用 Arc Pro B70 的 vLLM XPU 用户可能获得 prefill 性能提升。

<details class="news-minor">
<summary>其他 1 项小改动</summary>

- UCX 测试使用支持的块大小：UCX 测试块大小适配 XPU 要求 [PR #64834](https://github.com/vllm-project/vllm/pull/64834)

</details>

## 编译器与加速库

### Triton XPU 后端

- **2D 块读取布局重排优化**：针对 tensor-descriptor 加载小 tile 并用于归约（如 vLLM reduce_segments 的 fp32 [16,D] tile）的场景，引入可选的重排布局，以支持 2D 块读取，提升归约性能。 [commit 2234613](https://github.com/intel/intel-xpu-backend-for-triton/commit/2234613d3bc1b7eb3d51a79da8da1352f528b227)

  > **影响：** 使用 vLLM 的 reduce_segments 等归约操作的 XPU 用户可能获得性能提升，需启用该选项。

<details class="news-minor">
<summary>其他 4 项小改动</summary>

- 提升布局转换提升能力：布局转换可跨多个操作提升 [commit 83c2684](https://github.com/intel/intel-xpu-backend-for-triton/commit/83c268486af15b98f688bea672520ba133dcf9f8)
- 更新 vLLM 依赖 pin：更新 vLLM pin 版本 [commit e00d144](https://github.com/intel/intel-xpu-backend-for-triton/commit/e00d144413c865b71b6742a4fde42f85d612981e)
- 移除 SGLANG 测试跳过项：恢复 SGLANG test_seqlen_1 测试 [commit 6dcaeff](https://github.com/intel/intel-xpu-backend-for-triton/commit/6dcaefff373a525570a71539a95f8cb1a909f83f)
- 允许行限制掩码加载使用块 IO：允许行限制掩码加载使用块 IO [commit 73fae93](https://github.com/intel/intel-xpu-backend-for-triton/commit/73fae932d85ca57a0b18f3cb2768eca353a519db)

</details>

## 驱动、内核与图形栈

### Linux 图形栈

- **ANV 驱动支持 AV1 编码码率控制**：Mesa ANV 驱动新增 AV1 编码的码率控制支持，由 Igalia 的 Hyunjun Ko 持续改进 Vulkan Video 支持。 [Phoronix](https://www.phoronix.com/news/Intel-ANV-AV1-Bitrate-Control)

  > **影响：** 使用 Intel 显卡进行 AV1 编码的用户可获得更可控的码率。

### compute-runtime

<details class="news-minor">
<summary>2 项小改动</summary>

- 计算运行时启用 8 字节缓冲区复制：计算运行时优化大型复制性能 [26.44.40734.6](https://github.com/intel/compute-runtime/releases/tag/26.44.40734.6)
- 计算运行时修复线程抢占表面延迟：计算运行时修复抢占表面备份 [26.40.40196.17](https://github.com/intel/compute-runtime/releases/tag/26.40.40196.17)

</details>
