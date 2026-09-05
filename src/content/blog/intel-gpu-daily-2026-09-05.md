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

- llm-scaler 修复 INT4 router 残差竞态，并移除已由 DP 取代的 load balancer 实现。
- vLLM 上游合入 XPU DP 外部 LB 设备分配修复，SGLang 新增 GPT-OSS MXFP4 权重 XPU 支持。
- Mesa 26.3 为 Nova Lake P 的 64 位 shader 寻址模式做准备，Linux 7.4 改进 CMRR 功能。

## 下游优化与加速库 (intel/llm-scaler)

- **ESIMD 算子修复**：修复 INT4 router 残差竞态。将 residual-add/RMSNorm 从 router GEMV 中拆分，确保每个 work-group 消费相同的归一化向量。复用现有优化 INT4 GEMV dispatcher 以限制性能开销，并添加高 N 回归测试。[[PR #675](https://github.com/intel/llm-scaler/commit/ede4320a24a67f664fb53081d2623f9efe9a75b7)]
- **调度器清理**：删除 load balancer 实现，因 DP（Data Parallel）已就绪。该删除用于 triage PTK0008946。[[commit](https://github.com/intel/llm-scaler/commit/37818e23670797b51452ffbd44b4aa58a58e77b6)]
- **版本更新**：发布 vllm-0.26.0-b1 更新，并删除 vllm/docker-compose 目录。[[PR #674](https://github.com/intel/llm-scaler/commit/6dbda2e775a19460dd4d5b2e6f46445ae6cfd955)][[commit](https://github.com/intel/llm-scaler/commit/bc083f5ccaffde437c9a91d10adceebf224d1bc8)]

## 主流框架与上游集成 (PyTorch / vLLM / SGLang / llama.cpp)

- **vLLM XPU DP 设备分配修复**：修复 DP 外部 LB 场景下的设备分配问题。与 CUDA 不同，oneCCL 要求每个进程保持所有 XPU 设备可见；使用 `ZE_AFFINITY_MASK` 限制会导致每个 rank 仅看到一个设备，产生退化通信拓扑。因此设备选择不能依赖该掩码。[[PR #53037](https://github.com/vllm-project/vllm/pull/53037)]
- **vLLM XPU 测试跳过**：跳过 GLM-5.3-Flash 测试，因该模型在 XPU 上不受支持。[[PR #55266](https://github.com/vllm-project/vllm/pull/55266)]
- **SGLang XPU 构建对齐**：对齐 XPU toml 文件以支持 Rust，移除 apache-tvm-ffi 安装并固定 xgrammar 版本。[[PR #31031](https://github.com/sgl-project/sglang/pull/31031)]
- **SGLang GPT-OSS MXFP4 支持**：通过原生 W4A16 grouped GEMM 在 Intel XPU 上支持 GPT-OSS MXFP4 检查点。`openai/gpt-oss-20b` 和 `-120b` 使用 MXFP4 量化 MoE 权重，现有 SGLang MXFP4 内核均面向 CUDA（triton_kernels / Marlin / FlashInfer cutlass）。[[PR #35751](https://github.com/sgl-project/sglang/pull/35751)]
- **SGLang XPU CI 调整**：将 XPU 测试移至 nightly，并为每个子类添加服务器启动超时。`test_deepseek_ocr_triton` 和 `test_gemma_4_e2b` 从禁用 stage-b 移至 `nightly-xpu-1-gpu`，因 Triton-XPU / stage-b OOM 阻塞因素已不再适用。[[PR #37532](https://github.com/sgl-project/sglang/pull/37532)]

## 驱动、内核与图形栈 (Linux drm/xe / Mesa ANV)

- **Mesa 26.3 Nova Lake P 64 位模式准备**：合入 Intel 图形编译器代码变更，支持新的 64 位 shader 寻址模式。Nova Lake P 图形将发生根本性变化。[[Phoronix](https://www.phoronix.com/news/Intel-Nova-Lake-P-64-bit-Mode)]
- **Linux 7.4 CMRR 改进**：Intel 改进 Content Match Refresh Rate（CMRR）功能。该功能随 Xe2 Lunar Lake 图形硬件引入，相比传统 VRR / Adaptive-Sync 能更精确匹配视频或内容帧率。[[Phoronix](https://www.phoronix.com/news/Intel-Graphics-CMRR-Linux-7.4)]
- **Vulkan 1.4.362 发布**：新增两个由 Valve Linux 图形团队开发的扩展。[[Phoronix](https://www.phoronix.com/news/Vulkan-1.4.362)]

## 社区实测与生态动态

- **Arc Pro B70 推理性能**：社区用户报告 Intel Arc Pro B70 在 vLLM XPU + MTP4 下运行 Qwen3.8-27B 达到 84.65 tok/s。[[Reddit](https://www.reddit.com/r/IntelArc/comments/1w6ozxy/intel_arc_pro_b70_8465_toks_with_qwen3827b_using/)]
- **B580 模型运行讨论**：社区讨论单张 B580 可流畅运行的模型范围。[[Reddit](https://www.reddit.com/r/IntelArc/comments/1w7goyp/what_models_can_run_decently_well_on_a_single_b580/)]
- **Arc Power 1.1.0 发布**：社区工具 Arc Power 1.1.0 发布，提供 Arc 显卡超频功能。[[Reddit](https://www.reddit.com/r/IntelArc/comments/1w6jh7o/arc_power_110_overclocking_the_arc_way/)]
- **游戏性能反馈**：多篇帖子报告 B580 在《Blood of Dawnwalker》《Dragon's Dogma 2》《Onimusha: Way of the Sword》等游戏中的表现，以及 Rainbow Six Siege / Overwatch 2 的持续卡顿问题。[[Reddit](https://www.reddit.com/r/IntelArc/comments/1w7cv9a/onimusha_way_of_the_sword_benchmark/)][[Reddit](https://www.reddit.com/r/IntelArc/comments/1w7f26b/the_blood_of_dawnwalker_intel_arc_b580_ryzen_5/)][[Reddit](https://www.reddit.com/r/IntelArc/comments/1w6yll3/dragons_dogma_2_running_on_arc_b580_ryzen_5_5600/)][[Reddit](https://www.reddit.com/r/IntelArc/comments/1w6omgn/constant_stuttering_on_specifically_rainbow_six/)]
- **驱动问题反馈**：有用户报告 B580 驱动问题持续两个月未解决。[[Reddit](https://www.reddit.com/r/IntelArc/comments/1w7d1pt/2_months_and_nothing_intel_please_fix_your/)]