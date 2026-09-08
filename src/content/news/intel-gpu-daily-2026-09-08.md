---
title: "Intel GPU 技术生态日报 (2026-09-08)"
description: "今日 Intel GPU 动态速览：包含驱动内核演进、算子与推理引擎适配进展。"
pubDate: "2026-09-08T08:30:00.000Z"
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
- **vLLM XPU 后端密集修复**：今日合入 4 个 XPU 相关 PR，覆盖 MoE 量化权重加载、DeepSeek V4 LoRA、grouped_topk 融合内核路由与 FusedInputNorm 内核调度，XPU 路径与 CUDA 对齐度进一步提升。
- **SGLang XPU 功能扩展**：新增 MLA Prefill 支持、LoRA 启用、torch_memory_saver 集成及 Whisper 编码器-解码器修复，XPU 后端覆盖场景从纯推理扩展到微调与多模态。
- **intel/llm-scaler 修复 torch.compile 兼容性**：Omni XPU 内核在 torch.compile 下的推理路径得到修复，补齐公共张量 API 编译器覆盖。

## 下游优化与加速库 (intel/llm-scaler)
- **Omni XPU 内核 torch.compile 兼容性修复**：提交 `6044bab` 修复 Omni XPU 内核在 `torch.compile` 下的推理问题。改动包括支持原生 torch.compile 推理、明确编译精度与模型加载边界，并补齐公共张量 API 的编译器覆盖。此前 Omni 内核在编译模式下存在张量 API 覆盖不全导致的错误，此修复使 XPU 路径在编译优化下可正确执行。[[PR #681](https://github.com/intel/llm-scaler/commit/6044bab42a25cee6b5325bdcab3b93ce323b2b72)]

## 主流框架与上游集成 (vLLM / SGLang)
- **[vLLM][XPU] 修复 moe_wna16 线性权重加载**：`MoeWNA16Config.get_quant_method` 从原始 HF 量化字典重建线性委托时，未处理融合后的分片名，导致 GPTQ MoE 检查点无法加载。此修复使 XPU 路径能正确加载 MoE 量化权重。[[PR #52651](https://github.com/vllm-project/vllm/pull/52651)]
- **[vLLM][XPU] DeepSeek V4 LoRA 支持**：将 #53361 中 NVIDIA 模型的 LoRA 改动移植到 `vllm/models/deepseek_v4/xpu/model.py`，补齐 XPU 后端对 DeepSeek V4 LoRA 的支持。[[PR #53689](https://github.com/vllm-project/vllm/pull/53689)]
- **[vLLM][XPU] grouped_topk 路由到融合内核**：vllm-xpu-kernels 已提供 fused grouped_topk (noaux_tc) 内核并注册到 `_moe_C::grouped_topk`，但守卫条件仅检查 `is_cuda()`，导致 XPU 始终回退到 eager 分解。此 PR 修正守卫条件，使 XPU 使用融合内核。[[PR #53580](https://github.com/vllm-project/vllm/pull/53580)]
- **[vLLM][XPU] FusedInputNorm 使用融合内核**：当输入为 uint8 且仿射权重/偏置为 fp32 时，XPU 路径调度到 `torch.ops._C.fused_input_norm` 自定义内核，避免 eager 路径中 fp32 中间张量的设备-主机往返。[[PR #52945](https://github.com/vllm-project/vllm/pull/52945)]
- **[SGLang][XPU] 启用 LoRA**：将 LoRA 功能扩展到 XPU 后端，修改 triton/chunked/torch 后端使用 `torch.device(self.device)` 替代硬编码 "cuda"，并调整 lora_moe_runners 的路由逻辑，同时启用对应单元测试。[[PR #30345](https://github.com/sgl-project/sglang/pull/30345)]
- **[SGLang][Intel GPU] MLA Prefill 支持**：为 `intel_xpu` attention 后端添加 MLA 模型的 Prefill 支持（decode 已支持）。纯 Prefill 使用 `flash_attn_varlen_func`，增量 Prefill 使用 `flash_mla_prefill`。[[PR #35866](https://github.com/sgl-project/sglang/pull/35866)]
- **[SGLang][XPU] 集成 torch_memory_saver**：用上游 pip 可安装的 torch_memory_saver 包（Level Zero VMM 后端）替换仓库内实现，支持 XPU 上的 pause/resume 物理内存占用。[[PR #29935](https://github.com/sgl-project/sglang/pull/29935)]
- **[SGLang][XPU] 修复 Whisper 编码器-解码器**：修复 page_size > 1 时 intel_xpu 后端编码器-解码器模型输出乱码的问题。根因是交叉注意力页表未转换为页号，以及编码器页表处理错误。[[PR #36298](https://github.com/sgl-project/sglang/pull/36298)]
- **[SGLang][XPU] 恢复 diffusion 平台 Triton 路径**：`platform_key()` 未包含 XPU，导致 XPU 被识别为 "cpu" 并走 CPU fallback。此 PR 将 XPU 加入平台探测列表，使 diffusion 平台正确选择 Triton 实现。[[PR #36654](https://github.com/sgl-project/sglang/pull/36654)]

## 驱动、内核与图形栈 (Linux drm/xe / Mesa ANV)
- **Intel Dynamic PAMT 准备合入 Linux 7.4**：该特性用于减少 TDX 机密虚拟机场景下的内存开销，通过动态分配 PAMT（Page Attribute Table）降低静态预留内存。Phoronix 报道其已进入 Linux 7.4 合并窗口，对使用 TDX 的数据中心 GPU 工作负载有间接影响。[[Phoronix](https://www.phoronix.com/news/Intel-Dynamic-PAMT-For-7.4)]

## 社区实测与生态动态
- **Qwen3.6-35B-A3B 双 B580 分片推理讨论**：Reddit 用户询问如何将 Qwen3.6-35B-A3B 模型拆分到两张 Arc B580 上运行。该模型为 MoE 架构（35B 总参、3B 激活），社区讨论涉及多卡内存分配与 XPU 后端对 MoE 分片的支持现状。[[Reddit](https://www.reddit.com/r/IntelArc/comments/1wa8ycs/run_qwen3635ba3b_split_across_two_intel_arc_b580/)]
- **B580 运行 CS2 高 GPU 占用低 CPU 占用问题**：用户报告 B580 在 CS2 中 GPU 占用率异常高而 CPU 占用率极低，疑似驱动调度或渲染路径问题。该反馈对 Battlemage 在游戏负载下的驱动优化有参考价值。[[Reddit](https://www.reddit.com/r/IntelArc/comments/1w9ospg/cs2_issues_on_b580_high_gpu_usage_very_low_cpu/)]