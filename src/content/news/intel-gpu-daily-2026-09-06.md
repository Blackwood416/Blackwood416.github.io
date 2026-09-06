---
title: "Intel GPU 技术生态日报 (2026-09-06)"
description: "今日 Intel GPU 动态速览：包含驱动内核演进、算子与推理引擎适配进展。"
pubDate: "2026-09-06T08:30:00.000Z"
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

- **llm-scaler 修复 INT4 路由残差竞态**：将残差加与 RMSNorm 从 GEMV 中拆分，确保各 work-group 消费同一归一化向量，并复用优化后的 INT4 GEMV 分发器控制性能开销。
- **Mesa 26.3 为 Nova Lake P 准备 64 位 shader 寻址模式**：Intel 图形编译器代码合入新改动，为下一代核显的 64 位 GPU 模式铺路。
- **vLLM XPU 数据并行外部负载均衡修复**：解决 oneCCL 下 `ZE_AFFINITY_MASK` 导致单 rank 单设备、通信拓扑退化的设备分配问题。

## 下游优化与加速库 (intel/llm-scaler)

- **ESIMD INT4 路由残差竞态修复**：将残差加与 RMSNorm 从 router GEMV 中拆出，使所有 work-group 消费同一归一化向量，消除跨 work-group 的读取不一致。同时复用现有优化 INT4 GEMV 分发器以限制性能损失，并新增高 N 回归测试。[[PR #675](https://github.com/intel/llm-scaler/commit/ede4320a24a67f664fb53081d2623f9efe9a75b7)]

## 主流框架与上游集成 (PyTorch / vLLM / SGLang / llama.cpp)

- **vLLM [XPU] DP 外部负载均衡设备分配修复**：CUDA 与 oneCCL 在设备可见性语义上存在差异——oneCCL 要求每个进程保持所有 XPU 设备可见，而 `ZE_AFFINITY_MASK` 限制后每个 rank 仅见单设备，导致通信拓扑退化。该 PR 调整设备选择逻辑以适配 oneCCL 约束。[[PR #53037](https://github.com/vllm-project/vllm/pull/53037)]
- **vLLM [XPU][UT] 跳过 GLM-5.3-Flash 测试**：该模型在 XPU 上不受支持，CI 中直接跳过以避免误报。[[PR #55266](https://github.com/vllm-project/vllm/pull/55266)]
- **SGLang [Intel GPU] 对齐 XPU toml 文件以支持 Rust**：移除 `apache-tvm-ffi` 安装项，并固定 xgrammar 版本，以适配 Rust 工具链的构建需求。[[PR #31031](https://github.com/sgl-project/sglang/pull/31031)]
- **SGLang [XPU] 支持 GPT-OSS MXFP4 检查点**：为 Intel XPU 增加 MXFP4 格式的 GPT-OSS 模型加载与推理支持。[[PR #35751](https://github.com/sgl-project/sglang/pull/35751)]
- **SGLang [XPU][CI] 测试移至 nightly 并增加子类启动超时**：`test_deepseek_ocr_triton` 与 `test_gemma_4_e2b` 从禁用状态移至 `nightly-xpu-1-gpu`，原 Triton-XPU / stage-b OOM 阻塞已解除；`test_triton_attention_backend` 以锚定方式禁用。[[PR #37532](https://github.com/sgl-project/sglang/pull/37532)]

## 驱动、内核与图形栈 (Linux drm/xe / Mesa ANV)

- **Mesa 26.3 为 Nova Lake P 准备 64 位 GPU 模式**：Intel 图形编译器代码合入新改动，支持 64 位 shader 寻址模式。Nova Lake P 的图形架构将发生根本性变化，该改动是适配的第一步。[[Phoronix](https://www.phoronix.com/news/Intel-Nova-Lake-P-64-bit-Mode)]
- **Vulkan 1.4.362 发布**：新增两个由 Valve Linux 图形团队开发的扩展，其中一个为 Valve 主导。[[Phoronix](https://www.phoronix.com/news/Vulkan-1.4.362)]

## 社区实测与生态动态

- **Arc Pro B70 Qwen3.8-27B MTP4 测试**：512 tokens 下 81.24 tok/s，120K 上下文下 50.31 tok/s。[[Reddit](https://www.reddit.com/r/IntelArc/comments/1w8fc36/intel_arc_pro_b70_qwen3827b_mtp4_test_results/)]
- **B580 驱动稳定性讨论**：有用户询问 8801 是否为最后稳定版，另有用户报告 Acer Nitro 上 B580 启动后冻结问题，以及 2 个月未获驱动修复的抱怨。[[Reddit 1](https://www.reddit.com/r/IntelArc/comments/1w8lj1e/was_8801_the_last_stable_driver/)] [[Reddit 2](https://www.reddit.com/r/IntelArc/comments/1w7w7e0/intel_arc_b580_freeze_after_boot_acer_nitro/)] [[Reddit 3](https://www.reddit.com/r/IntelArc/comments/1w7d1pt/2_months_and_nothing_intel_please_fix_your/)]
- **B580 游戏与生成任务实测**：Blood of Dawnwalker 1440P 下通过 Optiscaler 使用 XeFG(x4) 帧生成，B570 OC + Ryzen 5 4500 组合也有测试；另有 Onimusha: Way of the Sword 基准测试。[[Reddit 1](https://www.reddit.com/r/IntelArc/comments/1w7s9ub/the_blood_of_dawnwalker_1440p_xefgx4_via/)] [[Reddit 2](https://www.reddit.com/r/IntelArc/comments/1w7lvgm/blood_of_dawnwalkerb570_ocryzen_5_4500/)] [[Reddit 3](https://www.reddit.com/r/IntelArc/comments/1w7cv9a/onimusha_way_of_the_sword_benchmark/)]
- **B580 本地模型运行讨论**：社区讨论单卡 B580 可流畅运行的模型范围，以及视频/图像生成任务表现。[[Reddit 1](https://www.reddit.com/r/IntelArc/comments/1w7goyp/what_models_can_run_decently_well_on_a_single_b580/)] [[Reddit 2](https://www.reddit.com/r/IntelArc/comments/1w7z4qm/video_und_bildgenerierung_auf_der_b580/)]