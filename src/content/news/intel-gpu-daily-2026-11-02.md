---
title: "Intel GPU 技术生态日报 (2026-11-02)"
description: "SGLang 为 XPU 增加完整 prefill 图捕获与回放支持"
pubDate: "2026-11-02T08:30:00.000Z"
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

- <span class="news-badge news-badge--merged">Merged</span> **SGLang 为 XPU 增加完整 prefill 图捕获与回放支持** [详情 →](#sglang-xpu)

## 主流框架与上游集成

### SGLang XPU

- **XPU 完整 prefill 图支持合入**：该改动为 SGLang 的 XPU 后端添加了完整 prefill 图路径，使 prefill 的捕获与回放能够复用与 decode 相同的全图后端契约。这统一了 prefill 和 decode 的图执行方式，可能提升 prefill 阶段的执行效率。 [PR #30980](https://github.com/sgl-project/sglang/pull/30980)

  > **影响：** 使用 SGLang 在 Intel GPU 上运行推理的用户，prefill 阶段可能获得性能提升；开发者可参考该实现扩展其他图后端。
