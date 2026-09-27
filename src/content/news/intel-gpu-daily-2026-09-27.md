---
title: "Intel GPU 技术生态日报 (2026-09-27)"
description: "今日 Intel GPU 动态速览：包含驱动内核演进、算子与推理引擎适配进展。"
pubDate: "2026-09-27T08:30:00.000Z"
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

- **`[Released]`** **oneDNN v3.13.3 发布**：oneDNN 发布 v3.13.3 补丁版本，包含多项修复与优化。
- **`[Issue]`** **No Man's Sky 在 Intel GPU 上世界加载时图形挂起**：用户报告 No Man's Sky v7.04 在 Intel 驱动下世界加载时图形挂起，待官方确认。

## 下游优化与加速库 (intel/llm-scaler / Triton / OpenVINO)

- **[oneDNN] oneDNN v3.13.3 发布**：oneDNN 发布 v3.13.3 补丁版本，包含多项修复与优化，具体改动未在摘要中列出，但作为官方发布，通常包含 bug 修复和性能改进。 [[oneDNN v3.13.3](https://github.com/uxlfoundation/oneDNN/releases/tag/v3.13.3)]
  > **影响：** 为使用 oneDNN 的开发者提供稳定性和性能提升，建议升级。

## 驱动、内核与图形栈 (Windows 驱动 / Linux drm/xe / Mesa ANV)

- **[Intel GPU 驱动] No Man's Sky 在 Intel GPU 上世界加载时图形挂起**：用户报告 No Man's Sky v7.04 在 Intel 驱动下世界加载时图形挂起，但官方尚未确认根因，报告者推测可能与驱动或游戏兼容性有关。 [[IGCIT Issue #1565](https://github.com/IGCIT/Intel-GPU-Community-Issue-Tracker-IGCIT/issues/1565)]
  > **影响：** 影响 Intel GPU 用户运行该游戏，需等待官方调查和修复。