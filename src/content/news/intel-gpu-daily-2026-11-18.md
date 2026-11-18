---
title: "Intel GPU 技术生态日报 (2026-11-18)"
description: "Triton XPU 新增子组位转换洗牌指令降级；XPU 稀疏合并内核修复特征步长错误；llama.cpp 修复 SYCL 闪存注意力掩码越界"
pubDate: "2026-11-18T08:30:00.000Z"
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

- <span class="news-badge news-badge--merged">Merged</span> **Triton XPU 新增子组位转换洗牌指令降级** [详情 →](#triton-xpu-后端)
- <span class="news-badge news-badge--merged">Merged</span> **XPU 稀疏合并内核修复特征步长错误** [详情 →](#torch-xpu-ops)
- <span class="news-badge news-badge--merged">Merged</span> **llama.cpp 修复 SYCL 闪存注意力掩码越界** [详情 →](#llamacpp-sycl)

## 主流框架与上游集成

### vLLM XPU

- **优化批量不变集合通信的分片归约**：对大于 4 MiB 的输入使用 all-to-all 和融合 Triton 求和，再通过 all-gather 实现 all-reduce，小输入保持原路径。 [PR #67182](https://github.com/vllm-project/vllm/pull/67182)

  > **影响：** 提升大输入下批量不变集合通信性能。

<details class="news-minor">
<summary>其他 1 项小改动</summary>

- 冻结 XPUWorker 启动堆以修复测试失败：修复 XPU 启动堆冻结 [PR #67639](https://github.com/vllm-project/vllm/pull/67639)

</details>

### llama.cpp SYCL

- **修复 SYCL 闪存注意力掩码广播越界**：MKL 闪存注意力路径在掩码广播到 heads 或 batches 时越界读取，导致 GPU 故障或 NaN，修复后正确读取。 [PR #31536](https://github.com/ggml-org/llama.cpp/pull/31536)

  > **影响：** 修复 SYCL 后端闪存注意力的正确性问题。

<details class="news-minor">
<summary>其他 1 项小改动</summary>

- llama.cpp 新增 SYCL Nix 包：新增 SYCL Nix 包 [PR #31066](https://github.com/ggml-org/llama.cpp/pull/31066)

</details>

## 编译器与加速库

### Triton XPU 后端

- **子组位转换洗牌降级到 SPV_INTEL 扩展**：将 triton_gen.sub_group_bitcast_shuffle 在驱动支持时降级为 __spirv_SubgroupBitcastShuffleINTEL，否则保留原路径，以利用硬件特性提升性能。 [commit 7e3c9b2](https://github.com/intel/intel-xpu-backend-for-triton/commit/7e3c9b2a8cd5469f4444d21f0c084cccc1f14cae)

  > **影响：** 使用该指令的 Triton 内核在支持扩展的 Intel GPU 上获得性能提升。

- **吸收行限制掩码中的空 >=0 边界**：修复描述符加载时因 index >= 0 与 index < shape 同时出现导致行边界无法匹配的问题，使 2D 块加载能正确吸收行限制掩码。 [commit 0c24285](https://github.com/intel/intel-xpu-backend-for-triton/commit/0c2428556032ad029d1f5adc2262905ace3e6654)

  > **影响：** 提升描述符块加载的匹配率和性能。

<details class="news-minor">
<summary>其他 3 项小改动</summary>

- 更新 vLLM 固定版本移除 Model Runner v1：同步 vLLM 移除 Model Runner v1 [commit c48c706](https://github.com/intel/intel-xpu-backend-for-triton/commit/c48c7068990bda48a0c26dfd22e8cb2e739e1ba8)
- 描述符微基准测试增加报告输出：描述符微基准测试输出报告 [commit 9cb53a5](https://github.com/intel/intel-xpu-backend-for-triton/commit/9cb53a5a78edf5b564fd84695692ee820562b2e7)
- GEMM 后置加矩阵基准回退到指针张量：GEMM 基准增加描述符不可用回退 [commit 91bd358](https://github.com/intel/intel-xpu-backend-for-triton/commit/91bd3589d0c1126e1d79d2c59dc1c7c2c5916b01)

</details>

### torch-xpu-ops

- **实现 XPU 上的 narrow_copy.out**：补全 XPU 上缺失的 narrow_copy.out 变体，注册操作待上游处理。 [PR #5520](https://github.com/intel/torch-xpu-ops/pull/5520)

  > **影响：** XPU 用户可使用 narrow_copy.out 操作。

- **修复稀疏合并内核特征步长错误**：coalesce_values_kernel 中特征维度步长计算错误，导致数据访问错位，修复后正确偏移。 [PR #6120](https://github.com/intel/torch-xpu-ops/pull/6120)

  > **影响：** 修复稀疏张量合并操作的正确性问题。

<details class="news-minor">
<summary>其他 3 项小改动</summary>

- 启用 Windows INT8/INT4 GEMM 测试并扩展覆盖：新增 XPU INT8/INT4 GEMM 测试 [PR #5615](https://github.com/intel/torch-xpu-ops/pull/5615)
- 清理过时的测试文件：删除过时测试文件 [PR #6233](https://github.com/intel/torch-xpu-ops/pull/6233)
- 同步上游 TorchScript 移除后的测试文件：同步测试文件适配 TorchScript 移除 [PR #6178](https://github.com/intel/torch-xpu-ops/pull/6178)

</details>
