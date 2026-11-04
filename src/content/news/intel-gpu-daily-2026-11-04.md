---
title: "Intel GPU 技术生态日报 (2026-11-04)"
description: "vLLM XPU 修复 P2P 生命周期与前缀测试的独立根因；Triton XPU 回滚 fp8 FMA 拓宽，规避 LTS 驱动失败"
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

- <span class="news-badge news-badge--merged">Merged</span> **vLLM XPU 修复 P2P 生命周期与前缀测试的独立根因** [详情 →](#vllm-xpu)
- <span class="news-badge news-badge--merged">Merged</span> **Triton XPU 回滚 fp8 FMA 拓宽，规避 LTS 驱动失败** [详情 →](#triton-xpu-后端)

## 主流框架与上游集成

### vLLM XPU

<details class="news-minor">
<summary>2 项小改动</summary>

- 修复 P2P 生命周期与前缀测试失败：对齐块大小并填充前缀，修复 CI 失败 [PR #65416](https://github.com/vllm-project/vllm/pull/65416)
- 更新 triton-xpu 3.9.0 shim 层：同步 triton-xpu shim 层 [PR #65047](https://github.com/vllm-project/vllm/pull/65047)

</details>

## 编译器与加速库

### Triton XPU 后端

- **回滚 fp8 FMA 拓宽，规避 LTS 驱动失败**：之前的提交 #8537 在 FMA 路径上拓宽 fp8 操作数，但在 LTS 驱动上失败，因此回滚。这是对驱动兼容性问题的规避，而非根本修复。 [commit b9fd78e](https://github.com/intel/intel-xpu-backend-for-triton/commit/b9fd78e172bbea4818f285b58e4912993ee965d7)

  > **影响：** 使用 LTS 驱动的用户不再遇到编译失败。

- **重新合入 BlockIO 非对齐 d64 拒绝**：重新合入 #8586，该提交拒绝非 8 字节对齐列的 d64 2D 块消息。之前因 #8520 合入后未跑 CI 而被回滚，现在重新合入。 [commit 6a31bae](https://github.com/intel/intel-xpu-backend-for-triton/commit/6a31baec2ce8538524d529094b5ba8ca5c994fab)

  > **影响：** BlockIO 相关功能恢复限制，避免非对齐访问。

- **fp8 Q 预缩放仅限 BLOCK_M>=64**：在统一注意力中，仅当 BLOCK_M >= 64 时对 fp8 Q 进行预缩放。这是对 #8526 停止预缩放的后续调整，以配合 FP 融合。 [commit 71f273d](https://github.com/intel/intel-xpu-backend-for-triton/commit/71f273d0491f051c4d23c6c70ebedd18a2e85761)

  > **影响：** 影响使用统一注意力的 vLLM 用户，BLOCK_M 小于 64 时行为不同。

- **提升单位维度重塑到描述符加载**：将丢弃单位维度的重塑操作提升到元素级操作和置换之前，以便在描述符加载时处理。这是 #8511 注意力内核优化的一部分。 [commit 35038fa](https://github.com/intel/intel-xpu-backend-for-triton/commit/35038fa8f95e3e76cfa5a67a2d817e6144049aec)

  > **影响：** 优化注意力内核性能，减少不必要的重塑。

- **f32 tl.fma 降级为可合约 fmul/fadd**：为规避 IGC 寄存器分配问题，将 f32 tl.fma 降级为标记 contract 的 fmul/fadd 对。移除该规避的跟踪在 #8626。 [commit 5d5eaa0](https://github.com/intel/intel-xpu-backend-for-triton/commit/5d5eaa0f58c3e6c0dd24782bc921dd433acc28c3)

  > **影响：** 使用 IGC 编译的用户可能获得更好的寄存器分配。

- **限制 bf16 out_dtype 仅用于 bf16 和 fp8 dot**：bf16 累加器是 Intel 特有功能，前端在其他后端拒绝 out_dtype=tl.bfloat16。本提交限制该 out_dtype 仅用于 bf16 和 fp8 dot 操作数。 [commit 05cb9fe](https://github.com/intel/intel-xpu-backend-for-triton/commit/05cb9fe2a0db2524540f859aa9383509aeedcc16)

  > **影响：** 限制 bf16 out_dtype 使用范围，避免不支持的组合。

<details class="news-minor">
<summary>其他 3 项小改动</summary>

- CRI 上不断言负列 2D-vs-scatter 选择：移除负列断言，测试调整 [commit 64233de](https://github.com/intel/intel-xpu-backend-for-triton/commit/64233defa041f78f6c1d99585a85d7eda732c440)
- CI 设置 MAX_JOBS 为 CPU 数：CI 构建时间优化 [commit cfe80e9](https://github.com/intel/intel-xpu-backend-for-triton/commit/cfe80e97a0ea03fd70286d93e0f728f1397e2969)
- fp8 FMA dot 操作数拓宽（原提交）：原始 fp8 拓宽实现 [commit 6ae00b7](https://github.com/intel/intel-xpu-backend-for-triton/commit/6ae00b777d667af66b0b9f7589ec921001072754)

</details>

## 驱动、内核与图形栈

### compute-runtime

- **compute-runtime 发布 26.40.40196.8**：Intel compute-runtime 发布新版本 26.40.40196.8，无摘要，可能包含驱动更新。 [26.40.40196.8](https://github.com/intel/compute-runtime/releases/tag/26.40.40196.8)

  > **影响：** 使用该驱动的用户可升级获取潜在修复。

## 社区反馈

### IGCIT 问题追踪

<details class="news-minor">
<summary>1 项小改动</summary>

- Life is Strange 重制版崩溃报告：游戏崩溃问题报告 [#1603](https://github.com/IGCIT/Intel-GPU-Community-Issue-Tracker-IGCIT/issues/1603)

</details>
