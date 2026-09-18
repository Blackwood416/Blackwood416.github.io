---
title: "Intel GPU 技术生态日报 (2026-09-18)"
description: "今日 Intel GPU 动态速览：包含驱动内核演进、算子与推理引擎适配进展。"
pubDate: "2026-09-18T08:30:00.000Z"
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

- **Intel Compute Runtime 26.35.39758.11 发布**：IGC 版本同步至 v2.41.9，延续 MemOpt 启发式迭代，同时 Phoronix 报道该版本为 Nova Lake 引入 LEO 支持并推出 Intel Portable ISA（PISA）。
- **vLLM XPU 三连合入**：修复 Qwen DFlash 上下文键归一化、启用 XPU EPLB 通信器、跳过 CI 中不稳定的 prefix cache 测试。
- **Level Zero Loader v1.34.0 发布**：oneAPI 生态底层加载器迎来新版本，为后续驱动与运行时适配提供基础。

## 下游优化与加速库 (intel/llm-scaler / Triton / OpenVINO)

- **[llm-scaler] SGLang XPU MTP 支持 temperature > 0**：此前 XPU 上的 MTP 投机解码仅支持 greedy 采样，因为 `sgl_kernel` 中的 `top_k_renorm_prob`、`top_p_renorm_prob` 和 `tree_speculative_sampling_target_only` 仅针对 CUDA/MUSA 构建。该 PR 为 XPU 路径补齐了首个采样器实现，使 MTP 在非零温度下可用。[[PR #719](https://github.com/intel/llm-scaler/commit/38d9a3dbbfecd3a5293a8acd75efef54f9bb3719)]
- **[llm-scaler] 消除 FP8 residual router 竞态**：修复 FP8 残差路由中的异步竞争条件，并新增覆盖异步 FP8 router 消费链的测试。[[PR #717](https://github.com/intel/llm-scaler/commit/1fa01ff4b54d3b3e777e38c03c1feb8434375403)]
- **[Triton XPU] vLLM XPU kernels 改用 release 固定版本**：`vllm_xpu_kernels` 已适配新版 PyTorch，该 PR 恢复从 vLLM 官方 pin 的 release 安装该包，简化 CI 脚本并移除手动删除逻辑。[[PR #8024](https://github.com/intel/intel-xpu-backend-for-triton/commit/ac39409b1a6fb4d7594b0f51fb57cacd397e85a3)]
- **[Triton XPU] vllm-spec-decode 测试套件补装 torch vision**：修复因缺少 torch vision 依赖导致 `vllm-spec-decode` 测试失败的问题。[[PR #8082](https://github.com/intel/intel-xpu-backend-for-triton/commit/605a95a02664057949fed8132a1a53a5e918247e)]
- **[Triton XPU] spirv_utils 缓存键加入 PyTorch-injection 标志**：`spirv_utils` 在 `INJECT_PYTORCH=True` 时以 `-DTRITON_INTEL_INJECT_PYTORCH=1` 编译，该标志此前未纳入缓存键，导致缓存误命中。[[PR #8041](https://github.com/intel/intel-xpu-backend-for-triton/commit/bfa21c283c64a0c4d125153e06c3d927711c6686)]
- **[OpenVINO GenAI] 2026.4.0.0 发布**：OpenVINO GenAI 新版本发布，包含针对 Intel GPU 的推理优化与 API 更新。[[Release](https://github.com/openvinotoolkit/openvino.genai/releases/tag/2026.4.0.0)]

## 主流框架与上游集成 (PyTorch / vLLM / SGLang / llama.cpp / Ollama)

- **[vLLM] 修复 Qwen DFlash 上下文键归一化**：DFlash 将每层 K-norm 权重堆叠后调用 `rms_norm`，输入形状为 `[num_layers, num_context_tokens, num_kv_heads, head_dim]`，权重为 `[num_layers, head_dim]`。现有 XPU kernel 错误地按单层处理，导致归一化结果错误。该 PR 修正了 XPU 端的权重索引逻辑。[[PR #56431](https://github.com/vllm-project/vllm/pull/56431)]
- **[vLLM] 启用 XPU EPLB**：为 XPU 添加 `TorchDistXCCLStagedEplbCommunicator`，支持在 XPU 上使用 TorchXCCL 与 TorchGloo 进行 EPLB 通信，并附带 Qwen3-30B-A3B 的验证示例。[[PR #44987](https://github.com/vllm-project/vllm/pull/44987)]
- **[vLLM] CI 跳过 test_hybrid_prefix_cache_hit_rate**：该测试在 XPU 上存在 prefix cache 命中率问题，先跳过以恢复 CI 绿，待修复后重新启用。[[PR #57301](https://github.com/vllm-project/vllm/pull/57301)]
- **[SGLang] XPU nightly Docker 构建支持指定分支/标签**：`release-docker-intel-xpu-nightly.yml` 原先硬编码 `SG_LANG_BRANCH=main`，现在允许通过 workflow 参数覆盖分支或标签，便于从 release 分支发布镜像。[[PR #39796](https://github.com/sgl-project/sglang/pull/39796)]

## 驱动、内核与图形栈 (Windows 驱动 / Linux drm/xe / Mesa ANV)

- **[Compute Runtime] 26.35.39758.11 发布**：IGC 版本更新至 v2.41.9，延续 MemOpt 的 SubDWord 合并启发式迭代。[[Release](https://github.com/intel/compute-runtime/releases/tag/26.35.39758.11)]
- **[Compute Runtime] 26.35.39758 系列引入 LEO 与 PISA**：Phoronix 报道该版本为 Nova Lake 启用 LEO（Low-power Engine Offload），并引入 Intel Portable ISA（PISA）抽象，为跨代 GPU 统一指令集铺路。[[Phoronix](https://www.phoronix.com/news/Intel-Compute-Runtime-26.35.397)]
- **[Level Zero] Loader v1.34.0 发布**：oneAPI Level Zero Loader 新版本，包含驱动加载与设备发现相关的修复与增强。[[Release](https://github.com/oneapi-src/level-zero/releases/tag/v1.34.0)]
- **[Linux NPU 驱动] 新增 command-queue priority ioctl**：drm-misc-next 拉取请求为 Intel NPU 驱动添加命令队列优先级控制，面向 Linux 7.4 合并窗口。[[Phoronix](https://www.phoronix.com/news/Intel-NPU-Linux-7.4-CQ-Priority)]

## 社区实测与生态动态

- **[IGCIT] The Legend of California 误拒 Arc A770 mesh shader**：用户报告该游戏在 Arc A770 上被错误判定不支持 mesh shader，导致功能受限。[[Issue #1559](https://github.com/IGCIT/Intel-GPU-Community-Issue-Tracker-IGCIT/issues/1559)]
- **[IGCIT] The Isle (Evrima) 在 Arc A750 上严重低帧率与卡顿**：社区反馈该游戏在 Arc A750 上存在性能问题，等待驱动优化。[[Issue #1558](https://github.com/IGCIT/Intel-GPU-Community-Issue-Tracker-IGCIT/issues/1558)]
- **[IGCIT] 自定义风扇曲线下风扇偶发不启动**：用户报告在 Intel Graphics Software 中设置自定义风扇曲线后，风扇有时无法按预期启动。[[Issue #1525](https://github.com/IGCIT/Intel-GPU-Community-Issue-Tracker-IGCIT/issues/1525)]
- **[Reddit] 双 B70 配置讨论**：社区用户分享双 B70 显卡的搭建经验，涉及多卡拓扑与驱动识别问题。[[链接](https://www.reddit.com/r/IntelArc/comments/1wixucm/dual_b70_setup/)]
- **[Reddit] B580 供应情况讨论**：用户询问 ASRock Challenger Arc B580 是否为唯一仍在生产的型号，并讨论显存短缺对供应的影响。[[链接](https://www.reddit.com/r/IntelArc/comments/1wip26b/is_the_asrock_challenger_arc_b580_the_only_b580/)]