---
title: "Intel GPU 技术生态日报 (2026-11-03)"
description: "BlockIO 非 8 字节对齐 d64 拒绝被回滚，因主分支失败；vLLM 量化测试 num_groups=0 重新启用"
pubDate: "2026-11-03T08:30:00.000Z"
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

- <span class="news-badge news-badge--merged">Merged</span> **BlockIO 非 8 字节对齐 d64 拒绝被回滚，因主分支失败** [详情 →](#triton-xpu-后端)
- <span class="news-badge news-badge--merged">Merged</span> **vLLM 量化测试 num_groups=0 重新启用** [详情 →](#triton-xpu-后端)

## 主流框架与上游集成

### vLLM XPU

<details class="news-minor">
<summary>1 项小改动</summary>

- XPU 跳过注意力融合 splitting_ops 检查：跳过 XPU 注意力融合检查 [PR #62623](https://github.com/vllm-project/vllm/pull/62623)

</details>

### SGLang XPU

- **修复 XPU logger 和 Inkling mock dtype**：修复 #47173 后，EAGLEDraftExtendCudaGraphRunner 读取 backend.cache_loc_dtype，但 Inkling 回放 fixture 返回 Mock 导致分配失败。恢复 XPU logger 并修复 mock dtype。 [PR #47858](https://github.com/sgl-project/sglang/pull/47858)

  > **影响：** 使用 Inkling 回放的 XPU 用户

- **Gemma4 双向图像注意力修复**：在 intel_xpu 后端，Gemma4 图像 token 使用因果注意力而非双向注意力。修复 prepare_attn_masks 以支持 XPU 后端。 [PR #46816](https://github.com/sgl-project/sglang/pull/46816)

  > **影响：** 使用 Gemma4 的 XPU 用户

## 编译器与加速库

### Triton XPU 后端

- **回滚 BlockIO 非对齐 d64 拒绝逻辑**：原提交 #8586 拒绝非 8 字节对齐列的 d64 2D block 消息，但该改动在主分支 CI 失败，因此被回滚。回滚后恢复原有行为，问题根因未解决。 [commit eff4450](https://github.com/intel/intel-xpu-backend-for-triton/commit/eff445037a51e407b376df3b53b8cb556847e314) · [commit a933977](https://github.com/intel/intel-xpu-backend-for-triton/commit/a9339770f38e225926b38e14bf6705e24f26fd08)

  > **影响：** 使用非 8 字节对齐 d64 2D block 的 XPU 用户可能仍会遇到潜在错误，需等待后续修复。

<details class="news-minor">
<summary>其他 4 项小改动</summary>

- SPV 探测结果添加 stdout 前缀：SPV 探测输出加前缀 [commit 6871493](https://github.com/intel/intel-xpu-backend-for-triton/commit/687149300b814fed61b7e28e106f519af9996d02)
- 重新启用 vLLM num_groups=0 量化测试：重新启用 num_groups=0 测试 [commit 6cdb633](https://github.com/intel/intel-xpu-backend-for-triton/commit/6cdb633405785a7ea7a5feb1b5c56e229fb3b2d0)
- SGLang 固定版本更新：SGLang 版本更新 [commit 9b8241b](https://github.com/intel/intel-xpu-backend-for-triton/commit/9b8241b0a4c6c4d16770ac3dd2dcc05e5695b6c9)
- vLLM 固定版本更新：vLLM 版本更新 [commit 3331d8c](https://github.com/intel/intel-xpu-backend-for-triton/commit/3331d8cdda850366984d573664df3c82da62feec)

</details>

## 驱动、内核与图形栈

### Windows 驱动

<details class="news-minor">
<summary>1 项小改动</summary>

- Larrabee 原型驱动恢复 3D 加速：Larrabee 驱动恢复 [TechPowerUp](https://www.techpowerup.com/354399/intel-larrabee-gpu-system-surfaces-with-working-drivers)

</details>

## 社区反馈

### IGCIT 问题追踪

- **Arc B580 守望先锋 DX11 卡顿问题**：报告者称 Arc B580 在守望先锋 DX11 下持续着色器编译，100-349ms 卡顿和低 FPS。属于问题报告，根因未确认。 [#1601](https://github.com/IGCIT/Intel-GPU-Community-Issue-Tracker-IGCIT/issues/1601)
