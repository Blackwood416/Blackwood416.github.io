---
title: "Intel GPU 技术生态日报 (2026-11-04)"
description: "fp8 FMA 拓宽改动因 LTS 驱动失败被回滚；BlockIO d64 非对齐限制重新合入，修复 CI 顺序问题"
pubDate: "2026-11-04T08:30:00.000Z"
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

- <span class="news-badge news-badge--merged">Merged</span> **fp8 FMA 拓宽改动因 LTS 驱动失败被回滚** [详情 →](#triton-xpu-后端)
- <span class="news-badge news-badge--merged">Merged</span> **BlockIO d64 非对齐限制重新合入，修复 CI 顺序问题** [详情 →](#triton-xpu-后端)

## 主流框架与上游集成

### vLLM XPU

<details class="news-minor">
<summary>1 项小改动</summary>

- vLLM 更新 triton-xpu 3.9.0 shim：更新 triton-xpu shim 层。 [PR #65047](https://github.com/vllm-project/vllm/pull/65047)

</details>

## 编译器与加速库

### Triton XPU 后端

- **回滚 fp8 FMA 拓宽改动**：该提交回滚了 #8537，因为该改动在 LTS 驱动上测试失败。回滚是为了恢复稳定性，但根因未解决。 [commit b9fd78e](https://github.com/intel/intel-xpu-backend-for-triton/commit/b9fd78e172bbea4818f285b58e4912993ee965d7)

  > **影响：** 依赖 fp8 FMA 拓宽的用户需等待后续修复。

- **重新合入 BlockIO d64 非对齐限制**：重新合入 #8586，该改动之前因 CI 顺序问题被回滚。现在 #8520 已合入，重新提交以恢复限制。 [commit 6a31bae](https://github.com/intel/intel-xpu-backend-for-triton/commit/6a31baec2ce8538524d529094b5ba8ca5c994fab)

  > **影响：** BlockIO 相关用户需注意非对齐列的限制。

- **提升 unit-dim 重塑到描述符加载**：该改动将 unit-dim 丢弃的重塑提升到元素级操作和置换之前，以优化 #8511 注意力内核中的描述符加载。 [commit 35038fa](https://github.com/intel/intel-xpu-backend-for-triton/commit/35038fa8f95e3e76cfa5a67a2d817e6144049aec)

  > **影响：** 注意力内核性能可能提升。

- **f32 tl.fma 降级为可收缩 fmul/fadd**：为规避 IGC 对 llvm.fma 的寄存器分配问题，将 f32 tl.fma 降级为标记 contract 的 fmul/fadd 对。移除跟踪在 #8626。 [commit 5d5eaa0](https://github.com/intel/intel-xpu-backend-for-triton/commit/5d5eaa0f58c3e6c0dd24782bc921dd433acc28c3)

  > **影响：** 使用 f32 tl.fma 的用户可能看到寄存器分配改善。

- **fp8 FMA dot 操作数拓宽**：该改动在布局转换前拓宽 fp8 操作数，但被回滚（见 s1）。此处为原始提交，因 LTS 驱动失败。 [commit 6ae00b7](https://github.com/intel/intel-xpu-backend-for-triton/commit/6ae00b777d667af66b0b9f7589ec921001072754)

- **限制 bf16 out_dtype 到 bf16 和 fp8 点积**：该改动限制 bf16 out_dtype 仅用于 bf16 和 fp8 点积操作数，因为 bf16 累加器是 Intel 特有功能。 [commit 05cb9fe](https://github.com/intel/intel-xpu-backend-for-triton/commit/05cb9fe2a0db2524540f859aa9383509aeedcc16)

  > **影响：** 使用 bf16 out_dtype 的用户需确认操作数类型。

<details class="news-minor">
<summary>其他 2 项小改动</summary>

- CRI 负数列断言放宽：放宽 CRI 负数列断言。 [commit 64233de](https://github.com/intel/intel-xpu-backend-for-triton/commit/64233defa041f78f6c1d99585a85d7eda732c440)
- CI 构建并行度设为 CPU 数：CI 构建并行度优化。 [commit cfe80e9](https://github.com/intel/intel-xpu-backend-for-triton/commit/cfe80e97a0ea03fd70286d93e0f728f1397e2969)

</details>

## 驱动、内核与图形栈

### compute-runtime

<details class="news-minor">
<summary>1 项小改动</summary>

- compute-runtime 26.40.40196.8 发布：compute-runtime 新版本发布。 [26.40.40196.8](https://github.com/intel/compute-runtime/releases/tag/26.40.40196.8)

</details>

## 社区反馈

### IGCIT 问题追踪

<details class="news-minor">
<summary>1 项小改动</summary>

- Life is Strange 重制版崩溃报告：游戏崩溃问题报告。 [#1603](https://github.com/IGCIT/Intel-GPU-Community-Issue-Tracker-IGCIT/issues/1603)

</details>
