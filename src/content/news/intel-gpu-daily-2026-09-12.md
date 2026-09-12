---
title: "Intel GPU 技术生态日报 (2026-09-12)"
description: "今日 Intel GPU 动态速览：包含驱动内核演进、算子与推理引擎适配进展。"
pubDate: "2026-09-12T08:30:00.000Z"
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

- **Triton XPU 后端清理 advanced path 遗留代码**：移除 `WarpEncodingAttr` 等仅被已删除路径使用的机制，同时修复 reshape 布局传播中的编码错误传递问题。
- **SGLang 与 vLLM 继续推进 XPU 适配**：SGLang 改用发布版 wheel 安装 xpu-kernel，vLLM 为 XPU CI 补充 decord 依赖并启用 int8 量化测试。
- **Intel 发布 Arc 驱动 101.8993 Beta**：为《Wardogs》提供首发支持，但未修复已知游戏问题；社区报告 TB5 Dock 下 10bit SDR/HDR 异常。

## 下游优化与加速库 (intel/llm-scaler / Triton / OpenVINO)

- **[llm-scaler/Omni] ComfyUI 升级至 v0.35.0**：同步更新 XPU providers，新增原生量化 Sol 与 bounded H3 producer，并适配相关回归测试。[[commit a53bb29](https://github.com/intel/llm-scaler/commit/a53bb2995243cc7fab6eedd9af344a47c240ba3d)]
- **[llm-scaler/SGL] 新增 GGUF 原生量化内核**：为 SGLang 服务启用 IQ4/Q3/IQ3 GGUF 融合，跳过 GGUF server 预热，并修复 GDN 状态更新逻辑。[[commit 3d2232e](https://github.com/intel/llm-scaler/commit/3d2232ea5de2fd7ec16a7b22a99f769f6cbb9678)]
- **[Triton XPU] 移除 advanced path 遗留代码**：`WarpEncodingAttr` 等机制在 #5205 移除 advanced path 后已无生产/消费方，本次清理相关 MLIR 定义与传递逻辑。[[PR #8021](https://github.com/intel/intel-xpu-backend-for-triton/commit/3a7d4a01bfecfa09d7d7eed7eb5aef0ca7208505)]
- **[Triton XPU] 修复 reshape 布局传播编码错误**：`LayoutPropagation::propagateToUsers` 此前将编码错误传播至 `tt.reshape` 的 efficient_layout 路径，现阻止该行为，关闭 issue #7915。[[PR #7917](https://github.com/intel/intel-xpu-backend-for-triton/commit/1c06b280b559cc4fc1c8c75c73633180c5ad590c)]
- **[Triton XPU] CI 停止自动运行 max1550 基准**：因 max1550 runner 资源稀缺，删除 PVC 工作流中的自动全量基准，改为仅手动触发。[[PR #8016](https://github.com/intel/intel-xpu-backend-for-triton/commit/240770912bf64ab4ffbe491b2c951d6f4cdcbe53)]

## 主流框架与上游集成 (PyTorch / vLLM / SGLang / llama.cpp / Ollama)

- **[vLLM] XPU CI 补充 decord 依赖**：因 #55921 注册 inclusionAI/Ling-3.0-flash-VL 模型后，registry 参数化测试自动加载该模型，需新增 decord==0.6.0 依赖。[[PR #56355](https://github.com/vllm-project/vllm/pull/56355)]
- **[vLLM] 启用 XPU 上的 int8 量化测试**：`test_per_token_group_quant_int8` 原先硬编码 CUDA 设备，现改为使用 Triton fallback 路径，使 XPU 可运行该测试。[[PR #55681](https://github.com/vllm-project/vllm/pull/55681)]
- **[SGLang] xpu-kernel 改用发布版 wheel 安装**：替换源码构建方式，简化 XPU 环境部署流程。[[PR #37394](https://github.com/sgl-project/sglang/pull/37394)]
- **[SGLang] 适配设备无关 API**：调整代码以支持跨设备运行单元测试，无需修改测试代码即可在 XPU 等平台执行。[[PR #32093](https://github.com/sgl-project/sglang/pull/32093)]

## 驱动、内核与图形栈 (Windows 驱动 / Linux drm/xe / Mesa ANV)

- **[Windows 驱动] Arc 驱动 101.8993 Beta 发布**：为《Wardogs》提供 game-ready 支持，但未修复任何已知游戏问题。[[TechPowerUp 报道](https://www.techpowerup.com/352588/intel-arc-gpu-graphics-drivers-101-8993-beta-released)]
- **[Linux 内核] Cache Aware Scheduling 修复补丁发布**：该调度增强自 Linux 7.2 合入后持续收到修复，新补丁针对不同处理器与系统配置的测试反馈。[[Phoronix 报道](https://www.phoronix.com/news/Cache-Aware-Scheduling-4-Patch)]
- **[Linux 工具] Intel Thermald 2.5.13 恢复 Wildcat Lake 支持**：修复此前误删的 Wildcat Lake 平台支持，该版本同时扩展了对 Qualcomm/ARM 硬件的初步支持。[[Phoronix 报道](https://www.phoronix.com/news/Intel-Thermald-2.5.13)]
- **[IGCIT] TB5 Dock 下 10bit SDR/HDR 异常**：Core Ultra 7 258V + Arc 140V 用户报告通过 Thunderbolt 5 Dock 连接时 10bit 输出失效，驱动版本为最新。[[Issue #1479](https://github.com/IGCIT/Intel-GPU-Community-Issue-Tracker-IGCIT/issues/1479)]
- **[IGCIT] FFXIV 随机图形花屏**：Arc 用户报告《最终幻想 XIV》出现随机图形故障，已确认使用最新驱动且游戏未修改。[[Issue #1440](https://github.com/IGCIT/Intel-GPU-Community-Issue-Tracker-IGCIT/issues/1440)]

## 社区实测与生态动态

- **[社区实测] 双 Arc Pro B70 运行 Qwen 3.8 27B FP8**：用户分享 2x Arc Pro B70 推理 Qwen 3.8 27B FP8 的配置与性能表现。[[Reddit 讨论](https://www.reddit.com/r/IntelArc/comments/1wdjfae/2x_intel_arc_pro_b70_running_qwen_38_27b_fp8/)]
- **[社区实测] Arc Pro B65 解码速度超 70 tok/s**：用户报告单卡 Arc Pro B65 在 LLM 推理中达到 70+ tok/s 解码速度。[[Reddit 讨论](https://www.reddit.com/r/IntelArc/comments/1wdm0gd/intel_arc_pro_b65_getting_70_toks_decode/)]
- **[社区讨论] A770 上加速 Qwen3.8 27B**：用户询问如何在 A770 上提升 Qwen3.8 27B 推理速度，涉及量化与框架选择。[[Reddit 讨论](https://www.reddit.com/r/IntelArc/comments/1wdlyt6/i_want_to_use_qwen38_27b_a_bit_faster_on_the_a770/)]
- **[社区讨论] B580 购买建议与 1440p 渲染**：用户讨论 B580 性价比及在 1080p 显示器上渲染 1440p 的可行性。[[Reddit 讨论 1](https://www.reddit.com/r/IntelArc/comments/1wdiwez/is_the_b580_a_good_option/)] [[Reddit 讨论 2](https://www.reddit.com/r/IntelArc/comments/1wdgcs3/how_do_i_render_games_at_1440p_with_a_1080p/)]