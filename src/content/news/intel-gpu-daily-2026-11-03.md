---
title: "Intel GPU 技术生态日报 (2026-11-03)"
description: "BlockIO 非对齐 d64 限制被回滚，主分支 CI 恢复；vLLM 量化测试取消跳过，num_groups=0 场景恢复验证"
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

- <span class="news-badge news-badge--merged">Merged</span> **BlockIO 非对齐 d64 限制被回滚，主分支 CI 恢复** [详情 →](#triton-xpu-后端)
- <span class="news-badge news-badge--merged">Merged</span> **vLLM 量化测试取消跳过，num_groups=0 场景恢复验证** [详情 →](#triton-xpu-后端)

## 主流框架与上游集成

### vLLM XPU

<details class="news-minor">
<summary>5 项小改动</summary>

- vLLM 量化测试增加内存并跳过超时用例：量化测试内存增加，超时用例跳过 [PR #65097](https://github.com/vllm-project/vllm/pull/65097)
- 测试改用当前平台设备类型：测试平台适配，XPU 纳入 CI [PR #63641](https://github.com/vllm-project/vllm/pull/63641)
- Intel CI 新增 EPD 测试：Intel CI 增加 EPD 测试 [PR #64651](https://github.com/vllm-project/vllm/pull/64651)
- XPU 跳过注意力融合 splitting_ops 检查：XPU 跳过注意力融合检查 [PR #62623](https://github.com/vllm-project/vllm/pull/62623)
- Intel CI 扩展批不变性测试：Intel CI 增加批不变性测试 [PR #64396](https://github.com/vllm-project/vllm/pull/64396)

</details>

### SGLang XPU

- **修复 XPU logger 和 Inkling mock dtype**：修复 EAGLEDraftExtendCudaGraphRunner 中 cache_loc_dtype 读取问题，Inkling 检查点回放 fixture 返回 Mock 导致真实缓冲区分配失败，现恢复正确 dtype。 [PR #47858](https://github.com/sgl-project/sglang/pull/47858)

  > **影响：** SGLang XPU 用户使用 Inkling 检查点回放时不再出现分配错误。

- **Gemma4 图像注意力在 XPU 后端修复**：Gemma4 在 intel_xpu 后端上图像 token 使用因果注意力而非双向注意力，现修复 prepare_attn_masks 以支持 XPU 后端。 [PR #46816](https://github.com/sgl-project/sglang/pull/46816)

  > **影响：** SGLang XPU 用户使用 Gemma4 模型时图像注意力行为正确。

## 编译器与加速库

### Triton XPU 后端

- **回滚 BlockIO 非 8 字节对齐 d64 限制**：原提交 #8586 拒绝非 8 字节对齐列的 d64 2D block 消息，但导致主分支 CI 失败，因此回滚该提交以恢复构建稳定性。 [commit eff4450](https://github.com/intel/intel-xpu-backend-for-triton/commit/eff445037a51e407b376df3b53b8cb556847e314) · [commit a933977](https://github.com/intel/intel-xpu-backend-for-triton/commit/a9339770f38e225926b38e14bf6705e24f26fd08)

  > **影响：** 使用非对齐 d64 2D block 消息的 XPU 用户暂时不受限制，但潜在正确性问题未解决。

<details class="news-minor">
<summary>其他 4 项小改动</summary>

- SPV 探测结果添加 stdout 前缀标记：SPV 探测输出加前缀便于解析 [commit 6871493](https://github.com/intel/intel-xpu-backend-for-triton/commit/687149300b814fed61b7e28e106f519af9996d02)
- 取消跳过 num_groups=0 量化测试：恢复 num_groups=0 量化测试 [commit 6cdb633](https://github.com/intel/intel-xpu-backend-for-triton/commit/6cdb633405785a7ea7a5feb1b5c56e229fb3b2d0)
- SGLang 固定版本更新至 d19f19d：SGLang 固定版本更新 [commit 9b8241b](https://github.com/intel/intel-xpu-backend-for-triton/commit/9b8241b0a4c6c4d16770ac3dd2dcc05e5695b6c9)
- vLLM 固定版本更新并引入新内核包：vLLM 固定版本更新，内核包升级 [commit 3331d8c](https://github.com/intel/intel-xpu-backend-for-triton/commit/3331d8cdda850366984d573664df3c82da62feec)

</details>

## 驱动、内核与图形栈

### Windows 驱动

<details class="news-minor">
<summary>1 项小改动</summary>

- Larrabee 原型恢复 3D 加速：Larrabee 原型驱动恢复 [TechPowerUp](https://www.techpowerup.com/354399/intel-larrabee-gpu-system-surfaces-with-working-drivers)

</details>

## 社区反馈

### IGCIT 问题追踪

- **Arc B580 在 Overwatch DX11 下持续着色器编译卡顿**：报告者称 Arc B580 在 Overwatch DX11 下出现持续着色器编译，导致 100-349ms 卡顿和低 FPS，已使用最新驱动。 [#1601](https://github.com/IGCIT/Intel-GPU-Community-Issue-Tracker-IGCIT/issues/1601)

  > **影响：** Arc B580 用户玩 Overwatch DX11 时可能遇到卡顿，需关注驱动更新。
