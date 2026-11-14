---
title: "Intel GPU 技术生态日报 (2026-11-14)"
description: "XPU 随机数内核向量化提速，输出与主分支逐位一致；XPU 空间 softmax 改用 64 位尺寸，修复大张量截断；Level Zero Loader v1.36.0 发布，基于规范 v1.21.26"
pubDate: "2026-11-14T08:30:00.000Z"
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

- <span class="news-badge news-badge--merged">Merged</span> **XPU 随机数内核向量化提速，输出与主分支逐位一致** [详情 →](#torch-xpu-ops)
- <span class="news-badge news-badge--merged">Merged</span> **XPU 空间 softmax 改用 64 位尺寸，修复大张量截断** [详情 →](#torch-xpu-ops)
- <span class="news-badge news-badge--released">Released</span> **Level Zero Loader v1.36.0 发布，基于规范 v1.21.26** [详情 →](#level-zero)

## 主流框架与上游集成

### vLLM XPU

- **XPU 启用 Triton greedy_argmax 加速投机解码**：启用 Triton greedy_argmax（上游 #57770 引入）以加速投机解码中的贪心草稿采样，此前在 XPU 上回退到 Torch。 [PR #67196](https://github.com/vllm-project/vllm/pull/67196)

  > **影响：** XPU 上投机解码性能提升，相关用户受益。

- **int4 MoE 内核新增张量描述符路径，XPU 默认启用**：为 fused_moe_kernel_gptq_awq 的 int4_w4a16 分组权重添加张量描述符路径，镜像 #42436 对 fused_moe_kernel 的改动，XPU 默认启用，SM100 可选。 [PR #52652](https://github.com/vllm-project/vllm/pull/52652)

  > **影响：** XPU 上 int4 MoE 推理性能提升，SM100 用户可选用。

<details class="news-minor">
<summary>其他 1 项小改动</summary>

- vLLM 测试内存占用优化，避免并发 GPU 占用：优化测试 fixture 减少 GPU 内存占用 [PR #67379](https://github.com/vllm-project/vllm/pull/67379)

</details>

## 编译器与加速库

### torch-xpu-ops

- **重新合入 Gather 与 upsample nearest 的 SYCL 自由函数迁移**：重新合入此前被回退的 #4962，并加入 #5719 的回归测试（其 grid-stride 修复已在 main 上）。修复 #5701，将 Gather 和 upsample nearest 内核迁移到 SYCL 自由函数形式。 [PR #5822](https://github.com/intel/torch-xpu-ops/pull/5822)

  > **影响：** 使用这些内核的 XPU 用户获得修复，回归测试覆盖相关场景。

- **XPU randn 内核向量化优化，输出逐位一致**：优化 XPU 空值分布内核（normal_、uniform_、exponential_、bernoulli_、random_ 等），采用惰性 Philox 等策略，不改变生成值，固定种子下输出与主分支逐位一致。 [PR #5910](https://github.com/intel/torch-xpu-ops/pull/5910)

  > **影响：** XPU 上随机数生成性能提升，数值兼容性不变。

- **XPU 空间 softmax 改用 64 位尺寸修复大张量截断**：根因是空间 softmax 启动器和 get_wgroup_size_spatial 将 dim/inner/outer 尺寸作为 int，当 inner_size 超过 INT_MAX 时被截断为负数。改用 64 位尺寸修复。 [PR #5871](https://github.com/intel/torch-xpu-ops/pull/5871)

  > **影响：** 修复 XPU 上超大张量 softmax 计算错误，影响使用大 inner_size 的用户。

<details class="news-minor">
<summary>其他 2 项小改动</summary>

- 更新 XPU 测试以适配 TorchScript API 移除：同步上游移除 TorchScript API 的测试变更 [PR #6177](https://github.com/intel/torch-xpu-ops/pull/6177)
- 更新回归测试以适配 TorchScript API 移除：同步上游移除 TorchScript API 的回归测试变更 [PR #6175](https://github.com/intel/torch-xpu-ops/pull/6175)

</details>

### Triton XPU 后端

- **Intel Triton 后端批量转换 f32 到 bf16 提升性能**：修复 #8594：内核中逐值调用 Intel 转换内建函数导致 IGC 调用开销大，现改为每次转换 8 个值，使用向量 bf16 内建函数。 [commit 9ba66fe](https://github.com/intel/intel-xpu-backend-for-triton/commit/9ba66fef6c25eb0ded9e67bb34ba19b1ff161d8f)

  > **影响：** 使用 f32 到 bf16 转换的 Triton 内核在 Intel GPU 上性能提升。

### vllm-xpu-kernels

- **vllm-xpu-kernels 移植 MoE 路由与数据移动内核**：将内部 csrc/moe/ 内核更新带到上游，包括 topk_softmax/topk_sigmoid 的打包融合 top-k 门控，以及 grouped_topk 的分层单/多组内核。 [PR #675](https://github.com/vllm-project/vllm-xpu-kernels/pull/675)

  > **影响：** vLLM XPU 后端 MoE 路由性能提升，相关用户受益。

## 驱动、内核与图形栈

### Level Zero

- **Level Zero Loader v1.36.0 发布**：发布 oneAPI Level Zero Loader v1.36.0，基于规范 v1.21.26，包含 API 头文件、加载器和验证层。 [v1.36.0](https://github.com/oneapi-src/level-zero/releases/tag/v1.36.0)

  > **影响：** 使用 Level Zero 的开发者可更新加载器以获取最新规范支持。

## 社区反馈

### IGCIT 问题追踪

<details class="news-minor">
<summary>1 项小改动</summary>

- Queen's domains demo 在 DX11 驱动崩溃：报告 DX11 驱动崩溃，根因未确认 [#1615](https://github.com/IGCIT/Intel-GPU-Community-Issue-Tracker-IGCIT/issues/1615)

</details>
