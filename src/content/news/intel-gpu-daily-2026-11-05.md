---
title: "Intel GPU 技术生态日报 (2026-11-05)"
description: "Triton XPU 跟随上游默认关闭隐式 FP 融合；vLLM XPU 复用 GDN 元数据提升性能"
pubDate: "2026-11-05T08:30:00.000Z"
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

- <span class="news-badge news-badge--merged">Merged</span> **Triton XPU 跟随上游默认关闭隐式 FP 融合** [详情 →](#triton-xpu-后端)
- <span class="news-badge news-badge--merged">Merged</span> **vLLM XPU 复用 GDN 元数据提升性能** [详情 →](#vllm-xpu)

## 主流框架与上游集成

### vLLM XPU

- **XPU 复用 GDN 元数据**：让 XPU 使用 Model Runner V2 路径，复用 KV cache 组间的 GDN attention 元数据。此前该复用路径和 mamba align 模式的 aligned state index 预计算仅限 CUDA，现扩展到 XPU。 [PR #64479](https://github.com/vllm-project/vllm/pull/64479)

  > **影响：** 提升 vLLM XPU 上 KV cache 组间的性能，减少重复计算。

<details class="news-minor">
<summary>其他 2 项小改动</summary>

- vLLM XPU 跳过不支持测试：跳过 XPU 不支持测试 [PR #65805](https://github.com/vllm-project/vllm/pull/65805)
- vLLM XPU 升级至 torch 2.15：升级 torch 至 2.15 [PR #63977](https://github.com/vllm-project/vllm/pull/63977)

</details>

### SGLang XPU

<details class="news-minor">
<summary>1 项小改动</summary>

- SGLang XPU Docker 版本更新：更新 XPU Docker 版本 [PR #48104](https://github.com/sgl-project/sglang/pull/48104)

</details>

## 编译器与加速库

### Triton XPU 后端

- **修复无符号结果非负性误判**：SimplifySignedArithmetic 的 isNonNegative 无条件接受 remui/divui 结果，但无符号操作仅表示操作数按无符号读取，不保证结果非负。本提交修正该逻辑，避免后续优化错误。 [commit f0f45d3](https://github.com/intel/intel-xpu-backend-for-triton/commit/f0f45d3ff71d6ca57991bd59d6424dc57118c5ab)

  > **影响：** 影响依赖该优化 pass 的 Triton XPU 编译正确性，修复潜在错误代码生成。

- **修复 fp8 FMA 点积操作数拓宽时机**：在 FMA 路径上，decomposeMixedModeDotOp 在点积操作数已处于 blocked 布局时拓宽 fp8 操作数，但该布局会复制操作数，导致拓宽无效。本提交将拓宽提前到布局转换之前，确保正确性。 [commit f242df4](https://github.com/intel/intel-xpu-backend-for-triton/commit/f242df44366bd99681213844e80175015d423ce7)

  > **影响：** 影响使用 fp8 FMA 路径的 Triton XPU 编译，修复潜在错误结果。

- **FMA 路径支持 bf16 累加器**：允许 bf16 x bf16 和 fp8 x fp8 点积使用 bf16 累加器，但仅限无法使用 DPAS 的形状或函数。这扩展了 FMA 路径的累加器类型支持。 [commit 79e68e2](https://github.com/intel/intel-xpu-backend-for-triton/commit/79e68e2963dd002f8cb8308cf0cd0237f0e7a1af)

  > **影响：** 影响使用 bf16/fp8 点积且无法使用 DPAS 的 Triton XPU 用户，可能提升性能。

<details class="news-minor">
<summary>其他 5 项小改动</summary>

- 适配上游 FP 融合默认变更：回滚 #8395，默认关闭隐式 FP 融合 [commit 2b65336](https://github.com/intel/intel-xpu-backend-for-triton/commit/2b65336a2f19568939bc62c8ef513bcdb3929156)
- vLLM CI 提前 5 小时运行：调整 vLLM CI 运行时间 [commit a6d7f37](https://github.com/intel/intel-xpu-backend-for-triton/commit/a6d7f377b0fd8896e612a05bc29b2f4455c48013)
- 新增 grouped-matmul 行限制掩码基准：添加 grouped-matmul 基准测试 [commit 6da05e2](https://github.com/intel/intel-xpu-backend-for-triton/commit/6da05e2d5960839b78ba4a3d4a76451647559dff)
- base_height 改为运行时操作数：base_height 改为运行时操作数 [commit 46c53ee](https://github.com/intel/intel-xpu-backend-for-triton/commit/46c53eed17d9f4a52d8f12583b380fdf9d891b11)
- 修复 Windows 下 proton 测试构建：修复 Windows 构建问题 [commit 7af37e8](https://github.com/intel/intel-xpu-backend-for-triton/commit/7af37e8057a8c16fa189d0c36963f588eb4f8ef5)

</details>

### oneDNN

<details class="news-minor">
<summary>1 项小改动</summary>

- oneDNN 发布 v3.14.2：oneDNN 发布 v3.14.2 [v3.14.2](https://github.com/uxlfoundation/oneDNN/releases/tag/v3.14.2)

</details>

## 驱动、内核与图形栈

### Windows 驱动

- **Intel 发布 Arc 驱动 101.9175 WHQL**：Intel 发布 Arc GPU 图形驱动 101.9175 WHQL，包含对多款游戏的优化和问题修复。 [TechPowerUp](https://www.techpowerup.com/354491/intel-releases-arc-gpu-graphics-drivers-101-9175-whql)

  > **影响：** Arc GPU 用户可更新驱动以获取优化和修复。

## 社区反馈

### IGCIT 问题追踪

- **ACC 在驱动 9150 上崩溃**：报告者称 Assetto Corsa Competizione 在驱动 9150 上出现 D3D Device Lost 错误并崩溃。报告者认为可能与驱动相关，但未提供根因。 [#1607](https://github.com/IGCIT/Intel-GPU-Community-Issue-Tracker-IGCIT/issues/1607)

  > **影响：** 使用该驱动的 ACC 玩家可能遇到崩溃。

- **Arc B580 驱动 9154 下 DXR 崩溃**：报告者称在 Arc B580 上使用驱动 32.0.101.9154 Beta 运行 Call of Duty HQ 时出现 DXR/光追崩溃（LKD 0x141 BBHANG / GuC Scheduler error）。报告者认为与驱动相关，但未确认根因。 [#1606](https://github.com/IGCIT/Intel-GPU-Community-Issue-Tracker-IGCIT/issues/1606)

  > **影响：** 使用该驱动的 Arc B580 用户可能遇到光追崩溃。
