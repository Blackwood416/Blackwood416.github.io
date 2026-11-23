---
title: "Intel GPU 技术生态日报 (2026-11-23)"
description: "Triton XPU 修复注意力反向传播中 trans 折叠，提升性能；BMG 窄行 2D 块存储改走 L1，修复写绕过性能问题"
pubDate: "2026-11-23T08:30:00.000Z"
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

- <span class="news-badge news-badge--merged">Merged</span> **Triton XPU 修复注意力反向传播中 trans 折叠，提升性能** [详情 →](#triton-xpu-后端)
- <span class="news-badge news-badge--merged">Merged</span> **BMG 窄行 2D 块存储改走 L1，修复写绕过性能问题** [详情 →](#triton-xpu-后端)

## 编译器与加速库

### Triton XPU 后端

- **折叠 tl.trans 到生产者，修复注意力反向传播**：将计算 tile 的 tl.trans 折叠到其生产者，使 dot(trans(p), do) 等模式中操作数 A 可直接使用，修复 #8634。 [commit f4d9383](https://github.com/intel/intel-xpu-backend-for-triton/commit/f4d938312c17df6b34b06ec22e53c5bac5e96510)

  > **影响：** 提升注意力反向传播性能，相关用户可受益。

- **BMG 窄行 2D 块存储改走 L1**：BMG 驱动默认 L1 写绕过，导致 8x16 块存储每 32B 行单独写 L2。通过标记此类存储走 L1，修复 #8247。 [commit 8807954](https://github.com/intel/intel-xpu-backend-for-triton/commit/8807954eccc74b2e43952f353f4d7f30d4b75b90)

  > **影响：** 提升 BMG 上窄行 2D 块存储性能，影响相关用户。

<details class="news-minor">
<summary>其他 3 项小改动</summary>

- 广播加载按不同地址计成本：广播加载成本按不同地址计算 [commit 8843be5](https://github.com/intel/intel-xpu-backend-for-triton/commit/8843be51e7665060ebbcb0683eda483363c94b85)
- 无法用 2D 块 IO 时降级 DescriptorLoadOp：descriptor_load 降级为普通 load [commit a562cdc](https://github.com/intel/intel-xpu-backend-for-triton/commit/a562cdc789557eeb5526cb2882c2639c01b5ca9a)
- 修复掩码整数加载负常量 other 打包：修复负常量 other 打包 [commit 0ebac8d](https://github.com/intel/intel-xpu-backend-for-triton/commit/0ebac8d774e2a95061a6c6993ac6d005f7aec7dc)

</details>

## 社区反馈

### IGCIT 问题追踪

<details class="news-minor">
<summary>1 项小改动</summary>

- Satisfactory 启动即崩溃问题报告：Satisfactory 启动崩溃待查 [#1627](https://github.com/IGCIT/Intel-GPU-Community-Issue-Tracker-IGCIT/issues/1627)

</details>
