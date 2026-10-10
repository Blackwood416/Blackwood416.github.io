---
title: "Intel GPU 技术生态日报 (2026-10-10)"
description: "今日 Intel GPU 动态速览：包含驱动内核演进、算子与推理引擎适配进展。"
pubDate: "2026-10-10T08:30:00.000Z"
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

- **`[Merged]`** **SGLang XPU 全面支持 DSA prefill/decode、topk sgl-kernel 与 MTP 推测解码**：SGLang 合入 XPU 杂项改动，启用 DSA 注意力后端、topk 内核及 MTP 推测支持。
- **`[Merged]`** **vLLM XPU 修复多模态输入归一化与 W4A8 权重残留问题**：修复 fused_input_norm 对 MM 模型路径，并清理 repack 后旧权重以省显存。
- **`[Merged]`** **Triton XPU 层归一化示例改用小 GRF 模式并动态调整 warp 数**：05-layer-norm 示例切换 GRF 128 并随 BLOCK_SIZE 缩放 num_warps 以提升性能。

## 下游优化与加速库 (intel/llm-scaler / Triton / OpenVINO)

- **[SGLang XPU] [XPU] Misc changes to support XPU**：该 PR 为 SGLang 在 XPU 上启用 intel_xpu attention backend 的 DSA prefill/decode 路径，并将 topk 的 sgl-kernel 标记为 XPU 支持，同时更新单元测试。此外，启用 Hy3 模型在 XPU 上的 MTP/推测解码支持，并调整 fused_experts API 以匹配最新接口。改动涉及多个模块的适配，属于功能扩展。 [[PR #39817](https://github.com/sgl-project/sglang/pull/39817)]
  > **影响：** 扩展 SGLang 在 Intel XPU 上的模型支持范围，提升 DSA 注意力与 topk 内核的可用性，并支持 MTP 推测解码，增强推理性能。
  > 🔗 **续报（关联 2026-09-17 日报）：** 事件跟踪【SGLang XPU MTP (多 Token 预测) 适配演进】新进展（此前阶段：初步支持 DeepSeek MTP 结构在 XPU 上的推理）。
- **[vLLM XPU] [XPU] fix fused_input_norm for MM**：PR #59195 的改动导致多模态模型的 mm_input_norm 在 XPU 上路径错误。此修复使非 uint8 数据类型走 Triton kernel 路径（与 CUDA 一致），uint8 则使用 xpu_fused_input_norm，并添加了禁用测试。根因是上游改动未考虑 XPU 分支，属于回归修复。 [[PR #59865](https://github.com/vllm-project/vllm/pull/59865)]
  > **影响：** 修复多模态模型在 XPU 上的输入归一化错误，确保与 CUDA 行为一致，避免精度问题。
- **[vLLM XPU] [Bugfix][XPU] Remove stale W4A8 weight after repacking**：XPUW4A8IntLinearKernel 在 process_weights_after_loading() 中将 checkpoint 格式的 W4A8 权重重打包为运行时 weight_packed 参数后，未释放原始未打包权重，导致显存泄漏。此修复在重打包后释放旧权重，修复 issue #57503。 [[PR #57511](https://github.com/vllm-project/vllm/pull/57511)]
  > **影响：** 减少 W4A8 模型加载时的显存占用，避免因权重残留导致的显存不足问题。
- **[vLLM XPU] [TEST][XPU][CI] Fix ci uva kernel test instability 2**：这是对 #60041 的后续修复，之前未完全解决 UVA kernel 测试不稳定问题。维护者基于 50 次测试运行验证了新理论，但未明确根因，可能涉及时序或资源竞争。改动属于测试稳定性调整，非根本修复。 [[PR #60404](https://github.com/vllm-project/vllm/pull/60404)]
  > **影响：** 提高 CI 中 UVA kernel 测试的稳定性，减少误报，但未解决底层潜在问题。
- **[vLLM XPU] [XPU]Fix the accuracy issue when meet topk_ids=-1 on DP+EP scenarios**：在 DP+EP 场景下，MoE 模型的 dummy/padded tokens 被标记为 topk_ids=-1，EP 的 all-gather 将这些 -1 条目分发到每个 rank 的 fused MoE kernel，导致 XPU MoE kernel 处理异常。此修复针对该情况调整内核逻辑，确保正确性。 [[PR #57787](https://github.com/vllm-project/vllm/pull/57787)]
  > **影响：** 修复 DP+EP 下 MoE 模型的精度问题，提升分布式推理的准确性。
- **[vLLM XPU] [XPU] Support register KV offload mmap region as pinned host memory on XPU**：将 CPU KV-cache offloading 路径的 mmap 主机注册扩展到 Intel XPU，并将 CUDA/ROCm 的 cudaHostRegister/cudaHostUnregister 调用抽象为平台分发辅助模块。这使 XPU 也能利用 pinned host memory 加速 KV offload。 [[PR #51956](https://github.com/vllm-project/vllm/pull/51956)]
  > **影响：** 提升 XPU 上 KV cache offload 的性能，减少主机与设备间传输开销。
- **[vLLM XPU] [XPU] fix online fp8_per_channel quantization**：修复 XPU 上 fp8_per_channel 在线量化的问题，放宽限制并添加相应单元测试。具体根因未详述，但属于功能修复。 [[PR #56027](https://github.com/vllm-project/vllm/pull/56027)]
  > **影响：** 使 fp8_per_channel 量化在 XPU 上可用，并增加 CI 覆盖。
- **[vLLM XPU] [XPU] Add tuned Mamba SSU configs for Intel Arc Pro B60**：selective_state_update 的 Triton launch config 按设备 JSON 查找，之前只有 Arc Pro B70 的配置，B60 缺失导致回退到默认配置。此 PR 为 B60 添加调优配置，提升 Mamba 模型性能。 [[PR #56765](https://github.com/vllm-project/vllm/pull/56765)]
  > **影响：** 优化 Intel Arc Pro B60 上 Mamba 模型的推理性能。
- **[SGLang XPU] [XPU] Fix XPU CI breaks from #41105 (KDA chunk_offsets) and #42588 (int4 test tp_group)**：上游 #41105 为 chunk_delta_h.py 添加 chunk_offsets 参数，但 XPU 的 kda.py 使用 XPU override，未同步更新导致 CI 失败。同时 #42588 的 int4 测试 tp_group 问题也需修复。此 PR 修复这些 CI 破坏。 [[PR #43334](https://github.com/sgl-project/sglang/pull/43334)]
  > **影响：** 恢复 SGLang XPU CI 的稳定性，确保 KDA 和 int4 测试通过。
- **[SGLang XPU] [XPU][Diffusion] Plain-torch scale-shift for inductor**：在 XPU 上，LayerNormScaleShift 和 MulAdd 原本调用手写 Triton kernel，但 Inductor 将用户自定义 Triton kernel 视为不透明，无法在编译区域内融合。此 PR 改为纯 torch 实现，使 Inductor 可以融合优化。 [[PR #41885](https://github.com/sgl-project/sglang/pull/41885)]
  > **影响：** 提升扩散模型在 XPU 上的编译优化效果，减少 kernel 启动开销。
- **[SGLang XPU] [XPU] Enable ring attention on XPUAttentionBackend**：为 XPUAttentionBackend 启用 ring attention 支持，扩展了注意力后端的功能。 [[PR #41406](https://github.com/sgl-project/sglang/pull/41406)]
  > **影响：** 使 SGLang 在 XPU 上支持 ring attention，提升长序列处理能力。

## 主流框架与上游集成 (PyTorch / vLLM / SGLang / llama.cpp / Ollama)

- **[Triton XPU] [05-layer-norm] Use small GRF mode and scale num_warps with BLOCK_SIZE**：该提交调整 05-layer-norm 示例：将三个 kernel launch 的 grf_mode 从 256 改为 128，并将固定的 num_warps=32 替换为随 BLOCK_SIZE 缩放。小 GRF 模式可提高占用率，动态 num_warps 适配不同块大小。 [[Commit ed35a9b](https://github.com/intel/intel-xpu-backend-for-triton/commit/ed35a9b9008cdbefe259bfc76159cd2e622a09ef)]
  > **影响：** 优化层归一化示例在 XPU 上的性能，尤其对中小 BLOCK_SIZE 更高效。
- **[Triton XPU] [WIN] Move `import resource` under `is_hip()` condition**：Windows 上 Python 没有 resource 模块，导致导入错误。此提交将 import resource 移到 is_hip() 条件下，避免在非 HIP 平台（如 Windows）导入。 [[Commit bb8ecb3](https://github.com/intel/intel-xpu-backend-for-triton/commit/bb8ecb399f74fe3af3dabc01e95b771578e31778)]
  > **影响：** 修复 Triton XPU 在 Windows 上的导入错误，提升跨平台兼容性。
- **[Triton XPU] [RemoveLayoutConversions] Pin canUseResultEncoding's fixed operands in getConvertBackwardSlice**：修复 issue #8278。自 triton-lang/triton#11758 起，canUseResultEncoding 返回操作数中布局必须固定的集合，但 getConvertBackwardSlice 未固定这些操作数，导致布局转换错误。此提交固定这些操作数。 [[Commit d7a1f42](https://github.com/intel/intel-xpu-backend-for-triton/commit/d7a1f4268f663fb63277ef0da1c3aed2d6274f41)]
  > **影响：** 修复布局转换优化中的潜在错误，提高代码生成正确性。
- **[Triton XPU] [XPU][FPSan] Implement global/profile scratch memory allocation and fix `dot_fma` fpsan test**：为 FPSan（浮点安全检查）实现全局/profile scratch 内存分配，并修复 dot_fma 测试。这使 FPSan 在 XPU 上能正确分配临时内存，确保测试通过。 [[Commit 0a7415b](https://github.com/intel/intel-xpu-backend-for-triton/commit/0a7415b0930e8214e5f9033734809d87f0306f31)]
  > **影响：** 完善 Triton XPU 的浮点安全检查功能，提升数值稳定性验证能力。

## 驱动、内核与图形栈 (Windows 驱动 / Linux drm/xe / Mesa ANV)

- **[Intel GPU 驱动] [Bodycam] [B580] Instability and game crashes**：社区用户报告在 Intel Arc B580 上运行游戏 Bodycam 时出现不稳定和崩溃，使用最新驱动。具体根因未确认，可能与驱动或游戏兼容性有关。 [[Issue #1583](https://github.com/IGCIT/Intel-GPU-Community-Issue-Tracker-IGCIT/issues/1583)]
  > **影响：** 影响 B580 用户游戏体验，需驱动团队进一步调查。

## 社区实测与生态动态

- **[oneDNN] oneDNN v3.13 发布**：oneDNN 发布 v3.13 版本，具体变更未提供摘要，但作为深度学习原语库，新版本通常包含性能优化和 bug 修复。 [[Release v3.13](https://github.com/uxlfoundation/oneDNN/releases/tag/v3.13)]
  > **影响：** 为 Intel 平台上的深度学习应用提供更新的原语库，可能带来性能提升。