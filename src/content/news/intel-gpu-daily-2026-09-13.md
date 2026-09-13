---
title: "Intel GPU 技术生态日报 (2026-09-13)"
description: "今日 Intel GPU 动态速览：包含驱动内核演进、算子与推理引擎适配进展。"
pubDate: "2026-09-13T08:30:00.000Z"
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
- Triton XPU 后端修复 `ReduceVariableLiveness` 中 prefetch 去重键错误，并启用 SGLang MoE 测试套件中的 `test_fused_moe.py`。
- vLLM 上游 XPU CI 清理：移除 ROCm 测试误跑、统一依赖管理、跳过不支持的 DeepSeek-V4.1-Flash 用例。
- Intel 发布 Linux NPU 驱动 1.38，正式支持 Ubuntu 26.04 LTS；社区报告 Arc B390 在 HDMI 热插拔时触发 BSOD。

## 下游优化与加速库 (intel/llvm / Triton)
- **[TritonIntelGPU] 修复 prefetch 去重键逻辑**：`ReduceVariableLiveness` 此前仅以 descriptor 作为 prefetch 去重键，导致不同地址但相同 descriptor 的访问被错误合并。补丁将键扩展为 descriptor 与地址的组合，避免 liveness 分析阶段错误删除必要的 prefetch 指令。[[PR #8018](https://github.com/intel/intel-xpu-backend-for-triton/commit/113b8362078f9d35ee3febad30975c47600a9141)]
- **[TritonIntelGPU] 启用 SGLang MoE 测试**：`test_fused_moe.py` 此前因 `srt/layers/activation.py` 在模块级导入 `sgl_kernel` 而无法在 XPU 上运行。补丁调整导入路径，使该测试进入 `--sglang-moe` 套件。[[PR #7886](https://github.com/intel/intel-xpu-backend-for-triton/commit/040df4a8297fc3adb636bfadd9d2b7a0ba9340b3)]
- **[TritonIntelGPU] CI 停止自动运行 max1550 vLLM 基准**：max1550 运行器资源稀缺，vLLM 基准改为仅手动触发，与先前 PVC 基准的调整保持一致。[[PR #8031](https://github.com/intel/intel-xpu-backend-for-triton/commit/d235e588ab85bb91324044eedfc5816a28a409fc)]
- **[intel/llvm] DPC++ 每日构建更新**：发布 `nightly-2026-09-12` 与 `nightly-2026-09-11` 两个每日构建，同时更新 `sycl-web` 状态标签（`main-latest-good`、`latest-buildable`）。[[Release](https://github.com/intel/llvm/releases/tag/nightly-2026-09-12)]

## 主流框架与上游集成 (vLLM)
- **[vLLM] XPU CI 跳过非 ROCm 平台测试**：修正 CI 配置，避免在 XPU 环境误跑 ROCm 专属测试。[[PR #56555](https://github.com/vllm-project/vllm/pull/56555)]
- **[vLLM] 统一 XPU 测试依赖管理**：将测试 yaml 中的 pip 安装依赖全部迁移至 `requirements/test/xpu.in`，简化 CI 依赖维护。[[PR #55171](https://github.com/vllm-project/vllm/pull/55171)]
- **[vLLM] 跳过 XPU 不支持的 DeepSeek-V4.1-Flash 用例**：`test_tensor_schema.py` 中该模型在 XPU 上不受支持，CI 中显式跳过。[[PR #56463](https://github.com/vllm-project/vllm/pull/56463)]

## 驱动、内核与图形栈 (Linux 驱动 / Windows 驱动)
- **[Linux NPU 驱动] 1.38 发布**：用户态组件正式支持 Ubuntu 26.04 LTS，与上游 IVPU 内核驱动配合使用，覆盖 Core Ultra 系列 NPU。[[Phoronix](https://www.phoronix.com/news/Intel-Linux-NPU-Driver-1.38)]
- **[Windows 驱动] Arc B390 HDMI 热插拔触发 BSOD**：`igdkmdn64.sys` 报 `SYSTEM_SERVICE_EXCEPTION (0x3B)`，错误为整数除零。发生在 Panther Lake 平台（Core Ultra X7 358H）搭配 Arc B390，驱动版本 32.0.101.8991/8992。[[IGCIT #1547](https://github.com/IGCIT/Intel-GPU-Community-Issue-Tracker-IGCIT/issues/1547)]
- **[Windows 驱动] WGL 共享上下文竞态崩溃**：两个线程无同步访问共享 GL 纹理时触发 AccessViolationException/segfault，涉及 WGL Core Profile 与 `wglShareLists`。[[IGCIT #1554](https://github.com/IGCIT/Intel-GPU-Community-Issue-Tracker-IGCIT/issues/1554)]

## 社区实测与生态动态
- **[Arc Pro B65] 70+ tok/s 解码**：社区报告 Arc Pro B65 在推理解码场景达到 70+ tok/s，未提供具体模型与量化细节。[[Reddit](https://www.reddit.com/r/IntelArc/comments/1we2ueu/intel_arc_pro_b65_getting_70_toks_decode/)]
- **[Arc B580] 双卡配置下 B580 闲置**：A770 与 B580 双卡组合中，B580 未被调度使用，疑似驱动或应用未正确识别多 GPU。[[Reddit](https://www.reddit.com/r/IntelArc/comments/1we5d3p/dual_gpu_a770_b580but_b580_is_sitting_idle/)]
- **[Arc B580] Bodycam 性能异常**：用户报告在《Bodycam》中性能不佳，未提供具体配置与对比数据。[[Reddit](https://www.reddit.com/r/IntelArc/comments/1welqzo/bad_performance_in_bodycam/)]
- **[Arc B580] 无法正常工作**：有用户报告 B580 完全无法工作，未提供错误日志或系统信息。[[Reddit](https://www.reddit.com/r/IntelArc/comments/1wenur9/intel_arc_b580_not_functioning/)]
- **[Arc B570] 4K 黑神话悟空测试**：i5-12400F + 16GB DDR4 平台运行 B580，4K 分辨率下性能表现未给出具体帧率。[[Reddit](https://www.reddit.com/r/IntelArc/comments/1wequsa/4k_black_myth_wukong_b580_i5_12400f_16_gb_3200/)]