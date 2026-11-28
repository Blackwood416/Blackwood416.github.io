---
title: "Intel GPU 技术生态日报 (2026-11-28)"
description: "Intel Triton 后端修复 DPAS 加载与 bf16 转换，提升正确性"
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

- <span class="news-badge news-badge--merged">Merged</span> **Intel Triton 后端修复 DPAS 加载与 bf16 转换，提升正确性** [详情 →](#triton-xpu-后端)

## 主流框架与上游集成

### HuggingFace Transformers

<details class="news-minor">
<summary>2 项小改动</summary>

- Transformers 更新 4 个模型的 XPU 测试预期：更新 4 个模型 XPU 测试预期。 [PR #51363](https://github.com/huggingface/transformers/pull/51363)
- Transformers 修复 CB 在 XPU 上的数值问题：修复 CB 在 XPU 上的数值问题。 [PR #51168](https://github.com/huggingface/transformers/pull/51168)

</details>

## 编译器与加速库

### Triton XPU 后端

- **Triton 后端将 bf16 转 f32 降为 fpext**：当使用原生 bf16 算术（非 LTS 驱动且支持 SPV_KHR_bfloat16）且 IGC 版本不低于 2.43 时，将 bf16 到 f32 的转换从 __spirv_ConvertBF16ToFINTEL 调用改为简单的 llvm.fpext，简化代码生成。 [commit a71d4f2](https://github.com/intel/intel-xpu-backend-for-triton/commit/a71d4f2707d9af03894bd382abc409966b9127e9)

  > **影响：** 使用 Triton 且依赖 bf16 算术的用户可获得更高效的代码。

- **修复 DPAS 累加器加载时 tile 形状错误**：修复 #8895：当 DPAS 累加器（操作数 C）中的张量被钳制后，getBlockIOTileSize 可能选择不合适的 tile 形状，导致 2D 块读取失败。现在仅在钳制后的 tile 能容纳时使用 DPAS C 消息形状。 [commit 321b03e](https://github.com/intel/intel-xpu-backend-for-triton/commit/321b03e89532d8913638d062c44bbfa870120fc1)

  > **影响：** 修复 DPAS 累加器加载错误，影响使用 DPAS 的 Triton 内核。

- **BLOCKIO 增加与顺序无关的 tile 大小计算**：修复 #7806：getBlockIOTileSize 按寄存器基址列表顺序增长 tile，导致仅当基址按递增步长排列时才能构建完整 tile。新实现与顺序无关，确保正确计算。 [commit ad63fa3](https://github.com/intel/intel-xpu-backend-for-triton/commit/ad63fa3df4289336cab7fd22dd19ce0f05bd3c9e)

  > **影响：** 修复 BLOCKIO 相关加载问题，影响使用 2D 块 I/O 的 Triton 内核。

<details class="news-minor">
<summary>其他 1 项小改动</summary>

- Triton 后端取消跳过 sanitize overflow 测试：取消跳过 sanitize overflow 测试。 [commit 25f6009](https://github.com/intel/intel-xpu-backend-for-triton/commit/25f6009a7c3a6257ef97223311ee318fbe272414)

</details>

### torch-xpu-ops

<details class="news-minor">
<summary>1 项小改动</summary>

- torch-xpu-ops 池化形状检查改用 c10::safe_conv：池化形状检查与上游对齐。 [PR #6404](https://github.com/intel/torch-xpu-ops/pull/6404)

</details>

## 驱动、内核与图形栈

### Windows 驱动

- **Intel 驱动更新确认 Raptor Lake-S NEXT 与 Bartlett Lake-S**：Intel 在最新驱动更新中确认了下一代桌面 CPU 产品线：Raptor Lake-S NEXT 将位于 Core Ultra 4000 Nova Lake-S 之下，与 Bartlett Lake-S 并列。这证实了此前关于 Intel 双产品线策略的传闻。 [TechPowerUp](https://www.techpowerup.com/355276/intel-names-raptor-lake-s-next-alongside-bartlett-lake-s-in-new-driver-update)

  > **影响：** 关注 Intel 桌面 CPU 路线图的用户和厂商需调整预期。

### IGC 图形编译器

<details class="news-minor">
<summary>1 项小改动</summary>

- IGC 新增注册表项将不兼容指针类型设为错误：IGC 提供注册表项启用不兼容指针类型错误。 [v2.44.1](https://github.com/intel/intel-graphics-compiler/releases/tag/v2.44.1)

</details>

### Linux 图形栈

- **Intel Vulkan 驱动默认启用 e64 高效 64 位模式**：Intel 的 Vulkan Linux 驱动为即将推出的 Nova Lake P 处理器（Xe3P 集成显卡）默认启用 e64 高效 64 位寻址模式，提供原生 64 位着色器内存寻址能力。 [Phoronix](https://www.phoronix.com/news/Intel-Efficient-64-bit-e64-ANV)

  > **影响：** 使用 Nova Lake P 集成显卡的 Linux 用户将自动获得 64 位寻址支持。

### compute-runtime

<details class="news-minor">
<summary>1 项小改动</summary>

- compute-runtime 修复 SVM 管理器导入分配泄漏：修复 SVM 管理器导入分配泄漏。 [26.44.40734.11](https://github.com/intel/compute-runtime/releases/tag/26.44.40734.11)

</details>
