---
title: "Intel GPU 技术生态日报 (2026-11-25)"
description: "Triton XPU 用整数运算替代查表解码 FP4，提升性能；vLLM XPU 支持 Qwen3.5 序列并行与流水线并行组合；torch-xpu-ops 测试文件同步上游，覆盖增加"
pubDate: "2026-11-25T08:30:00.000Z"
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

- <span class="news-badge news-badge--merged">Merged</span> **Triton XPU 用整数运算替代查表解码 FP4，提升性能** [详情 →](#triton-xpu-后端)
- <span class="news-badge news-badge--merged">Merged</span> **vLLM XPU 支持 Qwen3.5 序列并行与流水线并行组合** [详情 →](#vllm-xpu)
- <span class="news-badge news-badge--merged">Merged</span> **torch-xpu-ops 测试文件同步上游，覆盖增加** [详情 →](#torch-xpu-ops)

## 主流框架与上游集成

### vLLM XPU

- **Qwen3.5 XPU 支持序列并行与流水线并行组合**：镜像 NVIDIA 的 #66866 改动，使 XPU 上的 Qwen3.5 MoE 在流水线并行（PP>1）时保持序列并行（SP）启用，此前可能被禁用。 [PR #69314](https://github.com/vllm-project/vllm/pull/69314)

  > **影响：** 使用 Qwen3.5 模型且配置 PP>1 的 vLLM XPU 用户可获得 SP 带来的性能收益。

- **Triton MLA 解码注意力使用张量描述符加载 Q**：在 Intel XPU 上，TRITON_MLA decode 的 _fwd_grouped_kernel_stage1 对 576 宽 MLA tile（kv_lora_rank 512 + qk_rope_head_dim 64）改用张量描述符加载 Q 和 Q-PE，替代掩码指针加载。 [PR #64881](https://github.com/vllm-project/vllm/pull/64881)

  > **影响：** MLA 解码注意力性能提升。

- **XPU 图模式启用 6 个配方**：移植 recipes#1269，移除 Intel XPU（Arc Pro B60/B70）配置中的 --enforce-eager，使这些配方使用 torch.compile + XPU 图模式。 [PR #69605](https://github.com/vllm-project/vllm/pull/69605)

  > **影响：** 相关配方在 XPU 上获得图模式性能提升。

- **XPU 支持 MXFP4 MoE LoRA**：通过 XpuFusedMoe.apply 的新 activation_hook/output_hook 应用 w13/w2 LoRA 增量，支持 gpt-oss 的 MXFP4 MoE 后端 LoRA。依赖 vllm-xpu-kernels#648。 [PR #62631](https://github.com/vllm-project/vllm/pull/62631)

  > **影响：** XPU 上 MXFP4 MoE 模型可使用 LoRA 微调。

<details class="news-minor">
<summary>其他 1 项小改动</summary>

- XPU 启用更多 spec 解码单元测试：XPU 启用 spec 解码测试 [PR #69653](https://github.com/vllm-project/vllm/pull/69653)

</details>

### llama.cpp SYCL

- **SYCL 初步支持 FP8 e4m3**：为 SYCL 后端添加 OCP FP8 E4M3 的初始支持，覆盖 SET_ROWS、CPY、ADD、MUL_MAT、MUL_MAT_ID 操作，但不声称完全符合规范。 [PR #31871](https://github.com/ggml-org/llama.cpp/pull/31871)

  > **影响：** llama.cpp 在 SYCL 设备上可使用 FP8 模型。

- **SYCL ROLL 操作支持置换源**：为 ROLL 操作添加对置换源的支持，现在两个 ROLL 测试用例均通过。 [PR #31799](https://github.com/ggml-org/llama.cpp/pull/31799)

  > **影响：** 修复 ROLL 操作在置换输入上的正确性。

### bitsandbytes XPU

- **修复 XPU quantize_4bit 返回填充张量违反契约**：XPU 上 quantize_4bit 在输入元素数非倍数时返回形状与 register_fake 声明不符的填充张量，违反操作契约。修复使其与 CPU/CUDA 后端一致。 [PR #2099](https://github.com/bitsandbytes-foundation/bitsandbytes/pull/2099)

  > **影响：** 修复 bitsandbytes XPU 量化操作的形状一致性。

- **XPU Triton 优化器内核支持 skip_zeros**：CUDA 优化器内核支持 skip_zeros，但 XPU 抛出 NotImplementedError。由于 Triton 无每 lane 提前退出，实现时需在更新前处理零值。 [PR #2097](https://github.com/bitsandbytes-foundation/bitsandbytes/pull/2097)

  > **影响：** XPU 优化器内核功能与 CUDA 对齐。

## 编译器与加速库

### Triton XPU 后端

- **FP4 解码改用整数运算替代查表**：在无 e2m1 转换内建指令的目标（BMG、PVC、LNL 等）上，原实现通过常量向量查表解码 FP4，每 lane 动态索引导致性能开销。改为整数运算直接计算，消除查表依赖。 [commit 4b87c08](https://github.com/intel/intel-xpu-backend-for-triton/commit/4b87c080f0dbca198237ab9f294bb207fb359405)

  > **影响：** 使用 FP4 数据类型的 Triton 内核在相关 Intel GPU 上性能提升。

- **分解块缩放 DPAS 不支持的 dot_scaled**：当 tl.dot_scaled 两侧为 e2m1、缩放为 E4M3 且每 16 元素一个缩放（NVFP4）时，CRI 上 K=64 编译失败。通过分解该操作，使块缩放 DPAS 无法处理的情况得以编译。 [commit 1143f23](https://github.com/intel/intel-xpu-backend-for-triton/commit/1143f2375bf4598cf1913d4eed37b7e627570ced)

  > **影响：** 修复 NVFP4 格式在 Triton XPU 上的编译失败。

- **将 sub_group_block_write 建模为收敛写**：原生描述符 scatter 将 ttig.descriptor_scatter 降低为子组块写，但 triton_gen.sub_group_block_write 声明了 [MemRead] 属性，导致内存依赖分析错误。改为收敛写后，正确反映内存语义。 [commit aac5f6f](https://github.com/intel/intel-xpu-backend-for-triton/commit/aac5f6f5133aab39b1eb8fc223ef2f8dfd9f8e7f)

  > **影响：** 修复描述符 scatter 在 TritonGEN 上的正确性问题。

- **RVL 避免将循环前 dot 操作数移过写操作**：ReduceVariableLiveness 的 moveOperand 会将循环前的 dot 操作数加载克隆到循环内首次使用处，但若该加载与写操作之间存在依赖，移动可能导致错误。此修复阻止这种移动。 [commit 1b947ef](https://github.com/intel/intel-xpu-backend-for-triton/commit/1b947ef4792e3802bed738fd74bf71f27a5f1e39)

  > **影响：** 修复 Triton 编译器中 RVL 优化导致的潜在错误。

<details class="news-minor">
<summary>其他 1 项小改动</summary>

- 添加无溢出 flex attention 反向配置：新增无溢出反向配置 [commit 510242a](https://github.com/intel/intel-xpu-backend-for-triton/commit/510242a0a7691a15168912563bc70cb1fcef129a)

</details>

### torch-xpu-ops

<details class="news-minor">
<summary>4 项小改动</summary>

- torch-xpu-ops 测试文件同步上游泛化改动：测试文件同步上游，覆盖增加 [PR #6278](https://github.com/intel/torch-xpu-ops/pull/6278) · [PR #6254](https://github.com/intel/torch-xpu-ops/pull/6254)
- 修复多 AOT 目标下 sleep 内核构建失败：修复多 AOT 目标构建失败 [PR #6384](https://github.com/intel/torch-xpu-ops/pull/6384)
- 机器人审查门控仅在 PR 就绪时请求审查者：优化 bot 审查通知时机 [PR #6304](https://github.com/intel/torch-xpu-ops/pull/6304)
- DilatedMaxPool2d 重构为自由函数：DilatedMaxPool2d 代码重构 [PR #5319](https://github.com/intel/torch-xpu-ops/pull/5319)

</details>

### vllm-xpu-kernels

- **添加 head_size=512 的 paged_decode 内核配置**：为 XPU paged-decode 内核添加缺失的配置：head_size=512, qgroup=16, page_size=64, 非因果/非局部/非下沉。 [PR #713](https://github.com/vllm-project/vllm-xpu-kernels/pull/713)

  > **影响：** 支持 head_size=512 的模型在 XPU 上使用 paged decode。

- **SYCL 内核移植：RoPE 和 DeepSeek V4**：移植 rotary_embedding（CRI 重写）、fused_qk_norm_rope（多 head 每子组，全旋转 NeoX 交织路径），新增 fused_rope_norm_store_kv_fp8 操作（QK-norm + RoPE + KV 缓存写 + fp8 Q 量化）。 [PR #709](https://github.com/vllm-project/vllm-xpu-kernels/pull/709)

  > **影响：** DeepSeek V4 相关内核在 XPU 上可用。

<details class="news-minor">
<summary>其他 1 项小改动</summary>

- SYCL GDN 内核导出内部 prefill 检查点：导出 prefill 检查点 [PR #705](https://github.com/vllm-project/vllm-xpu-kernels/pull/705)

</details>
