---
title: "Intel GPU 技术生态日报 (2026-11-10)"
description: "vLLM XPU 修复 greedy_argmax NaN 处理，恢复主分支可用；Triton XPU 优化 2D 块加载，提升非点乘描述符加载性能"
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

- <span class="news-badge news-badge--merged">Merged</span> **vLLM XPU 修复 greedy_argmax NaN 处理，恢复主分支可用** [详情 →](#vllm-xpu)
- <span class="news-badge news-badge--merged">Merged</span> **Triton XPU 优化 2D 块加载，提升非点乘描述符加载性能** [详情 →](#triton-xpu-后端)

## 主流框架与上游集成

### vLLM XPU

- **修复 greedy_argmax 的 NaN 处理**：vLLM 主分支 XPU 因 #57770 引入回归，greedy_argmax 的 torch fallback 未按契约将 NaN 视为 -inf，导致行为与 Triton 路径不一致。此 PR 修复该问题，使 torch fallback 与文档及 Triton 路径对齐。 [PR #64897](https://github.com/vllm-project/vllm/pull/64897)

  > **影响：** 使用 XPU 且依赖 torch fallback 的投机解码用户，需更新 vLLM 以恢复正确行为。

- **Gemma4 MoE 路由改用 topk_softmax**：XPU 上 Gemma4 的 MoE 路由从 Triton 内核切换到 topk_softmax MoE 操作（_moe_C），数学等价但使用 XPU 内核实现。 [PR #63330](https://github.com/vllm-project/vllm/pull/63330)

  > **影响：** 使用 Gemma4 模型的 vLLM XPU 用户将获得更优的 MoE 路由性能。

- **XPU 启用大 head 预填充配置**：在 Intel XPU（Arc Pro B70）上启用 head_size 256 的 tuned_large_head 预填充启动配置，此前仅限 SM100。短多查询批次（投机解码验证）保持 3D 形状。 [PR #61630](https://github.com/vllm-project/vllm/pull/61630)

  > **影响：** 使用大 head 尺寸的 XPU 用户可获得更好的预填充性能。

<details class="news-minor">
<summary>其他 1 项小改动</summary>

- UCX 测试使用支持的块大小：UCX 测试适配块大小要求 [PR #64834](https://github.com/vllm-project/vllm/pull/64834)

</details>

## 编译器与加速库

### Triton XPU 后端

- **非点乘描述符加载支持可选重排**：针对小 tile 描述符加载（如 vLLM reduce_segments 的 fp32 [16,D] tile）在归约前进行布局重排，可提升性能。此功能为 opt-in，默认不启用。 [commit 2234613](https://github.com/intel/intel-xpu-backend-for-triton/commit/2234613d3bc1b7eb3d51a79da8da1352f528b227)

  > **影响：** 使用 2D 块读取且涉及归约的 Triton 内核可尝试启用以获得性能提升。

<details class="news-minor">
<summary>其他 7 项小改动</summary>

- 插件示例改用 setSymbolName：插件示例适配弃用 API [commit 72f3e0c](https://github.com/intel/intel-xpu-backend-for-triton/commit/72f3e0c68425f237f1e882507f91fd5bdc61e7f0)
- base_width 改为运行时操作数：2D 块加载的 base_width 改为运行时操作数 [commit 1814103](https://github.com/intel/intel-xpu-backend-for-triton/commit/1814103c40f9587b82b49ce399ab4bdf59179e88)
- 同步上游 README 到 Intel 版本：同步上游 README [commit 12ee329](https://github.com/intel/intel-xpu-backend-for-triton/commit/12ee329ada25ae4dc72a3d5eba3a870e87724610)
- 布局转换提升支持多个扩展/广播操作：布局转换提升支持多操作 [commit 83c2684](https://github.com/intel/intel-xpu-backend-for-triton/commit/83c268486af15b98f688bea672520ba133dcf9f8)
- 更新 vLLM pin 版本：更新 vLLM pin [commit e00d144](https://github.com/intel/intel-xpu-backend-for-triton/commit/e00d144413c865b71b6742a4fde42f85d612981e)
- 从 skiplist 移除 test_seqlen_1：移除测试跳过项 [commit 6dcaeff](https://github.com/intel/intel-xpu-backend-for-triton/commit/6dcaefff373a525570a71539a95f8cb1a909f83f)
- 允许行限制掩码加载使用块 IO：允许行限制掩码加载使用块 IO [commit 73fae93](https://github.com/intel/intel-xpu-backend-for-triton/commit/73fae932d85ca57a0b18f3cb2768eca353a519db)

</details>

## 驱动、内核与图形栈

### Linux 图形栈

<details class="news-minor">
<summary>1 项小改动</summary>

- ANV 驱动支持 AV1 编码码率控制：ANV 驱动添加 AV1 码率控制 [Phoronix](https://www.phoronix.com/news/Intel-ANV-AV1-Bitrate-Control)

</details>

### compute-runtime

<details class="news-minor">
<summary>2 项小改动</summary>

- compute-runtime 启用 8 字节缓冲拷贝：compute-runtime 性能优化 [26.44.40734.6](https://github.com/intel/compute-runtime/releases/tag/26.44.40734.6)
- compute-runtime 修复中线程抢占表面延迟：compute-runtime 修复抢占问题 [26.40.40196.17](https://github.com/intel/compute-runtime/releases/tag/26.40.40196.17)

</details>
