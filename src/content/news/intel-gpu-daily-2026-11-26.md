---
title: "Intel GPU 技术生态日报 (2026-11-26)"
description: "vLLM XPU 单适配器 LoRA 预填充改用稠密 GEMM，性能提升约 40%；Triton XPU 用 2D 块存储优化掩码指针存储，提升 GEMM 尾块性能；torch-xpu-ops 支持整数点积，修复 1-D 张量 matm…"
pubDate: "2026-11-26T08:30:00.000Z"
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

- <span class="news-badge news-badge--merged">Merged</span> **vLLM XPU 单适配器 LoRA 预填充改用稠密 GEMM，性能提升约 40%** [详情 →](#vllm-xpu)
- <span class="news-badge news-badge--merged">Merged</span> **Triton XPU 用 2D 块存储优化掩码指针存储，提升 GEMM 尾块性能** [详情 →](#triton-xpu-后端)
- <span class="news-badge news-badge--merged">Merged</span> **torch-xpu-ops 支持整数点积，修复 1-D 张量 matmul 报错** [详情 →](#torch-xpu-ops)

## 主流框架与上游集成

### vLLM XPU

- **单适配器 LoRA 预填充改用稠密 GEMM**：在 XPU 上，当预填充批次使用单个适配器时，将 LoRA 线性层从逐 token 的 BGMV 改为稠密 GEMM，利用默认编译和图模式，在 Qwen 模型上实现约 40% 的加速。 [PR #66752](https://github.com/vllm-project/vllm/pull/66752)

  > **影响：** 使用 vLLM XPU 且启用 LoRA 的用户，预填充性能将显著提升。

- **XPU W8A16 FP8 线性内核展平 N-D 输入**：XPUW8A16FP8LinearKernel 直接覆盖 apply_weights，绕过了基类的 2D 展平/反展平逻辑，导致 N-D 输入处理错误。此改动在 XPU 内核中展平 N-D 输入。 [PR #68308](https://github.com/vllm-project/vllm/pull/68308)

  > **影响：** 使用 vLLM XPU 且输入为 N-D 的 FP8 线性层用户，将获得正确结果。

- **XPU 上 fp32 lm_head 使用 torch.mm 加速**：LogitsProcessor 的 fp32 快速路径仅对 CUDA/ROCm 启用，XPU 上每个解码步都回退到慢路径。此改动在 XPU 上启用 torch.mm(out_dtype=float32) 快速路径。 [PR #69186](https://github.com/vllm-project/vllm/pull/69186)

  > **影响：** 使用 vLLM XPU 且 lm_head 为 fp32 的用户，解码性能将提升。

### llama.cpp SYCL

- **新增 gated delta net ESIMD 内核**：为 gated delta net 添加 ESIMD 内核，目前仅支持 S_v=128 和 kda=0，在 Qwen3.8-27B 推理基准上相比基础版本有性能提升。 [PR #31762](https://github.com/ggml-org/llama.cpp/pull/31762)

  > **影响：** 使用 llama.cpp SYCL 且运行 gated delta net 模型的用户，可能获得性能提升。

<details class="news-minor">
<summary>其他 2 项小改动</summary>

- 更新 SYCL Linux 参考文档：更新 SYCL 文档 [PR #32583](https://github.com/ggml-org/llama.cpp/pull/32583)
- ggml-openvino 修复 CI 测试并改进 KV 缓存解码：修复 OpenVINO 测试并优化解码 [PR #33002](https://github.com/ggml-org/llama.cpp/pull/33002)

</details>

## 编译器与加速库

### Triton XPU 后端

- **掩码指针存储改用 2D 块存储**：GEMM 尾块在边界掩码下存储结果时，若掩码边界不是 tile 宽度的倍数，指针存储无法成为 2D 块存储。此改动使这类掩码指针存储使用 2D 块存储，提升尾块写入效率。 [commit 27af418](https://github.com/intel/intel-xpu-backend-for-triton/commit/27af418b74e4bfe38b6c6153c169fff6422162f5)

  > **影响：** 使用 Triton XPU 编译 GEMM 内核的用户，尾块性能可能提升。

<details class="news-minor">
<summary>其他 1 项小改动</summary>

- FP4 DPAS 特性在 lit 测试中声明：修复 FP4 DPAS 测试声明 [commit e4ba344](https://github.com/intel/intel-xpu-backend-for-triton/commit/e4ba34458dd67faa2668ee389c5004761864e22b)

</details>

### torch-xpu-ops

- **dot_xpu 支持整数数据类型**：dot_xpu 将所有数据类型转发给 dot_xpu_mkl，而 oneMKL BLAS 仅支持浮点/复数，导致整数输入抛出 NotImplementedError。此改动为整数点积提供支持，修复 1-D 张量 matmul 路由到 aten::dot 时的错误。 [PR #6046](https://github.com/intel/torch-xpu-ops/pull/6046)

  > **影响：** 使用 torch-xpu-ops 进行整数点积或 1-D matmul 的用户，不再遇到 NotImplementedError。

<details class="news-minor">
<summary>其他 4 项小改动</summary>

- AdaptiveMaxPooling2d 内核重构为自由函数：重构 AdaptiveMaxPooling2d 内核 [PR #5270](https://github.com/intel/torch-xpu-ops/pull/5270)
- Windows UT 步骤设置 oneAPI 环境：修复 Windows UT 环境 [PR #6251](https://github.com/intel/torch-xpu-ops/pull/6251)
- 文档记录非 2 的幂最大工作组大小：文档补充工作组大小规则 [PR #6370](https://github.com/intel/torch-xpu-ops/pull/6370)
- 同步上游泛化测试文件：同步多 GPU 测试文件 [PR #6356](https://github.com/intel/torch-xpu-ops/pull/6356)

</details>

### IntelLabs/Xe-Forge

- **Xe-Forge v0.5.0 发布**：Xe-Forge 发布 v0.5.0，包含将弃用的块指针替换为张量描述符、修复 spec_to_roofline_csv 的 flop 公式、新增端到端代理以及 CPU 主机优化流水线（默认使用 perf 分析器）。 [v0.5.0](https://github.com/IntelLabs/X-Forge/releases/tag/v0.5.0)

  > **影响：** 使用 Xe-Forge 进行性能分析和优化的用户，可升级到 v0.5.0 获得新功能和修复。

### XeStrata

- **XeStrata 发布 xe0.2.20-1**：XeStrata 是一个本地运行的 ChatGPT 替代品，发布 xe0.2.20-1。警告 Intel Arc B 系列、Lunar Lake 和 Panther Lake 在 Linux 上，IGC 2.27-2.30 会错误编译部分 GPU 代码，XeStrata 会绕过受影响的优化。 [xe0.2.20-1](https://github.com/MistVVK/XeStrata/releases/tag/xe0.2.20-1)

  > **影响：** 使用 XeStrata 且受影响的 Intel GPU 用户，需注意此版本包含规避措施。

<details class="news-minor">
<summary>其他 5 项小改动</summary>

- Windows 构建修复 CUTLASS int8 主机端运行时：修复 Windows CUTLASS int8 链接 [commit 649b352](https://github.com/MistVVK/XeStrata/commit/649b3522d6b89f9a01590bd32e81d2dab2f3512e)
- Windows 7z 引擎传递全部 zstd 头文件：修复 zstd 头文件缺失 [commit f20d832](https://github.com/MistVVK/XeStrata/commit/f20d832dda60d4fdd768dcb008e846b68b57da4d)
- CUTLASS uint128 改用移植实现：修复 CUTLASS uint128 编译 [commit 25be746](https://github.com/MistVVK/XeStrata/commit/25be7460c4be9be3387716de5c2f41cfba0f3ee0)
- Windows 7z AMD 设备链接禁用依赖库：修复 AMD 设备链接问题 [commit 1d4d631](https://github.com/MistVVK/XeStrata/commit/1d4d631f7f9cb5acb6987e39636351c3d0bf6664)
- Level Zero 设备枚举失败时重试：修复 Level Zero 枚举失败 [commit 7f39d78](https://github.com/MistVVK/XeStrata/commit/7f39d78838a83edc77780eef5c6cdb36d59669d9)

</details>

### vllm-xpu-kernels

- **添加 VMM 操作支持可增长设备缓冲区**：添加虚拟内存管理（VMM）操作，镜像 CUDA cuMem*，用于 vLLM 的可扩展 KV 缓存，在 XPU 上预留地址范围并映射物理内存。 [PR #692](https://github.com/vllm-project/vllm-xpu-kernels/pull/692)

  > **影响：** 使用 vLLM XPU 可扩展 KV 缓存的用户，将获得底层支持。

<details class="news-minor">
<summary>其他 1 项小改动</summary>

- compact_sampling_mask 支持 bf16/fp16：扩展采样掩码数据类型 [PR #707](https://github.com/vllm-project/vllm-xpu-kernels/pull/707)

</details>
