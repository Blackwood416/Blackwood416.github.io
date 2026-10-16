---
title: "Intel GPU 技术生态日报 (2026-10-16)"
description: "今日 Intel GPU 动态速览：包含驱动内核演进、算子与推理引擎适配进展。"
pubDate: "2026-10-16T08:30:00.000Z"
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

- **`[Merged]`** **Intel Triton 后端适配上游负零掩码加载变更**：适配上游负零掩码加载语义，确保 XPU 后端行为一致。
- **`[Merged]`** **vLLM XPU 集成 MLA 后端并修复测试**：XPU MLA 集成至 FLASH_ATTN_MLA，并取消多个测试跳过。
- **`[Merged]`** **Intel 驱动发布 101.9150 WHQL 并确认 Nova Lake SR-IOV**：新驱动优化游戏性能，Nova Lake S/P 支持 Xe SR-IOV。

## 下游优化与加速库 (intel/llm-scaler / Triton / OpenVINO)

- **[vLLM XPU] Unskip watermarking tests fixed by vLLM pin update**：之前因 vLLM 旧 pin 的 API 不匹配而跳过的 watermarking 测试，在更新 vLLM pin 后已通过。该提交取消跳过，恢复测试覆盖。 [[PR #8425](https://github.com/intel/intel-xpu-backend-for-triton/commit/b114fa0eda126bd4f6fa19b9a7024ab3545b1e9f)]
  > **影响：** 恢复 vLLM XPU 的 watermarking 测试，提升 CI 覆盖完整性。
- **[SGLang XPU] Unskip test_extend_attention_sliding_window**：滑动窗口注意力扩展测试此前因 XPU 实现问题被跳过，现已修复并取消跳过。 [[PR #8367](https://github.com/intel/intel-xpu-backend-for-triton/commit/256d639fe143228362653451c7075dc081a04f78)]
  > **影响：** 恢复 SGLang XPU 的滑动窗口注意力测试覆盖，验证相关功能。
- **[vLLM XPU] Skip modelopt_fp4 online MoE re-quantization test on XPU**：XPU 不支持 modelopt_fp4 基础量化格式，因此跳过该在线重量化测试。这是平台能力限制导致的测试跳过。 [[PR #61723](https://github.com/vllm-project/vllm/pull/61723)]
  > **影响：** 避免 XPU 上运行不支持的测试，但功能缺失仍存在。
- **[vLLM XPU] Ignore test_reload.py on Intel CI**：XPU 不支持多种模型路径的模型重载，因此整个 test_reload.py 在 Intel CI 上被忽略。 [[PR #61740](https://github.com/vllm-project/vllm/pull/61740)]
  > **影响：** 避免 CI 失败，但模型重载功能在 XPU 上仍不可用。
- **[vLLM XPU] Integrate XPU MLA support into existing FLASH_ATTN_MLA backend**：将 XPU 的 MLA 支持集成到 FLASH_ATTN_MLA 后端，遵循 FLASH_ATTN 的平台特定集成模式，添加 XPU 专用 FlashAttnMLA 后端。 [[PR #58297](https://github.com/vllm-project/vllm/pull/58297)]
  > **影响：** 为 XPU 提供 MLA 注意力支持，扩展 vLLM 在 Intel 平台上的模型兼容性。
- **[SGLang XPU] Support Gemma-3 bidirectional image attention in XPUAttentionBackend**：Gemma-3 多模态在 prefill 阶段对图像 token 使用双向注意力，SGLang 通过密集掩码实现。XPU 后端需支持该掩码模式。 [[PR #39805](https://github.com/sgl-project/sglang/pull/39805)]
  > **影响：** 使 SGLang 在 XPU 上支持 Gemma-3 多模态模型，扩展功能。

## 主流框架与上游集成 (PyTorch / vLLM / SGLang / llama.cpp / Ollama)

- **[Triton XPU] Adapt Intel backend to upstream negative zero masked load changes**：上游 Triton 修改了掩码加载对负零的处理语义，Intel 后端需同步调整以保持行为一致。该提交适配了相关变更，确保 XPU 后端在掩码加载时正确处理负零值。 [[commit 9aa8d53](https://github.com/intel/intel-xpu-backend-for-triton/commit/9aa8d530ddc670fc25129d9906a5a4ea478cc653)]
  > **影响：** 保证 Intel XPU 后端与上游 Triton 语义一致，避免因负零处理差异导致的数值错误。
- **[Triton XPU Runtime] Put remaining Intel knob env vars in compile cache key**：编译缓存键未包含所有 Intel 特定的环境变量，导致不同配置下可能错误复用缓存。该提交将剩余的环境变量加入缓存失效逻辑，并添加测试确保覆盖。 [[PR #8410](https://github.com/intel/intel-xpu-backend-for-triton/commit/73cb21fedefa82d48409766b4f505050cf504c17)]
  > **影响：** 修复编译缓存误命中问题，确保不同环境变量配置下编译结果正确。
- **[Triton XPU Benchmarks] Compute addmatrix oneDNN baseline with addmm**：oneDNN 基线计算原先使用 mm+add，产生额外 fp32 临时张量。改用 addmm 直接计算，减少内存开销并更贴近实际算子。 [[PR #8429](https://github.com/intel/intel-xpu-backend-for-triton/commit/f3fdba120612e384b74204a69eea7a9eac4e8c5c)]
  > **影响：** 提升基准测试准确性，减少内存占用，使 oneDNN 基线更公平。
- **[Triton XPU Build] Limit Python install workers**：Python 安装时 compileall -j0 会生成数百个 worker，忽略 CPU 亲和性。限制 worker 数量为 min(8, 可用 CPU, cgroup 配额)，并回退 COMPILEALL_OPTS。 [[PR #8414](https://github.com/intel/intel-xpu-backend-for-triton/commit/2e51233437dab37db7a1007ee22c4608ae459d0f)]
  > **影响：** 减少构建时的资源争抢，避免系统过载，提升构建稳定性。
- **[Triton XPU Benchmarks] Compute torch reference in fp32 and tighten GEMM rtol**：GEMM 基准的 torch 参考原先在 bf16 上计算，导致精度损失。改为 fp32 计算参考，并收紧 rtol 以更严格评估性能。 [[PR #8415](https://github.com/intel/intel-xpu-backend-for-triton/commit/faf5bb030da2bc0c2bd668aa0941350f724105fa)]
  > **影响：** 提高基准测试的数值准确性，更严格地评估 GEMM 实现。
- **[Triton XPU Benchmarks] Keep addmatrix torch reference in fp32**：addmatrix 基准的 torch 参考使用 in-place add_，导致 fp32 的 d 被降为 bf16。改为保持 fp32 计算，避免精度损失。 [[PR #8416](https://github.com/intel/intel-xpu-backend-for-triton/commit/3dcb9e7f06cbb04b0e65412b538a7d1c6059ab98)]
  > **影响：** 修复基准参考精度问题，使对比更准确。
- **[Triton XPU Compiler] Fix nested-region live-through pressure undercounting**：RegisterPressureAnalysis 在嵌套区域中低估了 live-through 压力，导致布局提升决策不准确。修复了 peakPressure 的计算，确保压力统计完整。 [[PR #8159](https://github.com/intel/intel-xpu-backend-for-triton/commit/582b2cf1aaee78650eba5c5b624ad79eaefb58d1)]
  > **影响：** 改善寄存器压力分析，提升布局转换决策质量，可能带来性能提升。

## 驱动、内核与图形栈 (Windows 驱动 / Linux drm/xe / Mesa ANV)

- **[Linux drm/xe] Intel Nova Lake S & P to support SR-IOV with Xe graphics**：Intel 工程师向内核邮件列表提交补丁，确认 Nova Lake S 和 P 的集成显卡将支持 SR-IOV，配合 Xe 驱动。 [[Phoronix](https://www.phoronix.com/news/Intel-Nova-Lake-SR-IOV-Xe)]
  > **影响：** 为 Nova Lake 平台带来虚拟化支持，有利于云游戏和虚拟化场景。
- **[Windows 驱动] Intel Arc GPU Graphics Drivers 101.9150 WHQL Released**：Intel 发布 Arc GPU 驱动 101.9150 WHQL，针对《使命召唤：现代战争4》和《动物园之星2》进行优化，并包含模型特定和游戏特定性能改进。 [[TechPowerUp](https://www.techpowerup.com/353742/intel-arc-gpu-graphics-drivers-101-9150-whql-released)]
  > **影响：** 提升游戏性能和稳定性，为 Arc 用户提供更好的体验。