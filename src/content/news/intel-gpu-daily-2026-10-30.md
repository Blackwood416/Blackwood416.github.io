---
title: "Intel GPU 技术生态日报 (2026-10-30)"
description: "SGLang 修复 Intel XPU 上 page_size=1 崩溃；Intel Triton 后端发布 v3.9.0"
pubDate: "2026-10-30T08:30:00.000Z"
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

- <span class="news-badge news-badge--merged">Merged</span> **SGLang 修复 Intel XPU 上 page_size=1 崩溃** [详情 →](#sglang-xpu)
- <span class="news-badge news-badge--released">Released</span> **Intel Triton 后端发布 v3.9.0** [详情 →](#triton-xpu-后端)

## 主流框架与上游集成

### SGLang XPU

- **允许 XPU 后端 page_size=1**：SGLang 在 Intel XPU 后端使用 paged KV cache 时，`baidu/Unlimited-OCR` 模型因滑动窗口注意力导致启动崩溃。修复允许 page_size=1，解决该模型的启动问题。 [PR #42725](https://github.com/sgl-project/sglang/pull/42725)

  > **影响：** 使用 Intel XPU 后端的 SGLang 用户，特别是运行滑动窗口注意力模型的用户，将不再遇到启动崩溃。

### vLLM XPU

- **vLLM XPU 使用专用 mrope 内核**：vLLM XPU 使用新的 multimodal_rotary_embedding XPU 内核替换 Triton 路径，获得约 13% 吞吐提升。 [PR #59938](https://github.com/vllm-project/vllm/pull/59938)

  > **影响：** vLLM XPU 用户可获得性能提升。

## 编译器与加速库

### Triton XPU 后端

- **Intel Triton 后端发布 v3.9.0**：Intel 的 Triton XPU 后端发布了 v3.9.0 版本，包含多项修复和功能改进。 [v3.9.0](https://github.com/intel/intel-xpu-backend-for-triton/releases/tag/v3.9.0)

  > **影响：** 使用 Intel Triton 后端的开发者应升级到 v3.9.0 以获取最新修复。

- **默认启用 FP 融合**：上游 Triton 将隐式 FP 融合改为 opt-in，Intel 后端默认设置 TRITON_ALLOW_FP_FUSION=True，以恢复 FMA 收缩等优化。 [commit 44752c7](https://github.com/intel/intel-xpu-backend-for-triton/commit/44752c7354f60c919b2ef5858f82b72cc490dcb1)

  > **影响：** 恢复 FP 融合优化，可能提升性能。

<details class="news-minor">
<summary>其他 8 项小改动</summary>

- 添加 Level Zero 探针检查 SPIR-V 能力：新增 SPIR-V 能力探针 [commit fe357dd](https://github.com/intel/intel-xpu-backend-for-triton/commit/fe357dd0b202375e8b914136482b93a0b3109bf0)
- 修复 setEncodingInPlace 类型不匹配：修复类型不匹配 [commit d8ea048](https://github.com/intel/intel-xpu-backend-for-triton/commit/d8ea04887542f66c3319b7289ff464018a3757dd)
- 加载 DeadCodeAnalysis 使范围分析生效：修复范围分析失效 [commit cafb459](https://github.com/intel/intel-xpu-backend-for-triton/commit/cafb4591b49d5492ce5311e2d4aa28f2647646b4)
- 保留 reshape 中的 DPAS 编码：优化 reshape 布局转换 [commit 948e3a2](https://github.com/intel/intel-xpu-backend-for-triton/commit/948e3a293d524794097871b2b96aef4acdf4ffb5)
- CRI 支持更多 grf_mode 值：扩展 CRI grf_mode 支持 [commit 66ea569](https://github.com/intel/intel-xpu-backend-for-triton/commit/66ea569bb028651b42980a0b8980de558c506279)
- fp8 dot 使用 DPAS 和 bf16 累加器：优化 fp8 dot 实现 [commit a16812b](https://github.com/intel/intel-xpu-backend-for-triton/commit/a16812b5b34ea4ed445c27f02b9775c4f954b36e)
- AOT 编译避免不支持 long_vector：修复 AOT 编译兼容性 [commit b3bee6a](https://github.com/intel/intel-xpu-backend-for-triton/commit/b3bee6ab25bf9a0cc6a734a8e4583fbe2db39ab7)
- 避免单 warp 布局的跨 warp 误判：修复缓存控制误判 [commit 23f79e9](https://github.com/intel/intel-xpu-backend-for-triton/commit/23f79e908525c27b75041be2f172740625d7d682)

</details>

### oneDNN

<details class="news-minor">
<summary>1 项小改动</summary>

- oneDNN 发布 v3.14.1 和 v3.13.5：发布维护版本 [v3.14.1](https://github.com/uxlfoundation/oneDNN/releases/tag/v3.14.1) · [v3.13.5](https://github.com/uxlfoundation/oneDNN/releases/tag/v3.13.5)

</details>

## 驱动、内核与图形栈

### Level Zero

<details class="news-minor">
<summary>1 项小改动</summary>

- pyzes v0.1.4 发布：发布 pyzes v0.1.4 [pyzes-v0.1.4](https://github.com/oneapi-src/level-zero/releases/tag/pyzes-v0.1.4)

</details>
