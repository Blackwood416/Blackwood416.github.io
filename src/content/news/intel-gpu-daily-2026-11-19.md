---
title: "Intel GPU 技术生态日报 (2026-11-19)"
description: "XPU 嵌入反向内核改用 64 位索引修复大表越界；修复 XPU 稀疏 COO 乘法 SIGFPE 崩溃；vLLM XPU 修复 flash attention 未转发 num_splits"
pubDate: "2026-11-19T08:30:00.000Z"
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

- <span class="news-badge news-badge--merged">Merged</span> **XPU 嵌入反向内核改用 64 位索引修复大表越界** [详情 →](#torch-xpu-ops)
- <span class="news-badge news-badge--merged">Merged</span> **修复 XPU 稀疏 COO 乘法 SIGFPE 崩溃** [详情 →](#torch-xpu-ops)
- <span class="news-badge news-badge--merged">Merged</span> **vLLM XPU 修复 flash attention 未转发 num_splits** [详情 →](#vllm-xpu)

## 主流框架与上游集成

### vLLM XPU

- **vLLM XPU 移植 eager Qwen3.5 模型**：将 Qwen3.5 模型和 MTP 移植到 eager 可断图设计，恢复小批量 MoE decode 融合。 [PR #64687](https://github.com/vllm-project/vllm/pull/64687)

  > **影响：** 使用 Qwen3.5 的 vLLM XPU 用户

- **vLLM XPU 转发 num_splits 到 FA 内核**：XPU flash attention shim 接受 num_splits 但未转发，导致内核未使用。修复转发。 [PR #58131](https://github.com/vllm-project/vllm/pull/58131)

  > **影响：** 使用 flash attention 的 vLLM XPU 用户

<details class="news-minor">
<summary>其他 1 项小改动</summary>

- vLLM XPU 采样掩码改用 SYCL 内核：采样掩码改用 SYCL 内核 [PR #64231](https://github.com/vllm-project/vllm/pull/64231)

</details>

### llama.cpp SYCL

- **ggml-openvino 扩展模型支持并优化 NPU/GPU**：新增 Qwen3.5 GDN 分解、Qwen MTP 和多序列支持，优化 NPU、GPU 和内存使用。 [PR #32172](https://github.com/ggml-org/llama.cpp/pull/32172)

  > **影响：** 使用 OpenVINO 后端的 llama.cpp 用户

### SGLang XPU

- **SGLang XPU 支持 EPD 多模态编码器路径**：EPD 多模态编码器路径此前不支持 XPU，编码器服务器和语言端接收器硬编码 CUDA。添加 XPU 支持。 [PR #47961](https://github.com/sgl-project/sglang/pull/47961)

  > **影响：** 使用 EPD 的 SGLang XPU 用户

## 编译器与加速库

### torch-xpu-ops

- **嵌入反向内核改用 64 位索引**：XPU embedding_bag 反向内核将索引截断为 int，导致大表（>=2^31 行）越界访问。改用 64 位索引类型修复。 [PR #6241](https://github.com/intel/torch-xpu-ops/pull/6241)

  > **影响：** 使用大嵌入表的 XPU 用户

- **修复 XPU 稀疏 COO 乘法 SIGFPE**：XPU 稀疏 COO 乘法触发 SIGFPE，涉及多个 PyTorch issue。修复该崩溃。 [PR #6268](https://github.com/intel/torch-xpu-ops/pull/6268)

  > **影响：** 使用稀疏 COO 乘法的 XPU 用户

<details class="news-minor">
<summary>其他 3 项小改动</summary>

- 阻塞 XPU memcpy 补发流同步事件：修复阻塞 memcpy 的 trace 事件缺失 [PR #5947](https://github.com/intel/torch-xpu-ops/pull/5947)
- 重构 AdaptiveAveragePooling2d 为自由函数：重构池化内核为自由函数 [PR #5265](https://github.com/intel/torch-xpu-ops/pull/5265)
- 修复 xccl 注解时长反映 Work 生命周期：修复 xccl 注解时长 [PR #5850](https://github.com/intel/torch-xpu-ops/pull/5850)

</details>

### Triton XPU 后端

- **新增 tt.descriptor gather/scatter 转换 pass**：新增 MLIR pass 将 tt.descriptor_gather/scatter 转换为 ttig 操作，并接入 XPU 编译流水线，以支持描述符操作。 [commit b59b6b2](https://github.com/intel/intel-xpu-backend-for-triton/commit/b59b6b24445702b0f1a92bc65c197a8ff009f088)

  > **影响：** 使用描述符 gather/scatter 的 Triton 内核开发者

- **子组块读取携带缓存控制属性**：子组块读取未携带缓存控制，导致单行描述符块读取丢失加载的缓存策略。添加 cache_control 属性以保留策略。 [commit 04e59af](https://github.com/intel/intel-xpu-backend-for-triton/commit/04e59afee23b949f7afb4ce3fcf53e259a7f2538)

  > **影响：** 依赖缓存策略的 Triton 内核性能

<details class="news-minor">
<summary>其他 3 项小改动</summary>

- 更新 Triton XPU 后端 PyTorch 版本：同步 PyTorch 版本 [commit f6921dc](https://github.com/intel/intel-xpu-backend-for-triton/commit/f6921dc4b8cd45a332c206d38db995b789172acb)
- GEMM 基准显式传递转置布局：修复 GEMM 基准转置推断 [commit 2e580a2](https://github.com/intel/intel-xpu-backend-for-triton/commit/2e580a2659adab4a100be66aa9ec421c446ab773)
- 统一注意力页保护仅限 TD 路径：恢复 TD 路径页保护行为 [commit 9e34209](https://github.com/intel/intel-xpu-backend-for-triton/commit/9e34209ab8c484e1279cd90e432be01cf2e336f8)

</details>

## 驱动、内核与图形栈

### compute-runtime

- **compute-runtime 修复共享缓冲对象解绑时机**：共享句柄导入复用同一 BO，释放或驱逐一个导入会解绑 BO 而其他导入仍在使用。修复为在最后一个引用时解绑。 [26.44.40734.9](https://github.com/intel/compute-runtime/releases/tag/26.44.40734.9)

  > **影响：** 使用共享缓冲的 Intel GPU 驱动用户

### Linux 图形栈

<details class="news-minor">
<summary>1 项小改动</summary>

- Dell XPS 14 认证支持 Panther Lake Linux：Panther Lake 笔记本获 Linux 认证 [Phoronix](https://www.phoronix.com/review/dell-xps-14-panther-lake)

</details>
