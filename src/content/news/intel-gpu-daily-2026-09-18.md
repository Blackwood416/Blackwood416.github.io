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

- **Intel Compute Runtime 26.35.39758.11 发布**：IGC 版本锁定至 v2.41.9，同时 Phoronix 报道该版本为 Nova Lake 引入 LEO 支持并推出 Intel Portable ISA（PISA）。
- **vLLM XPU 三连合入**：修复 Qwen DFlash 上下文键归一化、启用 XPU 的 EPLB 通信器、跳过 CI 中失败的 prefix cache 测试。
- **Level Zero Loader v1.34.0 发布**：oneAPI 生态底层加载器迎来新版本，为后续驱动与运行时适配提供基础。

## 下游优化与加速库 (intel/llm-scaler / Triton / OpenVINO)

- **[llm-scaler] SGLang XPU MTP 支持 temperature > 0**：此前 XPU 上的投机解码（MTP）仅支持 greedy 采样，因为 `sgl_kernel` 中的 `top_k_renorm_prob`、`top_p_renorm_prob` 和 `tree_speculative_sampling_target_only` 仅针对 CUDA/MUSA 构建。该 PR 为 XPU 路径补齐了首个采样器实现，使 MTP 在非零温度下可用。[[PR #719](https://github.com/intel/llm-scaler/commit/38d9a3dbbfecd3a5293a8acd75efef54f9bb3719)]
- **[llm-scaler] 消除 FP8 residual router 竞态**：修复异步 FP8 路由消费链中的竞态条件，并新增覆盖异步 FP8 router 消费链的测试。[[PR #717](https://github.com/intel/llm-scaler/commit/1fa01ff4b54d3b3e777e38c03c1feb8434375403)]
- **[Triton XPU] vLLM XPU kernels 改用 release 固定版本**：`vllm_xpu_kernels` 已适配新 PyTorch，该 PR 恢复从 vLLM 官方 pin 的 release 安装该包，简化 CI 脚本并移除手动删除依赖的逻辑。[[PR #8024](https://github.com/intel/intel-xpu-backend-for-triton/commit/ac39409b1a6fb4d7594b0f51fb57cacd397e85a3)]
- **[Triton XPU] vllm-spec-decode 测试套件补装 torch vision**：修复 `vllm-spec-decode` 测试套件因缺少 torch vision 依赖导致的失败。[[PR #8082](https://github.com/intel/intel-xpu-backend-for-triton/commit/605a95a02664057949fed8132a1a53a5e918247e)]
- **[Triton XPU] spirv_utils 缓存键加入 PyTorch-injection 标志**：`spirv_utils` 在 `INJECT_PYTORCH=True` 时以 `-DTRITON_INTEL_INJECT_PYTORCH=1` 编译，每个 kernel launch 会包裹 `RECORD_FUNCTION`。此前缓存键未区分该标志，导致不同配置下可能复用错误缓存。[[PR #8041](https://github.com/intel/intel-xpu-backend-for-triton/commit/bfa21c283c64a0c4d125153e06c3d927711c6686)]
- **[Triton XPU] spirv-llvm-translator 版本自动更新**：github-bot 自动提交更新 translator commit id。[[PR #8091](https://github.com/intel/intel-xpu-backend-for-triton/commit/63c18440bc6ddd31cbcfb231293da55a2a1ee5bb)]
- **[OpenVINO GenAI] 2026.4.0.0 发布**：新版本发布，具体变更内容待官方 release notes 补充。[[Release](https://github.com/openvinotoolkit/openvino.genai/releases/tag/2026.4.0.0)]

## 主流框架与上游集成 (PyTorch / vLLM / SGLang / llama.cpp / Ollama)

- **[vLLM] 修复 Qwen DFlash 上下文键归一化错误**：DFlash 将每层 K-norm 权重堆叠后调用 `rms_norm`，输入形状为 `[num_layers, num_context_tokens, num_kv_heads, head_dim]`，权重为 `[num_layers, head_dim]`。现有 XPU kernel 错误地将权重视为单层，导致归一化结果错误。该 PR 修正了 kernel 对层维度的处理。[[PR #56431](https://github.com/vllm-project/vllm/pull/56431)]
- **[vLLM] 启用 XPU EPLB（Expert Parallel Load Balancing）**：新增 `TorchDistXCCLStagedEplbCommunicator`，支持在 XPU 上使用 torch_xccl 和 torch_gloo 进行专家并行负载均衡。测试模型为 Qwen3-30B-A3B。[[PR #44987](https://github.com/vllm-project/vllm/pull/44987)]
- **[vLLM] CI 跳过 test_hybrid_prefix_cache_hit_rate**：该测试在 XPU 上存在 prefix cache hit rate 问题，先跳过以恢复 CI 绿，待修复后重新启用。[[PR #57301](https://github.com/vllm-project/vllm/pull/57301)]
- **[SGLang] XPU nightly docker 构建支持指定分支/标签**：`release-docker-intel-xpu-nightly.yml` 原先硬编码 `SG_LANG_BRANCH=main`，无法从 release 分支构建镜像。该 PR 增加可选分支/标签覆盖参数。[[PR #39796](https://github.com/sgl-project/sglang/pull/39796)]

## 驱动、内核与图形栈 (Windows 驱动 / Linux drm/xe / Mesa ANV)

- **[Compute Runtime] 26.35.39758.11 发布**：IGC 版本更新至 v2.41.9，与昨日报道的 IGC 补丁迭代保持一致。[[Release](https://github.com/intel/compute-runtime/releases/tag/26.35.39758.11)]
- **[Compute Runtime] Nova Lake 支持 LEO，引入 Intel Portable ISA（PISA）**：Phoronix 报道 26.35.39758.10 版本为 Nova Lake 启用 LEO（Low-power Engine Offload），并引入 PISA 作为跨架构可移植 ISA 抽象。[[Phoronix](https://www.phoronix.com/news/Intel-Compute-Runtime-26.35.397)]
- **[Level Zero Loader] v1.34.0 发布**：oneAPI Level Zero 加载器新版本，为驱动与运行时提供更新基础。[[Release](https://github.com/oneapi-src/level-zero/releases/tag/v1.34.0)]
- **[Linux NPU 驱动] 新增 command-queue priority ioctl**：drm-misc-next 拉取请求为 Linux 7.4 合并窗口准备，为 Intel NPU 驱动添加命令队列优先级控制。[[Phoronix](https://www.phoronix.com/news/Intel-NPU-Linux-7.4-CQ-Priority)]

## 社区实测与生态动态

- **[IGCIT] Arc A770 被错误拒绝 mesh shader**：游戏《The Legend of California》在 Arc A770 上被驱动错误地判定不支持 mesh shader，已提交 issue 追踪。[[Issue #1559](https://github.com/IGCIT/Intel-GPU-Community-Issue-Tracker-IGCIT/issues/1559)]
- **[IGCIT] Arc A750 运行《The Isle (Evrima)》严重低帧率与卡顿**：游戏优化问题已提交，等待驱动侧分析。[[Issue #1558](https://github.com/IGCIT/Intel-GPU-Community-Issue-Tracker-IGCIT/issues/1558)]
- **[IGCIT] 各向异性过滤开启时出现画质伪影**：游戏《Gamble With Your Friends》在开启 AF 后出现伪影，已提交 issue。[[Issue #1478](https://github.com/IGCIT/Intel-GPU-Community-Issue-Tracker-IGCIT/issues/1478)]
- **[社区实测] Arc Pro B70 四个月使用报告**：Reddit 用户分享 Arc Pro B70（32GB VRAM）在 LLM 推理表现良好，但对 AI 视频生成场景的体验提出疑问。[[Reddit](https://www.reddit.com/r/IntelArc/comments/1wje1qo/intel_arc_pro_b70_32gb_vram_after_4_months_great/)]
- **[社区反馈] Arc 130v 驱动问题临时修复**：用户分享针对 Arc 130v 驱动问题的临时 workaround，涉及特定配置调整。[[Reddit](https://www.reddit.com/r/IntelArc/comments/1wjei06/sorta_a_fix_for_problematic_arc_130v_driver_issues/)]
- **[社区反馈] B580 Rebar 不工作**：用户报告 B580 上 Rebar（Resizable BAR）无法启用，影响部分游戏性能。[[Reddit](https://www.reddit.com/r/IntelArc/comments/1wjddci/b580_rebar_not_working/)]
- **[社区反馈] Linux 下 Overwatch 原生分辨率黑屏**：Arc 显卡在 Linux 上运行 Overwatch 时，原生分辨率下出现黑屏问题。[[Reddit](https://www.reddit.com/r/IntelArc/comments/1wjbu3v/black_screen_native_resolution_overwatch_on_linux/)]