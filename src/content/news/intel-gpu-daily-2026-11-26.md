---
title: "Intel GPU 技术生态日报 (2026-11-26)"
description: "vLLM XPU LoRA 单适配器预填充改用稠密 GEMM，性能提升约 40%；torch-xpu-ops 新增 XPU 支持 _philox_randint_ 无状态 RNG；XeStrata 发布 xe0.2.20-1，修复 In…"
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

- <span class="news-badge news-badge--merged">Merged</span> **vLLM XPU LoRA 单适配器预填充改用稠密 GEMM，性能提升约 40%** [详情 →](#vllm-xpu)
- <span class="news-badge news-badge--merged">Merged</span> **torch-xpu-ops 新增 XPU 支持 _philox_randint_ 无状态 RNG** [详情 →](#torch-xpu-ops)
- <span class="news-badge news-badge--merged">Merged</span> **XeStrata 发布 xe0.2.20-1，修复 Intel GPU 编译器误编译问题** [详情 →](#xestrata)

## 主流框架与上游集成

### vLLM XPU

- **XPU LoRA 单适配器预填充改用稠密 GEMM**：在 XPU 上，当预填充批次使用单个适配器时，将 LoRA 线性层从逐 token 的 BGMV 改为稠密 GEMM，利用默认编译和图模式，在 Qwen 模型上实现约 40% 的加速。 [PR #66752](https://github.com/vllm-project/vllm/pull/66752)

  > **影响：** 使用 vLLM XPU 且 LoRA 单适配器预填充的用户可受益，需更新到包含此提交的版本。

- **vLLM XPU 修复 W8A16 FP8 线性层输入展平**：XPU W8A16 FP8 线性核直接覆盖 apply_weights，绕过了基类的 2D 展平逻辑，导致 N-D 输入处理错误，此提交添加展平逻辑，属于 bugfix。 [PR #68308](https://github.com/vllm-project/vllm/pull/68308)

  > **影响：** 使用 vLLM XPU 且输入非 2D 的 FP8 线性层用户可受益。

- **vLLM XPU 启用 fp32 lm_head 的 torch.mm 快速路径**：将 CUDA/ROCm 上 fp32 lm_head 的 torch.mm(out_dtype=float32) 快速路径扩展到 XPU，避免每次解码时额外的数据类型转换，提升性能。 [PR #69186](https://github.com/vllm-project/vllm/pull/69186)

  > **影响：** 使用 vLLM XPU 且 lm_head 为 fp32 的用户可受益。

- **vLLM XPU 实现 stateless_init_device_torch_dist_pg**：为 XPU 平台实现 stateless_init_device_torch_dist_pg，使分布式进程组初始化支持 XPU，属于功能扩展。 [PR #57196](https://github.com/vllm-project/vllm/pull/57196)

  > **影响：** 使用 vLLM XPU 分布式推理的用户可受益。

<details class="news-minor">
<summary>其他 1 项小改动</summary>

- vLLM 为 Arc Pro B60/B70 添加 8192 上下文默认值：vLLM 添加 Arc Pro 上下文默认值 [PR #68901](https://github.com/vllm-project/vllm/pull/68901)

</details>

### llama.cpp SYCL

<details class="news-minor">
<summary>1 项小改动</summary>

- llama.cpp OpenVINO 修复 CI 测试并改进 KV cache 解码：llama.cpp OpenVINO 修复与优化 [PR #33002](https://github.com/ggml-org/llama.cpp/pull/33002)

</details>

### bitsandbytes XPU

<details class="news-minor">
<summary>1 项小改动</summary>

- bitsandbytes XPU 移除未使用的 NF4/FP4 表：bitsandbytes 节省 XPU 内存 [PR #2156](https://github.com/bitsandbytes-foundation/bitsandbytes/pull/2156)

</details>

## 编译器与加速库

### torch-xpu-ops

- **XPU 支持 _philox_randint_ 无状态 RNG**：为 XPU 后端添加 _philox_randint_ 支持，并调整共享的 Philox 分布基础设施以匹配上游的 sample_func 接口，属于功能扩展。 [PR #6294](https://github.com/intel/torch-xpu-ops/pull/6294)

  > **影响：** 使用 PyTorch 无状态 RNG 的 XPU 用户可调用该函数。

- **torch-xpu-ops 注册 hash_tensor.out 到 XPU**：实现 xor_sum_kernel 支持 torch.hash_tensor，处理整型、浮点和布尔类型，属于功能扩展。 [PR #6153](https://github.com/intel/torch-xpu-ops/pull/6153)

  > **影响：** XPU 用户可使用 torch.hash_tensor。

<details class="news-minor">
<summary>其他 3 项小改动</summary>

- torch-xpu-ops 同步上游泛化测试文件：torch-xpu-ops 测试同步 [PR #6356](https://github.com/intel/torch-xpu-ops/pull/6356)
- torch-xpu-ops 重构 MultiLabelMarginLoss 内核为自由函数：torch-xpu-ops 内核重构 [PR #5502](https://github.com/intel/torch-xpu-ops/pull/5502)
- torch-xpu-ops 迁移 TensorFactories 内核到自由函数：torch-xpu-ops 内核迁移 [PR #5209](https://github.com/intel/torch-xpu-ops/pull/5209)

</details>

### XeStrata

- **XeStrata 发布 xe0.2.20-1 修复 Intel GPU 编译器误编译**：XeStrata 是一个旨在替代 ChatGPT 的本地运行模型项目，支持 Intel Arc B 系列、Lunar Lake 和 Panther Lake。此版本针对 Linux 上 IGC 2.27-2.30 误编译部分 GPU 代码的问题提供了规避方案。 [xe0.2.20-1](https://github.com/MistVVK/XeStrata/releases/tag/xe0.2.20-1)

  > **影响：** 使用 XeStrata 且受影响的 Intel GPU 用户应更新到该版本。

<details class="news-minor">
<summary>其他 5 项小改动</summary>

- XeStrata Windows 构建修复 CUTLASS int8 主机侧运行时：XeStrata Windows 构建修复 [commit 649b352](https://github.com/MistVVK/XeStrata/commit/649b3522d6b89f9a01590bd32e81d2dab2f3512e)
- XeStrata 修复 Windows 7z 引擎 zstd 头文件缺失：XeStrata 修复 zstd 头文件缺失 [commit f20d832](https://github.com/MistVVK/XeStrata/commit/f20d832dda60d4fdd768dcb008e846b68b57da4d)
- XeStrata 移植 CUTLASS uint128 实现：XeStrata 移植 uint128 实现 [commit 25be746](https://github.com/MistVVK/XeStrata/commit/25be7460c4be9be3387716de5c2f41cfba0f3ee0)
- XeStrata Windows 7z AMD 设备链接添加 --no-dependent-libraries：XeStrata 修复 AMD 设备链接 [commit 1d4d631](https://github.com/MistVVK/XeStrata/commit/1d4d631f7f9cb5acb6987e39636351c3d0bf6664)
- XeStrata 修复 Level Zero 设备枚举失败：XeStrata 修复设备枚举失败 [commit 7f39d78](https://github.com/MistVVK/XeStrata/commit/7f39d78838a83edc77780eef5c6cdb36d59669d9)

</details>

### Triton XPU 后端

- **Triton XPU 使用 2D 块存储优化掩码指针存储**：当 GEMM epilogue 的边界掩码（row < M, col < N）不满足 tile 宽度倍数时，改用 2D 块存储，避免低效的逐元素存储，提升性能。 [commit 27af418](https://github.com/intel/intel-xpu-backend-for-triton/commit/27af418b74e4bfe38b6c6153c169fff6422162f5)

  > **影响：** 使用 Triton XPU 且 GEMM epilogue 带边界掩码的代码可受益。

<details class="news-minor">
<summary>其他 1 项小改动</summary>

- Triton XPU 声明 FP4 DPAS 特性：Triton XPU 测试修复 FP4 DPAS 声明 [commit e4ba344](https://github.com/intel/intel-xpu-backend-for-triton/commit/e4ba34458dd67faa2668ee389c5004761864e22b)

</details>

### IntelLabs/Xe-Forge

<details class="news-minor">
<summary>2 项小改动</summary>

- Xe-Forge 添加主机墙钟时间行求和：Xe-Forge 添加时间求和 [commit a0764c9](https://github.com/IntelLabs/Xe-Forge/commit/a0764c9544f7a598c20003f86fd15d7b3d3c06fa)
- Xe-Forge 更新 CPU 契约：Xe-Forge 更新 CPU 契约 [commit b13dc6e](https://github.com/IntelLabs/Xe-Forge/commit/b13dc6e4d4f588d7c7cc152726493552965da0ad)

</details>
