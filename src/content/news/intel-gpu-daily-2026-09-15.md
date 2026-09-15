---
title: "Intel GPU 技术生态日报 (2026-09-15)"
description: "今日 Intel GPU 动态速览：包含驱动内核演进、算子与推理引擎适配进展。"
pubDate: "2026-09-15T08:30:00.000Z"
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

- **Triton XPU 后端新增 `OptimizeLoadMasks` pass**，消除 Inductor 生成内核中的冗余内存读取，并修复 `HoistLayoutConversions` 的 GRF 预算单位不匹配问题。
- **intel/llm-scaler 修复 gemma-4 GGUF 加载**，处理量化线性层 `qweight` 属性缺失导致的 fp8 ESIMD 快速路径崩溃。
- **社区实测单卡 Arc Pro B70 运行 Qwen3.8-Flash-Next 125B-A6B 1-bit 量化**，达到 42.7 tok/s 吞吐。

## 下游优化与加速库 (intel/llm-scaler / Triton / OpenVINO)

- **[llm-scaler] SGLang launcher 启用 Qwen GGUF MTP 验证**：为 SGLang 启动器新增 Qwen GGUF 多 token 预测（MTP）验证开关，使用 `SGL_XPU` 前缀的环境变量控制，并保留旧版启动路径的兼容性。[[PR #702](https://github.com/intel/llm-scaler/commit/d41d3bf5cf588ce1c18a16869ea3f9540428844a)]
- **[llm-scaler] 修复 gemma-4 GGUF 模型加载**：GGUF 量化线性层注册的是 `qweight` 而非 `weight`，导致 fused fp8 ESIMD 快速路径在属性探测时抛出 AttributeError。该补丁修正了属性访问逻辑，使 gemma-4 GGUF 检查点可正常加载。[[PR #706](https://github.com/intel/llm-scaler/commit/f4575469c1e85d023e9ae00238b0d4a3a0621041)]
- **[Triton XPU] 新增 `OptimizeLoadMasks` pass**：该 pass 移除 Inductor 生成内核中不必要的内存读取。Inductor 通常对同一索引范围检查两次——一次作为 `tt.load` 的 mask，一次作为 `arith.select` 的条件——此优化可消除重复的越界检查读取。[[PR #7997](https://github.com/intel/intel-xpu-backend-for-triton/commit/834298fc1639284522ee1f06a5410846f5237f7c)]
- **[Triton XPU] 修复 `HoistLayoutConversions` GRF 预算计算**：修复两个独立 bug：GRF 预算单位不匹配（字节 vs 元素），以及成本核算仅考虑加法而忽略乘法等非加法操作。该问题影响寄存器压力门控的准确性，可能导致布局转换提升决策错误。[[PR #7933](https://github.com/intel/intel-xpu-backend-for-triton/commit/b45a6312fb5e2eff31517a92c147da4a9f892227)]
- **[Triton XPU] 限制 LTS 驱动下 `TORCH_XPU_ARCH_LIST` 为 `pvc`**：更新 PyTorch pin 版本，并在使用 LTS 驱动时将 `TORCH_XPU_ARCH_LIST` 限制为 `pvc`，避免在非 PVC 架构上触发不兼容的代码路径。[[PR #7884](https://github.com/intel/intel-xpu-backend-for-triton/commit/ad9191eb97ee0dbadd57e0a029457649c96883e4)]
- **[Triton XPU] CI 跳过 IGC 2.40.x 上导致 GPU 挂死的 flex attention 测试**：`test_kernel_options_argument_is_respected` 在 IGC 2.40.13 上编译运行 flex attention 内核后会导致 GPU 挂死，CI 中暂时跳过该测试。[[PR #8039](https://github.com/intel/intel-xpu-backend-for-triton/commit/729ff6dbafb4311667cf9ff9cbd1d4c87f11fa5f)]

## 主流框架与上游集成 (PyTorch / vLLM / SGLang / llama.cpp / Ollama)

- **[vLLM] XPU CI 固定 gpt-oss 包版本**：`pip compile` 解析到 gpt-oss 0.0.9 但该版本存在精度问题，手动 pin 回 0.0.8 以与 `cuda.txt` 对齐，避免 CI 中因版本漂移导致的精度回归。[[PR #56783](https://github.com/vllm-project/vllm/pull/56783)]
- **[Triton XPU] unified-attention Blockm autotune 剪枝逻辑修复**：原剪枝规则强制 BLOCK_M 配置使 BLOCK_Q 为 2 的幂，但非 TD 路径和 USE_... 场景并不需要此约束。修复后放宽限制，允许更多 BLOCK_M 配置参与 autotune。[[PR #7476](https://github.com/intel/intel-xpu-backend-for-triton/commit/dbc5206ffecd2a9f0852c6ed7aaad03aaba92791)]
- **[Triton XPU] spec_decode 测试取消 gated HF 模型跳过**：vLLM 的 spec_decode 测试此前因依赖 gated HF 模型被跳过，现在 CI 中已可正常通过，取消跳过标记。[[PR #7974](https://github.com/intel/intel-xpu-backend-for-triton/commit/a74efcc83cc0444c6c75118895510a9efb091acb)]
- **[Triton XPU] PROTON 移除过时 XPU skip**：`test_scope_metrics_invalid` 此前因依赖 #5727（XPU 启用 Proton metrics API）被跳过，该依赖已通过 #6709 完成，现移除 skip 标记。[[PR #8049](https://github.com/intel/intel-xpu-backend-for-triton/commit/e4418bf9c68cdaec922088181f3007dc8d5a5d21)]

## 驱动、内核与图形栈 (Windows 驱动 / Linux drm/xe / Mesa ANV)

- **[compute-runtime] 26.35.39758.10 修复事件池计数验证**：该版本修复了事件池（event pool）计数验证逻辑，确保在创建事件池时正确校验计数参数，避免潜在的越界或无效配置。[[Release](https://github.com/intel/compute-runtime/releases/tag/26.35.39758.10)]
- **[compute-runtime] 25.18.33578.93 调试器 SBA 跟踪修复**：在单地址空间（single address space）SBA 跟踪中避免使用 GPR0/GPR1 寄存器，防止调试器在特定场景下与内核寄存器分配冲突。[[Release](https://github.com/intel/compute-runtime/releases/tag/25.18.33578.93)]
- **[Linux 内核] 7.3 为 Panther Lake 带来性能提升**：Phoronix 实测显示 Linux 7.3 在 Intel Core Ultra Series 3 "Panther Lake" 和 Framework Laptop 13 Pro 上有性能提升，延续 7.1/7.2 对 Arc B390 Xe3 集显的优化趋势。[[Phoronix](https://www.phoronix.com/review/linux-73-panther-lake)]

## 社区实测与生态动态

- **[社区实测] 单卡 Arc Pro B70 运行 Qwen3.8-Flash-Next 125B-A6B**：用户报告在单张 Intel Arc Pro B70 上以 1-bit 量化（72.5 GB）运行 Qwen3.8-Flash-Next 125B-A6B，达到 42.7 tok/s 的生成速度。该结果展示了 Arc Pro 系列在大模型推理上的单卡能力。[[Reddit](https://www.reddit.com/r/IntelArc/comments/1wghw5d/qwen38flashnext_125ba6b_1bit_725_gb_at_427_toks/)]
- **[社区反馈] B580 运行 Dirt 5 高画质 4K 升采样**：用户分享 B580 在 Dirt 5 高画质设置下从 1440p 升采样至 4K 的实测表现，属于常规游戏性能反馈。[[Reddit](https://www.reddit.com/r/IntelArc/comments/1wgeff2/dirt_5_high_settings_4k_upscaled_from_1440p_on_b580/)]