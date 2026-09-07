---
title: "Intel GPU 技术生态日报 (2026-09-07)"
description: "今日 Intel GPU 动态速览：包含驱动内核演进、算子与推理引擎适配进展。"
pubDate: "2026-09-07T08:30:00.000Z"
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

- **SGLang 上游合入 4 个 XPU 相关 PR**：涵盖 NUMA 绑定、GLM5.1 DSA 注意力、CI 仪表盘修复与 DeepSeek-OCR 测试内存参数固定，XPU 后端在 SGLang 中的适配深度持续增加。
- **intel/llm-scaler 提交 2 个关键修复**：解决 GDN 状态并发竞争，并增强 Omni XPU 内核的 solattn 与多候选支持。
- **社区实测 B70 在 vLLM 下达到 180+ tok/s**：Qwen 3.6 MTP4 GPTQ INT4 单卡推理数据，为 Battlemage 专业卡的 INT4 性能提供新参考。

## 下游优化与加速库 (intel/llm-scaler)

- **GDN 状态竞争修复**：提交 `2ac6a6f` 将 GDN 卷积状态更新在 work-group 间序列化，并新增测试覆盖循环 GDN 解码状态。该修复针对并发 decode 场景下状态竞争导致的非确定性输出问题，对使用 GDN 结构的生成模型在 XPU 上的稳定性有直接影响。[[PR #677](https://github.com/intel/llm-scaler/commit/2ac6a6f68f58a7789e6f3652fe5d083047457339)]

- **Omni XPU 内核增强**：提交 `2a29d6f` 扩展 Omni XPU kernel 对 solattn（稀疏注意力）和多候选（multi-candidate）的支持。该改动涉及 kernel 内部调度逻辑，使 Omni 在 XPU 上能更高效地处理稀疏注意力模式与多候选生成场景。[[PR #669](https://github.com/intel/llm-scaler/commit/2a29d6f5fab8126bf4982262ea705cc261315510)]

## 主流框架与上游集成 (SGLang)

- **NUMA 节点绑定支持**：PR #31113 为 Intel XPU 添加 NUMA 绑定能力。此前 `numa_utils` 仅支持 CUDA（通过 NVML 发现 GPU→NUMA 映射），XPU 无 NVML，该 PR 实现了 XPU 路径的 NUMA 拓扑发现与绑定，使多卡场景下 CPU 内存与 GPU 本地 NUMA 节点对齐。[[PR #31113](https://github.com/sgl-project/sglang/pull/31113)]

- **GLM5.1 DSA 注意力启用**：PR #24959 为 GLM5.1（GlmMoeDsaForCausalLM）在 XPU 上启用 Dynamic Sparse Attention 路径。GLM5.1 使用 FP8 indexer 对 KV pages 打分后再执行稀疏注意力，该 PR 在 server_args 中增加 DSA 模型识别与 XPU 执行路径。[[PR #24959](https://github.com/sgl-project/sglang/pull/24959)]

- **XPU CI 仪表盘修复**：PR #37800 修复 nightly XPU dashboard 渲染空表的问题，包括 workflow 过滤字段修正等 4 处改动，确保 CI 状态可视化正常。[[PR #37800](https://github.com/sgl-project/sglang/pull/37800)]

- **DeepSeek-OCR 测试内存参数固定**：PR #38221 为 XPU 上的 DeepSeek-OCR 测试固定 `--mem-fraction-static=0.7`。此前设备默认值 0.5016 在 ~12 GB XPU tile 上不足以容纳 6.23 GB 权重，导致测试失败。[[PR #38221](https://github.com/sgl-project/sglang/pull/38221)]

## 驱动、内核与图形栈

- **Linux 7.3-rc2 调度器修复**：Phoronix 报道了本周 rc2 的调度器修复集，重点处理混合 CPU 上 Cache-Aware Load Scheduling 的 misfit 问题。该修复对 Intel 混合架构（P-core + E-core）上的负载均衡行为有直接影响，间接影响 GPU 驱动线程的调度效率。[[Phoronix](https://www.phoronix.com/news/Linux-7.3-rc2-Scheduler-Fixes)]

## 社区实测与生态动态

- **B70 vLLM INT4 推理性能**：Reddit 用户报告在单张 Arc Pro B70 上，vLLM 运行 Qwen 3.6 MTP4 GPTQ INT4 达到 180+ tok/s。该数据与昨日报道的 27B MTP4 场景（81 tok/s）形成对比，显示 INT4 量化与模型规模对吞吐的显著影响。[[Reddit](https://www.reddit.com/r/IntelArc/comments/1w9537c/vllm_pushing_180_ts_on_a_single_b70_with_qwen_36/)]

- **llama.cpp SYCL 硬崩溃修复**：Arc Pro B60 用户在 llama.cpp SYCL 加载模型时遇到 hard abort，社区找到了修复方法并分享。该问题与 SYCL 运行时在特定模型加载路径上的内存分配行为相关，对 Battlemage 专业卡用户有直接参考价值。[[Reddit](https://www.reddit.com/r/IntelArc/comments/1w97cy1/intel_arc_pro_b60_battlemage_llamacpp_sycl_hard/)]

- **Arc Pro B70 温度锁定讨论**：用户报告 B70 存在温度锁定现象，讨论集中在散热设计与功耗墙的交互。该话题涉及 Battlemage 专业卡的持续负载热管理表现。[[Reddit](https://www.reddit.com/r/IntelArc/comments/1w8yyh6/arc_pro_b70_temperature_locked/)]

- **驱动问题反馈**：有用户报告当前驱动版本下的问题，涉及稳定性与兼容性，具体细节待进一步确认。[[Reddit](https://www.reddit.com/r/IntelArc/comments/1w9dffi/issues_with_the_drivers/)]