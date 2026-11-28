---
title: "Intel GPU 技术生态日报 (2026-11-28)"
description: "Intel 驱动更新确认 Raptor Lake-S NEXT 与 Bartlett Lake-S 双产品线；Triton 后端修复 DPAS 累加器加载与 tile 尺寸计算顺序问题"
pubDate: "2026-11-28T08:30:00.000Z"
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

- <span class="news-badge news-badge--merged">Merged</span> **Intel 驱动更新确认 Raptor Lake-S NEXT 与 Bartlett Lake-S 双产品线** [详情 →](#windows-驱动)
- <span class="news-badge news-badge--merged">Merged</span> **Triton 后端修复 DPAS 累加器加载与 tile 尺寸计算顺序问题** [详情 →](#triton-xpu-后端)

## 主流框架与上游集成

### HuggingFace Transformers

<details class="news-minor">
<summary>2 项小改动</summary>

- Transformers 更新 4 个模型 XPU 测试期望：更新 4 个模型 XPU 测试期望。 [PR #51363](https://github.com/huggingface/transformers/pull/51363)
- Transformers 修复 CB 模型 XPU 测试数值问题：修复 CB 模型 XPU 测试数值问题。 [PR #51168](https://github.com/huggingface/transformers/pull/51168)

</details>

## 编译器与加速库

### Triton XPU 后端

- **修复 DPAS 累加器加载 tile 形状选择**：修复 #8895：当 clamped tile 无法容纳 DPAS C 消息形状时，不再使用该形状，避免加载错误。 [commit 321b03e](https://github.com/intel/intel-xpu-backend-for-triton/commit/321b03e89532d8913638d062c44bbfa870120fc1)

  > **影响：** 使用 DPAS 累加器布局的 Triton 内核可避免潜在错误。

- **BLOCKIO tile 尺寸计算改为顺序无关**：修复 #7806：原 getBlockIOTileSize 按寄存器基址列表顺序增长 tile，导致基址未按步长递增时无法构建完整 tile。新实现顺序无关，可正确计算 tile 尺寸。 [commit ad63fa3](https://github.com/intel/intel-xpu-backend-for-triton/commit/ad63fa3df4289336cab7fd22dd19ce0f05bd3c9e)

  > **影响：** 修复了特定布局下 2D block I/O 加载不完整的问题。

<details class="news-minor">
<summary>其他 2 项小改动</summary>

- Triton 后端原生 bf16 下用 fpext 转换：bf16 转换改用 fpext 指令。 [commit a71d4f2](https://github.com/intel/intel-xpu-backend-for-triton/commit/a71d4f2707d9af03894bd382abc409966b9127e9)
- Triton 后端取消跳过 sanitize overflow 测试：取消跳过 sanitize overflow 测试。 [commit 25f6009](https://github.com/intel/intel-xpu-backend-for-triton/commit/25f6009a7c3a6257ef97223311ee318fbe272414)

</details>

### IntelLabs/Xe-Forge

<details class="news-minor">
<summary>1 项小改动</summary>

- Xe-Forge 固定 intel extra 到 torch 2.15.0+xpu：Xe-Forge 固定 torch XPU 版本。 [commit 8ff691e](https://github.com/IntelLabs/X-Forge/commit/8ff691e9692152f520e8cce2cb96aae65105e35b)

</details>

### torch-xpu-ops

<details class="news-minor">
<summary>1 项小改动</summary>

- torch-xpu-ops 池化形状检查改用 c10::safe_conv：池化形状检查同步上游实现。 [PR #6404](https://github.com/intel/torch-xpu-ops/pull/6404)

</details>

## 驱动、内核与图形栈

### Windows 驱动

- **驱动更新确认 Raptor Lake-S NEXT 与 Bartlett Lake-S**：Intel 新驱动更新中提及 Raptor Lake-S NEXT 和 Bartlett Lake-S，证实了此前关于下一代桌面 CPU 双产品线策略的传闻。Raptor Lake-S NEXT 定位在 Core Ultra 4000 Nova Lake-S 之下。 [TechPowerUp](https://www.techpowerup.com/355276/intel-names-raptor-lake-s-next-alongside-bartlett-lake-s-in-new-driver-update)

  > **影响：** 关注 Intel 桌面 CPU 路线图的用户和厂商可据此调整预期。

### IGC 图形编译器

<details class="news-minor">
<summary>1 项小改动</summary>

- IGC 新增 regkey 将不兼容指针类型设为错误：IGC 提供 regkey 启用严格指针类型检查。 [v2.44.1](https://github.com/intel/intel-graphics-compiler/releases/tag/v2.44.1)

</details>

### Linux 图形栈

- **Intel Vulkan 驱动默认启用 e64 高效 64 位模式**：Nova Lake P 的 Xe3P 核显引入 e64 高效 64 位寻址模式，提供原生 64 位着色器内存寻址。Vulkan Linux 驱动现已默认启用。 [Phoronix](https://www.phoronix.com/news/Intel-Efficient-64-bit-e64-ANV)

  > **影响：** 使用 Nova Lake P 集显的 Vulkan 应用可自动获得 64 位寻址能力。

### compute-runtime

<details class="news-minor">
<summary>1 项小改动</summary>

- compute-runtime 修复 SVM 管理器导入分配泄漏：修复 SVM 管理器导入分配泄漏。 [26.44.40734.11](https://github.com/intel/compute-runtime/releases/tag/26.44.40734.11)

</details>
