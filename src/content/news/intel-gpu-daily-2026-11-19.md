---
title: "Intel GPU 技术生态日报 (2026-11-19)"
description: "XPU 稀疏 COO 乘法 SIGFPE 已修复；XPU 归约工作组尺寸取 2 的幂修复 argmin/argmax 错误；Triton XPU 新增 descriptor gather/scatter 转换 pass"
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

- <span class="news-badge news-badge--merged">Merged</span> **XPU 稀疏 COO 乘法 SIGFPE 已修复** [详情 →](#torch-xpu-ops)
- <span class="news-badge news-badge--merged">Merged</span> **XPU 归约工作组尺寸取 2 的幂修复 argmin/argmax 错误** [详情 →](#torch-xpu-ops)
- <span class="news-badge news-badge--merged">Merged</span> **Triton XPU 新增 descriptor gather/scatter 转换 pass** [详情 →](#triton-xpu-后端)

## 主流框架与上游集成

### vLLM XPU

<details class="news-minor">
<summary>1 项小改动</summary>

- XPU flash attention 转发 num_splits：修复 num_splits 未转发 [PR #58131](https://github.com/vllm-project/vllm/pull/58131)

</details>

### llama.cpp SYCL

- **ggml-openvino 扩展模型支持并优化 NPU/GPU**：新增 Qwen3.5 GDN 分解、Qwen MTP 和多序列支持，并优化 NPU、GPU 和内存使用。 [PR #32172](https://github.com/ggml-org/llama.cpp/pull/32172)

  > **影响：** llama.cpp 用户可在 Intel NPU/GPU 上运行更多模型并获得更好性能。

## 编译器与加速库

### torch-xpu-ops

- **修复 XPU 稀疏 COO 乘法 SIGFPE**：修复多个 issue 中 XPU 稀疏 COO 乘法导致的 SIGFPE（浮点异常），涉及除零或非法操作。 [PR #6268](https://github.com/intel/torch-xpu-ops/pull/6268)

  > **影响：** 使用稀疏 COO 乘法的用户不再遇到崩溃。

- **归约工作组尺寸取 2 的幂修复 argmin/argmax**：ReduceConfig::set_group_dimensions 未将最大工作组项数向下取 2 的幂，导致 float32 (96,128) 在 Arc B390 上 argmin/argmax 返回错误索引，现修复。 [PR #6247](https://github.com/intel/torch-xpu-ops/pull/6247)

  > **影响：** 修复 Intel Arc B390 上 argmin/argmax 错误结果。

<details class="news-minor">
<summary>其他 1 项小改动</summary>

- 阻塞 XPU memcpy 补发流同步事件：修复 GPU trace 中阻塞 memcpy 同步事件缺失 [PR #5947](https://github.com/intel/torch-xpu-ops/pull/5947)

</details>

### Triton XPU 后端

- **新增 descriptor gather/scatter 转 ttig pass**：新增 MLIR pass 将 tt.descriptor_gather/scatter 重写为 ttig 等价操作，并接入 XPU 编译流水线，以支持 TMA 风格描述符操作。 [commit b59b6b2](https://github.com/intel/intel-xpu-backend-for-triton/commit/b59b6b24445702b0f1a92bc65c197a8ff009f088)

  > **影响：** 使用 descriptor gather/scatter 的 Triton 内核可在 XPU 上正确编译执行。

- **子组块读携带缓存控制属性**：子组块读未携带缓存控制，导致单行描述符块读丢失加载缓存策略，现为 triton_gen.sub_group 块读添加 cache_control 属性。 [commit 04e59af](https://github.com/intel/intel-xpu-backend-for-triton/commit/04e59afee23b949f7afb4ce3fcf53e259a7f2538)

  > **影响：** 修复单行描述符块读的缓存策略丢失，影响缓存性能。

<details class="news-minor">
<summary>其他 3 项小改动</summary>

- Triton XPU 后端更新 PyTorch 版本：同步 PyTorch 版本 [commit f6921dc](https://github.com/intel/intel-xpu-backend-for-triton/commit/f6921dc4b8cd45a332c206d38db995b789172acb)
- GEMM 基准显式传递转置布局：修复 GEMM 基准中 M/N=1 的转置推断 [commit 2e580a2](https://github.com/intel/intel-xpu-backend-for-triton/commit/2e580a2659adab4a100be66aa9ec421c446ab773)
- 统一注意力页保护仅限 TD 路径：限制页保护到 TD 路径 [commit 9e34209](https://github.com/intel/intel-xpu-backend-for-triton/commit/9e34209ab8c484e1279cd90e432be01cf2e336f8)

</details>

## 驱动、内核与图形栈

### compute-runtime

- **compute-runtime 修复共享缓冲对象生命周期**：共享句柄导入复用同一 BO，释放一个导入会解绑 BO 而其他导入仍在使用，现修复为在最后一个引用释放时才解绑。 [26.44.40734.9](https://github.com/intel/compute-runtime/releases/tag/26.44.40734.9)

  > **影响：** 修复共享缓冲对象提前解绑导致的问题，影响使用共享内存的应用程序。

### Linux 图形栈

<details class="news-minor">
<summary>1 项小改动</summary>

- Dell XPS 14 获 Panther Lake Linux 认证：Panther Lake 笔记本获 Linux 认证 [Phoronix](https://www.phoronix.com/review/dell-xps-14-panther-lake)

</details>
