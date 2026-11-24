---
title: "Intel GPU 技术生态日报 (2026-11-24)"
description: "Triton XPU 重新合入上游 scan 相关提交，修复反向扫描与 CTA 分割问题；torch-xpu-ops 同步上游测试文件，测试覆盖显著增加"
pubDate: "2026-11-24T08:30:00.000Z"
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

- <span class="news-badge news-badge--merged">Merged</span> **Triton XPU 重新合入上游 scan 相关提交，修复反向扫描与 CTA 分割问题** [详情 →](#triton-xpu-后端)
- <span class="news-badge news-badge--merged">Merged</span> **torch-xpu-ops 同步上游测试文件，测试覆盖显著增加** [详情 →](#torch-xpu-ops)

## 主流框架与上游集成

### vLLM XPU

- **vLLM 限制 TRITON_ATTN 张量描述符路径到 XPU**：在 CUDA 上，张量描述符路径存在 bug 且比 CUDA 默认路径慢，因此将其限制为仅 XPU 使用。这是对 CUDA 路径的规避。 [PR #68521](https://github.com/vllm-project/vllm/pull/68521)

  > **影响：** CUDA 用户将不再受张量描述符路径 bug 影响，XPU 用户不受影响。

### llama.cpp SYCL

<details class="news-minor">
<summary>1 项小改动</summary>

- llama.cpp OpenVINO 后端多项修复：OpenVINO 后端 CI 修复与新模型支持 [PR #32861](https://github.com/ggml-org/llama.cpp/pull/32861)

</details>

## 编译器与加速库

### Triton XPU 后端

- **重新合入上游 scan 相关提交**：此前因回归回退的 4 个上游 scan 提交被重新合入，包括支持有符号 shuffle 距离的反向扫描、跳过 lane-local scan carry shuffle、修复小形状下的 CTA 分割，以及复用 shuffle-up 边界谓词。这些提交共同完善了 Triton 在 Intel GPU 上的 scan 实现。 [commit 0991913](https://github.com/intel/intel-xpu-backend-for-triton/commit/0991913986f84a5a9e4c07a14b1d5b7b4ee41ab8) · [commit 66b7a27](https://github.com/intel/intel-xpu-backend-for-triton/commit/66b7a27387bfac06d996ede793c543c9ff0aea58) · [commit 6ae1eec](https://github.com/intel/intel-xpu-backend-for-triton/commit/6ae1eec17b08dc1616ecfb1b219571b32f6904f7) · [commit 3c94e3a](https://github.com/intel/intel-xpu-backend-for-triton/commit/3c94e3aa44b08d727550488f0f58e81dd6e577aa) · [commit 4405349](https://github.com/intel/intel-xpu-backend-for-triton/commit/440534953ffaa6bdb2cb06c49f6861eb7b6ecf5b)

  > **影响：** 使用 Triton scan 操作的 XPU 用户将获得更正确的反向扫描和更优的小形状性能。

### torch-xpu-ops

- **XPU maximum/minimum 对齐 CUDA 符号零**：XPU eager 的 torch.maximum/minimum 现在使用 fmax/fmin，使 max(-0, +0) 返回 +0，min(-0, +0) 返回 -0，与 CUDA eager 和 Triton 一致。修复了符号零不一致问题。 [PR #6252](https://github.com/intel/torch-xpu-ops/pull/6252)

  > **影响：** 使用 torch.maximum/minimum 的 XPU 用户将获得与 CUDA 一致的符号零行为。

<details class="news-minor">
<summary>其他 3 项小改动</summary>

- 同步上游测试文件，覆盖增加：测试文件同步上游，覆盖从 228 增至 381 [PR #6311](https://github.com/intel/torch-xpu-ops/pull/6311)
- 机器人保留回归测试而非丢弃：机器人保留回归测试，避免更改丢失 [PR #6272](https://github.com/intel/torch-xpu-ops/pull/6272)
- Windows 上避免不准确的 CPU 参考：Windows 测试改用准确参考，避免误报 [PR #6133](https://github.com/intel/torch-xpu-ops/pull/6133)

</details>

## 驱动、内核与图形栈

### IGC 图形编译器

- **IGC 修复栈调用中本地大小加载**：在栈调用中，get_enqueued_local_size 从隐式参数缓冲区偏移 0x80 加载，但旧版 NEO（<25.31）结构体只有 0x70 字节，导致 PVC 上加载到跨线程数据。修复为使用本地大小。 [v2.43.11](https://github.com/intel/intel-graphics-compiler/releases/tag/v2.43.11)

  > **影响：** 使用旧版 NEO 的 PVC 用户将获得正确的本地大小，避免数据错误。
