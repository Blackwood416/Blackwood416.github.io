---
title: "Intel GPU 技术生态日报 (2026-11-01)"
description: "Arc B580 在 Win11 26H2 双屏混刷新率下直播冻结，疑与 MPO 相关"
pubDate: "2026-11-01T08:30:00.000Z"
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

- <span class="news-badge news-badge--issue">Issue</span> **Arc B580 在 Win11 26H2 双屏混刷新率下直播冻结，疑与 MPO 相关** [详情 →](#igcit-问题追踪)

## 编译器与加速库

### Triton XPU 后端

<details class="news-minor">
<summary>1 项小改动</summary>

- Triton 基准测试添加 pid 非负假设：基准测试添加 pid 非负假设 [commit 46c4413](https://github.com/intel/intel-xpu-backend-for-triton/commit/46c44133db973559a7003a54afcf0c940879941b)

</details>

## 驱动、内核与图形栈

### IGC 图形编译器

<details class="news-minor">
<summary>1 项小改动</summary>

- Intel Graphics Compiler 发布 v2.43.2：IGC 发布 v2.43.2 [v2.43.2](https://github.com/intel/intel-graphics-compiler/releases/tag/v2.43.2)

</details>

## 社区反馈

### IGCIT 问题追踪

- **Arc B580 双屏直播冻结问题报告**：报告者称在 Win11 26H2 下，Arc B580 双显示器混刷新率时，Edge 中同时播放 YouTube Live 和 Kick Live 会冻结，怀疑与 MPO 或 WDDM 3.2 相关。该问题为社区新提交，尚未经维护者确认。 [#1600](https://github.com/IGCIT/Intel-GPU-Community-Issue-Tracker-IGCIT/issues/1600)

  > **影响：** 使用 Arc B580 且双屏混刷新率的用户可能遇到直播冻结，需关注后续驱动更新。

  > 🔗 **续报（关联 2026-09-19 日报）：** 事件跟踪【Arc B580 锁屏唤醒与冷启动冻结问题】新进展（此前阶段：社区多位用户报告 B580 冷启动失败与 4K 60Hz 限制，IGCIT #1560 持续跟进）。
