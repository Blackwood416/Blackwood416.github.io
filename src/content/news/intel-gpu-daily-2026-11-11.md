---
title: "Intel GPU 技术生态日报 (2026-11-11)"
description: "修复 bool 张量描述符加载/存储崩溃；回退 scan 泛化，恢复稳定"
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
- <span class="news-badge news-badge--merged">Merged</span> **回退 scan 泛化，恢复稳定** [详情 →](#triton-xpu-后端)

## 主流框架与上游集成

### vLLM XPU

<details class="news-minor">
<summary>4 项小改动</summary>

- 跳过未安装 lmcache 的测试：跳过 lmcache 测试 [PR #66924](https://github.com/vllm-project/vllm/pull/66924)
- 修复 Dots OCR 测试平台选择：修复 Dots OCR 测试平台 [PR #66758](https://github.com/vllm-project/vllm/pull/66758)
- 外部 LB 测试保持设备可见：修复外部 LB 测试设备可见性 [PR #66446](https://github.com/vllm-project/vllm/pull/66446)
- 迁移 B70 作业到 intel_gpu_k8s：迁移 B70 作业 [PR #66603](https://github.com/vllm-project/vllm/pull/66603)

</details>

## 编译器与加速库

### Triton XPU 后端

- **修复 bool 张量描述符加载/存储崩溃**：加载或存储 bool 张量时，编译器触发 LLVM "Invalid cast!" 断言。修复了加载和存储路径中的类型转换问题。 [commit 16e0a6c](https://github.com/intel/intel-xpu-backend-for-triton/commit/16e0a6c10c033d19b8e7c62fea4a04b00efdbfa3)

  > **影响：** 使用 bool 张量描述符的 Triton 内核不再崩溃。

- **回退 scan 泛化，恢复稳定**：回退了 scan lowering 泛化到线性布局的提交，以及 NVIDIA 的 shuffle-up 边界谓词复用，并恢复了合并时丢失的 warpScan hook 调用。这些回退旨在解决 scan 相关回归。 [commit bed5ab3](https://github.com/intel/intel-xpu-backend-for-triton/commit/bed5ab3e2826b6bebc76e585029311da590d41ef) · [commit 521b21f](https://github.com/intel/intel-xpu-backend-for-triton/commit/521b21facb3d3fe13b1fc4070c74273c3ae11e5c) · [commit 11a589d](https://github.com/intel/intel-xpu-backend-for-triton/commit/11a589d125627bf9d69b46ebc62b8c84c335fd6b)

  > **影响：** 使用 scan 操作的 Triton 内核恢复稳定。

- **小 INT8 dot 回退到 FMA**：允许小尺寸 INT8 dot 回退到 FMA 路径，此前因正确性问题被限制。修复了相关路径后，现在可以启用。 [commit 372730e](https://github.com/intel/intel-xpu-backend-for-triton/commit/372730efd35de746d48ac0e9aa64d657a747afad)

  > **影响：** 小尺寸 INT8 dot 性能提升。

- **数据依赖地址视为可能复用**：AnnotateCacheControl 分析无法识别通过数据依赖地址（如 `table[idx]`）的复用，导致标记为 `.cg`。现在将此类地址视为可能复用，避免错误标记。 [commit a89bb56](https://github.com/intel/intel-xpu-backend-for-triton/commit/a89bb56a66df1eee26ccc7820bf4f4f005297e8a)

  > **影响：** 数据依赖地址的加载不再被错误标记为 `.cg`，可能提升缓存性能。

<details class="news-minor">
<summary>其他 4 项小改动</summary>

- 降低 2D 块加载运行时列限制：降低 2D 块加载列限制 [commit 1bb8b00](https://github.com/intel/intel-xpu-backend-for-triton/commit/1bb8b00152e74cc4c8c64f559cfba2fd3d6fbd03)
- matchRowLimitMask 接受 i64 行索引：支持 i64 行索引 [commit 0ab43cf](https://github.com/intel/intel-xpu-backend-for-triton/commit/0ab43cf0791b200ec47681a138f6c5817a49ef34)
- 添加 CRI 架构支持：支持 CRI 架构 [commit ce452a3](https://github.com/intel/intel-xpu-backend-for-triton/commit/ce452a32544950801e7f6f82e77bcb5f189c9bac)
- 更新 sgl-kernel-xpu 固定版本：更新 sgl-kernel-xpu 版本 [commit 84c773b](https://github.com/intel/intel-xpu-backend-for-triton/commit/84c773b3200cb2b7c4213a0000c4f9cbdc590d76)

</details>

## 驱动、内核与图形栈

### IGC 图形编译器

<details class="news-minor">
<summary>1 项小改动</summary>

- IGC 发布多个版本：IGC 发布多个版本 [v2.43.9](https://github.com/intel/intel-graphics-compiler/releases/tag/v2.43.9) · [v2.43.8](https://github.com/intel/intel-graphics-compiler/releases/tag/v2.43.8) · [v2.43.7](https://github.com/intel/intel-graphics-compiler/releases/tag/v2.43.7) · [v2.43.6](https://github.com/intel/intel-graphics-compiler/releases/tag/v2.43.6)

</details>

## 社区反馈

### IGCIT 问题追踪

<details class="news-minor">
<summary>1 项小改动</summary>

- Slang 生成 SPIR-V 导致驱动崩溃：驱动崩溃报告 [#1612](https://github.com/IGCIT/Intel-GPU-Community-Issue-Tracker-IGCIT/issues/1612)

</details>
