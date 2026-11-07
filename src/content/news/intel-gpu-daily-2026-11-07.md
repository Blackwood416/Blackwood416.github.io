---
title: "Intel GPU 技术生态日报 (2026-11-07)"
description: "移除 flex attention 测试跳过，驱动已修复挂起；Triton 版本升至 3.9.1 以适配 PyTorch 2.16"
pubDate: "2026-11-07T08:30:00.000Z"
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

- <span class="news-badge news-badge--merged">Merged</span> **移除 flex attention 测试跳过，驱动已修复挂起** [详情 →](#triton-xpu-后端)
- <span class="news-badge news-badge--merged">Merged</span> **Triton 版本升至 3.9.1 以适配 PyTorch 2.16** [详情 →](#triton-xpu-后端)

## 主流框架与上游集成

### vLLM XPU

<details class="news-minor">
<summary>1 项小改动</summary>

- 修正 vLLM 测试取消选择的文件路径：修正 vLLM 测试路径。 [PR #66039](https://github.com/vllm-project/vllm/pull/66039)

</details>

## 编译器与加速库

### Triton XPU 后端

- **SymbolicBounds 新增 materializeForm 与 splat 归一化**：新增 materializeForm 让 pass 能将 prover 已知信息转回 IR，splat-leaf 归一化模式用于 #8651 的行数限制场景。 [commit d677b40](https://github.com/intel/intel-xpu-backend-for-triton/commit/d677b4013a01dafa61eda2a10fed7b343ca04f79)

  > **影响：** 影响依赖 SymbolicBounds 的优化 pass，如行限制相关优化。

- **循环内 convert 重物化至锚点**：在 RemoveLayoutConversions 中，将循环内 convert 重物化至锚点，以修复 #8596 中 per-row scale load 的布局问题。 [commit be2655d](https://github.com/intel/intel-xpu-backend-for-triton/commit/be2655d759f59c8801ae35e872a345f0d8e7c8e4)

  > **影响：** 影响布局转换优化，可能改善相关算子性能。

- **移除 ScanOpToLLVM fork，改用 warpScan 钩子**：将 600 行重复的 ScanOpToLLVM 实现替换为 TargetInfoBase 的 warpScan 钩子，减少代码重复。 [commit fc396f7](https://github.com/intel/intel-xpu-backend-for-triton/commit/fc396f7b790679281e835a2f6d61343f6a2db069)

  > **影响：** 影响扫描算子代码生成，需验证功能一致性。

- **Proton 插件链接 ProtonIntelGPUToLLVM**：修复 TritonProton 插件未链接 ProtonIntelGPUToLLVM 的问题，使 createConvertProtonIntelGPUToLLVMPass 可用。 [commit 24c67cd](https://github.com/intel/intel-xpu-backend-for-triton/commit/24c67cddef223680775a0931958e700ac1688f2b)

  > **影响：** 影响 Proton 插件功能，需重新构建。

- **XPU 启用 Proton instrumentation 模式**：启用 Proton 的 instrumentation 模式，支持内核内性能分析，提供 TTGIR 覆盖等。 [commit 546220e](https://github.com/intel/intel-xpu-backend-for-triton/commit/546220e3751cdc5e396ba9811ac86f7a66f3ca0c)

  > **影响：** 影响使用 Proton 进行性能分析的用户。

<details class="news-minor">
<summary>其他 6 项小改动</summary>

- 恢复 flex attention 测试，移除旧驱动规避：移除 flex attention 测试跳过，驱动已修复。 [commit cac6d0b](https://github.com/intel/intel-xpu-backend-for-triton/commit/cac6d0b9226df32171e404df74ddd100f65f54c2)
- 适配上游 elementwise 与 true-mask 折叠改动：同步上游 elementwise 与 mask 折叠改动。 [commit 736eb8f](https://github.com/intel/intel-xpu-backend-for-triton/commit/736eb8f0e9497c3eeedae2b8f9d1f8a3cadcd7ad)
- Triton 版本更新至 3.9.1：Triton 版本升至 3.9.1。 [commit e21e246](https://github.com/intel/intel-xpu-backend-for-triton/commit/e21e246bb2e007595e6b33a6f1c7e8330b7470cd)
- 新增 rank-3 分组矩阵乘行限制基准：新增 rank-3 分组矩阵乘基准。 [commit 325e37d](https://github.com/intel/intel-xpu-backend-for-triton/commit/325e37d91ef69e229ded43f39208aa4de367a78c)
- 合并 Intel 单元测试为单一可执行文件：合并 Intel 单元测试可执行文件。 [commit dfc1304](https://github.com/intel/intel-xpu-backend-for-triton/commit/dfc13041240359b83ce44ce19ed4f810d8fb9158)
- 文档化测试跳过与 xfail 列表规则：文档化 skip/xfail 列表规则。 [commit 8e86bfb](https://github.com/intel/intel-xpu-backend-for-triton/commit/8e86bfb85004aa842eea3cd7d38f98383e38c83f)

</details>

## 驱动、内核与图形栈

### Windows 驱动

<details class="news-minor">
<summary>1 项小改动</summary>

- HWiNFO 识别未发布 Radeon RX 7500 与 Razor Lake：HWiNFO 识别新硬件。 [TechPowerUp](https://www.techpowerup.com/354555/unreleased-radeon-rx-7500-and-intel-razor-lake-h-hx-s-appear-in-latest-hwinfo-beta)

</details>

## 社区反馈

### IGCIT 问题追踪

<details class="news-minor">
<summary>1 项小改动</summary>

- PETAFAB 游戏崩溃问题报告：PETAFAB 游戏崩溃报告。 [#1609](https://github.com/IGCIT/Intel-GPU-Community-Issue-Tracker-IGCIT/issues/1609)

</details>
