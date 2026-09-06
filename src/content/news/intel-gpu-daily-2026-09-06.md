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

- **llm-scaler 修复 INT4 路由残差竞争**：将残差加与 RMSNorm 从 router GEMV 中拆出，确保各 work-group 消费同一归一化向量，并复用优化后的 INT4 GEMV 分发器控制性能开销。
- **Mesa 26.3 为 Nova Lake P 准备 64 位 shader 寻址模式**：Intel 图形编译器代码合入新改动，支持下一代核显的 64 位 shader 地址空间。
- **SGLang 为 XPU 引入 GPT-OSS MXFP4 支持**：通过原生 W4A16 分组 GEMM 路径，使 `openai/gpt-oss-20b` 与 `-120b` 的 MXFP4 权重可在 Intel XPU 上运行。

---

## 下游优化与加速库 (intel/llm-scaler)

- **[ESIMD] INT4 router 残差竞争修复**：`#675` 将残差加与 RMSNorm 从 router GEMV 中拆分，使每个 work-group 消费相同的归一化向量，消除因异步执行导致的数值不一致。改动复用现有优化后的 INT4 GEMV 分发器以限制性能损失，并新增高 N 回归测试。[[PR #675](https://github.com/intel/llm-scaler/commit/ede4320a24a67f664fb53081d2623f9efe9a75b7)]

---

## 主流框架与上游集成 (PyTorch / vLLM / SGLang / llama.cpp)

- **[vLLM] XPU DP 外部负载均衡设备分配修复**：`#53037` 修复了 DP 场景下外部负载均衡的设备分配问题。与 CUDA 不同，oneCCL 要求每个进程保持所有 XPU 设备可见；使用 `ZE_AFFINITY_MASK` 限制会导致每个 rank 仅看到单设备，产生退化的通信拓扑。该 PR 调整了设备选择逻辑以适配 oneCCL 的约束。[[PR #53037](https://github.com/vllm-project/vllm/pull/53037)]
- **[vLLM] XPU 跳过 GLM-5.3-Flash 测试**：`#55266` 在 XPU 上跳过 `GLM-5.3-Flash` 测试，原因是该模型在 XPU 上不受支持，CI 构建失败。[[PR #55266](https://github.com/vllm-project/vllm/pull/55266)]
- **[SGLang] XPU toml 文件对齐 rust 支持**：`#31031` 移除 `apache-tvm-ffi` 安装项并固定 xgrammar 版本，以适配 rust 工具链的构建需求。[[PR #31031](https://github.com/sgl-project/sglang/pull/31031)]
- **[SGLang] XPU 支持 GPT-OSS MXFP4 检查点**：`#35751` 通过原生 W4A16 分组 GEMM 路径，使 `openai/gpt-oss-20b` 与 `-120b` 的 MXFP4 量化 MoE 权重可在 Intel XPU 上运行。此前所有 SGLang MXFP4 内核均面向 CUDA（triton_kernels / Marlin / FlashInfer cutlass）。[[PR #35751](https://github.com/sgl-project/sglang/pull/35751)]
- **[SGLang] XPU CI 迁移至 nightly 并增加超时**：`#37532` 将 `test_deepseek_ocr_triton` 与 `test_gemma_4_e2b` 从禁用状态移至 `nightly-xpu-1-gpu`，因 Triton-XPU / stage-b 的 OOM 阻塞已解除；同时禁用 `test_triton_attention_backend` 并增加 per-subclass 服务启动超时。[[PR #37532](https://github.com/sgl-project/sglang/pull/37532)]

---

## 驱动、内核与图形栈 (Linux drm/xe / Mesa ANV)

- **[Mesa] Nova Lake P 64 位 shader 寻址模式准备**：Mesa 26.3 合入 Intel 图形编译器改动，为 Nova Lake P 核显新增 64 位 shader 寻址模式支持。这是下一代核显图形栈的基础性变更，涉及编译器后端地址空间扩展。[[Phoronix](https://www.phoronix.com/news/Intel-Nova-Lake-P-64-bit-Mode)]
- **[Vulkan] 1.4.362 规范更新**：Vulkan 1.4.362 发布，包含两个由 Valve Linux 图形团队开发的新扩展。该更新对 Intel ANV 驱动在 Linux 上的 Vulkan 功能覆盖有间接影响。[[Phoronix](https://www.phoronix.com/news/Vulkan-1.4.362)]

---

## 社区实测与生态动态

- **[Arc Pro B70] Qwen3.8-27B MTP4 推理测试**：社区用户报告在 Arc Pro B70 上运行 Qwen3.8-27B 配合 MTP4 的实测数据：512 tokens 上下文下 81.24 tok/s，120K tokens 长上下文下 50.31 tok/s。该测试涉及 MTP（Multi-Token Prediction）路径在 Battlemage 架构上的实际吞吐表现。[[Reddit](https://www.reddit.com/r/IntelArc/comments/1w8fc36/intel_arc_pro_b70_qwen3827b_mtp4_test_results/)]
- **[B580] XeFG x4 帧生成测试**：用户通过 Optiscaler 在 B580 上启用 XeFG（x4）运行《Blood of Dawnwalker》1440P，报告帧生成效果良好。该测试涉及 XeSS 帧生成在非官方路径下的兼容性。[[Reddit](https://www.reddit.com/r/IntelArc/comments/1w7s9ub/the_blood_of_dawnwalker_1440p_xefgx4_via/)]
- **[B580] 驱动稳定性讨论**：多名用户反馈 B580 在特定主板（如 Acer Nitro）上出现启动后冻结问题，另有用户询问 8801 是否为最后稳定驱动版本。这些反馈指向当前 Windows 驱动在特定硬件组合下的稳定性缺口。[[Reddit 1](https://www.reddit.com/r/IntelArc/comments/1w7w7e0/intel_arc_b580_freeze_after_boot_acer_nitro/)] [[Reddit 2](https://www.reddit.com/r/IntelArc/comments/1w8lj1e/was_8801_the_last_stable_driver/)]
- **[B580] 单卡本地模型运行讨论**：社区讨论 B580 单卡可流畅运行的模型范围，涉及 12GB VRAM 约束下的量化模型选择与推理框架配置。[[Reddit](https://www.reddit.com/r/IntelArc/comments/1w7goyp/what_models_can_run_decently_well_on_a_single_b580/)]