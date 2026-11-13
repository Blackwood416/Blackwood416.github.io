---
title: "Intel GPU 技术生态日报 (2026-11-13)"
description: "vLLM 多个 CI 测试因驱动崩溃或未知根因被跳过；Intel 后端适配上游 warp specialization 与向量打包变更"
pubDate: "2026-11-13T08:30:00.000Z"
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

- <span class="news-badge news-badge--merged">Merged</span> **vLLM 多个 CI 测试因驱动崩溃或未知根因被跳过** [详情 →](#triton-xpu-后端)
- <span class="news-badge news-badge--merged">Merged</span> **Intel 后端适配上游 warp specialization 与向量打包变更** [详情 →](#triton-xpu-后端)

## 主流框架与上游集成

### vLLM XPU

<details class="news-minor">
<summary>2 项小改动</summary>

- 重新启用 XPU 上的前缀缓存端到端测试：重新启用 XPU 前缀缓存测试 [PR #62656](https://github.com/vllm-project/vllm/pull/62656)
- 跳过更多 TP=2 分布式关闭测试：扩大 TP=2 测试跳过范围 [PR #66568](https://github.com/vllm-project/vllm/pull/66568)

</details>

### SGLang XPU

- **SGLang XPU 支持 GDN 投机解码**：用 SGLang 共享 GDN 后端替换 Qwen3.5 专用融合路由，使用独立 SYCL 内核支持 conv1d 和 prefill/decode。 [PR #44017](https://github.com/sgl-project/sglang/pull/44017)

  > **影响：** XPU 上的 GDN 模型可进行投机解码。

## 编译器与加速库

### Triton XPU 后端

- **回退小形状 CTA 拆分修复**：回退此前对 CTA 拆分在小形状上的修复，可能因引入回归或未达预期效果。 [commit d568118](https://github.com/intel/intel-xpu-backend-for-triton/commit/d5681181b399b54354212239dbe0f346a8018e27)

  > **影响：** 小形状上的 CTA 拆分行为恢复原状，需重新评估。

- **范围分析仅接受已知操作应用 assume 反向**：将 assume 反向应用的检查从黑名单改为白名单，仅接受已知可安全完成的操作，提高分析正确性。 [commit 81ca969](https://github.com/intel/intel-xpu-backend-for-triton/commit/81ca9694b7e5f793c9816689ea3e37d5848788e0)

  > **影响：** 范围分析更保守，可能减少误优化。

- **逐项匹配行限制掩码以支持 2D 块加载**：将行限制掩码的匹配改为逐项进行，新增 matchBoundaryCheckMask 函数，提升识别能力。 [commit a7aac2c](https://github.com/intel/intel-xpu-backend-for-triton/commit/a7aac2ce4457f5f8cf0d39df04c2af86ace265bc)

  > **影响：** 2D 块加载优化可覆盖更多边界检查模式。

- **可选成本模型用于丢弃有间隙的 dot 操作数预取**：在长 split-K GEMM 循环中，预取两个操作数可能浪费缓存带宽，新增可选成本模型以决定是否丢弃有间隙的预取。 [commit 843e88c](https://github.com/intel/intel-xpu-backend-for-triton/commit/843e88ccb21d07a9f9fb42f36fa8d101e9ae1ea4)

  > **影响：** B580 等设备上的长 split-K GEMM 性能可能提升。

- **在 LLVM 优化后生成 f32 tl.fma 契约对**：将 f32 tl.fma 契约对的生成移到 LLVM 优化之后，避免优化器干扰，并解决与 bf16 拓宽的冲突。 [commit a5de337](https://github.com/intel/intel-xpu-backend-for-triton/commit/a5de3374ba96e9d9ba174a5bd03adf47f650f3bf)

  > **影响：** f32 FMA 的代码生成更稳定，可能影响性能。

- **支持 tt.dot_scaled 中的原生 fp4e2m1x2 操作数**：适配上游新增的 fp4e2m1x2 类型，使 tt.dot_scaled 支持该原生类型操作数。 [commit 7803707](https://github.com/intel/intel-xpu-backend-for-triton/commit/780370768155a8f3fc447ba19fbbc616371efe96)

  > **影响：** 使用 fp4e2m1x2 的模型可在 Intel 后端运行。

<details class="news-minor">
<summary>其他 4 项小改动</summary>

- 跳过 vLLM kda 测试，因驱动 load_binary 崩溃：跳过崩溃的 vLLM kda 测试 [commit 60debf3](https://github.com/intel/intel-xpu-backend-for-triton/commit/60debf36ead37cda1e94996b932b70467b0247e3)
- 适配上游 warp specialization 和向量打包变更：同步上游变更并调整 Intel 测试 [commit 9dfda17](https://github.com/intel/intel-xpu-backend-for-triton/commit/9dfda170710e41a9fc18c72862a30061876d4bda)
- 临时跳过 4x2k chunked-prefill 统一注意力配置：临时跳过 4x2k 配置的基准测试 [commit e2c1f5a](https://github.com/intel/intel-xpu-backend-for-triton/commit/e2c1f5a6175120d13505ff9d8a4d3e2c7fe7fdcd)
- GEMM 基准在无法使用张量描述符时回退到指针张量：GEMM 基准增加指针张量回退 [commit 536a577](https://github.com/intel/intel-xpu-backend-for-triton/commit/536a577ff2377a4b2245af1897859bde857ffd3c)

</details>

## 驱动、内核与图形栈

### Linux 图形栈

- **Intel Xe 驱动准备 SR-IOV vGPU 配置**：Linux 7.5 内核周期中，Intel Xe 驱动将支持 SR-IOV 的 vGPU 配置文件。 [Phoronix](https://www.phoronix.com/news/Linux-7.5-Intel-Xe-vGPU-Profile)

  > **影响：** 虚拟化场景下可配置 vGPU 配置文件。

### compute-runtime

- **修复暂存缓冲区优化的依赖跟踪**：compute-runtime 26.44.40734.8 修复了暂存缓冲区优化中的依赖跟踪问题。 [26.44.40734.8](https://github.com/intel/compute-runtime/releases/tag/26.44.40734.8)

  > **影响：** 使用该版本的驱动可避免相关依赖问题。
