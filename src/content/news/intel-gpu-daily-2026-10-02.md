---
title: "Intel GPU 技术生态日报 (2026-10-02)"
description: "今日 Intel GPU 动态速览：包含驱动内核演进、算子与推理引擎适配进展。"
pubDate: "2026-10-02T08:30:00.000Z"
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

- **`[Merged]`** **Triton XPU 寄存器预算按目标架构自适应**：GRF 模式默认寄存器预算改为按目标架构计算，修复未知 GRF 大小回退问题。
- **`[Merged]`** **Triton XPU 修复 fp16->bf16 转换舍入模式**：新增 fp16 到 bf16 类型转换的舍入模式支持，提升数值精度。
- **`[Merged]`** **Triton XPU 修复 AccelerateMatmul 转置丢失 k_pack 标志**：转置 scaled dot 时保留 lhs/rhs_k_pack 标志，避免性能退化。

## 下游优化与加速库 (intel/llm-scaler / Triton / OpenVINO)

- **[vLLM XPU] unified_attention 包装函数改用 3D 参数调用**：unified_attention 内核有 2D 和 3D 路径，编译时折叠其一。包装函数根据参数维度决定路径，但之前未正确传递 3D 参数，导致路径选择错误。该提交修正调用方式。 [[commit 9a78870](https://github.com/intel/intel-xpu-backend-for-triton/commit/9a7887083dfd7ea294cbb91c3c12716a34a82555)]
  > **影响：** 修复 vLLM 中 attention 内核路径选择错误，确保 3D 输入正确使用对应实现。
- **[vLLM XPU] vLLM 测试改为每日运行**：由于 vLLM 测试已从 B580 迁移到 B60，运行频率从每周改为每日，以更早发现回归。关闭 issue #7719。 [[commit 90bbba3](https://github.com/intel/intel-xpu-backend-for-triton/commit/90bbba342fe5a53aeb57d1b392fde6558b8c3a90)]
  > **影响：** 提高测试频率，加速问题发现，但非功能修复。
- **[vLLM XPU] 取消 MRv2 compute_prompt_logprobs 测试跳过**：之前因问题 #7159 跳过的 MRv2 compute_prompt_logprobs 测试现已取消跳过，表明底层问题已解决。 [[commit 5989e76](https://github.com/intel/intel-xpu-backend-for-triton/commit/5989e76b35b1d3026e49792e758a3bc7990eac08)]
  > **影响：** 恢复测试覆盖，验证相关功能已正常。
- **[SGLang XPU] 修复 defer_expansion 变更后的 XPU 测试**：PR #40972 修改了 QSAIndexer._forward_impl 传递 defer_expansion 参数，但只更新了 CUDA 测试的 fake _DispatchIndexer，XPU 副本未同步，导致测试失败。该 PR 同步更新 XPU 测试。 [[PR #41915](https://github.com/sgl-project/sglang/pull/41915)]
  > **影响：** 修复 XPU 测试失败，保持测试一致性。

## 主流框架与上游集成 (PyTorch / vLLM / SGLang / llama.cpp / Ollama)

- **[Triton XPU] 默认/自动 GRF 模式寄存器预算改为目标感知**：RegisterPressureAnalysis 中 getGRFBytesPerHardwareThread 的未知 GRF 大小回退值未考虑目标架构，导致默认/自动 GRF 模式下的寄存器预算不准确。该提交使回退值基于目标架构计算，关闭 issue #8074。 [[commit 885e1a4](https://github.com/intel/intel-xpu-backend-for-triton/commit/885e1a4ec60751ed8a003335dccb679f9243ad86)]
  > **影响：** 提升默认 GRF 模式下的寄存器分配准确性，可能改善内核性能与编译稳定性。
- **[Triton XPU] 支持 fp16 到 bf16 转换的舍入模式**：新增 fp16 到 bf16 类型转换的 lowering 支持，包括舍入模式选项，使转换行为与硬件指令一致，避免默认截断导致的精度损失。 [[commit 4da7bb9](https://github.com/intel/intel-xpu-backend-for-triton/commit/4da7bb9402c6cdebe18185693faed8d658165437)]
  > **影响：** 提高数值精度，尤其对需要精确类型转换的模型推理和训练场景有益。
- **[Triton XPU] AccelerateMatmul 转置 scaled dot 时保留 k_pack 标志**：transposeDotScaledOp 重建 tt.dot_scaled 时未传递 lhs/rhs_k_pack 标志，导致转置后丢失打包信息，可能影响性能。该提交移植自 triton-lang/triton#11613，修复标志传递。 [[commit f9be5a7](https://github.com/intel/intel-xpu-backend-for-triton/commit/f9be5a704f540a9a0381462986210152f15bc59c)]
  > **影响：** 修复转置 scaled dot 时的性能退化，确保打包优化在转置后依然生效。
- **[Triton XPU] 修复 scf.while 循环结果传播错误**：scf.while 的 do-block yield 应馈送给 before-region 参数而非循环结果，两者可能 arity 和类型不同。该提交移植 triton-lang/triton#11558，修复错误传播，关闭 issue #8189。 [[commit b9d0c7c](https://github.com/intel/intel-xpu-backend-for-triton/commit/b9d0c7c9541584187277e30820e6b7c01798e7f3)]
  > **影响：** 修复涉及 scf.while 的编译错误，提升循环结构处理的正确性。
- **[Triton XPU] 跳过不支持的分布式 MoE 测试**：由于 issue #8179 中分布式 MoE 存在未支持的情况，相关测试被跳过，以避免 CI 失败。 [[commit 91e9b80](https://github.com/intel/intel-xpu-backend-for-triton/commit/91e9b80db42dce365c75f9771576b55e8a50b6c7)]
  > **影响：** 临时跳过测试，掩盖已知问题，非根本修复。
- **[Triton XPU] CI 添加并发组以优化构建流程**：为 build-windows.yml 和 spirvrunner-test.yml 添加 concurrency groups，避免重复 CI 运行，节省资源。 [[commit 8061b19](https://github.com/intel/intel-xpu-backend-for-triton/commit/8061b19f2e7a94fef5556d513ad01ff7541556f4)]
  > **影响：** 优化 CI 资源使用，非功能修复。
- **[Triton XPU] 文档规则文件添加路径作用域**：将 .claude/rules 文件的 glob 声明从 applyTo 改为 paths 前端键，以正确限定作用域，避免规则误应用于其他路径。 [[commit 7349c1e](https://github.com/intel/intel-xpu-backend-for-triton/commit/7349c1e58e10318bea4577f19d102fbf6bb34e35)]
  > **影响：** 改善开发工具规则作用域，非运行时功能。

## 驱动、内核与图形栈 (Windows 驱动 / Linux drm/xe / Mesa ANV)

- **[Intel Graphics Compiler] IGC v2.41.11 发布**：Intel Graphics Compiler 发布 v2.41.11，包含代码变更，具体内容未在摘要中说明。 [[IGC v2.41.11](https://github.com/intel/intel-graphics-compiler/releases/tag/v2.41.11)]
  > **影响：** 驱动更新，可能包含编译优化和 bug 修复。
- **[Intel Compute Runtime] Compute Runtime 26.35.39758.13 发布**：Compute Runtime 更新到 26.35.39758.13，同步 IGC 版本至 v2.41.11。 [[compute-runtime 26.35.39758.13](https://github.com/intel/compute-runtime/releases/tag/26.35.39758.13)]
  > **影响：** 驱动更新，与 IGC 版本对齐。

## 社区实测与生态动态

- **[Intel GPU Community Issue Tracker] 游戏 Seed of the Dead 启动崩溃报告**：用户报告游戏 Seed of the Dead: Complete Edition 启动时崩溃，错误码 0x887A0020，可能为图形驱动问题，但根因未确认。 [[IGCIT issue #1575](https://github.com/IGCIT/Intel-GPU-Community-Issue-Tracker-IGCIT/issues/1575)]
  > **影响：** 社区问题报告，等待官方调查。