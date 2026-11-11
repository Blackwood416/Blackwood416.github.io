---
title: "Intel GPU 技术生态日报 (2026-11-11)"
description: "修复 bool 张量描述符加载/存储崩溃；回退 scan 泛化改动，恢复稳定"
pubDate: "2026-11-11T08:30:00.000Z"
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

- <span class="news-badge news-badge--merged">Merged</span> **修复 bool 张量描述符加载/存储崩溃** [详情 →](#triton-xpu-后端)
- <span class="news-badge news-badge--merged">Merged</span> **回退 scan 泛化改动，恢复稳定** [详情 →](#triton-xpu-后端)

## 主流框架与上游集成

### vLLM XPU

<details class="news-minor">
<summary>2 项小改动</summary>

- 修复 XPU 外部 LB 测试设备可见性：修复外部 LB 测试的设备可见性问题 [PR #66446](https://github.com/vllm-project/vllm/pull/66446)
- 迁移更多 B70 作业到 intel_gpu_k8s：迁移 B70 CI 作业到 intel_gpu_k8s [PR #66603](https://github.com/vllm-project/vllm/pull/66603)

</details>

## 编译器与加速库

### Triton XPU 后端

- **修复 bool 张量描述符加载/存储崩溃**：通过张量描述符加载或存储 bool 张量时，编译器触发 LLVM "Invalid cast!" 断言。修复了加载和存储路径中的类型转换问题。 [commit 16e0a6c](https://github.com/intel/intel-xpu-backend-for-triton/commit/16e0a6c10c033d19b8e7c62fea4a04b00efdbfa3)

  > **影响：** 使用 bool 张量描述符的 Triton 内核开发者

- **回退 scan 泛化及 NVIDIA 相关改动**：回退了 scan 泛化到线性布局的改动和 NVIDIA 的 shuffle-up 边界谓词复用，并恢复了合并时丢失的 warpScan 钩子调用。这些回退可能是为了修复回归或保持一致性。 [commit bed5ab3](https://github.com/intel/intel-xpu-backend-for-triton/commit/bed5ab3e2826b6bebc76e585029311da590d41ef) · [commit 521b21f](https://github.com/intel/intel-xpu-backend-for-triton/commit/521b21facb3d3fe13b1fc4070c74273c3ae11e5c) · [commit 11a589d](https://github.com/intel/intel-xpu-backend-for-triton/commit/11a589d125627bf9d69b46ebc62b8c84c335fd6b)

  > **影响：** 依赖 scan 操作的 Triton 内核开发者

- **小 INT8 dot 回退到 FMA**：允许小尺寸 INT8 dot 在 DPAS 无法处理时回退到 FMA。此前因 INT8 FMA 路径结果错误而保留了最小尺寸限制，现在该问题已修复，可以放宽限制。 [commit 372730e](https://github.com/intel/intel-xpu-backend-for-triton/commit/372730efd35de746d48ac0e9aa64d657a747afad)

  > **影响：** 使用小尺寸 INT8 dot 的 Triton 内核开发者

- **将数据相关加载地址视为可能复用**：AnnotateCacheControl 将没有复用证据的 tt.load 标记为 .cg，但复用分析无法识别通过数据相关地址（如 table[idx]）的复用。此改动将这类地址视为可能复用，避免过度使用 .cg。 [commit a89bb56](https://github.com/intel/intel-xpu-backend-for-triton/commit/a89bb56a66df1eee26ccc7820bf4f4f005297e8a)

  > **影响：** 使用数据相关加载地址的 Triton 内核开发者

<details class="news-minor">
<summary>其他 3 项小改动</summary>

- matchRowLimitMask 接受 i64 行索引：扩展行限制掩码匹配以支持 i64 索引 [commit 0ab43cf](https://github.com/intel/intel-xpu-backend-for-triton/commit/0ab43cf0791b200ec47681a138f6c5817a49ef34)
- arch_parser 添加 CRI 架构支持：添加 CRI 架构解析支持 [commit ce452a3](https://github.com/intel/intel-xpu-backend-for-triton/commit/ce452a32544950801e7f6f82e77bcb5f189c9bac)
- 更新 sgl-kernel-xpu 固定版本：更新 sgl-kernel-xpu 依赖版本 [commit 84c773b](https://github.com/intel/intel-xpu-backend-for-triton/commit/84c773b3200cb2b7c4213a0000c4f9cbdc590d76)

</details>

## 驱动、内核与图形栈

### IGC 图形编译器

<details class="news-minor">
<summary>1 项小改动</summary>

- Intel Graphics Compiler 发布多个版本：IGC 发布 v2.43.4-v2.43.9 版本 [v2.43.9](https://github.com/intel/intel-graphics-compiler/releases/tag/v2.43.9) · [v2.43.8](https://github.com/intel/intel-graphics-compiler/releases/tag/v2.43.8) · [v2.43.7](https://github.com/intel/intel-graphics-compiler/releases/tag/v2.43.7) · [v2.43.6](https://github.com/intel/intel-graphics-compiler/releases/tag/v2.43.6) · [v2.43.5](https://github.com/intel/intel-graphics-compiler/releases/tag/v2.43.5) · [v2.43.4](https://github.com/intel/intel-graphics-compiler/releases/tag/v2.43.4)

</details>

## 社区反馈

### IGCIT 问题追踪

<details class="news-minor">
<summary>1 项小改动</summary>

- Slang 生成 SPIR-V 时 vkCreateGraphicsPipelines 段错误：报告 Slang SPIR-V 创建图形管线段错误 [#1612](https://github.com/IGCIT/Intel-GPU-Community-Issue-Tracker-IGCIT/issues/1612)

</details>
