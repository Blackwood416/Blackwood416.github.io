---
title: "Intel GPU 技术生态日报 (2026-09-05)"
description: "今日 Intel GPU 动态速览：包含驱动内核演进、算子与推理引擎适配进展。"
pubDate: "2026-09-05T08:30:00.000Z"
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

- **llm-scaler 修复 INT4 router 残差竞争**：将 residual-add/RMSNorm 从 router GEMV 中拆分，确保所有 work-group 消费同一归一化向量，并复用现有 INT4 GEMV dispatcher 控制性能开销。
- **vLLM 上游修复 XPU DP 外部负载均衡设备分配**：因 oneCCL 要求所有进程保持全部 XPU 设备可见，改用 `ZE_AFFINITY_MASK` 会导致通信拓扑退化，该 PR 调整了设备选择逻辑。
- **Mesa 26.3 为 Nova Lake P 准备 64 位 shader 寻址模式**：Intel 图形编译器代码合入新支持，Nova Lake P 图形将迎来根本性变化。

## 下游优化与加速库 (intel/llm-scaler)

- **esimd: 修复 INT4 router residual race**：将 residual-add/RMSNorm 从 router GEMV 中拆分，使每个 work-group 消费相同的归一化向量。复用现有优化 INT4 GEMV dispatcher 以限制性能损失，并添加高 N 回归测试。[[PR #675](https://github.com/intel/llm-scaler/commit/ede4320a24a67f664fb53081d2623f9efe9a75b7)]
- **移除 load balancer 实现**：由于 DP（数据并行）已就绪，删除 load_balancer 以处理 PTK0008946 问题。[[commit](https://github.com/intel/llm-scaler/commit/37818e23670797b51452ffbd44b4aa58a58e77b6)]
- **vllm-0.26.0-b1 发布更新**：同步 vLLM 0.26.0-b1 版本。[[PR #674](https://github.com/intel/llm-scaler/commit/6dbda2e775a19460dd4d5b2e6f46445ae6cfd955)]
- **删除 vllm/docker-compose 目录**：清理不再需要的 docker-compose 配置。[[commit](https://github.com/intel/llm-scaler/commit/bc083f5ccaffde437c9a91d10adceebf224d1bc8)]

## 主流框架与上游集成 (PyTorch / vLLM / SGLang / llama.cpp)

- **vLLM [XPU] 修复 DP 外部 LB 设备分配**：与 CUDA 不同，oneCCL 要求每个进程保持所有 XPU 设备可见；使用 `ZE_AFFINITY_MASK` 限制会导致每个 rank 仅看到一个设备，产生退化通信拓扑。因此设备选择不能依赖该环境变量。[[PR #53037](https://github.com/vllm-project/vllm/pull/53037)]
- **vLLM [XPU][UT] 跳过 GLM-5.3-Flash 测试**：该模型在 XPU 上不受支持，跳过相关单元测试。[[PR #55266](https://github.com/vllm-project/vllm/pull/55266)]
- **SGLang [Intel GPU] 对齐 XPU toml 文件以支持 Rust**：移除 apache-tvm-ffi 安装，固定 xgrammar 版本。[[PR #31031](https://github.com/sgl-project/sglang/pull/31031)]
- **SGLang [XPU] 支持 GPT-OSS MXFP4 检查点**：通过原生 W4A16 分组 GEMM 在 Intel XPU 上启用 `openai/gpt-oss-20b` 和 `-120b` 的 MXFP4 量化 MoE 权重。此前所有 SGLang MXFP4 内核均面向 CUDA（triton_kernels / Marlin / FlashInfer cutlass）。[[PR #35751](https://github.com/sgl-project/sglang/pull/35751)]
- **SGLang [XPU][CI] 移动 XPU 测试至 nightly**：将 `test_deepseek_ocr_triton` 和 `test_gemma_4_e2b` 从禁用 stage-b 移至 `nightly-xpu-1-gpu`，因 Triton-XPU / stage-b OOM 阻塞因素已消除；禁用 `test_triton_attention_backend`。[[PR #37532](https://github.com/sgl-project/sglang/pull/37532)]
- **SGLang [XPU] 周度简单模型启用**：合并 11 个源 PR 的小型 XPU 模型启用和后端对齐改动，每个源 PR 保留为独立 commit 以便追溯。[[PR #37193](https://github.com/sgl-project/sglang/pull/37193)]

## 驱动、内核与图形栈 (Linux drm/xe / Mesa ANV)

- **Mesa 26.3 为 Nova Lake P 准备 64 位 GPU 模式**：Intel 图形编译器代码合入新支持，为 Nova Lake P 的 64 位 shader 寻址模式做准备。这是 Nova Lake P 图形架构的根本性变化。[[Phoronix](https://www.phoronix.com/news/Intel-Nova-Lake-P-64-bit-Mode)]
- **Vulkan 1.4.362 发布**：包含两个由 Valve Linux 图形团队开发的新扩展，其中一个为 Valve 主导。[[Phoronix](https://www.phoronix.com/news/Vulkan-1.4.362)]
- **Intel 改进 CMRR 功能**：Linux 7.4 中继续完善 Content Match Refresh Rate（CMRR），该功能自 Xe2 Lunar Lake 图形硬件引入，相比传统 VRR/Adaptive-Sync 能更精确匹配视频或内容帧率。[[Phoronix](https://www.phoronix.com/news/Intel-Graphics-CMRR-Linux-7.4)]

## 社区实测与生态动态

- **Arc Pro B70 推理性能**：社区用户报告使用 vLLM XPU + MTP4 运行 Qwen3.8-27B 达到 84.65 tok/s。[[Reddit](https://www.reddit.com/r/IntelArc/comments/1w6ozxy/intel_arc_pro_b70_8465_toks_with_qwen3827b_using/)]
- **Arc Power 1.1.0 发布**：社区超频工具更新，支持 Intel Arc 显卡超频。[[Reddit](https://www.reddit.com/r/IntelArc/comments/1w6jh7o/arc_power_110_overclocking_the_arc_way/)]
- **B580 游戏兼容性反馈**：多篇帖子报告《Blood of Dawnwalker》《Dragon's Dogma 2》等游戏在 B580 上的运行情况，以及《WARDOGS》微卡顿的解决方案。[[Reddit](https://www.reddit.com/r/IntelArc/comments/1w7f26b/the_blood_of_dawnwalker_intel_arc_b580_ryzen_5/)]
- **B580 驱动问题持续**：有用户反映切换至 B580 后《彩虹六号：围攻》和《守望先锋 2》出现持续卡顿，且两个月未获修复。[[Reddit](https://www.reddit.com/r/IntelArc/comments/1w6omgn/constant_stuttering_on_specifically_rainbow_six/)]
- **B580 单卡模型运行讨论**：社区讨论单张 B580 可流畅运行的模型范围。[[Reddit](https://www.reddit.com/r/IntelArc/comments/1w7goyp/what_models_can_run_decently_well_on_a_single_b580/)]