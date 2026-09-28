---
title: "Intel GPU 技术生态日报 (2026-09-28)"
description: "今日 Intel GPU 动态速览：包含驱动内核演进、算子与推理引擎适配进展。"
pubDate: "2026-09-28T08:30:00.000Z"
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

- **`[Workaround]`** **SGLang 在 XPU 上禁用 NGRAM 语料测试并动态检测 XPU 测试**：SGLang 为修复 XPU CI 失败，禁用 test_ngram_corpus 并动态过滤 XPU 测试。

## 下游优化与加速库 (intel/llm-scaler / Triton / OpenVINO)

- **[SGLang XPU] [XPU] Disable test_ngram_corpus on XPU and detect XPU tests dynamically in CI filter**：该 PR 针对 SGLang 在 XPU 上 CI 持续失败的问题，将 test_ngram_corpus 测试在 XPU 上禁用，并修改 CI 过滤器以动态识别 XPU 测试。由于 NGRAM 推测解码在 XPU 上的实现可能不完整或存在兼容性问题，维护者选择暂时跳过该测试以避免 CI 阻塞，但未确认根本原因。 [[PR #41075](https://github.com/sgl-project/sglang/pull/41075)]
  > **影响：** 该改动为临时规避方案，使 XPU CI 不再因 NGRAM 测试失败而中断，但 NGRAM 功能在 XPU 上的实际可用性仍待验证。开发者需注意该测试在 XPU 上被跳过，可能掩盖潜在功能缺陷。