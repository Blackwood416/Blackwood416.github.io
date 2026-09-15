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
- **Triton XPU 后端新增 `OptimizeLoadMasks` pass**：消除 Inductor 生成内核中的冗余内存读取，并修复 `HoistLayoutConversions` 的 GRF 预算计算错误。
- **llm-scaler 修复 Gemma-4 GGUF 加载与 Qwen MTP 验证**：解决 GGUF 量化线性层属性缺失导致的 ESIMD 路径崩溃，并新增 MTP 验证开关。
- **compute-runtime 发布两个维护版本**：分别修复事件池计数校验与调试器 SBA 跟踪中的 GPR 冲突问题。

---

## 下游优化与加速库 (intel/llm-scaler / Triton / OpenVINO)

### intel/llm-scaler
- **SGLang launcher 启用 Qwen GGUF MTP 验证**：新增 `SGL_XPU` 前缀的 MTP GDN 选项，用于在启动时验证 Qwen 系列 GGUF 模型的 MTP（Multi-Token Prediction）配置，同时保留旧启动路径的兼容性。[[PR #702](https://github.com/intel/llm-scaler/commit/d41d3bf5cf588ce1c18a16869ea3f9540428844a)]
- **修复 Gemma-4 GGUF 模型加载**：GGUF 量化线性层注册的是 `qweight` 而非 `weight`，导致 fused fp8 ESIMD 快速路径在属性探测时抛出 `AttributeError`。该提交在加载路径中增加对 `qweight` 的兼容处理，使 Gemma-4 GGUF 检查点可正常加载。[[PR #706](https://github.com/intel/llm-scaler/commit/f4575469c1e85d023e9ae00238b0d4a3a0621041)]

### intel-xpu-backend-for-triton
- **新增 `OptimizeLoadMasks` pass**：针对 Inductor 生成内核中重复的边界检查（一次作为 `tt.load` 的 mask，一次作为 `arith.select` 的条件）进行冗余消除，减少不必要的内存读取。该 pass 位于 TritonIntelGPU 优化管线中。[[PR #7997](https://github.com/intel/intel-xpu-backend-for-triton/commit/834298fc1639284522ee1f06a5410846f5237f7c)]
- **修复 `HoistLayoutConversions` 的 GRF 预算计算**：修复两个独立 bug——GRF 预算单位不匹配（bytes vs. registers）以及成本核算仅考虑加法项。此前可能导致布局转换提升决策错误，影响寄存器压力控制。[[PR #7933](https://github.com/intel/intel-xpu-backend-for-triton/commit/b45a6312fb5e2eff31517a92c147da4a9f892227)]
- **CI 调整**：translator pin 候选搜索仅运行 unit + minicore 测试子集以加速筛选；停止在 max1550 上自动运行 SGLang 基准（BMG workflow 已覆盖 b580）；跳过 IGC 2.40.x 上会导致 GPU 挂起的 flex attention 测试；将 gluon/test_core.py 中的 skip 改为 xfail。[[PR #8051](https://github.com/intel/intel-xpu-backend-for-triton/commit/8ea6af563e969afb415f3a73014b2dd70318dea1)] [[PR #8034](https://github.com/intel/intel-xpu-backend-for-triton/commit/4def520322ec0685f6dd5f1b097911e84e25e57f)] [[PR #8039](https://github.com/intel/intel-xpu-backend-for-triton/commit/729ff6dbafb4311667cf9ff9cbd1d4c87f11fa5f)] [[commit cb6b8df](https://github.com/intel/intel-xpu-backend-for-triton/commit/cb6b8df1f08120587e67a2c9902a532583757330)]
- **PyTorch pin 更新与 LTS 驱动限制**：更新 PyTorch 版本引用，并在使用 LTS 驱动时将 `TORCH_XPU_ARCH_LIST` 限制为 `pvc`，避免非 PVC 架构在 LTS 驱动下的兼容性问题。[[PR #7884](https://github.com/intel/intel-xpu-backend-for-triton/commit/ad9191eb97ee0dbadd57e0a029457649c96883e4)]
- **PROTON 移除过时 XPU skip**：`test_scope_metrics_invalid` 此前因依赖未完成的 XPU metrics API 而跳过，该依赖已通过 #6709 完成，现移除 skip 恢复测试。[[PR #8049](https://github.com/intel/intel-xpu-backend-for-triton/commit/e4418bf9c68cdaec922088181f3007dc8d5a5d21)]

---

## 主流框架与上游集成 (PyTorch / vLLM / SGLang / llama.cpp / Ollama)

### vLLM (upstream XPU)
- **CI 固定 gpt-oss 包版本**：`pip compile` 解析到 gpt-oss 0.0.9 存在精度问题，手动回退到 0.0.8 以与 `cuda.txt` 对齐，确保 XPU CI 的测试一致性。[[PR #56783](https://github.com/vllm-project/vllm/pull/56783)]

### intel-xpu-backend-for-triton (vLLM 集成)
- **unified-attention BlockM autotune 剪枝逻辑修复**：原剪枝规则强制 BLOCK_Q 为 2 的幂，这对非 TD 路径和 USE 路径并非必要。修复后放宽限制，允许更多 BLOCK_M 配置参与 autotune。[[PR #7476](https://github.com/intel/intel-xpu-backend-for-triton/commit/dbc5206ffecd2a9f0852c6ed7aaad03aaba92791)]
- **spec_decode 测试取消跳过**：依赖 gated HF 模型的 spec_decode 测试在 CI 中已可正常通过，现取消跳过恢复执行。[[PR #7974](https://github.com/intel/intel-xpu-backend-for-triton/commit/a74efcc83cc0444c6c75118895510a9efb091acb)]

---

## 驱动、内核与图形栈 (Windows 驱动 / Linux drm/xe / Mesa ANV)

### intel/compute-runtime
- **26.35.39758.10 发布**：修复事件池计数校验逻辑，防止无效事件池计数导致运行时错误。[[Release](https://github.com/intel/compute-runtime/releases/tag/26.35.39758.10)]
- **25.18.33578.93 发布**：调试器修复——在单地址空间 SBA（State Base Address）跟踪中避免使用 GPR0/GPR1，防止调试器与内核执行冲突。[[Release](https://github.com/intel/compute-runtime/releases/tag/25.18.33578.93)]

### Linux 内核
- **Linux 7.3 在 Panther Lake 上带来性能提升**：Phoronix 实测显示，Linux 7.3 对 Intel Core Ultra Series 3 "Panther Lake" 及 Framework Laptop 13 Pro 的集成 Arc B390 Xe3 图形性能有进一步优化，延续 7.1/7.2 的改进趋势。[[Phoronix 评测](https://www.phoronix.com/review/linux-73-panther-lake)]

---

## 社区实测与生态动态

- **单卡 Arc Pro B70 运行 Qwen3.8-Flash-Next 125B-A6B**：社区用户报告在单张 Intel Arc Pro B70 上以 1-bit 量化（72.5 GB）运行该 MoE 模型，实测生成速度达 42.7 tok/s。该测试展示了 XMX 与内存带宽在低比特推理场景下的实际表现。[[Reddit 讨论](https://www.reddit.com/r/IntelArc/comments/1wghw5d/qwen38flashnext_125ba6b_1bit_725_gb_at_427_toks/)]
- **Arc B580 运行 Dirt 5 高画质**：社区用户分享 B580 在 4K（从 1440p 上采样）高画质设置下运行 Dirt 5 的实测表现，作为游戏性能参考。[[Reddit 讨论](https://www.reddit.com/r/IntelArc/comments/1wgeff2/dirt_5_high_settings_4k_upscaled_from_1440p_on/)]