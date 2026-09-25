---
title: "Intel GPU 技术生态日报 (2026-09-25)"
description: "今日 Intel GPU 动态速览：包含驱动内核演进、算子与推理引擎适配进展。"
pubDate: "2026-09-25T08:30:00.000Z"
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

- **`[Merged]`** **vLLM XPU 修复指针存储溢出与测试对齐问题**：修复 phi-2 测试 OverflowError 及 Qwen2 embedding 测试模板不一致
- **`[Merged]`** **Triton XPU 改进内核启动错误处理与除法安全性**：内核启动异常改为抛出而非中止，isDivisible 拒绝非正除数
- **`[Merged]`** **vLLM XPU 默认启用 XPU Graph 并扩展测试覆盖**：XPU Graph 默认开启，prompt embeds 测试支持 XPU

## 下游优化与加速库 (intel/llm-scaler / Triton / OpenVINO)

- **[vLLM XPU] 修复 Qwen2 embedding 测试中 HF 与 vLLM 输入不一致**：Hfrunner 使用 sentence-transformers 5.7.0 在 XPU 上应用 Qwen chat template，而 Vllmrunner 未应用，导致 embedding 比较断言失败。通过阻止 Sentence Transformers 应用 chat template 对齐输入。 [[PR #58117](https://github.com/vllm-project/vllm/pull/58117)]
  > **影响：** 修复 XPU 上 Qwen2 embedding 测试的 AssertionError，确保测试可靠性。
- **[vLLM XPU] 修复 PromptEmbedsState 存储指针数值导致 OverflowError**：PromptEmbedsState.add_request() 将 GPU data_ptr() 数值存入有符号整数，在 32 位系统上溢出。改为存储指针原始位模式，避免数值转换。 [[PR #54514](https://github.com/vllm-project/vllm/pull/54514)]
  > **影响：** 修复 phi-2 测试在 32 位环境下的 OverflowError，提升跨平台兼容性。
- **[vLLM XPU] 默认启用 XPU Graph 并调整相关逻辑**：PyTorch XPU 2.14 将 XPU Graph 从 SYCL Graph 切换至 Level Zero Graph，解决先前限制。此 PR 默认启用 XPU Graph，以提升小模型和 MoE 模型在低并发下的性能。 [[PR #51600](https://github.com/vllm-project/vllm/pull/51600)]
  > **影响：** 默认开启 XPU Graph，显著提升小模型和 MoE 模型性能，但需注意 Level Zero Graph 的兼容性。
- **[vLLM XPU] 启用 prompt embeds 测试在 XPU 上运行**：test_prompt_embeds_state.py 原本仅限 CUDA，此 PR 扩展至 XPU，使测试覆盖 XPU 平台。 [[PR #58283](https://github.com/vllm-project/vllm/pull/58283)]
  > **影响：** 增加 XPU 测试覆盖，确保 prompt embeds 功能在 XPU 上正确性。

## 主流框架与上游集成 (PyTorch / vLLM / SGLang / llama.cpp / Ollama)

- **[Triton XPU] 内核启动被拒绝时抛出异常而非中止进程**：driver.c 中 launch 调用 sycl_kernel_launch 未捕获异常，SYCL submit 抛出 sycl::exception 时异常逃逸导致进程中止。改为捕获并抛出，使上层可处理。 [[Commit 6a3e4ab](https://github.com/intel/intel-xpu-backend-for-triton/commit/6a3e4ab91311f3bd4f4d4147dbc26cd3d60fb929)]
  > **影响：** 避免内核启动失败时进程崩溃，提升错误可恢复性。
- **[Triton XPU] isDivisible 接受 int64_t 除数并拒绝非正数**：ttgi::isDivisible 原接受 unsigned 除数，零除数导致 SIGFPE。改为 int64_t 并拒绝非正数，防止除零和未定义行为。 [[Commit 5102987](https://github.com/intel/intel-xpu-backend-for-triton/commit/510298701e233ad9c6218eabd62d016adbb1085f)]
  > **影响：** 消除除零崩溃风险，提高编译器健壮性。
- **[Triton XPU] 启用 SGLANG dense attention 单元测试**：上游 dense attention 测试因依赖 torch.cuda.is_available() 和硬编码设备被跳过。此 PR 调整测试条件，使其在 XPU 上运行。 [[Commit 825fb60](https://github.com/intel/intel-xpu-backend-for-triton/commit/825fb6021b3054b18e3e26aafefa80e65e58f350)]
  > **影响：** 增加 XPU 上 dense attention 测试覆盖，验证 SGLANG 后端正确性。
- **[Triton XPU] CI 切换 CodeQL 作业到新 runner 标签**：将 CodeQL 作业从旧 runner 标签迁移到 cpu/runner-0.0.22，以适配 CI 基础设施更新。 [[Commit cbefab6](https://github.com/intel/intel-xpu-backend-for-triton/commit/cbefab6e1706af792102ec99387d06f5f6074011)]
  > **影响：** 维持 CI 稳定性，确保静态分析持续运行。
- **[Triton XPU] 更新 spirv-llvm-translator 提交引用**：自动化 PR 更新 spirv-llvm-translator 的提交 ID，以同步上游修复和特性。 [[Commit 56c2e8c](https://github.com/intel/intel-xpu-backend-for-triton/commit/56c2e8cb664234a6cd7bf4c6e6edd519c985a12e)]
  > **影响：** 保持与 SPIR-V 翻译器最新版本同步，可能带来编译优化或修复。

## 社区实测与生态动态

- **[Intel LLVM] sycl-web/status 发布标记为 HALT**：该 release 标记为 HALT，可能表示 sycl-web 状态页面或相关服务暂停，但无详细说明。 [[Release sycl-web/status](https://github.com/intel/llvm/releases/tag/sycl-web%2Fstatus)]
  > **影响：** 可能影响开发者获取 SYCL 状态信息，但具体影响不明。