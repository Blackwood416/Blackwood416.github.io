---
title: "XPU 算子开发最佳实践：GEMM 高性能优化指南"
description: "基于 Intel Arc A770 (Xe-HPG DG2) 的高性能 GEMM 算子调优实战：从标准 SYCL 访存分块、XMX 张量核心，到 ESIMD 显式硬件控制与 1D 模拟 2D 异步预取，记录预打包、对齐输入条件下接近官方库的内核调优过程。"
pubDate: 2026-08-02
categories: [SYCL, 算子优化, XPU]
tags: [SYCL, 高性能计算, GPU, XPU, Intel, ESIMD, GEMM]
draft: false
---

# XPU 算子开发最佳实践：GEMM 高性能优化指南

Intel GPU 在高性能计算与深度学习算子开发领域的公开调优资料相对有限。本篇作为 XPU 算子优化的工程实战指南，以最经典的矩阵乘法（GEMM）为例，基于 Intel Arc A770（Xe-HPG DG2 架构，16GB 显存）平台，系统介绍如何从基础实现出发，循序渐进地应用共享内存分块、寄存器分块、SIMD 向量化、硬件张量核心（Joint Matrix/XMX），直至直接操控底层指令的手写 ESIMD（Explicit SIMD）与异步软件预取技术，最终得到在预打包、对齐输入条件下接近官方库的 GEMM 内核。

# 一、GEMM 算子定义与基础基准

## 算法图解与基准约定

GEMM（General Matrix Multiply，通用矩阵乘法）是深度学习与科学计算中最基础的高频算子，其标准数学定义如下：

$$
C = \alpha (A \times B) + \beta C
$$

其中：
- $A$ 为 $M \times K$ 矩阵
- $B$ 为 $K \times N$ 矩阵
- $C$ 为 $M \times N$ 矩阵
- $\alpha, \beta$ 为标量缩放因子

在初始调优阶段，为排除标量计算与回写分支的干扰，专注于核心计算与内存交互，我们首先令 $\alpha = 1.0, \beta = 0.0$，即计算简化的 $C = A \times B$。后续章节会加入标量系数与运行时对齐维度支持；具体输入契约和未覆盖的边界见泛化章节。

运算过程与数据流图示如下：

```mermaid
---
title: "GEMM: C = A × B (α=1.0, β=0.0)"
---
flowchart LR
    %% 定义矩阵的样式：圆角、背景色、边框、等宽字体以保证排版对齐
    classDef matA fill:#e3f2fd,stroke:#1e88e5,stroke-width:2px,color:#0d47a1,font-family:monospace,border-radius:8px;
    classDef matB fill:#e8f5e9,stroke:#43a047,stroke-width:2px,color:#1b5e20,font-family:monospace,border-radius:8px;
    classDef matC fill:#fff3e0,stroke:#f4511e,stroke-width:2px,color:#e65100,font-family:monospace,border-radius:8px;
    classDef op fill:none,stroke:none,font-size:42px,color:#333,font-weight:bold;

    %% 利用 HTML 的不换行空格(&nbsp;)和换行符(<br>)来精确控制矩阵的可视化长宽比
    A["&nbsp;&nbsp;&nbsp;K&nbsp;&nbsp;&nbsp;<br>&nbsp;<br>&nbsp;<br>M&nbsp;&nbsp;<b style='font-size:32px;'>A</b>&nbsp;&nbsp;&nbsp;<br>&nbsp;<br>&nbsp;<br>&nbsp;"]:::matA
    
    Op1["×"]:::op
    
    B["&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;N&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<br>&nbsp;<br>K&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b style='font-size:32px;'>B</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"]:::matB
    
    Op2["="]:::op
    
    C["&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;N&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<br>&nbsp;<br>&nbsp;<br>M&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b style='font-size:32px;'>C</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<br>&nbsp;<br>&nbsp;<br>&nbsp;"]:::matC

    %% 使用不可见连接线让它们水平居中排列
    A ~~~ Op1 ~~~ B ~~~ Op2 ~~~ C
```

## 阅读约定、计时口径与修订状态

本文保留逐步调优的历史耗时和失败实验。**本次修订修正了代码示例与结论表述，尚未在 A770 上重新编译、对拍或采集性能；原有数值不代表修订后代码的验证结果。** 原始基准使用默认乱序队列连续写同一个 USM 输出，未显式建立迭代依赖，需按下述口径重测后才能确认各版本的串行调用表现。

- **执行依赖**：本文基准统一使用 `property::queue::in_order`，使同一队列内的 GEMM、拷贝和输出重置按提交顺序执行；乱序队列的 USM 调用必须显式传递 event 依赖。循环末尾的 `wait_and_throw()` 只等待完成并报告异步错误，不能替代迭代间依赖。参见 [Khronos SYCL 队列说明](https://github.khronos.org/syclacademy/Lesson_Materials/In_Order_Queue/)。
- **计时口径**：`chrono` 包围提交循环再同步，所得是包含主机提交与调度影响的连续调用平均时间。设备时间应在单独启用 `enable_profiling` 的采集中，以 event 的 `command_end - command_start` 统计；oneDNN/oneMKL 若发射多个 kernel，需统计完整调用，不能只挑其中一个事件。总批次耗时与单次平均耗时分开列示。
- **布局成本**：VNNI B 打包，以及后续 ESIMD 的 A 操作数重排，均在原有内核计时之外。固定权重 B 可复用打包结果；运行时激活 A 通常需每次转换，除非上游直接生成目标布局。“接近官方库”的历史比例仅适用于这里的预打包基准，不能代表原始 row-major 输入的端到端表现。
- **复现信息**：每轮应记录源码 commit、完整编译参数、编译器/驱动/库版本、队列属性、USM 类型、输入形状及布局、预热与迭代次数，并在同一轮交替测量基线与候选。区分复用相同输入的热缓存实验与轮换工作集的实验，报告多轮中位数及波动范围。
- **证据等级**：实测变慢、寄存器压力增加、发生 Device Lost 分别是观测结果；溢出、缓存置换、occupancy 下降等原因需要编译产物或硬件计数器佐证。单一配置的结果不自动成为整代架构的限制。

建议补齐三种对照，统一库与手写实现的输入、输出和同步条件：

| 比较口径 | 纳入的工作 | 适用问题 |
|---|---|---|
| 预打包内核 | 已就绪的 A/B 布局 + GEMM | 内核本身的优化效果 |
| 固定权重推理 | 每次 A 转换 + GEMM，B 打包摊销另列 | 运行时激活输入是否划算 |
| 原始输入端到端 | A/B 转换 + GEMM，必要传输另列 | 一次性调用是否划算 |

初期常量输入和 `C[0]` 仅作冒烟检查。正式对拍应先量化输入为 bf16，再用相同输入计算高精度 CPU 参考；记录随机种子、正负混合与消去用例、全量或抽样规则、`atol/rtol`、最大绝对/相对误差和非有限值处理。`errors=0` 表示测试判据下未检出错误，不等于逐位一致。还应覆盖 `beta=0` 且旧 C 为 NaN、最小对齐尺寸，以及非对齐/空维度的拒绝或回退策略。

## 朴素（Naive）实现

采用标准 SYCL 编写基础内核并在 Intel Arc A770 上执行。为兼顾吞吐量与数值精度，输入矩阵 $A$ 与 $B$ 采用 `bfloat16`（bf16）格式，累加器与输出矩阵 $C$ 采用单精度浮点数 `float`（f32）。

```cpp
#include <iostream>
#include <chrono>
#include <sycl/sycl.hpp>

using namespace sycl;
using bf16 = sycl::ext::oneapi::bfloat16;

// Device Kernel 代码
void gemm(size_t M, size_t N, size_t K, bf16* A, bf16* B, float* C, queue q)
{
    q.parallel_for(range{M, N}, [=](id<2> idx) {
        int row = idx[0];
        int col = idx[1];
        float sum = 0.0f;
        for (int k = 0; k < K; ++k) {
            float a_val = static_cast<float>(A[row * K + k]);
            float b_val = static_cast<float>(B[k * N + col]);
            sum += a_val * b_val;
        }
        C[row * N + col] = sum;
    });
}

int main()
{
    // 创建 SYCL 队列，指定 GPU 执行
    queue q{gpu_selector_v, property::queue::in_order{}};

    // 测试矩阵基准规模
    constexpr size_t M = 1024;
    constexpr size_t N = 1536;
    constexpr size_t K = 512;
    
    constexpr size_t warmup_iters = 100;
    constexpr size_t run_iters = 1000;

    // 分配统一共享内存 (USM Shared Memory)
    auto A = malloc_shared<bf16>(M * K, q);
    auto B = malloc_shared<bf16>(K * N, q);
    auto C = malloc_shared<float>(M * N, q);
    
    // 初始化数据
    for (size_t i = 0; i < M * K; ++i) A[i] = 1.0f;
    for (size_t i = 0; i < K * N; ++i) B[i] = 2.0f;
    for (size_t i = 0; i < M * N; ++i) C[i] = 0.0f;

    // 预热 GPU
    for (size_t i = 0; i < warmup_iters; i++) {
        gemm(M, N, K, A, B, C, q);
    }
    q.wait_and_throw();

    auto run_start = std::chrono::steady_clock::now();
    for (size_t i = 0; i < run_iters; i++) {
        gemm(M, N, K, A, B, C, q);
    }
    q.wait_and_throw();
    auto run_end = std::chrono::steady_clock::now();
    double run_total = std::chrono::duration<double, std::milli>(run_end - run_start).count();

    std::cout << "Naive spent " << run_total << " ms\n" << run_total / run_iters << " ms per Run\n";
    std::cout << "C[0] = " << C[0] << " (Expected: " << K * 2.0f << ")" << std::endl;
    
    free(A, q);
    free(B, q);
    free(C, q);

    return 0;
}
```

执行结果如下：

```text
Naive spent 1951.73 ms
1.95174 ms per Run
C[0] = 1024 (Expected: 1024)
```

历史连续调用平均耗时约 1.9517 ms。每个 work-item 独立沿 K 读取 A/B，缺少显式分块复用；但源代码中的 global load 不等于实际 DRAM 事务，缓存与访问合并可能复用数据。是否显存带宽饱和，需要结合实际流量、缓存命中与停顿指标判断。

## 建立官方基线：oneMKL 性能参考

为了量化手写代码与成熟工业级数学库之间的差距，我们使用 Intel 官方的 **oneMKL** 库运行相同维度的 GEMM 运算：

```cpp
#include <iostream>
#include <chrono>
#include <sycl/sycl.hpp>
#include <oneapi/mkl.hpp>

using namespace sycl;
using bf16 = oneapi::mkl::bfloat16;

int main() {
    queue q{gpu_selector_v, property::queue::in_order{}};

    constexpr size_t M = 1024;
    constexpr size_t N = 1536;
    constexpr size_t K = 512;

    constexpr float alpha = 1.0f;
    constexpr float beta  = 0.0f;

    // 行主序 (Row-Major) 步长
    constexpr size_t lda = K;
    constexpr size_t ldb = N;
    constexpr size_t ldc = N;

    constexpr size_t warmup_iters = 100;
    constexpr size_t run_iters = 1000;

    bf16*  A = malloc_shared<bf16>(M * K, q);
    bf16*  B = malloc_shared<bf16>(K * N, q);
    float* C = malloc_shared<float>(M * N, q);

    for (int i = 0; i < M * K; ++i) A[i] = bf16(1.0f);
    for (int i = 0; i < K * N; ++i) B[i] = bf16(2.0f);
    for (int i = 0; i < M * N; ++i) C[i] = 0.0f;

    // 预热
    for (size_t i = 0; i < warmup_iters; i++) {
        oneapi::mkl::blas::row_major::gemm(
            q,
            oneapi::mkl::transpose::nontrans,
            oneapi::mkl::transpose::nontrans,
            M, N, K,
            alpha,
            A, lda,
            B, ldb,
            beta,
            C, ldc
        );
    }
    q.wait_and_throw();

    // 正式测试
    auto run_start = std::chrono::steady_clock::now();
    for (size_t i = 0; i < run_iters; i++) {
        oneapi::mkl::blas::row_major::gemm(
            q,
            oneapi::mkl::transpose::nontrans,
            oneapi::mkl::transpose::nontrans,
            M, N, K,
            alpha,
            A, lda,
            B, ldb,
            beta,
            C, ldc
        );
    }
    q.wait_and_throw();

    auto run_end = std::chrono::steady_clock::now();
    double run_total = std::chrono::duration<double, std::milli>(run_end - run_start).count();

    std::cout << "oneMKL spent " << run_total << " ms\n" << run_total / run_iters << " ms per Run\n";
    std::cout << "C[0] = " << C[0] << " (Expected: " << K * 2.0f << ")" << std::endl;

    free(A, q);
    free(B, q);
    free(C, q);

    return 0;
}
```

输出结果：

```text
oneMKL spent 53.6976 ms
0.0536976 ms per Run
C[0] = 1024 (Expected: 1024)
```

## Naive 实现与 oneMKL 基线对比

| 实现版本 | 单次平均耗时 | 相对效率 |
| :--- | :---: | :---: |
| Naive 朴素实现 | 1.95174 ms | 2.75% |
| oneMKL 官方基线 | **0.05370 ms** | **100.00%** |

历史耗时比约为 **36 倍**，需在修正队列依赖后复测。Naive 版本缺少显式的数据复用，后续通过 Tiling 观察协作加载是否能降低访存与指令开销。

# 二、标准 SYCL 框架下的通用访存优化

## Tiling（分块）实现

```cpp
// ···
// 定义 Tile 大小（如 16x16）
constexpr size_t TILE_SIZE = 16;

// Tiling 优化的 GEMM Kernel 代码
void gemm_tiled(size_t M, size_t N, size_t K, bf16* A, bf16* B, float* C, queue q)
{
    // 定义 Global 与 Local 工作空间维度
    range<2> global_size{M, N};
    range<2> local_size{TILE_SIZE, TILE_SIZE};

    q.submit([&](handler& h) {
        // 1. 申请 Local Memory (共享内存) 用于缓存 Tile 块
        local_accessor<bf16, 2> tileA(range<2>{TILE_SIZE, TILE_SIZE}, h);
        local_accessor<bf16, 2> tileB(range<2>{TILE_SIZE, TILE_SIZE}, h);

        h.parallel_for(nd_range<2>(global_size, local_size), [=](nd_item<2> item) {
            int row = item.get_global_id(0);
            int col = item.get_global_id(1);

            int local_row = item.get_local_id(0);
            int local_col = item.get_local_id(1);

            float sum = 0.0f;

            // 2. 沿着 K 维度分块迭代
            for (size_t bk = 0; bk < K; bk += TILE_SIZE) {
                // 协作加载 A 矩阵 Tile
                if (row < M && (bk + local_col) < K) {
                    tileA[local_row][local_col] = A[row * K + (bk + local_col)];
                } else {
                    tileA[local_row][local_col] = static_cast<bf16>(0.0f);
                }

                // 协作加载 B 矩阵 Tile
                if ((bk + local_row) < K && col < N) {
                    tileB[local_row][local_col] = B[(bk + local_row) * N + col];
                } else {
                    tileB[local_row][local_col] = static_cast<bf16>(0.0f);
                }

                // 3. 屏障同步：确保 Work-Group 内所有线程都已经完成了 Tile 加载
                item.barrier(access::fence_space::local_space);

                // 4. 从 Local Memory 中读取并计算局部点积
                for (size_t k = 0; k < TILE_SIZE; ++k) {
                    float a_val = static_cast<float>(tileA[local_row][k]);
                    float b_val = static_cast<float>(tileB[k][local_col]);
                    sum += a_val * b_val;
                }

                // 5. 屏障同步：确保局部计算全部完成，防止后续读取覆盖当前数据
                item.barrier(access::fence_space::local_space);
            }

            // 6. 结果写回全局内存
            if (row < M && col < N) {
                C[row * N + col] = sum;
            }
        });
    });
}
// ···
```

结果如下：

```
Tiling spent 1492.31 ms
1.49231 ms per Run
C[0] = 1024 (Expected: 1024)
```

可以看到性能提升了一些：

||Naive实现|Tiling实现|oneMKL|
|:-:|:-:|:-:|:-:|
|总耗时|1951.73 ms|1492.32 ms|53.6976 ms|
|单次耗时|1.95174 ms|1.49231 ms|0.0536976 ms|
|相对效率|2.75%|3.59%|100%|

## Register Tiling 实现

普通的 Tiling 实现依然大量的向 global memory 进行内存访问，计算速度依然被访存速度拖慢，我们可以使用 **Blocking（切片）** 来尽量提高寄存器及其缓存的利用率，来进一步缓解 Tiling 实现的访存瓶颈。

```cpp
// ···
// Work-Group 级别的 Tile 尺寸
constexpr size_t BM = 64;
constexpr size_t BN = 64;
constexpr size_t BK = 16;

// Work-Item 级别的 Thread Tile 尺寸 (寄存器分块)
constexpr size_t TM = 4;
constexpr size_t TN = 4;

// Register Tiling GEMM Kernel
void gemm_register_tiled(size_t M, size_t N, size_t K, bf16* A, bf16* B, float* C, queue q)
{
    // 每个 Work-Group 包含的线程数为 (BM/TM) x (BN/TN) = 16 x 16 = 256 个线程
    range<2> global_size{M / TM, N / TN};
    range<2> local_size{BM / TM, BN / TN};

    q.submit([&](handler& h) {
        // 1. 声明 Work-Group 共享的 Local Memory
        local_accessor<bf16, 2> tileA(range<2>{BM, BK}, h);
        local_accessor<bf16, 2> tileB(range<2>{BK, BN}, h);

        h.parallel_for(nd_range<2>(global_size, local_size), [=](nd_item<2> item) {
            int wg_row = item.get_group(0);
            int wg_col = item.get_group(1);

            int local_row = item.get_local_id(0); // 范围: 0 ~ (BM/TM - 1)
            int local_col = item.get_local_id(1); // 范围: 0 ~ (BN/TN - 1)

            // 2. 在寄存器 (Private Memory) 中分配每个线程专属的累加器
            float acc[TM][TN] = {0.0f};

            // 计算该线程在 Work-Group 内的扁平化 ID，用于协作加载
            int tid = local_row * (BN / TN) + local_col;
            int threads_per_group = (BM / TM) * (BN / TN); // 256 个线程

            // 沿着 K 维度按 BK 步进
            for (size_t bk = 0; bk < K; bk += BK) {
                
                // --- A. Work-Group 协同加载 tileA (BM x BK) ---
                for (int i = tid; i < BM * BK; i += threads_per_group) {
                    int a_r = i / BK;
                    int a_c = i % BK;
                    int g_r = wg_row * BM + a_r;
                    int g_c = bk + a_c;
                    tileA[a_r][a_c] = (g_r < M && g_c < K) ? A[g_r * K + g_c] : static_cast<bf16>(0.0f);
                }

                // --- B. Work-Group 协同加载 tileB (BK x BN) ---
                for (int i = tid; i < BK * BN; i += threads_per_group) {
                    int b_r = i / BN;
                    int b_c = i % BN;
                    int g_r = bk + b_r;
                    int g_c = wg_col * BN + b_c;
                    tileB[b_r][b_c] = (g_r < K && g_c < N) ? B[g_r * N + g_c] : static_cast<bf16>(0.0f);
                }

                // 屏障同步：等待共享数据加载完毕
                item.barrier(access::fence_space::local_space);

                // --- C. 从 Local Memory 读入寄存器并进行 2D 计算 ---
                for (int k = 0; k < BK; ++k) {
                    // 局部临时寄存器数组，用于暂存当前的 A 和 B 向量
                    float regA[TM];
                    float regB[TN];

                    // 加载 TM 个 A 元素到寄存器
                    for (int m = 0; m < TM; ++m) {
                        regA[m] = static_cast<float>(tileA[local_row * TM + m][k]);
                    }
                    // 加载 TN 个 B 元素到寄存器
                    for (int n = 0; n < TN; ++n) {
                        regB[n] = static_cast<float>(tileB[k][local_col * TN + n]);
                    }

                    // 外积展开计算并累加到 acc[TM][TN]
                    for (int m = 0; m < TM; ++m) {
                        for (int n = 0; n < TN; ++n) {
                            acc[m][n] += regA[m] * regB[n];
                        }
                    }
                }

                // 屏障同步：防止下一轮加载覆盖未用完的数据
                item.barrier(access::fence_space::local_space);
            }

            // --- D. 将寄存器的计算结果写回全局内存 C ---
            for (int m = 0; m < TM; ++m) {
                for (int n = 0; n < TN; ++n) {
                    int g_r = wg_row * BM + local_row * TM + m;
                    int g_c = wg_col * BN + local_col * TN + n;
                    if (g_r < M && g_c < N) {
                        C[g_r * N + g_c] = acc[m][n];
                    }
                }
            }
        });
    });
}
// ···
```

结果如下：
```
Register Tiling spent 430.648 ms
0.430648 ms per Run
C[0] = 1024 (Expected: 1024)
```

可以看到性能有比较明显的提升：

||Naive实现|Tiling实现|Register Tiling实现|oneMKL|
|:-:|:-:|:-:|:-:|:-:|
|总耗时|1951.73 ms|1492.32 ms|430.648 ms|53.6976 ms|
|单次耗时|1.95174 ms|1.49231 ms|0.430648 ms|0.0536976 ms|
|相对效率|2.75%|3.59%|12.46%|100%|

## SIMD 向量化读写

```cpp
// ···
constexpr size_t BM = 64;
constexpr size_t BN = 64;
constexpr size_t BK = 16;

constexpr size_t TM = 4;
constexpr size_t TN = 4;

// 定义向量大小（每次连续读写 4 个元素，对应 64-bit bf16 或 128-bit float）
constexpr size_t VEC_SIZE = 4;

// SIMD 向量化 Register Tiling GEMM
void gemm_simd_vectorized(size_t M, size_t N, size_t K, bf16* A, bf16* B, float* C, queue q)
{
    range<2> global_size{M / TM, N / TN};
    range<2> local_size{BM / TM, BN / TN};

    q.submit([&](handler& h) {
        local_accessor<bf16, 2> tileA(range<2>{BM, BK}, h);
        local_accessor<bf16, 2> tileB(range<2>{BK, BN}, h);

        h.parallel_for(nd_range<2>(global_size, local_size), [=](nd_item<2> item) {
            int wg_row = item.get_group(0);
            int wg_col = item.get_group(1);

            int local_row = item.get_local_id(0);
            int local_col = item.get_local_id(1);

            float acc[TM][TN] = {0.0f};

            int tid = local_row * (BN / TN) + local_col;
            int threads_per_group = (BM / TM) * (BN / TN); // 256 个线程

            for (size_t bk = 0; bk < K; bk += BK) {
                
                // --- A. 向量化从 Global Memory 加载到 Local Memory ---
                // 协同加载 tileA
                for (int i = tid * VEC_SIZE; i < BM * BK; i += threads_per_group * VEC_SIZE) {
                    int a_r = i / BK;
                    int a_c = i % BK;
                    int g_r = wg_row * BM + a_r;
                    int g_c = bk + a_c;

                    if (g_r < M && (g_c + VEC_SIZE - 1) < K) {
                        // 使用 reinterpret_cast 触发向量化 64-bit Load/Store
                        auto vec_a = *reinterpret_cast<const vec<bf16, VEC_SIZE>*>(&A[g_r * K + g_c]);
                        *reinterpret_cast<vec<bf16, VEC_SIZE>*>(&tileA[a_r][a_c]) = vec_a;
                    }
                }

                // 协同加载 tileB
                for (int i = tid * VEC_SIZE; i < BK * BN; i += threads_per_group * VEC_SIZE) {
                    int b_r = i / BN;
                    int b_c = i % BN;
                    int g_r = bk + b_r;
                    int g_c = wg_col * BN + b_c;

                    if (g_r < K && (g_c + VEC_SIZE - 1) < N) {
                        auto vec_b = *reinterpret_cast<const vec<bf16, VEC_SIZE>*>(&B[g_r * N + g_c]);
                        *reinterpret_cast<vec<bf16, VEC_SIZE>*>(&tileB[b_r][b_c]) = vec_b;
                    }
                }

                item.barrier(access::fence_space::local_space);

                // --- B. 从 Local Memory 向量化装载到寄存器并计算 ---
                for (int k = 0; k < BK; ++k) {
                    float regA[TM];
                    for (int m = 0; m < TM; ++m) {
                        regA[m] = static_cast<float>(tileA[local_row * TM + m][k]);
                    }

                    // 向量化读取 tileB 中连续的 TN 个元素
                    auto vec_tileB = *reinterpret_cast<const vec<bf16, VEC_SIZE>*>(&tileB[k][local_col * TN]);

                    for (int m = 0; m < TM; ++m) {
                        for (int n = 0; n < TN; ++n) {
                            acc[m][n] += regA[m] * static_cast<float>(vec_tileB[n]);
                        }
                    }
                }

                item.barrier(access::fence_space::local_space);
            }

            // --- C. 向量化写回全局内存 C ---
            for (int m = 0; m < TM; ++m) {
                int g_r = wg_row * BM + local_row * TM + m;
                int g_c = wg_col * BN + local_col * TN;

                if (g_r < M && (g_c + VEC_SIZE - 1) < N) {
                    vec<float, VEC_SIZE> vec_out;
                    for (int n = 0; n < TN; ++n) {
                        vec_out[n] = acc[m][n];
                    }
                    // 触发 128-bit 向量化写入 (4 x float)
                    *reinterpret_cast<vec<float, VEC_SIZE>*>(&C[g_r * N + g_c]) = vec_out;
                }
            }
        });
    });
}
// ···
```

结果如下：
```
SIMD Vectorized spent 273.737 ms
0.273737 ms per Run
C[0] = 1024 (Expected: 1024)
```

访存模式对速度提升也很明显：

||Naive实现|Tiling实现|Register Tiling实现|SIMD 向量化读写|oneMKL|
|:-:|:-:|:-:|:-:|:-:|:-:|
|总耗时|1951.73 ms|1492.32 ms|430.648 ms|273.737ms|53.6976 ms|
|单次耗时|1.95174 ms|1.49231 ms|0.430648 ms|0.273737 ms|0.0536976 ms|
|相对效率|2.75%|3.59%|12.46%|19.61%|100%|

# 三、利用专用张量硬件：SYCL Joint Matrix (XMX) 优化

## 硬件张量核心与 Joint Matrix 基础实现

通过前述的共享内存分块、寄存器分块与 SIMD 向量化读写，常规矢量 ALU 路径的性能已被基本榨干，相对 oneMKL 的效率达到 19.61%。若要进一步突破算力瓶颈，必须调用 Intel GPU 专为矩阵点积设计的硬件张量加速单元——Xe Matrix Extension（XMX）。

在 Intel Arc A770 (DG2) 上，每个 Xe Core 包含专门的 XMX 脉动阵列单元，支持硬件级点积累加指令（DPAS，Dot Product and Accumulate Systolic）。对于 `bfloat16` 输入与 `float` 累加，A770 的硬件块规格固定为 $M=8, N=8, K=16$。在标准 SYCL 框架中，可以通过官方的 Joint Matrix 扩展接口使用这套硬件单元：

```cpp
// 引入 Joint Matrix 扩展命名空间
using namespace sycl::ext::oneapi::experimental::matrix;

// Intel Arc A770 的 XMX bf16 硬件块形状: M=8, N=8, K=16
constexpr int TM = 8;
constexpr int TN = 8;
constexpr int TK = 16;

void gemm_joint_matrix(size_t M, size_t N, size_t K, bf16* A, bf16* B, float* C, queue q)
{
    constexpr size_t SG_SIZE = 16;
    range<2> global_size{M / TM, (N / TN) * SG_SIZE};
    range<2> local_size{1, SG_SIZE}; 

    q.submit([&](handler& h) {
        h.parallel_for(nd_range<2>(global_size, local_size), [=](nd_item<2> item) {
            auto sg = item.get_sub_group();

            int sg_row = item.get_group(0);
            int sg_col = item.get_group(1);

            // 1. 将原生 USM 指针转换为 global_space 地址空间的 multi_ptr
            auto pA = sycl::address_space_cast<sycl::access::address_space::global_space, sycl::access::decorated::no>(A);
            auto pB = sycl::address_space_cast<sycl::access::address_space::global_space, sycl::access::decorated::no>(B);
            auto pC = sycl::address_space_cast<sycl::access::address_space::global_space, sycl::access::decorated::no>(C);

            // 2. 声明硬件矩阵
            joint_matrix<sub_group, bf16, use::a, TM, TK, layout::row_major> sub_a;
            joint_matrix<sub_group, bf16, use::b, TK, TN, layout::row_major> sub_b;
            joint_matrix<sub_group, float, use::accumulator, TM, TN> sub_c;

            joint_matrix_fill(sg, sub_c, 0.0f);

            for (size_t k = 0; k < K; k += TK) {
                // 3. 使用转换后的 multi_ptr 进行 load
                joint_matrix_load(sg, sub_a, pA + (sg_row * TM) * K + k, K);
                joint_matrix_load(sg, sub_b, pB + k * N + (sg_col * TN), N);

                joint_matrix_mad(sg, sub_c, sub_a, sub_b, sub_c);
            }

            // 4. 使用转换后的 multi_ptr 进行 store
            joint_matrix_store(sg, sub_c, pC + (sg_row * TM) * N + (sg_col * TN), N, layout::row_major);
        });
    });
}
// ···
```

结果如下：

```
Joint Matrix spent: 430.931 ms
0.430931 ms per Run
C[0] = 1024 (Expected: 1024)
```

比较一下：

||Naive实现|Tiling实现|Register Tiling实现|SIMD 向量化读写|Joint Matrix 实现|oneMKL|
|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
|总耗时|1951.73 ms|1492.32 ms|430.648 ms|273.737ms|430.931 ms|53.6976 ms|
|单次耗时|1.95174 ms|1.49231 ms|0.430648 ms|0.273737 ms|0.430931 ms|0.0536976 ms|
|相对效率|2.75%|3.59%|12.46%|19.61%|12.46%|100%|

## Joint Matrix + SLM 读写实现

```cpp
// ···
// 针对 Intel Arc A770 优化的硬件块尺寸 (8x8x16)
constexpr int TM = 8;
constexpr int TN = 8;
constexpr int TK = 16;

// Work-Group 级 SLM Tile 尺寸
constexpr int BM = 32;
constexpr int BN = 32;
constexpr int BK = 16;

void gemm_joint_matrix_slm(size_t M, size_t N, size_t K, bf16* A, bf16* B, float* C, queue q)
{
    constexpr size_t SG_SIZE = 16;

    // 每个 Work-Group 内部包含 (BM/TM) x (BN/TN) = 4 x 4 = 16 个 Sub-Group
    // 每个 Sub-Group 包含 SG_SIZE(16) 个线程，因此 Work-Group 内总线程数为 4 x 64 = 256
    range<2> global_size{(M / BM) * (BM / TM), (N / BN) * (BN / TN) * SG_SIZE};
    range<2> local_size{BM / TM, (BN / TN) * SG_SIZE};

    q.submit([&](handler& h) {
        // 1. 分配 Work-Group 共享内存 (SLM)
        local_accessor<bf16, 2> tileA(range<2>{BM, BK}, h);
        local_accessor<bf16, 2> tileB(range<2>{BK, BN}, h);

        h.parallel_for(nd_range<2>(global_size, local_size), [=](nd_item<2> item) {
            auto sg = item.get_sub_group();

            // Work-Group ID
            int wg_row = item.get_group(0);
            int wg_col = item.get_group(1);

            // Sub-Group 在 Work-Group 内部的 2D 坐标 (范围均为 0~3)
            int sg_row_in_wg = item.get_local_id(0);
            int sg_col_in_wg = item.get_local_id(1) / SG_SIZE;

            // 线程在 Work-Group 内的线性 ID，用于协同加载数据到 SLM
            int local_tid = item.get_local_id(0) * (BN / TN * SG_SIZE) + item.get_local_id(1);
            int threads_per_wg = (BM / TM) * (BN / TN) * SG_SIZE; // 256

            // 全局内存 Global Pointer
            auto pA_global = sycl::address_space_cast<access::address_space::global_space, access::decorated::no>(A);
            auto pB_global = sycl::address_space_cast<access::address_space::global_space, access::decorated::no>(B);
            auto pC_global = sycl::address_space_cast<access::address_space::global_space, access::decorated::no>(C);

            // 声明 Joint Matrix 累加器与输入块
            joint_matrix<sub_group, bf16, use::a, TM, TK, layout::row_major> sub_a;
            joint_matrix<sub_group, bf16, use::b, TK, TN, layout::row_major> sub_b;
            joint_matrix<sub_group, float, use::accumulator, TM, TN> sub_c;

            joint_matrix_fill(sg, sub_c, 0.0f);

            // 2. 沿着 K 维度按 BK(16) 步进
            for (size_t bk = 0; bk < K; bk += BK) {

                // --- 阶段 A：协同从 Global Memory 加载数据到 SLM ---
                for (int i = local_tid; i < BM * BK; i += threads_per_wg) {
                    int r = i / BK;
                    int c = i % BK;
                    int g_r = wg_row * BM + r;
                    int g_c = bk + c;
                    tileA[r][c] = (g_r < M && g_c < K) ? A[g_r * K + g_c] : static_cast<bf16>(0.0f);
                }

                for (int i = local_tid; i < BK * BN; i += threads_per_wg) {
                    int r = i / BN;
                    int c = i % BN;
                    int g_r = bk + r;
                    int g_c = wg_col * BN + c;
                    tileB[r][c] = (g_r < K && g_c < N) ? B[g_r * N + g_c] : static_cast<bf16>(0.0f);
                }

                // 屏障同步：等待 Work-Group 协作加载 SLM 完成
                item.barrier(access::fence_space::local_space);

                // --- 阶段 B：从 SLM 加载到 Joint Matrix 寄存器 ---
                // 获取指向 SLM 中当前 Sub-Group 负责切片的指针，注意地址空间设为 local_space
                auto pA_slm = sycl::address_space_cast<access::address_space::local_space, access::decorated::no>(&tileA[sg_row_in_wg * TM][0]);
                auto pB_slm = sycl::address_space_cast<access::address_space::local_space, access::decorated::no>(&tileB[0][sg_col_in_wg * TN]);

                // 从 SLM 中加载到 sub_a 和 sub_b (stride 分别为 BK 和 BN)
                joint_matrix_load(sg, sub_a, pA_slm, BK);
                joint_matrix_load(sg, sub_b, pB_slm, BN);

                // --- 阶段 C：XMX 硬件计算 ---
                joint_matrix_mad(sg, sub_c, sub_a, sub_b, sub_c);

                // 屏障同步：防止下一轮循环提前覆盖 SLM
                item.barrier(access::fence_space::local_space);
            }

            // 3. 将计算结果直接写回 Global Memory
            int global_r = wg_row * BM + sg_row_in_wg * TM;
            int global_c = wg_col * BN + sg_col_in_wg * TN;
            joint_matrix_store(sg, sub_c, pC_global + global_r * N + global_c, N, layout::row_major);
        });
    });
}
// ···
```

结果反而变慢：
```
Joint Matrix with SLM spent: 629.883 ms
0.629883 ms per Run
C[0] = 1024 (Expected: 1024)
```

对比结果：
||Naive实现|Tiling实现|Register Tiling实现|SIMD 向量化读写|Joint Matrix 实现|Joint Matrix + 基础SLM|oneMKL|
|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
|总耗时|1951.73 ms|1492.32 ms|430.648 ms|273.737ms|430.931 ms|629.883 ms|53.6976 ms|
|单次耗时|1.95174 ms|1.49231 ms|0.430648 ms|0.273737 ms|0.430931 ms|0.629883 ms|0.0536976 ms|
|相对效率|2.75%|3.59%|12.46%|19.61%|12.46%|8.52%|100%|

## Joint Matrix + SLM + Prefetch 实现

在共享内存（SLM）实现的基础上，我们引入 `sycl::ext::oneapi::experimental::prefetch` 原语为内核增加软件异步预取：在计算当前 K 块之前，先按行把下一个 K 块的 `tileA`/`tileB` 从全局显存预取到 L2 缓存，使访存延迟和 XMX 计算尽量重叠。预取指令置于每一轮 K 循环的开头，使下一个块拥有整整一轮“加载 SLM + 计算”的时间窗口落入 L2。

```cpp
// ···
// 记得引入 prefetch 扩展头文件
#include <sycl/ext/oneapi/experimental/prefetch.hpp>

// 针对 Intel Arc A770 优化的硬件块尺寸 (8x8x16)
constexpr int TM = 8;
constexpr int TN = 8;
constexpr int TK = 16;

// Work-Group 级 SLM Tile 尺寸
constexpr int BM = 32;
constexpr int BN = 32;
constexpr int BK = 16;
// ···
void gemm_joint_matrix_prefetch(size_t M, size_t N, size_t K, bf16* A, bf16* B, float* C, queue q)
{
    constexpr size_t SG_SIZE = 16;

    range<2> global_size{(M / BM) * (BM / TM), (N / BN) * (BN / TN) * SG_SIZE};
    range<2> local_size{BM / TM, (BN / TN) * SG_SIZE};

    q.submit([&](handler& h) {
        local_accessor<bf16, 2> tileA(range<2>{BM, BK}, h);
        local_accessor<bf16, 2> tileB(range<2>{BK, BN}, h);

        h.parallel_for(nd_range<2>(global_size, local_size), [=](nd_item<2> item) {
            auto sg = item.get_sub_group();

            int wg_row = item.get_group(0);
            int wg_col = item.get_group(1);

            int sg_row_in_wg = item.get_local_id(0);
            int sg_col_in_wg = item.get_local_id(1) / SG_SIZE;

            int local_tid = item.get_local_id(0) * (BN / TN * SG_SIZE) + item.get_local_id(1);
            int threads_per_wg = (BM / TM) * (BN / TN) * SG_SIZE; // 256

            auto pA_global = sycl::address_space_cast<access::address_space::global_space, access::decorated::no>(A);
            auto pB_global = sycl::address_space_cast<access::address_space::global_space, access::decorated::no>(B);
            auto pC_global = sycl::address_space_cast<access::address_space::global_space, access::decorated::no>(C);

            // 预取下一个 K 块：提前把下一轮要读的 tileA/tileB 拉到 L2
            auto prefetch_next_block = [&](size_t next_bk) {
                if (next_bk >= K) return;

                // tileA 的 BM 行，每行连续 BK 个元素，由前 BM 个线程各预取一行
                if (local_tid < BM) {
                    int r = local_tid;
                    auto p_next_a = pA_global + (wg_row * BM + r) * K + next_bk;
                    sycl::ext::oneapi::experimental::prefetch(p_next_a, BK,
                        sycl::ext::oneapi::experimental::properties(
                            sycl::ext::oneapi::experimental::prefetch_hint_L2));
                }

                // tileB 的 BK 行，每行连续 BN 个元素，由前 BK 个线程各预取一行
                if (local_tid < BK) {
                    int r = local_tid;
                    auto p_next_b = pB_global + (next_bk + r) * N + wg_col * BN;
                    sycl::ext::oneapi::experimental::prefetch(p_next_b, BN,
                        sycl::ext::oneapi::experimental::properties(
                            sycl::ext::oneapi::experimental::prefetch_hint_L2));
                }
            };

            joint_matrix<sub_group, bf16, use::a, TM, TK, layout::row_major> sub_a;
            joint_matrix<sub_group, bf16, use::b, TK, TN, layout::row_major> sub_b;
            joint_matrix<sub_group, float, use::accumulator, TM, TN> sub_c;

            joint_matrix_fill(sg, sub_c, 0.0f);

            // 进入循环前先预取第 0 个块
            prefetch_next_block(0);

            for (size_t bk = 0; bk < K; bk += BK) {

                // 本轮开始时预取下一个 K 块，让它有整整一轮加载+计算的提前量
                prefetch_next_block(bk + BK);

                // --- 阶段 A：协同从 Global Memory 加载数据到 SLM ---
                for (int i = local_tid; i < BM * BK; i += threads_per_wg) {
                    int r = i / BK;
                    int c = i % BK;
                    int g_r = wg_row * BM + r;
                    int g_c = bk + c;
                    tileA[r][c] = (g_r < M && g_c < K) ? A[g_r * K + g_c] : static_cast<bf16>(0.0f);
                }

                for (int i = local_tid; i < BK * BN; i += threads_per_wg) {
                    int r = i / BN;
                    int c = i % BN;
                    int g_r = bk + r;
                    int g_c = wg_col * BN + c;
                    tileB[r][c] = (g_r < K && g_c < N) ? B[g_r * N + g_c] : static_cast<bf16>(0.0f);
                }

                item.barrier(access::fence_space::local_space);

                // --- 阶段 B：从 SLM 加载到 Joint Matrix 寄存器 ---
                auto pA_slm = sycl::address_space_cast<access::address_space::local_space, access::decorated::no>(&tileA[sg_row_in_wg * TM][0]);
                auto pB_slm = sycl::address_space_cast<access::address_space::local_space, access::decorated::no>(&tileB[0][sg_col_in_wg * TN]);

                joint_matrix_load(sg, sub_a, pA_slm, BK);
                joint_matrix_load(sg, sub_b, pB_slm, BN);

                // --- 阶段 C：XMX 硬件计算 ---
                joint_matrix_mad(sg, sub_c, sub_a, sub_b, sub_c);

                item.barrier(access::fence_space::local_space);
            }

            // 3. 将计算结果直接写回 Global Memory
            int global_r = wg_row * BM + sg_row_in_wg * TM;
            int global_c = wg_col * BN + sg_col_in_wg * TN;
            joint_matrix_store(sg, sub_c, pC_global + global_r * N + global_c, N, layout::row_major);
        });
    });
}
// ···
```

结果如下：
```
Joint Matrix with Prefetch Spent: 660.607 ms
Joint Matrix with Prefetch GEMM average time: 0.660607 ms per Run
C[0] = 1024 (Expected: 1024)
```

对比结果：
||Naive实现|Tiling实现|Register Tiling实现|SIMD 向量化读写|Joint Matrix 实现|Joint Matrix + 基础SLM|Joint Matrix + SLM + Prefetch|oneMKL|
|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
|总耗时|1951.73 ms|1492.32 ms|430.648 ms|273.737ms|430.931 ms|629.883 ms|660.607 ms|53.6976 ms|
|单次耗时|1.95174 ms|1.49231 ms|0.430648 ms|0.273737 ms|0.430931 ms|0.629883 ms|0.660607 ms|0.0536976 ms|
|相对效率|2.75%|3.59%|12.46%|19.61%|12.46%|8.52%|8.13%|100%|

本轮 prefetch 没有带来收益，反而比基础 SLM 版本慢约 5%（同一会话重测基础 SLM 约 640 ms）。A/B bf16 输入合计约 2.5 MiB，小于 A770 的 16 MiB L2，反复使用相同输入可能使 DRAM 延迟不再主导；但容量能容纳不等于已确认全部常驻。额外预取指令开销是候选解释，应结合缓存命中和消息指令统计验证。下一步尝试 Double Buffering，为下一块加载与当前块计算创造重叠机会；实际重叠程度仍取决于生成指令和依赖关系。

## Joint Matrix + SLM + Double Buffering（软件流水线）实现

这一节把 SLM 改成双缓冲，并使用软件流水线让“下一个 K 块的 global → SLM 加载”与“当前块的 XMX 计算”重叠：一组缓冲负责计算，另一组缓冲同时接收下一块数据，每轮循环只保留一个屏障。

```cpp
// ···
// 针对 Intel Arc A770 优化的硬件块尺寸 (8x8x16)
constexpr int TM = 8;
constexpr int TN = 8;
constexpr int TK = 16;

// Work-Group 级 SLM Tile 尺寸
constexpr int BM = 32;
constexpr int BN = 32;
constexpr int BK = 16;

void gemm_joint_matrix_double_buffer(size_t M, size_t N, size_t K, bf16* A, bf16* B, float* C, queue q)
{
    constexpr size_t SG_SIZE = 16;

    range<2> global_size{(M / BM) * (BM / TM), (N / BN) * (BN / TN) * SG_SIZE};
    range<2> local_size{BM / TM, (BN / TN) * SG_SIZE};

    q.submit([&](handler& h) {
        // 1. 分配双缓冲 SLM：两组 tile 交替作为计算缓冲与加载缓冲
        local_accessor<bf16, 3> tileA(range<3>{2, BM, BK}, h);
        local_accessor<bf16, 3> tileB(range<3>{2, BK, BN}, h);

        h.parallel_for(nd_range<2>(global_size, local_size), [=](nd_item<2> item) {
            auto sg = item.get_sub_group();

            int wg_row = item.get_group(0);
            int wg_col = item.get_group(1);

            int sg_row_in_wg = item.get_local_id(0);
            int sg_col_in_wg = item.get_local_id(1) / SG_SIZE;

            int local_tid = item.get_local_id(0) * (BN / TN * SG_SIZE) + item.get_local_id(1);
            int threads_per_wg = (BM / TM) * (BN / TN) * SG_SIZE; // 256

            auto pA_global = sycl::address_space_cast<access::address_space::global_space, access::decorated::no>(A);
            auto pB_global = sycl::address_space_cast<access::address_space::global_space, access::decorated::no>(B);
            auto pC_global = sycl::address_space_cast<access::address_space::global_space, access::decorated::no>(C);

            // 协同加载指定 K 块到指定缓冲
            auto load_block = [&](int buf, size_t bk) {
                for (int i = local_tid; i < BM * BK; i += threads_per_wg) {
                    int r = i / BK;
                    int c = i % BK;
                    int g_r = wg_row * BM + r;
                    int g_c = bk + c;
                    tileA[buf][r][c] = (g_r < M && g_c < K) ? A[g_r * K + g_c] : static_cast<bf16>(0.0f);
                }

                for (int i = local_tid; i < BK * BN; i += threads_per_wg) {
                    int r = i / BN;
                    int c = i % BN;
                    int g_r = bk + r;
                    int g_c = wg_col * BN + c;
                    tileB[buf][r][c] = (g_r < K && g_c < N) ? B[g_r * N + g_c] : static_cast<bf16>(0.0f);
                }
            };

            joint_matrix<sub_group, bf16, use::a, TM, TK, layout::row_major> sub_a;
            joint_matrix<sub_group, bf16, use::b, TK, TN, layout::row_major> sub_b;
            joint_matrix<sub_group, float, use::accumulator, TM, TN> sub_c;

            joint_matrix_fill(sg, sub_c, 0.0f);

            // 2. 软件流水线前奏：先把第 0 个 K 块加载进缓冲 0
            load_block(0, 0);
            item.barrier(access::fence_space::local_space);

            // 3. 主循环：计算当前块的同时，把下一个 K 块加载进另一个缓冲
            for (size_t bk = 0; bk < K; bk += BK) {
                int cur = (bk / BK) % 2;
                int nxt = cur ^ 1;

                // --- 阶段 A：把下一个 K 块加载到备用缓冲，与下面的 XMX 计算重叠 ---
                if (bk + BK < K) {
                    load_block(nxt, bk + BK);
                }

                // --- 阶段 B：从当前缓冲加载到 Joint Matrix 寄存器 ---
                auto pA_slm = sycl::address_space_cast<access::address_space::local_space, access::decorated::no>(&tileA[cur][sg_row_in_wg * TM][0]);
                auto pB_slm = sycl::address_space_cast<access::address_space::local_space, access::decorated::no>(&tileB[cur][0][sg_col_in_wg * TN]);

                joint_matrix_load(sg, sub_a, pA_slm, BK);
                joint_matrix_load(sg, sub_b, pB_slm, BN);

                // --- 阶段 C：XMX 硬件计算 ---
                joint_matrix_mad(sg, sub_c, sub_a, sub_b, sub_c);

                // 屏障同步：当前块计算完毕，旧的当前缓冲可被覆盖；下一个块加载对全部线程可见
                item.barrier(access::fence_space::local_space);
            }

            // 4. 将计算结果直接写回 Global Memory
            int global_r = wg_row * BM + sg_row_in_wg * TM;
            int global_c = wg_col * BN + sg_col_in_wg * TN;
            joint_matrix_store(sg, sub_c, pC_global + global_r * N + global_c, N, layout::row_major);
        });
    });
}
// ···
```

结果如下：
```
Joint Matrix with Double Buffer Spent: 669.505 ms
Joint Matrix with Double Buffer GEMM average time: 0.669505 ms per Run
C[0] = 1024 (Expected: 1024)
```

对比结果：
||Naive实现|Tiling实现|Register Tiling实现|SIMD 向量化读写|Joint Matrix 实现|Joint Matrix + 基础SLM|Joint Matrix + SLM + Prefetch|Joint Matrix + SLM + Double Buffer|oneMKL|
|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
|总耗时|1951.73 ms|1492.32 ms|430.648 ms|273.737ms|430.931 ms|629.883 ms|660.607 ms|669.505 ms|53.6976 ms|
|单次耗时|1.95174 ms|1.49231 ms|0.430648 ms|0.273737 ms|0.430931 ms|0.629883 ms|0.660607 ms|0.669505 ms|0.0536976 ms|
|相对效率|2.75%|3.59%|12.46%|19.61%|12.46%|8.52%|8.13%|8.02%|100%|

双缓冲 + 软件流水线在这个配置下同样没有带来提升（多次运行稳定在 669.5 ~ 671.6 ms，同一会话中基础 SLM 约为 639.7 ms）。原因是 `BM = BN = 32` 的 tile 太小：每个 Work-Group 每个 K 块只有 16 个 Sub-Group 各做一次 8x8x16 的 XMX 计算，计算时间太短，加载指令、SLM 读写和屏障开销依然是主导；双缓冲只是把加载和这段很短的计算重叠，屏障仍然要等最慢的加载完成，双份 SLM 与 3D 寻址还带来了额外开销。要让流水线真正吃饱，下一步应该增大 `BM`/`BN`（例如 64x64 或 128x128），提高每次加载对应的 XMX 计算量，或者把协作加载改成向量化读写。

## Joint Matrix + SLM + 大 Tile + GRF 实现

上一节的结论是 `BM = BN = 32` 太小。这一节把 Work-Group 级 tile 增大到 64x64，并让每个 Sub-Group 使用 GRF（General Register File）持有 16x16 的输出块：也就是 2x2 个 8x8 joint matrix 累加器，配合 2 个 A 切片和 2 个 B 切片，每个 K 块执行 4 次 XMX MAD。这样从 SLM 读入的 A/B 数据会在 GRF 中被复用 4 次，计算/加载比直接翻倍，双缓冲 + 软件流水线保持不变。

```cpp
// ···
// 针对 Intel Arc A770 优化的硬件块尺寸 (8x8x16)
constexpr int TM = 8;
constexpr int TN = 8;
constexpr int TK = 16;

// Sub-Group 级 GRF 寄存器块：16x16 = 2x2 个 8x8 joint matrix 累加器
constexpr int TM_SG = 16;
constexpr int TN_SG = 16;

// Work-Group 级 SLM Tile 尺寸
constexpr int BM = 64;
constexpr int BN = 64;
constexpr int BK = 16;

void gemm_joint_matrix_grf(size_t M, size_t N, size_t K, bf16* A, bf16* B, float* C, queue q)
{
    constexpr size_t SG_SIZE = 16;

    // 每个 Work-Group 内部包含 (BM/TM_SG) x (BN/TN_SG) = 4 x 4 = 16 个 Sub-Group
    // 每个 Sub-Group 包含 SG_SIZE(16) 个线程，因此 Work-Group 内总线程数为 4 x 64 = 256
    range<2> global_size{(M / BM) * (BM / TM_SG), (N / BN) * (BN / TN_SG) * SG_SIZE};
    range<2> local_size{BM / TM_SG, (BN / TN_SG) * SG_SIZE};

    q.submit([&](handler& h) {
        // 1. 分配双缓冲 SLM：两组 tile 交替作为计算缓冲与加载缓冲
        local_accessor<bf16, 3> tileA(range<3>{2, BM, BK}, h);
        local_accessor<bf16, 3> tileB(range<3>{2, BK, BN}, h);

        h.parallel_for(nd_range<2>(global_size, local_size), [=](nd_item<2> item) {
            auto sg = item.get_sub_group();

            int wg_row = item.get_group(0);
            int wg_col = item.get_group(1);

            // Sub-Group 在 Work-Group 内部的 2D 坐标 (范围均为 0~3)
            int sg_row_in_wg = item.get_local_id(0);
            int sg_col_in_wg = item.get_local_id(1) / SG_SIZE;

            int local_tid = item.get_local_id(0) * (BN / TN_SG * SG_SIZE) + item.get_local_id(1);
            int threads_per_wg = (BM / TM_SG) * (BN / TN_SG) * SG_SIZE; // 256

            auto pA_global = sycl::address_space_cast<access::address_space::global_space, access::decorated::no>(A);
            auto pB_global = sycl::address_space_cast<access::address_space::global_space, access::decorated::no>(B);
            auto pC_global = sycl::address_space_cast<access::address_space::global_space, access::decorated::no>(C);

            // 协同加载指定 K 块到指定缓冲
            auto load_block = [&](int buf, size_t bk) {
                for (int i = local_tid; i < BM * BK; i += threads_per_wg) {
                    int r = i / BK;
                    int c = i % BK;
                    int g_r = wg_row * BM + r;
                    int g_c = bk + c;
                    tileA[buf][r][c] = (g_r < M && g_c < K) ? A[g_r * K + g_c] : static_cast<bf16>(0.0f);
                }

                for (int i = local_tid; i < BK * BN; i += threads_per_wg) {
                    int r = i / BN;
                    int c = i % BN;
                    int g_r = bk + r;
                    int g_c = wg_col * BN + c;
                    tileB[buf][r][c] = (g_r < K && g_c < N) ? B[g_r * N + g_c] : static_cast<bf16>(0.0f);
                }
            };

            // 声明 Joint Matrix 累加器与输入块：每个 Sub-Group 用 GRF 持有 16x16 输出块
            joint_matrix<sub_group, bf16, use::a, TM, TK, layout::row_major> sub_a0;
            joint_matrix<sub_group, bf16, use::a, TM, TK, layout::row_major> sub_a1;
            joint_matrix<sub_group, bf16, use::b, TK, TN, layout::row_major> sub_b0;
            joint_matrix<sub_group, bf16, use::b, TK, TN, layout::row_major> sub_b1;
            joint_matrix<sub_group, float, use::accumulator, TM, TN> sub_c00;
            joint_matrix<sub_group, float, use::accumulator, TM, TN> sub_c01;
            joint_matrix<sub_group, float, use::accumulator, TM, TN> sub_c10;
            joint_matrix<sub_group, float, use::accumulator, TM, TN> sub_c11;

            joint_matrix_fill(sg, sub_c00, 0.0f);
            joint_matrix_fill(sg, sub_c01, 0.0f);
            joint_matrix_fill(sg, sub_c10, 0.0f);
            joint_matrix_fill(sg, sub_c11, 0.0f);

            // 2. 软件流水线前奏：先把第 0 个 K 块加载进缓冲 0
            load_block(0, 0);
            item.barrier(access::fence_space::local_space);

            // 3. 主循环：计算当前块的同时，把下一个 K 块加载进另一个缓冲
            for (size_t bk = 0; bk < K; bk += BK) {
                int cur = (bk / BK) % 2;
                int nxt = cur ^ 1;

                // --- 阶段 A：把下一个 K 块加载到备用缓冲，与下面的 XMX 计算重叠 ---
                if (bk + BK < K) {
                    load_block(nxt, bk + BK);
                }

                // --- 阶段 B：从当前缓冲加载 A/B 切片到 GRF 寄存器 ---
                auto pA_slm0 = sycl::address_space_cast<access::address_space::local_space, access::decorated::no>(&tileA[cur][sg_row_in_wg * TM_SG][0]);
                auto pA_slm1 = sycl::address_space_cast<access::address_space::local_space, access::decorated::no>(&tileA[cur][sg_row_in_wg * TM_SG + TM][0]);
                auto pB_slm0 = sycl::address_space_cast<access::address_space::local_space, access::decorated::no>(&tileB[cur][0][sg_col_in_wg * TN_SG]);
                auto pB_slm1 = sycl::address_space_cast<access::address_space::local_space, access::decorated::no>(&tileB[cur][0][sg_col_in_wg * TN_SG + TN]);

                joint_matrix_load(sg, sub_a0, pA_slm0, BK);
                joint_matrix_load(sg, sub_a1, pA_slm1, BK);
                joint_matrix_load(sg, sub_b0, pB_slm0, BN);
                joint_matrix_load(sg, sub_b1, pB_slm1, BN);

                // --- 阶段 C：4 次 8x8x16 XMX 计算，A/B 数据在 GRF 中复用 ---
                joint_matrix_mad(sg, sub_c00, sub_a0, sub_b0, sub_c00);
                joint_matrix_mad(sg, sub_c01, sub_a0, sub_b1, sub_c01);
                joint_matrix_mad(sg, sub_c10, sub_a1, sub_b0, sub_c10);
                joint_matrix_mad(sg, sub_c11, sub_a1, sub_b1, sub_c11);

                // 屏障同步：当前块计算完毕，旧的当前缓冲可被覆盖；下一个块加载对全部线程可见
                item.barrier(access::fence_space::local_space);
            }

            // 4. 将 16x16 GRF 寄存器块写回 Global Memory
            int global_r = wg_row * BM + sg_row_in_wg * TM_SG;
            int global_c = wg_col * BN + sg_col_in_wg * TN_SG;
            joint_matrix_store(sg, sub_c00, pC_global + global_r * N + global_c, N, layout::row_major);
            joint_matrix_store(sg, sub_c01, pC_global + global_r * N + global_c + TN, N, layout::row_major);
            joint_matrix_store(sg, sub_c10, pC_global + (global_r + TM) * N + global_c, N, layout::row_major);
            joint_matrix_store(sg, sub_c11, pC_global + (global_r + TM) * N + global_c + TN, N, layout::row_major);
        });
    });
}
// ···
```

结果如下：
```
Joint Matrix with GRF Spent: 356.372 ms
Joint Matrix with GRF GEMM average time: 0.356372 ms per Run
C[0] = 1024 (Expected: 1024)
```

对比结果：
||Naive实现|Tiling实现|Register Tiling实现|SIMD 向量化读写|Joint Matrix 实现|Joint Matrix + 基础SLM|Joint Matrix + SLM + Prefetch|Joint Matrix + SLM + Double Buffer|Joint Matrix + SLM + 大Tile + GRF|oneMKL|
|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
|总耗时|1951.73 ms|1492.32 ms|430.648 ms|273.737ms|430.931 ms|629.883 ms|660.607 ms|669.505 ms|356.372 ms|53.6976 ms|
|单次耗时|1.95174 ms|1.49231 ms|0.430648 ms|0.273737 ms|0.430931 ms|0.629883 ms|0.660607 ms|0.669505 ms|0.356372 ms|0.0536976 ms|
|相对效率|2.75%|3.59%|12.46%|19.61%|12.46%|8.52%|8.13%|8.02%|15.07%|100%|

这次提升非常明显（多次运行稳定在 356 ~ 358 ms）：相比纯 Joint Matrix（430.931 ms）快约 21%，相比基础 SLM（629.883 ms）快约 77%，相比双缓冲版本（669.505 ms）快约 88%。原因有两方面：`BM/BN` 从 32 增大到 64 后，每个 K 块的加载量只翻倍，但每个 Sub-Group 的 XMX 计算量翻了 4 倍（4 次 8x8x16 MAD），计算/加载比提升；同时 16x16 的 GRF 寄存器块让 A/B 切片被复用 4 次，大幅摊薄了 SLM 读取和屏障开销。这也验证了上一节的判断：小 tile 下 SLM 和双缓冲的收益被过小的计算量掩盖了。

## Joint Matrix + SLM + 按 A770 硬件规格调参实现

A770 的关键硬件规格：

|硬件规格|数值|
|:-:|:-:|
|Hardware Thread Count|4096|
|Number of General Register File per Thread|128|
|Register Width|256 bits (32B)|

按数据字节数估算，一个 8x8 float 累加器为 256B，即 8 个 32B GRF 的数据量；8x16 bf16 A 切片和 16x8 bf16 B 切片也各为 256B。下述 GRF 数值只是操作数数据量估算，不包含临时量、地址、填充和编译器分配，不能据此确认实际寄存器占用或溢出。Joint Matrix 的 subgroup 协作布局与 ESIMD work-item 的显式向量布局也不能混为一谈。我们尝试了三组参数：

1. **16x32 寄存器块**：8 个累加器 + 2 个 A 切片 + 4 个 B 切片，操作数数据量约 112 个 GRF，实测 444.701 ms；是否发生 spill 需检查编译报告或反汇编。
2. **16x16 + BK=32**：4 个累加器 + 8 个 A/B 切片，数据占用约 `96/128` GRF，实测 455.252 ms，SLM 占用翻倍到 16KB/Work-Group，也没有提升。
3. **最终方案**：保持 16x16 寄存器块，把 `BM` 增大到 128、`BN` 保持 64，每组 512 个 SYCL work-item；本轮实测最快。共 `8 × 24 × 512 = 98304` 个 work-item，在 subgroup size=8 的划分下为 12288 个 subgroup。不能把 work-item 数直接除以 4096 个硬件线程槽称作“24 个满波次”；实际 SIMD 映射、工作组分配及资源限制需另行核对。

```cpp
// ···
// 针对 Intel Arc A770 优化的硬件块尺寸 (8x8x16)
constexpr int TM = 8;
constexpr int TN = 8;
constexpr int TK = 16;

// Sub-Group 级 GRF 寄存器块：16x16 = 2x2 个 8x8 joint matrix 累加器
// 4 个 float 累加器（1KB）+ 2 个 A 切片 + 2 个 B 切片（bf16 共 1KB）
// 合计约 2KB = 64 个 256-bit GRF，留出余量避免寄存器溢出
constexpr int TM_SG = 16;
constexpr int TN_SG = 16;

// Work-Group 级 SLM Tile 尺寸
constexpr int BM = 128;
constexpr int BN = 64;
constexpr int BK = 16;

void gemm_joint_matrix_tuned(size_t M, size_t N, size_t K, bf16* A, bf16* B, float* C, queue q)
{
    constexpr size_t SG_SIZE = 16;

    // 每个 Work-Group 内部包含 (BM/TM_SG) x (BN/TN_SG) = 8 x 4 = 32 个 Sub-Group
    // 每个 Sub-Group 包含 SG_SIZE(16) 个线程，因此 Work-Group 内总线程数为 32 x 16 = 512
    range<2> global_size{(M / BM) * (BM / TM_SG), (N / BN) * (BN / TN_SG) * SG_SIZE};
    range<2> local_size{BM / TM_SG, (BN / TN_SG) * SG_SIZE};

    q.submit([&](handler& h) {
        // 1. 分配双缓冲 SLM：两组 tile 交替作为计算缓冲与加载缓冲
        local_accessor<bf16, 3> tileA(range<3>{2, BM, BK}, h);
        local_accessor<bf16, 3> tileB(range<3>{2, BK, BN}, h);

        h.parallel_for(nd_range<2>(global_size, local_size), [=](nd_item<2> item) {
            auto sg = item.get_sub_group();

            int wg_row = item.get_group(0);
            int wg_col = item.get_group(1);

            // Sub-Group 在 Work-Group 内部的 2D 坐标 (范围均为 0~3)
            int sg_row_in_wg = item.get_local_id(0);
            int sg_col_in_wg = item.get_local_id(1) / SG_SIZE;

            int local_tid = item.get_local_id(0) * (BN / TN_SG * SG_SIZE) + item.get_local_id(1);
            int threads_per_wg = (BM / TM_SG) * (BN / TN_SG) * SG_SIZE; // 512

            auto pA_global = sycl::address_space_cast<access::address_space::global_space, access::decorated::no>(A);
            auto pB_global = sycl::address_space_cast<access::address_space::global_space, access::decorated::no>(B);
            auto pC_global = sycl::address_space_cast<access::address_space::global_space, access::decorated::no>(C);

            // 协同加载指定 K 块到指定缓冲
            auto load_block = [&](int buf, size_t bk) {
                for (int i = local_tid; i < BM * BK; i += threads_per_wg) {
                    int r = i / BK;
                    int c = i % BK;
                    int g_r = wg_row * BM + r;
                    int g_c = bk + c;
                    tileA[buf][r][c] = (g_r < M && g_c < K) ? A[g_r * K + g_c] : static_cast<bf16>(0.0f);
                }

                for (int i = local_tid; i < BK * BN; i += threads_per_wg) {
                    int r = i / BN;
                    int c = i % BN;
                    int g_r = bk + r;
                    int g_c = wg_col * BN + c;
                    tileB[buf][r][c] = (g_r < K && g_c < N) ? B[g_r * N + g_c] : static_cast<bf16>(0.0f);
                }
            };

            // 声明 Joint Matrix 累加器与输入块：每个 Sub-Group 用 GRF 持有 16x16 输出块
            joint_matrix<sub_group, bf16, use::a, TM, TK, layout::row_major> sub_a0;
            joint_matrix<sub_group, bf16, use::a, TM, TK, layout::row_major> sub_a1;
            joint_matrix<sub_group, bf16, use::b, TK, TN, layout::row_major> sub_b0;
            joint_matrix<sub_group, bf16, use::b, TK, TN, layout::row_major> sub_b1;
            joint_matrix<sub_group, float, use::accumulator, TM, TN> sub_c00;
            joint_matrix<sub_group, float, use::accumulator, TM, TN> sub_c01;
            joint_matrix<sub_group, float, use::accumulator, TM, TN> sub_c10;
            joint_matrix<sub_group, float, use::accumulator, TM, TN> sub_c11;

            joint_matrix_fill(sg, sub_c00, 0.0f);
            joint_matrix_fill(sg, sub_c01, 0.0f);
            joint_matrix_fill(sg, sub_c10, 0.0f);
            joint_matrix_fill(sg, sub_c11, 0.0f);

            // 2. 软件流水线前奏：先把第 0 个 K 块加载进缓冲 0
            load_block(0, 0);
            item.barrier(access::fence_space::local_space);

            // 3. 主循环：计算当前块的同时，把下一个 K 块加载进另一个缓冲
            for (size_t bk = 0; bk < K; bk += BK) {
                int cur = (bk / BK) % 2;
                int nxt = cur ^ 1;

                // --- 阶段 A：把下一个 K 块加载到备用缓冲，与下面的 XMX 计算重叠 ---
                if (bk + BK < K) {
                    load_block(nxt, bk + BK);
                }

                // --- 阶段 B：从当前缓冲加载 A/B 切片到 GRF 寄存器 ---
                auto pA_slm0 = sycl::address_space_cast<access::address_space::local_space, access::decorated::no>(&tileA[cur][sg_row_in_wg * TM_SG][0]);
                auto pA_slm1 = sycl::address_space_cast<access::address_space::local_space, access::decorated::no>(&tileA[cur][sg_row_in_wg * TM_SG + TM][0]);
                auto pB_slm0 = sycl::address_space_cast<access::address_space::local_space, access::decorated::no>(&tileB[cur][0][sg_col_in_wg * TN_SG]);
                auto pB_slm1 = sycl::address_space_cast<access::address_space::local_space, access::decorated::no>(&tileB[cur][0][sg_col_in_wg * TN_SG + TN]);

                joint_matrix_load(sg, sub_a0, pA_slm0, BK);
                joint_matrix_load(sg, sub_a1, pA_slm1, BK);
                joint_matrix_load(sg, sub_b0, pB_slm0, BN);
                joint_matrix_load(sg, sub_b1, pB_slm1, BN);

                // --- 阶段 C：4 次 8x8x16 XMX 计算，A/B 数据在 GRF 中复用 ---
                joint_matrix_mad(sg, sub_c00, sub_a0, sub_b0, sub_c00);
                joint_matrix_mad(sg, sub_c01, sub_a0, sub_b1, sub_c01);
                joint_matrix_mad(sg, sub_c10, sub_a1, sub_b0, sub_c10);
                joint_matrix_mad(sg, sub_c11, sub_a1, sub_b1, sub_c11);

                // 屏障同步：当前块计算完毕，旧的当前缓冲可被覆盖；下一个块加载对全部线程可见
                item.barrier(access::fence_space::local_space);
            }

            // 4. 将 16x16 GRF 寄存器块写回 Global Memory
            int global_r = wg_row * BM + sg_row_in_wg * TM_SG;
            int global_c = wg_col * BN + sg_col_in_wg * TN_SG;
            joint_matrix_store(sg, sub_c00, pC_global + global_r * N + global_c, N, layout::row_major);
            joint_matrix_store(sg, sub_c01, pC_global + global_r * N + global_c + TN, N, layout::row_major);
            joint_matrix_store(sg, sub_c10, pC_global + (global_r + TM) * N + global_c, N, layout::row_major);
            joint_matrix_store(sg, sub_c11, pC_global + (global_r + TM) * N + global_c + TN, N, layout::row_major);
        });
    });
}
// ···
```

结果如下：
```
Joint Matrix Tuned Spent: 307.633 ms
Joint Matrix Tuned GEMM average time: 0.307633 ms per Run
C[0] = 1024 (Expected: 1024)
```

对比结果：
||Naive实现|Tiling实现|Register Tiling实现|SIMD 向量化读写|Joint Matrix 实现|Joint Matrix + 基础SLM|Joint Matrix + SLM + Prefetch|Joint Matrix + SLM + Double Buffer|Joint Matrix + SLM + 大Tile + GRF|Joint Matrix + SLM + 硬件调参|oneMKL|
|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
|总耗时|1951.73 ms|1492.32 ms|430.648 ms|273.737ms|430.931 ms|629.883 ms|660.607 ms|669.505 ms|356.372 ms|307.633 ms|53.6976 ms|
|单次耗时|1.95174 ms|1.49231 ms|0.430648 ms|0.273737 ms|0.430931 ms|0.629883 ms|0.660607 ms|0.669505 ms|0.356372 ms|0.307633 ms|0.0536976 ms|
|相对效率|2.75%|3.59%|12.46%|19.61%|12.46%|8.52%|8.13%|8.02%|15.07%|17.46%|100%|

历史调参结果在 305 ~ 308 ms，比上一版 356.372 ms 的耗时低约 14%，相对 oneMKL 的比例为 17.46%。这说明本轮增大工作组 tile 有收益；不能由此推出“work-item 总数是硬件线程数整数倍”是必要条件，也不能仅凭操作数估算确认实际 GRF 占用。

## Joint Matrix + SLM + VNNI Packed Data 实现

VNNI（Vector Neural Network Instructions）的 Packed Data 格式是 XMX 硬件直接消费的数据布局。查了 Intel 官方资料和 [intel/llvm](https://github.com/intel/llvm/blob/sycl/sycl/test-e2e/Matrix/joint_matrix_bfloat16.cpp) 的测试代码后确认：对于 Arc（DG2）上的 bf16，XMX DPAS 的 **B 操作数**需要按 VNNI 打包（VNNI factor = 2），也就是把同一列相邻两行 K 的两个 bf16 塞进一个 32-bit 字（低 16 位 = `B[2k][n]`，高 16 位 = `B[2k+1][n]`）；**A 保持 row-major**。SYCL 里通过 `layout::ext_intel_packed` 声明 B 的 `joint_matrix`，`joint_matrix_load` 就会按 packed 布局读取。

实现上，主机端先把 B 预打包成 `uint32_t B_packed[K/2][N]`（打包成本只算一次，不计入 kernel 计时），kernel 的 SLM B tile 也改成 `uint32_t` 存储，`load_block` 直接做 32-bit 整字拷贝；`sub_b` 声明为 `layout::ext_intel_packed`，加载时以 bf16 视角指向 packed 切片、行距传 `BN * 2`。

```cpp
// ···
#include <cstdint>
// ···
// 针对 Intel Arc A770 优化的硬件块尺寸 (8x8x16)
constexpr int TM = 8;
constexpr int TN = 8;
constexpr int TK = 16;

constexpr int TM_SG = 16;
constexpr int TN_SG = 16;

constexpr int BM = 128;
constexpr int BN = 64;
constexpr int BK = 16;

// B 使用 VNNI Packed 布局：bf16 按 K 两两打包进 32-bit（VF=2），A 保持 row-major
void gemm_joint_matrix_vnni(size_t M, size_t N, size_t K, bf16* A, uint32_t* B_packed, float* C, queue q)
{
    constexpr size_t SG_SIZE = 16;

    range<2> global_size{(M / BM) * (BM / TM_SG), (N / BN) * (BN / TN_SG) * SG_SIZE};
    range<2> local_size{BM / TM_SG, (BN / TN_SG) * SG_SIZE};

    q.submit([&](handler& h) {
        // A 保持 row-major，B 按 VNNI 打包存成 uint32（每字 = 2 个 bf16）
        local_accessor<bf16, 3> tileA(range<3>{2, BM, BK}, h);
        local_accessor<uint32_t, 3> tileB(range<3>{2, BK / 2, BN}, h);

        h.parallel_for(nd_range<2>(global_size, local_size), [=](nd_item<2> item) {
            auto sg = item.get_sub_group();

            int wg_row = item.get_group(0);
            int wg_col = item.get_group(1);

            int sg_row_in_wg = item.get_local_id(0);
            int sg_col_in_wg = item.get_local_id(1) / SG_SIZE;

            int local_tid = item.get_local_id(0) * (BN / TN_SG * SG_SIZE) + item.get_local_id(1);
            int threads_per_wg = (BM / TM_SG) * (BN / TN_SG) * SG_SIZE; // 512

            auto pA_global = sycl::address_space_cast<access::address_space::global_space, access::decorated::no>(A);
            auto pC_global = sycl::address_space_cast<access::address_space::global_space, access::decorated::no>(C);

            // 协同加载指定 K 块到指定缓冲
            auto load_block = [&](int buf, size_t bk) {
                for (int i = local_tid; i < BM * BK; i += threads_per_wg) {
                    int r = i / BK;
                    int c = i % BK;
                    int g_r = wg_row * BM + r;
                    int g_c = bk + c;
                    tileA[buf][r][c] = (g_r < M && g_c < K) ? A[g_r * K + g_c] : static_cast<bf16>(0.0f);
                }

                // B 已由主机端按 VNNI 打包：packed 行数只有 BK/2，每行 BN 个 uint32
                for (int i = local_tid; i < (BK / 2) * BN; i += threads_per_wg) {
                    int r = i / BN;
                    int c = i % BN;
                    int g_r = bk / 2 + r;
                    int g_c = wg_col * BN + c;
                    tileB[buf][r][c] = (g_r < K / 2 && g_c < N) ? B_packed[g_r * N + g_c] : 0u;
                }
            };

            joint_matrix<sub_group, bf16, use::a, TM, TK, layout::row_major> sub_a0;
            joint_matrix<sub_group, bf16, use::a, TM, TK, layout::row_major> sub_a1;
            joint_matrix<sub_group, bf16, use::b, TK, TN, layout::ext_intel_packed> sub_b0;
            joint_matrix<sub_group, bf16, use::b, TK, TN, layout::ext_intel_packed> sub_b1;
            joint_matrix<sub_group, float, use::accumulator, TM, TN> sub_c00;
            joint_matrix<sub_group, float, use::accumulator, TM, TN> sub_c01;
            joint_matrix<sub_group, float, use::accumulator, TM, TN> sub_c10;
            joint_matrix<sub_group, float, use::accumulator, TM, TN> sub_c11;

            joint_matrix_fill(sg, sub_c00, 0.0f);
            joint_matrix_fill(sg, sub_c01, 0.0f);
            joint_matrix_fill(sg, sub_c10, 0.0f);
            joint_matrix_fill(sg, sub_c11, 0.0f);

            load_block(0, 0);
            item.barrier(access::fence_space::local_space);

            for (size_t bk = 0; bk < K; bk += BK) {
                int cur = (bk / BK) % 2;
                int nxt = cur ^ 1;

                if (bk + BK < K) {
                    load_block(nxt, bk + BK);
                }

                auto pA_slm0 = sycl::address_space_cast<access::address_space::local_space, access::decorated::no>(&tileA[cur][sg_row_in_wg * TM_SG][0]);
                auto pA_slm1 = sycl::address_space_cast<access::address_space::local_space, access::decorated::no>(&tileA[cur][sg_row_in_wg * TM_SG + TM][0]);

                // 以 bf16 视角指向 VNNI 打包后的 B 切片，行距为 BN*2 个 bf16（=BN 个 uint32）
                auto pB_slm0 = sycl::address_space_cast<access::address_space::local_space, access::decorated::no>(
                    reinterpret_cast<bf16*>(&tileB[cur][0][sg_col_in_wg * TN_SG]));
                auto pB_slm1 = sycl::address_space_cast<access::address_space::local_space, access::decorated::no>(
                    reinterpret_cast<bf16*>(&tileB[cur][0][sg_col_in_wg * TN_SG + TN]));

                joint_matrix_load(sg, sub_a0, pA_slm0, BK);
                joint_matrix_load(sg, sub_a1, pA_slm1, BK);
                joint_matrix_load(sg, sub_b0, pB_slm0, BN * 2);
                joint_matrix_load(sg, sub_b1, pB_slm1, BN * 2);

                joint_matrix_mad(sg, sub_c00, sub_a0, sub_b0, sub_c00);
                joint_matrix_mad(sg, sub_c01, sub_a0, sub_b1, sub_c01);
                joint_matrix_mad(sg, sub_c10, sub_a1, sub_b0, sub_c10);
                joint_matrix_mad(sg, sub_c11, sub_a1, sub_b1, sub_c11);

                item.barrier(access::fence_space::local_space);
            }

            int global_r = wg_row * BM + sg_row_in_wg * TM_SG;
            int global_c = wg_col * BN + sg_col_in_wg * TN_SG;
            joint_matrix_store(sg, sub_c00, pC_global + global_r * N + global_c, N, layout::row_major);
            joint_matrix_store(sg, sub_c01, pC_global + global_r * N + global_c + TN, N, layout::row_major);
            joint_matrix_store(sg, sub_c10, pC_global + (global_r + TM) * N + global_c, N, layout::row_major);
            joint_matrix_store(sg, sub_c11, pC_global + (global_r + TM) * N + global_c + TN, N, layout::row_major);
        });
    });
}

// 主机端 VNNI 打包：低 16 位 = B[2k][n]，高 16 位 = B[2k+1][n]
for (size_t k2 = 0; k2 < K / 2; ++k2) {
    for (size_t n = 0; n < N; ++n) {
        uint16_t lo = sycl::bit_cast<uint16_t>(B[k2 * 2 * N + n]);
        uint16_t hi = sycl::bit_cast<uint16_t>(B[(k2 * 2 + 1) * N + n]);
        B_packed[k2 * N + n] = static_cast<uint32_t>(lo) | (static_cast<uint32_t>(hi) << 16);
    }
}
// ···
```

结果如下：
```
Joint Matrix with VNNI Spent: 234.17 ms
Joint Matrix with VNNI GEMM average time: 0.23417 ms per Run
C[0] = 1024 (Expected: 1024)
```

对比结果：
||Naive实现|Tiling实现|Register Tiling实现|SIMD 向量化读写|Joint Matrix 实现|Joint Matrix + 基础SLM|Joint Matrix + SLM + Prefetch|Joint Matrix + SLM + Double Buffer|Joint Matrix + SLM + 大Tile + GRF|Joint Matrix + SLM + 硬件调参|Joint Matrix + SLM + VNNI|oneMKL|
|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
|总耗时|1951.73 ms|1492.32 ms|430.648 ms|273.737ms|430.931 ms|629.883 ms|660.607 ms|669.505 ms|356.372 ms|307.633 ms|234.17 ms|53.6976 ms|
|单次耗时|1.95174 ms|1.49231 ms|0.430648 ms|0.273737 ms|0.430931 ms|0.629883 ms|0.660607 ms|0.669505 ms|0.356372 ms|0.307633 ms|0.23417 ms|0.0536976 ms|
|相对效率|2.75%|3.59%|12.46%|19.61%|12.46%|8.52%|8.13%|8.02%|15.07%|17.46%|22.93%|100%|

VNNI Packed Data 带来明显收益（多次运行稳定在 233 ~ 235 ms，相对效率来到 22.93%）：B 的 global→SLM 协作加载变成 32-bit 整字拷贝，每线程要处理的元素数减半；`ext_intel_packed` 的 `joint_matrix_load` 也直接按 DPAS 需要的 VNNI 格式搬运数据，省掉了寄存器里的两两重组。参考实现：[intel/llvm joint_matrix_bfloat16.cpp](https://github.com/intel/llvm/blob/sycl/sycl/test-e2e/Matrix/joint_matrix_bfloat16.cpp) 与 [joint_matrix_16bit_impl.hpp](https://github.com/intel/llvm/blob/sycl/sycl/test-e2e/Matrix/Inputs/joint_matrix_16bit_impl.hpp)。

## Joint Matrix + SLM + VNNI + 向量化 A 加载实现

VNNI 之后与 oneMKL 仍差约 4.4 倍。继续分析发现，此时 A 的 scalar 16-bit global 加载成了下一个瓶颈：每个 K 块每个线程要搬 4 个 bf16，指令数远多于已经 32-bit 化的 B。把 A 的 global→SLM 协作加载改成 `vec<bf16,4>`（8B）向量拷贝后，A 加载指令数降为原来的 1/4，A/B 两侧都变成“一次搬一个向量/整字”。

期间还试过两个方向但都更慢：去掉 SLM 的纯 GRF 双缓冲流水线（约 290 ms，直接 global→寄存器的小切片加载不如协同 SLM 高效）、`BK=32`（约 169 ms，SLM 占用翻倍反而拖慢）。最终保留 `BM=128, BN=64, BK=16` + VNNI + `vec<bf16,4>` 的组合。

```cpp
// ···
#include <cstdint>
// ···
constexpr int TM = 8;
constexpr int TN = 8;
constexpr int TK = 16;

constexpr int TM_SG = 16;
constexpr int TN_SG = 16;

// A 的 global->SLM 加载向量宽度：每次搬 4 个 bf16（8B）
constexpr size_t VEC_SIZE = 4;

constexpr int BM = 128;
constexpr int BN = 64;
constexpr int BK = 16;

void gemm_joint_matrix_vnni_vec(size_t M, size_t N, size_t K, bf16* A, uint32_t* B_packed, float* C, queue q)
{
    constexpr size_t SG_SIZE = 16;

    range<2> global_size{(M / BM) * (BM / TM_SG), (N / BN) * (BN / TN_SG) * SG_SIZE};
    range<2> local_size{BM / TM_SG, (BN / TN_SG) * SG_SIZE};

    q.submit([&](handler& h) {
        // A 保持 row-major，B 按 VNNI 打包存成 uint32（每字 = 2 个 bf16）
        local_accessor<bf16, 3> tileA(range<3>{2, BM, BK}, h);
        local_accessor<uint32_t, 3> tileB(range<3>{2, BK / 2, BN}, h);

        h.parallel_for(nd_range<2>(global_size, local_size), [=](nd_item<2> item) {
            auto sg = item.get_sub_group();

            int wg_row = item.get_group(0);
            int wg_col = item.get_group(1);

            int sg_row_in_wg = item.get_local_id(0);
            int sg_col_in_wg = item.get_local_id(1) / SG_SIZE;

            int local_tid = item.get_local_id(0) * (BN / TN_SG * SG_SIZE) + item.get_local_id(1);
            int threads_per_wg = (BM / TM_SG) * (BN / TN_SG) * SG_SIZE; // 512

            auto pA_global = sycl::address_space_cast<access::address_space::global_space, access::decorated::no>(A);
            auto pC_global = sycl::address_space_cast<access::address_space::global_space, access::decorated::no>(C);

            auto load_block = [&](int buf, size_t bk) {
                // A 按 vec<bf16,4> 向量化加载，指令数降为原来的 1/4
                for (int i = local_tid * VEC_SIZE; i < BM * BK; i += threads_per_wg * VEC_SIZE) {
                    int r = i / BK;
                    int c = i % BK;
                    int g_r = wg_row * BM + r;
                    int g_c = bk + c;
                    if (g_r < M && g_c + VEC_SIZE - 1 < K) {
                        auto vec_a = *reinterpret_cast<const vec<bf16, VEC_SIZE>*>(&A[g_r * K + g_c]);
                        *reinterpret_cast<vec<bf16, VEC_SIZE>*>(&tileA[buf][r][c]) = vec_a;
                    }
                }

                // B 已按 VNNI 打包：packed 行数只有 BK/2，每行 BN 个 uint32
                for (int i = local_tid; i < (BK / 2) * BN; i += threads_per_wg) {
                    int r = i / BN;
                    int c = i % BN;
                    int g_r = bk / 2 + r;
                    int g_c = wg_col * BN + c;
                    tileB[buf][r][c] = (g_r < K / 2 && g_c < N) ? B_packed[g_r * N + g_c] : 0u;
                }
            };

            joint_matrix<sub_group, bf16, use::a, TM, TK, layout::row_major> sub_a0;
            joint_matrix<sub_group, bf16, use::a, TM, TK, layout::row_major> sub_a1;
            joint_matrix<sub_group, bf16, use::b, TK, TN, layout::ext_intel_packed> sub_b0;
            joint_matrix<sub_group, bf16, use::b, TK, TN, layout::ext_intel_packed> sub_b1;
            joint_matrix<sub_group, float, use::accumulator, TM, TN> sub_c00;
            joint_matrix<sub_group, float, use::accumulator, TM, TN> sub_c01;
            joint_matrix<sub_group, float, use::accumulator, TM, TN> sub_c10;
            joint_matrix<sub_group, float, use::accumulator, TM, TN> sub_c11;

            joint_matrix_fill(sg, sub_c00, 0.0f);
            joint_matrix_fill(sg, sub_c01, 0.0f);
            joint_matrix_fill(sg, sub_c10, 0.0f);
            joint_matrix_fill(sg, sub_c11, 0.0f);

            load_block(0, 0);
            item.barrier(access::fence_space::local_space);

            for (size_t bk = 0; bk < K; bk += BK) {
                int cur = (bk / BK) % 2;
                int nxt = cur ^ 1;

                if (bk + BK < K) {
                    load_block(nxt, bk + BK);
                }

                auto pA_slm0 = sycl::address_space_cast<access::address_space::local_space, access::decorated::no>(&tileA[cur][sg_row_in_wg * TM_SG][0]);
                auto pA_slm1 = sycl::address_space_cast<access::address_space::local_space, access::decorated::no>(&tileA[cur][sg_row_in_wg * TM_SG + TM][0]);

                // 以 bf16 视角指向 VNNI 打包后的 B 切片，行距为 BN*2 个 bf16（=BN 个 uint32）
                auto pB_slm0 = sycl::address_space_cast<access::address_space::local_space, access::decorated::no>(
                    reinterpret_cast<bf16*>(&tileB[cur][0][sg_col_in_wg * TN_SG]));
                auto pB_slm1 = sycl::address_space_cast<access::address_space::local_space, access::decorated::no>(
                    reinterpret_cast<bf16*>(&tileB[cur][0][sg_col_in_wg * TN_SG + TN]));

                joint_matrix_load(sg, sub_a0, pA_slm0, BK);
                joint_matrix_load(sg, sub_a1, pA_slm1, BK);
                joint_matrix_load(sg, sub_b0, pB_slm0, BN * 2);
                joint_matrix_load(sg, sub_b1, pB_slm1, BN * 2);

                joint_matrix_mad(sg, sub_c00, sub_a0, sub_b0, sub_c00);
                joint_matrix_mad(sg, sub_c01, sub_a0, sub_b1, sub_c01);
                joint_matrix_mad(sg, sub_c10, sub_a1, sub_b0, sub_c10);
                joint_matrix_mad(sg, sub_c11, sub_a1, sub_b1, sub_c11);

                item.barrier(access::fence_space::local_space);
            }

            int global_r = wg_row * BM + sg_row_in_wg * TM_SG;
            int global_c = wg_col * BN + sg_col_in_wg * TN_SG;
            joint_matrix_store(sg, sub_c00, pC_global + global_r * N + global_c, N, layout::row_major);
            joint_matrix_store(sg, sub_c01, pC_global + global_r * N + global_c + TN, N, layout::row_major);
            joint_matrix_store(sg, sub_c10, pC_global + (global_r + TM) * N + global_c, N, layout::row_major);
            joint_matrix_store(sg, sub_c11, pC_global + (global_r + TM) * N + global_c + TN, N, layout::row_major);
        });
    });
}

// 主机端 VNNI 打包：低 16 位 = B[2k][n]，高 16 位 = B[2k+1][n]
for (size_t k2 = 0; k2 < K / 2; ++k2) {
    for (size_t n = 0; n < N; ++n) {
        uint16_t lo = sycl::bit_cast<uint16_t>(B[k2 * 2 * N + n]);
        uint16_t hi = sycl::bit_cast<uint16_t>(B[(k2 * 2 + 1) * N + n]);
        B_packed[k2 * N + n] = static_cast<uint32_t>(lo) | (static_cast<uint32_t>(hi) << 16);
    }
}
// ···
```

结果如下：
```
Joint Matrix with VNNI+Vec Spent: 143.731 ms
Joint Matrix with VNNI+Vec GEMM average time: 0.143731 ms per Run
C[0] = 1024 (Expected: 1024)
```

对比结果：
||Naive实现|Tiling实现|Register Tiling实现|SIMD 向量化读写|Joint Matrix 实现|Joint Matrix + 基础SLM|Joint Matrix + SLM + Prefetch|Joint Matrix + SLM + Double Buffer|Joint Matrix + SLM + 大Tile + GRF|Joint Matrix + SLM + 硬件调参|Joint Matrix + SLM + VNNI|Joint Matrix + SLM + VNNI + Vec|oneMKL|
|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
|总耗时|1951.73 ms|1492.32 ms|430.648 ms|273.737ms|430.931 ms|629.883 ms|660.607 ms|669.505 ms|356.372 ms|307.633 ms|234.17 ms|143.731 ms|53.6976 ms|
|单次耗时|1.95174 ms|1.49231 ms|0.430648 ms|0.273737 ms|0.430931 ms|0.629883 ms|0.660607 ms|0.669505 ms|0.356372 ms|0.307633 ms|0.23417 ms|0.143731 ms|0.0536976 ms|
|相对效率|2.75%|3.59%|12.46%|19.61%|12.46%|8.52%|8.13%|8.02%|15.07%|17.46%|22.93%|37.36%|100%|

向量化 A 加载把 234.17 ms 降到 143.731 ms（多次运行稳定在 142 ~ 144 ms，再快约 39%），相对效率来到 37.36%，已经是 SLM 基础版（629.883 ms）的 4.4 倍。与 oneMKL（53.6976 ms）仍差约 2.7 倍：oneMKL 内部是多年打磨的 XMX kernel，包含专门的 tile 形状、L2 感知调度、持久化内核以及更底层的访存优化；SYCL joint matrix 层面能做的常规手段到这里基本已经覆盖，要继续逼近 oneMKL 通常需要引入这些底层细节，甚至手写/生成 DPAS 级别的调度代码。

## Large GRF + 大寄存器块实验（A770 上的结论）

官方指南建议用 `-ze-opt-large-register-file`（Large GRF Mode，每线程 256 个 GRF）并放大 Sub-Group 寄存器块，我们按这个方向做了三组实验。Windows 下 `icx-cl` 的传参写法为 `-Xsycl-target-backend "-options -ze-opt-large-register-file"`。

结果如下：

|配置|GRF 数据占用|实测耗时|对比 16x16 默认|
|:-:|:-:|:-:|:-:|
|16x16 + 默认 GRF|约 64/128|143.7 ms|基准|
|16x16 + Large GRF|约 64/256|211.2 ms|慢 47%|
|16x32 + Large GRF|约 112/256|180.3 ms|慢 25%|
|32x32 + Large GRF|约 192/256|193.9 ms|慢 35%|

三组配置全部比 16x16 默认更慢，`C[0] = 1024` 冒烟检查通过。增加寄存器预算可能改变并发线程容量和实际驻留，但编译选项是否生效、真实 GRF 分配、spill 与 occupancy 应由当前 DG2 编译产物及计数器确认，不能仅从耗时推断占用率减半。本轮保留 VNNI + 向量化 A 加载（143.731 ms）；该结论限于测试形状、布局和软件版本，不排除其他配置从 Large GRF 获益。

## Joint Matrix + SLM + VNNI + Vec + K 拆分 + N 优先遍历实现

参考 oneDNN 源码（`walk_orders.hpp`、`jit_xe_hp_systolic.cpp`）后，我们又做了三项实验：

1. **A 预打包**：把 A 按 8x16 微块重排，让 Sub-Group 的 A 切片连续。实测 154 ~ 169 ms，索引计算开销盖过了布局收益，无效。
2. **K 首/尾拆分**：主循环去掉“是否还有下一个 K 块”的分支，把最后一个块单独处理。实测 142 ~ 146 ms，与基线基本持平，无回归。
3. **N 优先遍历**：交换 Work-Group 的 M/N group 索引，改变线性 group ID 对应的 tile 排列（不保证硬件执行顺序）。实测 118.2 ~ 119.6 ms，再快约 17%，是这次唯一有效的手段。

关键改动只有两处：

```cpp
// 1) 交换 M/N 的 group 索引；global/local range 的对应维度也需交换
int wg_row = item.get_group(1);
int wg_col = item.get_group(0);

// 2) K 首/尾拆分：前 K-BK 个块无条件预取，最后一个块单独计算
auto compute_block = [&](int cur) {
    // ... 原有 joint_matrix_load + mad ...
};
size_t bk = 0;
for (; bk + BK < K; bk += BK) {
    int cur = (bk / BK) % 2;
    int nxt = cur ^ 1;
    load_block(nxt, bk + BK);
    compute_block(cur);
    item.barrier(access::fence_space::local_space);
}
compute_block((bk / BK) % 2);
```

结果如下：
```
Joint Matrix with WalkN Spent: 118.31 ms
Joint Matrix with WalkN GEMM average time: 0.11831 ms per Run
C[0] = 1024 (Expected: 1024)
```

对比结果：
||Naive实现|Tiling实现|Register Tiling实现|SIMD 向量化读写|Joint Matrix 实现|Joint Matrix + 基础SLM|Joint Matrix + SLM + Prefetch|Joint Matrix + SLM + Double Buffer|Joint Matrix + SLM + 大Tile + GRF|Joint Matrix + SLM + 硬件调参|Joint Matrix + SLM + VNNI|Joint Matrix + SLM + VNNI + Vec|Joint Matrix + SLM + VNNI + Vec + WalkN|oneMKL|
|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
|总耗时|1951.73 ms|1492.32 ms|430.648 ms|273.737ms|430.931 ms|629.883 ms|660.607 ms|669.505 ms|356.372 ms|307.633 ms|234.17 ms|143.731 ms|118.31 ms|53.6976 ms|
|单次耗时|1.95174 ms|1.49231 ms|0.430648 ms|0.273737 ms|0.430931 ms|0.629883 ms|0.660607 ms|0.669505 ms|0.356372 ms|0.307633 ms|0.23417 ms|0.143731 ms|0.11831 ms|0.0536976 ms|
|相对效率|2.75%|3.59%|12.46%|19.61%|12.46%|8.52%|8.13%|8.02%|15.07%|17.46%|22.93%|37.36%|45.39%|100%|

N 优先遍历把 143.731 ms 降到 118.31 ms（多次运行稳定在 118 ~ 120 ms，再快约 17%），相对效率来到 45.39%，与 oneMKL（53.6976 ms）的差距缩小到约 2.2 倍。A 为 1 MiB、B 为 1.5 MiB；bf16 两两打包为 uint32 不改变 B 的总字节数。改变 tile 索引映射可能改善缓存局部性，但 SYCL 不保证各工作组按线性 ID 顺序实际执行，具体缓存收益需采集验证。

## Tile 调度顺序与流水线深度的进一步探索

参考 oneDNN 的设计思路，我们针对调度策略与共享内存流水进一步测试了三项探索方案：

|实验方案|1000 次累计耗时|实验结论|
|:---:|:---:|:---:|
|N 优先遍历（N-first）|**118.31 ms**|基准最优|
|蛇形遍历（Boustrophedon）|118.50 ms|与 N 优先基本持平，无显著额外收益|
|SLM 行填充（Bank Padding）|156.40 ms|该 padding 配置实测退化；对齐、地址开销及资源分配需分别核对|
|3 级 SLM 流水线缓冲|125.00 ms|SLM 占用量升至 18KB/WG；是否跨越驻留阈值待验证|

本轮蛇形遍历没有显著收益，padding 和 3 级缓冲变慢。索引计算、访问布局和 SLM 分配均可能参与影响，不能仅靠耗时确定缓存命中或驻留组数的变化，也不能概括为 padding 在标准 SYCL 下必然无效。

## oneDNN vs oneMKL 同机实测

为了确认 oneDNN 那些更细的生成器细节是否真的比 oneMKL 快，我们基于 oneAPI 自带的 oneDNN 库（`dnnl.lib`）编写了底层基准测试程序，采用与 oneMKL 相同的 bf16 GEMM 规格（$M=1024, N=1536, K=512$）、相同的 100 次预热 + 1000 次计时口径，并在同一会话内进行实测对比。

oneDNN 通过 SYCL Interop 调用 `dnnl::matmul` 原语的核心实现如下：

```cpp
#include <sycl/sycl.hpp>
#include <oneapi/dnnl/dnnl.hpp>
#include <oneapi/dnnl/dnnl_sycl.hpp>

using namespace sycl;
using bf16 = sycl::ext::oneapi::bfloat16;
using namespace dnnl;

// 创建与当前 SYCL 队列关联的 oneDNN engine 与 stream
engine eng = sycl_interop::make_engine(q.get_device(), q.get_context());
dnnl::stream strm = sycl_interop::make_stream(eng, q);

// 描述张量内存布局（行主序使用 format_tag::ab）
auto src_md     = memory::desc({M, K}, memory::data_type::bf16, memory::format_tag::ab);
auto weights_md = memory::desc({K, N}, memory::data_type::bf16, memory::format_tag::ab);
auto dst_md     = memory::desc({M, N}, memory::data_type::f32,  memory::format_tag::ab);

// 创建 matmul 算子描述符与可执行原语
auto matmul_pd   = matmul::primitive_desc(eng, src_md, weights_md, dst_md);
auto matmul_prim = matmul(matmul_pd);

// 将 USM 内存指针直接绑定至 oneDNN memory
auto src_mem     = memory(src_md, eng, A);
auto weights_mem = memory(weights_md, eng, B);
auto dst_mem     = memory(dst_md, eng, C);

// 执行 matmul 原语计算
matmul_prim.execute(strm, {
    {DNNL_ARG_SRC,     src_mem},
    {DNNL_ARG_WEIGHTS, weights_mem},
    {DNNL_ARG_DST,     dst_mem}
});
strm.wait();
```

同一会话实测对比：

|实现|单次耗时|
|:-:|:-:|
|oneMKL|0.0528755 ms|
|oneDNN|0.0552399 ~ 0.055861 ms（三次稳定值）|
|手写 SYCL 最优（`gemm_jm_walk_n`）|0.118073 ms|

结论：oneDNN 与 oneMKL 性能基本持平（慢约 5%），oneDNN 更细的 tile/walk/SLM 生成器细节并没有带来额外优势；两者都比我们的 SYCL joint matrix kernel 快约 2.1 ~ 2.2 倍。差距主要来自于底层 ngen/汇编级代码生成与库级调度，而非某个单独的 SYCL 语法层技巧。

## 寄存器多副本与深级缓冲的迁移尝试与分析

基于 oneDNN 的执行特征分析，我们尝试将两项可迁移的结构参数移植到 SYCL Joint Matrix 内核中：SLM→GRF 双副本（参考 `slmCopies=2`）和 4 级 SLM 缓冲（参考 `slmBuffers=4` + `unrollKSLM=32`）。

GRF 双副本（显式按 2 个 K 块展开）的主循环逻辑如下：

```cpp
// 预热：SLM 块 0 -> GRF set0
load_block(0, 0);
item.barrier(access::fence_space::local_space);
load_grf0(0);

for (size_t bk = 0; bk + 2 * BK <= K; bk += 2 * BK) {
    // 偶数块：set0 算块 bk，期间 SLM 写入块 bk+BK
    load_block(1, bk + BK);
    compute0();
    item.barrier(access::fence_space::local_space);
    load_grf1(1);   // 同步后 set1 读块 bk+BK

    // 奇数块：set1 算块 bk+BK，期间 SLM 写入块 bk+2BK
    if (bk + 2 * BK < K) load_block(0, bk + 2 * BK);
    compute1();
    item.barrier(access::fence_space::local_space);
    if (bk + 3 * BK < K) load_grf0(0);
}
```

BK=32 配合 4 级 SLM 缓冲的主循环结构：

```cpp
// 预热阶段：预加载前 3 个 SLM 缓冲
load_block(0, 0);
load_block(1, BK);
load_block(2, 2 * BK);
item.barrier(access::fence_space::local_space);

for (size_t bk = 0; bk < K; bk += BK) {
    int idx = bk / BK;
    int buf = idx % NBUF;   // NBUF = 4
    if (bk + BK < K) {
        load_block((idx + 1) % NBUF, bk + BK);
        load_grf(buf);
        compute();
        item.barrier(access::fence_space::local_space);
    } else {
        load_grf(buf);
        compute();
    }
}
```

实测结果对比：

| 流水线变体方案 | 实现机制说明 | 单次平均耗时 |
|---|---|---:|
| N 优先遍历基准（基线） | 空间局部性优化遍历次序 | **0.11831 ms** |
| GRF 寄存器双副本（动态分支判断） | 运行时分支切换寄存器句柄 | 0.41762 ms |
| GRF 寄存器双副本（静态按 2 块展开） | 编译期静态循环展开调度 | 0.12480 ms |
| BK=32 + 4 级 SLM + 单 GRF 副本 | 扩充分块步长与 SLM 缓冲深度 | 0.15060 ms |
| BK=32 + 4 级 SLM + GRF 双副本展开 | 深度缓冲与寄存器双副本协同 | 0.37410 ms |

实验分析：
本轮未能通过直接套用 oneDNN 的缓冲参数改善 Joint Matrix 内核。双份 `joint_matrix` 句柄增加活跃数据量，4 级 SLM 增加资源需求；是否发生 spill 或实际 occupancy 下降，需要附编译报告或对应计数器，不能仅从变慢反推。

至此，本轮已尝试的 Joint Matrix 配置最好为 **0.1183 ms**（历史 oneMKL 比例约 45.4%），尚有约 2.2 倍差距。它不是 Joint Matrix 的性能上限，也不代表参数空间已穷尽。接下来选择 ESIMD，探索更直接的数据布局与加载控制。

# 四、显式控制硬件：手写 ESIMD (Explicit SIMD) 深度调优

## 为什么需要转向 ESIMD

在标准 SYCL Joint Matrix 框架下，编译器（IGC）在后端负责将 `joint_matrix_load`、`joint_matrix_mad` 映射到底层硬件指令。然而这种高级抽象存在若干难以规避的约束：
1. **硬件形状约束**：本文 DG2 路径使用 $8 \times 8 \times 16$ 微块；可以组合多个 `joint_matrix` 构建更大 tile，前文已展示这种复用，实际收益取决于代码生成与寄存器分配。
2. **寄存器重组黑盒**：数据在 SLM 与硬件寄存器之间的搬运往往伴随着编译器自动生成的掩码（Mask）与重排指令，产生大量不可见开销。
3. **指令调度缺乏确定性**：开发者无法显式控制内存加载与 DPAS 计算指令的乱序发射窗口。

为了更明确地表达向量布局与硬件点积操作，我们转向 Intel oneAPI 的低级扩展——**ESIMD（Explicit SIMD）**。ESIMD 仍由编译器分配物理寄存器和调度指令，不能保证源码顺序就是最终机器指令顺序。

## ESIMD 基础验证：DPAS 指令与操作数对齐

ESIMD 公开头文件 `sycl/ext/intel/esimd/xmx/dpas.hpp` 提供了 `esimd::dpas` 与 `esimd::dpasw` 原语。我们首先构建冒烟基准内核，验证单个 $8 \times 8 \times 16$ 微块的计算正确性：输入 $A$ 为 $8 \times 16$ bf16 行主序，输入 $B$ 为 $16 \times 8$ VNNI 打包格式，输出 $C$ 为 $8 \times 8$ f32。

微块计算的核心实现：

```cpp
q.single_task([=]() SYCL_ESIMD_KERNEL {
    simd<bf16, M * K> a(A, overaligned_tag<16>{});
    simd<bf16, K * N> b(B, overaligned_tag<16>{});
    simd<float, M * N> c0(0.0f);

    // 计算 C = C + A x B
    simd<float, M * N> c1 = dpas<8, M, float>(c0, b, a);
    c1.copy_to(Cd);

    // 计算 C = A x B（无累加初值）
    simd<float, M * N> c2 = dpas<8, M, float>(b, a);
    c2.copy_to(C2);
}).wait();
```

验证结果：

```text
Running on Intel(R) Arc(TM) A770 Graphics
dpas  with-src0 errors: 0/64
dpas  no-src0 errors:  0/64
dpasw executed OK
SMOKE PASSED
```

实验结论：
- `esimd::dpas` 在 A770 上运行正常，当前冒烟用例与 CPU 主机基准比较未检出错误（`errors=0/64`）。这证明通过 ESIMD 可以绕过 SYCL 矩阵抽象层，直接生成 XMX 指令。
- VNNI 格式要求：$B$ 矩阵在 32 位整型字视角下索引为 $(k/2) \times N + j$，在线性 bf16 视角下为两行交错存储。

## 共享内存双缓冲微架构验证

在微块验证的基础上，我们进一步构建了一个 $32 \times 32 \times 32$ 规模的片上存储双缓冲验证内核：单个 Work-Group 内包含 16 个 ESIMD work-item，各处理一个 $8 \times 8 \times 16$ 的 DPAS 微块；$A/B$ 矩阵通过 `slm_block_load/store` 进行 4KB SLM 双缓冲管理，内层循环通过 `esimd::barrier()` 实现同步：

```cpp
slm_init<SLM_TOTAL_BYTES>();
load_block(0, 0);
barrier();
for (size_t bk = 0; bk < Ktot; bk += BK) {
    int cur = (bk / BK) % 2;
    int nxt = cur ^ 1;
    if (bk + BK < Ktot) load_block(nxt, bk + BK);
    load_grf(cur, a, b);                  // SLM -> GRF
    c = dpas<8, DPAS_M, float>(c, b, a); // XMX 硬件累加
    barrier();
}
```

实测输出：

```text
Running on Intel(R) Arc(TM) A770 Graphics
errors: 0/1024
SLM MICROBENCH PASSED
```

该微基准表明 ESIMD 的 SLM 双缓冲流水线与 `barrier()` 在 A770 驱动下运行稳定，编译后端没有打乱双缓冲依赖关系，可以直接以此骨架构建完整 GEMM 内核。

## 构建完整 ESIMD GEMM 与几何参数探索

将微基准扩展到标准测试形状（$M=1024, N=1536, K=512$），我们针对不同的分块步长与缓存深度进行了对照测量（所有用例均通过 0/1572864 正确性比对）：

| 几何结构与缓冲配置 | 线程分块与寄存器排布 | 单次耗时 |
|---|---|---:|
| BK=16 双缓冲 | 单线程负责 $16 \times 8$ 输出分块 | 0.13898 ms |
| BK=32 双缓冲 | 单线程负责 $16 \times 8$ 输出分块 | 0.10937 ms |
| BK=32 深度缓冲 | 4 级 SLM + 2 份 GRF 寄存器副本 | 0.28247 ms |
| BK=32 双缓冲（最优） | 单线程负责 $16 \times 16$ 输出分块 | **0.09921 ms** |

16x16 寄存器分块变体的主循环实现：

```cpp
for (size_t bk = 0; bk < K; bk += BK) {
    const int cur = (bk / BK) % 2;
    const int nxt = cur ^ 1;
    if (bk + BK < K) load_block(nxt, bk + BK);
    load_grf(cur, a0, a1, a2, a3, b0, b1, b2, b3);
    
    // 2x2 累加块，每个 K 步展开 8 次 DPAS 计算
    c00 = dpas<8, 8, float>(c00, b0, a0);
    c00 = dpas<8, 8, float>(c00, b1, a1);
    c01 = dpas<8, 8, float>(c01, b2, a0);
    c01 = dpas<8, 8, float>(c01, b3, a1);
    c10 = dpas<8, 8, float>(c10, b0, a2);
    c10 = dpas<8, 8, float>(c10, b1, a3);
    c11 = dpas<8, 8, float>(c11, b2, a2);
    c11 = dpas<8, 8, float>(c11, b3, a3);
    barrier();
}
```

测试结果表明：手写 ESIMD 完整内核首次超过了本轮已测 Joint Matrix 配置（从 118.31 ms 降至 **99.21 ms**，提速约 16%），相对 oneMKL 的效率达到 54.1%。进一步测试显示，每个 Work-Item 分配 16x16 寄存器 Tile、配合 32 线程 Work-Group，是 A770 显卡在当前配置下的最优几何参数。

## 基于 VTune 热点分析的宽加载优化

使用 `vtune -collect gpu-hotspots -knob characterization-mode=instruction-count` 分析最优 16x16 寄存器分块内核：在 1100 次迭代中共执行 292 亿条 GPU 指令（每次约 2650 万条）。指令分布统计显示：
- **Send 指令**：占比 29.0%
- **Int32 / SP Float（主要为地址计算）**：占比 45.6%
- **Other 指令**：占比 19.1%

主要的瓶颈在于 SLM 到 GRF 之间存在大量 32 字节细碎读取（每个线程每计算一块需要执行约 64 条读取指令）。据此我们实现宽加载优化：
- $A$ 矩阵单条消息加载 4 行（连续 256 字节，共 4 条消息）
- $B$ 矩阵单条消息加载 16 个连续 `uint32_t`（64 字节，共 16 条消息）
- 将 SLM $\to$ GRF 的消息总数由约 64 条压缩至约 20 条。

宽加载核心代码段：

```cpp
auto load_grf = [=](int buf, simd<bf16, 128> &a0,
                    simd<bf16, 128> &a1, simd<bf16, 128> &a2,
                    simd<bf16, 128> &a3, simd<bf16, 128> &b0,
                    simd<bf16, 128> &b1, simd<bf16, 128> &b2,
                    simd<bf16, 128> &b3) SYCL_ESIMD_FUNCTION {
    const uint32_t offA = buf * SLM_BUF_BYTES;
    const uint32_t offB = offA + SLM_A_BYTES;
    const int base_row = wi_row * 16;

    // A: 每次消息加载连续 4 行 (256B)，两次覆盖 8 行微块
    for (int r2 = 0; r2 < 2; r2++) {
        simd<bf16, 128> v0 = slm_block_load<bf16, 128>(
            offA + (base_row + 4 * r2) * 64, overaligned_tag<16>{});
        for (int rr = 0; rr < 4; rr++) {
            a0.select<16, 1>((4 * r2 + rr) * 16) = v0.select<16, 1>(rr * 32);
            a1.select<16, 1>((4 * r2 + rr) * 16) = v0.select<16, 1>(rr * 32 + 16);
        }

        simd<bf16, 128> v1 = slm_block_load<bf16, 128>(
            offA + (base_row + 8 + 4 * r2) * 64, overaligned_tag<16>{});
        for (int rr = 0; rr < 4; rr++) {
            a2.select<16, 1>((4 * r2 + rr) * 16) = v1.select<16, 1>(rr * 32);
            a3.select<16, 1>((4 * r2 + rr) * 16) = v1.select<16, 1>(rr * 32 + 16);
        }
    }

    // B: 每次加载 16 个连续 uint32 (64B)，合并读请求
    for (int k2 = 0; k2 < 8; k2++) {
        simd<uint32_t, 16> w0 = slm_block_load<uint32_t, 16>(
            offB + (k2 * BN + wi_col * 16) * 4, overaligned_tag<16>{});
        b0.select<16, 1>(k2 * 16) = w0.select<8, 1>(0).bit_cast_view<bf16>();
        b2.select<16, 1>(k2 * 16) = w0.select<8, 1>(8).bit_cast_view<bf16>();

        simd<uint32_t, 16> w1 = slm_block_load<uint32_t, 16>(
            offB + ((k2 + 8) * BN + wi_col * 16) * 4, overaligned_tag<16>{});
        b1.select<16, 1>(k2 * 16) = w1.select<8, 1>(0).bit_cast_view<bf16>();
        b3.select<16, 1>(k2 * 16) = w1.select<8, 1>(8).bit_cast_view<bf16>();
    }
};
```

实测平均耗时从 99.21 ms 下降至 **83.62 ~ 85.57 ms**（提速约 15%），相对 oneMKL 的效率达到 63.2%。

## VTune 全指令剖析与操作数直通布局

为深入分析剩余的性能差距，我们使用管理员权限采集了 `characterization-mode=full-compute` 的细粒度硬件指标（对比宽加载内核与 oneDNN 基准）：

| 关键硬件指标 | 手写 ESIMD (宽加载) | oneDNN 官方库 | oneDNN 相对比例 |
|---|---:|---:|---:|
| 单次迭代耗时 | 79.0 µs | 50.9 µs | 64.4% |
| ALU0 + ALU1 指令总数 | 22.4 亿 | 5.6 亿 | 25.0% |
| Send 访存指令总数 | 5.12 亿 | 2.17 亿 | 42.4% |
| XMX 算力指令总数 | 15.1 亿 | 13.1 亿 | 86.8% |
| GPU 同步屏障数 | 1.11 亿 | 0.38 亿 | 34.2% |
| 硬件占用率（Occupancy） | 58.4% | 28.7% | - |
| L3 带宽受限度（Bandwidth Bound） | 0.2% | 0.2% | - |

本次采集的 L3 Bandwidth Bound 为 0.2%，不支持“该指标对应的带宽饱和是主因”的判断；它不能单独排除访存延迟或其他层级的瓶颈。手写内核 occupancy 为 58.4%，高于 oneDNN 的 28.7%，但速度仍较慢，说明提高 occupancy 并非充分条件。表中 ALU0+ALU1 计数约为 oneDNN 的 4 倍、Send 约为 2.36 倍；统计范围和执行次数必须一致才能比较。结合后续布局实验，我们优先减少 `load_grf` 的重排、细碎消息及地址计算。

接着对宽加载优化方案复采 `instruction-count`（1100 次），与 16x16 基础分块内核对比：

| 指令类别 | 16x16 基础分块 | 宽加载优化 | 相对变化 |
|---|---:|---:|---:|
| Send 访存指令 | 8.46B（29.0%） | 3.70B（13.8%） | -56.2% |
| Int32 & SP Float 指令 | 13.31B（45.6%） | 8.69B（32.5%） | -34.7% |
| Other 杂项指令 | 5.58B（19.1%） | 12.83B（48.0%） | +129.8% |
| 单次迭代总指令 | 26.55M | 24.31M | -8.4% |

## 操作数直通布局与寄存器重排消除

通过 VTune 硬件指令剖析明确瓶颈后，我们针对冗余指令展开针对性消除：
1. **C 矩阵写回合并**：由分散写回改为 16 元素连续 `block_store`。
2. **B 操作数布局规约**：将 SLM 中 B 矩阵数据划分为对应 DPAS 操作数的连续片段，消除 `load_grf` 中的 `select` 重排指令。
3. **A 矩阵预打包直读**：在输入侧将 A 矩阵按操作数形状排列，使内核直接通过全局 `block_load` 直读，完全绕过 SLM。

| 优化阶段 | 实现方案 | 单次迭代耗时 |
|---|---|---:|
| 宽加载基线 | 基础宽加载实现 | 0.0836 ~ 0.0856 ms |
| 阶段 1：C 矩阵合并写回 | 连续 16 float 写回 | 0.0834 ~ 0.0841 ms |
| 阶段 2：B 操作数布局规约 | SLM 布局重排，消除 `select` | 0.0799 ~ 0.0825 ms |
| 阶段 3：A 直读 + B 操作数布局 + C 合并 | A 绕过 SLM 全局直读 | 0.0734 ~ 0.0736 ms |

所有阶段均严格通过数值对拍校验（`C[0]=3`，0 错误）。
在阶段 2 中，将 SLM 内部的 B 矩阵划分为 4 个操作数段，使 `load_grf` 从 16 次 64B 读取转换为 4 次 256B 读取，彻底消除了 64 次寄存器 `select` 拼接指令；
在阶段 3 中，在主机端将 A 矩阵打包为操作数布局，内核内直接以 4 次 256B 全局 `block_load` 直读，A 矩阵完全绕过 SLM，使得单个工作组的 SLM 占用从 24KB 降至 8KB。
内核单次耗时推进至 0.0734 ms，相较 oneMKL（0.0529 ms）达到 72.5% 性能，耗时比约为 1.39 倍。

主机端 A 矩阵操作数重排打包（每个 Work-Item 对应 4 个 256B 操作数段）：

```cpp
for (int wg_row = 0; wg_row < M / BM; wg_row++)
    for (int kb = 0; kb < K / BK; kb++)
        for (int wi = 0; wi < 8; wi++)
            for (int o = 0; o < 4; o++)
                for (int rr = 0; rr < 8; rr++)
                    for (int cc = 0; cc < 16; cc++) {
                        const int m = wg_row * BM + wi * 16 + rr + (o / 2) * 8;
                        const int k = kb * BK + cc + (o % 2) * 16;
                        Ap[((((wg_row * (K / BK) + kb) * 8 + wi) * 4 + o) * 8 +
                            rr) * 16 + cc] = A[m * K + k];
                    }
```

内核内 A 直接加载与 B 零重排加载代码实现：

```cpp
// A: 四个 256B 操作数段，直接加载全局显存，无 select 重排
const size_t abase =
    ((size_t)(wg_row * (K / BK) + bk / BK) * 8 + wi_row) * 4 * 128;
a0 = block_load<bf16, 128>(Ap + abase + 0 * 128, overaligned_tag<16>{});
a1 = block_load<bf16, 128>(Ap + abase + 1 * 128, overaligned_tag<16>{});
a2 = block_load<bf16, 128>(Ap + abase + 2 * 128, overaligned_tag<16>{});
a3 = block_load<bf16, 128>(Ap + abase + 3 * 128, overaligned_tag<16>{});

// B: 每个 dpas 操作数一段 256B，bit_cast 后直接作为操作数
simd<uint32_t, 64> wb0 =
    slm_block_load<uint32_t, 64>(offB + 0 * 1024 + wi_col * 256,
                                 overaligned_tag<16>{});
simd<uint32_t, 64> wb2 =
    slm_block_load<uint32_t, 64>(offB + 1 * 1024 + wi_col * 256,
                                 overaligned_tag<16>{});
b0 = wb0.bit_cast_view<bf16>();
b2 = wb2.bit_cast_view<bf16>();
// b1/b3 同理，段偏移分别为 2/3
```

> **注意**：`bit_cast_view` 必须绑定到左值变量。此外，Intel Arc A770 (DG2) 的单次 `block_load` 硬件上限为 256 字节（Ponte Vecchio 架构扩展至 512 字节），因此降低访存消息开销必须依靠布局重排与全载荷对齐，无法通过继续单纯拉宽单次加载实现。

完成操作数布局规约后复采 VTune 硬件指令（采集 1100 次迭代与 5500 次计算）：

| 关键硬件指标 | 宽加载基线 | 操作数直通布局 | oneDNN 官方基准 |
|---|---:|---:|---:|
| 单次迭代总指令（instruction-count） | 24.31M | **12.15M** | - |
| Send 访存指令 | 5.12B | 2.37B | 2.17B |
| ALU0 运算指令 | 9.39B | 1.87B | 0.52B |
| ALU1 整数/地址指令 | 13.05B | 8.04B | 5.09B |
| 工作组同步屏障（GPU Barriers） | 111M | 109M | 38M |

数据表明：操作数直通布局使 Send 访存指令基本追平 oneDNN，ALU0 计算指令削减达 80%，XMX Pipeline Active 占用率从 14.3% 上升至 15.6%。此时剩余的指令差距集中在 ALU1 地址计算（8.04B vs 5.09B）与工作组同步屏障（109M vs 38M）。

## 循环地址步进优化与 4 级缓冲屏障减半

针对地址计算与工作组屏障开销，我们实施两项针对性改进：

| 优化阶段 | 实现方案 | 单次耗时 |
|---|---|---:|
| 操作数直通基线 | A 全局直读 + B 零重排 | 0.0734 ~ 0.0736 ms |
| 阶段 1：循环地址步进优化 | 循环外预计算基址，循环内固定步进 | 0.0715 ~ 0.0735 ms |
| 阶段 2：4 级缓冲 + 成对计算屏障减半 | SLM 扩至 16KB，每 2 块同步一次 | 0.0628 ~ 0.0646 ms |

1. **循环地址步进优化**：将每个 Work-Item 的 A/B 矩阵与 SLM 寻址基地址提前在主循环外计算，循环内仅维护固定增量步进（A 矩阵每块步进 4096 个 `bf16`，B 矩阵行基址每块步进 $16 \times N$），消除了每次循环内部重复的 64 位整数乘法开销。
2. **4 级缓冲与屏障减半**：由于 A 矩阵已绕开 SLM，当前每个工作组仅占用 8KB SLM，硬件容量余量充足。将 B 矩阵的 SLM 缓冲区扩展为 4 个（$4 \times 4\text{KB} = 16\text{KB}$），预取 2 个 K 块后以成对（Pair）方式计算，工作组同步屏障由“每块一次”降为“每两块一次”：

```cpp
// 启动阶段：预填两个 K 块的数据
load_block(0, brow);
load_block(1, brow + size_t{16} * N);
barrier();

// 主循环：按成对步长迭代，屏障频次减半
for (int b = 0; b < K / BK; b += 2) {
    if (b + 2 < K / BK) load_block((b + 2) & 3, brow + 32 * N);
    if (b + 3 < K / BK) load_block((b + 3) & 3, brow + 48 * N);

    load_grf(b & 3, ap, a0, a1, a2, a3, b0, b1, b2, b3);
    // 8 次 dpas 硬件计算块 b
    load_grf((b + 1) & 3, ap + 4096, a0, a1, a2, a3, b0, b1, b2, b3);
    // 8 次 dpas 硬件计算块 b+1

    barrier();
    ap += 2 * 4096;
    brow += 32 * N;
}
```

优化后复采 VTune 硬件指标（采集 1100 次迭代与 5500 次计算）：

| 关键硬件指标 | 操作数直通基线 | 4 级缓冲屏障减半 | oneDNN 官方基准 |
|---|---:|---:|---:|
| 单次迭代总指令 | 12.15M | **8.58M** | - |
| 内核平均单次耗时 | 71.9 µs | **61.6 µs** | 50.9 µs |
| ALU1 整数/地址指令 | 8.04B | **4.80B** | 5.09B |
| Send 访存指令 | 2.37B | 2.22B | 2.17B |
| 工作组同步屏障（GPU Barriers） | 109M | **57M** | 38M |
| XMX Pipeline Active | 15.6% | **17.1%** | 19.1% |

ALU1 指令数已低于 oneDNN，Send 指令基本打平，同步屏障开销削减一半，硬件执行停顿（Stall）从 46.8% 降至 40.7%（低于 oneDNN 水平）。单次耗时稳定在 0.0628 ~ 0.0646 ms，相对 oneMKL 达到约 82%、相对 oneDNN 达到约 87%，性能差距缩小至 1.14 倍。

## 结构探索的边界验证与失效分析

为探索能否进一步逼近官方库极限，我们针对访存延迟与同步开销设计了三个探索假设，全部通过数值对拍校验（`C[0]=3`，0 错误），但实测均显示为负收益：

| 探索方向 | 预期优化机制 | 单次迭代耗时 | 实测结论与原因分析 |
|---|---|---:|---|
| 4 级缓冲基线 | 当前最优流水线 | 0.0628 ~ 0.0646 ms | 性能基线 |
| A 矩阵下一块 L1 预取 | 提前发射 A 矩阵软件预取指令 | 0.0707 ~ 0.0715 ms | **负收益**：每对计算块增加 8 条 `prefetch` 消息指令，开销超出延迟隐藏收益 |
| 8 级缓冲（32KB）+ 每 4 块同步 | 进一步摊薄工作组屏障开销 | 0.0690 ~ 0.0703 ms | **负收益**：SLM 占用升至 32KB；实际驻留组数变化待采集确认 |
| $16 \times 8$ 几何 + 64 线程工作组 | 减半单线程累加寄存器压力 | 0.0832 ~ 0.0835 ms | **负收益**：A 的逻辑 global load 重复度由 4 倍增至 8 倍；实际 DRAM 流量取决于缓存 |

结合硬件行为的量化归因如下：
1. **指令开销反噬**：A 矩阵软件预取使每对计算块额外发射 8 条内存消息指令。在显存带宽并未饱和的情形下，指令管线被预取指令抢占，导致总体耗时上升。
2. **资源驻留假设**：8 级缓冲占用 32KB SLM，但不能由此断言无法驻留两个工作组或 occupancy 腰斩。Intel 的 [Xe-HPG 架构说明](https://www.intel.com/content/www/us/en/developer/articles/technical/introduction-to-the-xe-hpg-architecture.html) 描述每个 Xe-core 最高 128KB SLM，与 L1 共享资源；这不同于单工作组可申请上限。实际驻留还受分配粒度、线程槽、GRF、barrier 等限制，需要结合编译产物与采集数据判断。
3. **逻辑读取重复增加**：64 线程、$16 \times 8$ tile 配置使 A 的组内逻辑 global load 重复度升至 8 倍；缓存命中可能避免同倍数 DRAM 读取。应分别比较请求数量、缓存流量和显存流量。

## A 矩阵片上缓存中转与全局流量权衡

在进一步探索前，我们检查了当前软件栈下若干 API 路径。以下失败记录用于界定本实现的可用路径，不能独立证明硬件 ISA 缺失：

| 特性验证项 | 当前实验结果与验证边界 |
|---|---|
| DPAS ExecutionSize=16 验证 | 该测试可编译但产生 78/128 错误；本文保留已通过测试的 ExecutionSize=8 路径，ISA 支持需另据架构规范核对 |
| 硬件 2D Block 读写（`load_2d`） | 该软件栈测试挂起；bf16 转置测试另有类型约束。使用前应查询 API 支持并核对参数，不能据此概括所有硬件 2D 消息 |
| Large GRF 模式（`-ze-opt-large-register-file`） | 本轮发生执行失败或性能回退；失败需单独复现和定位，不能归因于并发线程容量下降 |
| A 矩阵 `block_load` 缓存提示微调 | 实测 0.0641 ~ 0.0659 ms，性能中性无明显收益 |

在保留当前可用路径后，我们重新评估 A 的读取：同一数据由组内 4 个 work-item 重复发出 global load，逻辑读取量是唯一数据量的 4 倍；实际 DRAM 流量取决于缓存命中，不能直接称为 4 倍显存带宽冗余。

为此，我们设计了**“A 矩阵片上 SLM 协作中转”**架构：由工作组内 32 个线程协作单次将 8KB 的 A 矩阵块拉入 SLM，随后各线程由 SLM 读取自身所需的操作数片段。

| 优化阶段 | 存储配置与方案说明 | 单次迭代耗时 | 相对 oneDNN 比例 |
|---|---|---:|---:|
| 4 级缓冲基线（A 全局直读） | B 占用 16KB SLM，A 矩阵全局直读 | 0.0628 ~ 0.0646 ms | 约 87% |
| **A 矩阵 SLM 协作中转** | **A 占 16KB + B 占 8KB = 24KB SLM** | **0.0613 ~ 0.0615 ms** | **约 90%** |

核心协作加载与操作数读取实现：

```cpp
// 32 个工作项协作将 A 矩阵块拷入 SLM（每个线程搬运 256B，单块 8KB）
const uint32_t offA = abuf * SLM_A_BYTES;
simd<bf16, 128> av =
    block_load<bf16, 128>(apb + lid * 128, overaligned_tag<16>{});
slm_block_store(offA + lid * 256, av, overaligned_tag<16>{});

// load_grf 从 SLM 中读取 4 个 256B 操作数片段
a0 = slm_block_load<bf16, 128>(offA + wi_row * 1024 + 0 * 256,
                               overaligned_tag<16>{});
a1 = slm_block_load<bf16, 128>(offA + wi_row * 1024 + 1 * 256,
                               overaligned_tag<16>{});
a2 = slm_block_load<bf16, 128>(offA + wi_row * 1024 + 2 * 256,
                               overaligned_tag<16>{});
a3 = slm_block_load<bf16, 128>(offA + wi_row * 1024 + 3 * 256,
                               overaligned_tag<16>{});
```

VTune 硬件数据复采表明：
- 协作中转增加了搬运指令，总指令数由 8.58M 增至 10.83M（约 26%），同时减少组内对 A 的重复 global load。历史净耗时降低约 3.3%；要确认收益来自哪个缓存/访存层级，还需对应流量与停顿指标。
- 内核平均执行耗时缩减至 59.7 µs，**XMX Pipeline Active 达到 20.7%，首次超越 oneDNN 的 19.1%**；XMX 指令发射速率达到约 86B/s（超越 oneDNN 的 75B/s）。手写内核性能达到官方 oneDNN 的 90%、oneMKL 的 87%。

## 线程几何尺寸与 Bank Padding 的边界验证

在 SLM 双中转架构确立后，我们进一步验证了两项细粒度结构假设：

| 探索实验 | 实现说明 | 单次迭代耗时 | 验证结论 |
|---|---|---:|---|
| 双中转基准 | 32 线程 $\times 16 \times 16$ + A/B 双中转 | 0.0613 ~ 0.0615 ms | 最优配置 |
| 64 线程工作组（$16 \times 8$ 几何） | 扩充工作组规模以期复用 | 0.0780 ~ 0.0791 ms | **负收益**：A 的 SLM 逻辑读取重复度达 8 倍；驻留变化待验证 |
| SLM Bank Padding 填充 | A 槽位 1056B / B 槽位 288B 隔离 | 0.0698 ~ 0.0704 ms | **负收益**：改变步长且 SLM 膨胀至 26.1KB；具体对齐与 bank 影响待验证 |

实验表明：
1. **本轮 64 线程配置未获益**：所测 $16 \times 8$ tile 配合 64 个 ESIMD work-item 的配置更慢，A 在 SLM 中的读取重复度增加。这同时改变了 tile 复用和资源需求，不能推出 64 线程工作组在 A770 上普遍不适用。
2. **本轮 padding 配置退化**：填充改变了 SLM 步长、寻址与总分配量（24KB 增至 26.1KB）。需检查具体消息的对齐要求、bank 行为和资源分配，不能把 256B 载荷大小直接当作所有地址必须 256B 对齐的证据，也不能推出 padding 必然有害。

**阶段性收敛结论**：在 Intel Arc A770 (DG2) 硬件上，**32 线程工作组 $\times 16 \times 16$ 寄存器 Tile + A/B 双 SLM 协作中转（24KB 容量）+ 操作数直通布局 + 常量地址步进**是本轮测试配置中的较优组合，迁移到其他形状需重新选择。

## 算子泛化：标量系数与运行时对齐维度支持

在当前配置收敛后，我们加入标量系数与运行时对齐维度支持。此处仍是预打包输入的受限内核，不是完整 BLAS GEMM 替代品：

1. **通用线性组合支持（$C = \alpha A B + \beta C$）**：
   - 将累加器专职用于矩阵乘累加，在写回阶段按需重读旧 C 矩阵计算 $\alpha \cdot \text{acc} + \beta \cdot C_{\text{old}}$。
   - 使用独立的 `BetaZero` 与 `AlphaOne` 模板参数：所有 `beta==0` 路径均不读取旧 C，`alpha==1` 再省去缩放。BLAS 允许 beta 为零时不初始化 C，不能以 `0 * old_C` 替代“不读取”，否则旧 C 的 NaN 会污染结果。参见 [Netlib GEMM 定义](https://www.netlib.org/lapack/explore-html/d4/de2/sgemm_8f_source.html)。
2. **运行时动态 $M/N/K$ 维度**：
   - 将矩阵维度解耦为内核运行时参数，输入数据的操作数重排与 Work-Group 分配在运行时按矩阵大小动态计算，维度满足硬件对齐约束（$M \% 128 = 0, N \% 64 = 0, K \% 32 = 0$）。

输入契约：M/N/K 必须为正并满足上述整除关系；A/B 已按本文布局打包，C 为连续 row-major float，指针满足示例声明的 16B 对齐且分配完整。调用方须在打包前检查维度与大小乘法；不满足条件的输入应明确拒绝或交给独立 fallback，不能直接向下整除后启动。本文未实现转置、任意 leading dimension、尾块、空维度及完整 BLAS 的特殊值/quick-return 语义（包括 `alpha==0` 时跳过 A/B）。

以下为修订后的核心片段，沿用前文 `load_block`/`load_grf` 等定义。它需要在实际 A770 工程中编译和对拍，不能把下方历史 PASSED 表当成此次修订的验证记录。

```cpp
template <bool BetaZero, bool AlphaOne>
void gemm_esimd_generalized(bf16 *Ap, uint32_t *Bp, float *C, int M, int N,
                            int K, float alpha, float beta, queue q) {
    const int wgs_m = M / BM;
    const int wgs_n = N / BN;
    const int kb_total = K / BK;
    const size_t wgs = static_cast<size_t>(wgs_m) * wgs_n;

    q.submit([&](handler &h) {
        h.parallel_for(
            nd_range<1>(range<1>((size_t)wgs * WG_THREADS), range<1>(WG_THREADS)),
            [=](nd_item<1> it) SYCL_ESIMD_KERNEL {
                slm_init<SLM_TOTAL_BYTES>();

                const uint32_t lid = it.get_local_id(0);
                const size_t wg = it.get_group_linear_id();
                const int wg_row = wg % wgs_m; // 线性 ID 增大时，M tile 索引先变化
                const int wg_col = wg / wgs_m;
                const int wi_row = lid / 4;    // 每线程负责 16 行
                const int wi_col = lid % 4;    // 每线程负责 16 列

                // 常量步进与线程专属寻址基址
                const int r2 = lid / 2;
                const int rr = r2 % 8;
                const int rh = r2 / 8;
                const int hp = lid % 2;
                const uint32_t b_op_base = (uint32_t)(wi_col * 256);
                const bf16 *apb = Ap + static_cast<size_t>(wg_row) * kb_total * 4096;
                const uint32_t *brow = Bp + (size_t)r2 * N + wg_col * BN + hp * 32;

                simd<bf16, 128> a0, a1, a2, a3;
                simd<bf16, 128> b0, b1, b2, b3;
                simd<float, 64> c00(0.0f), c01(0.0f), c10(0.0f), c11(0.0f);

                load_block(0, 0, apb, brow);
                barrier();

                for (int b = 0; b < kb_total; b++) {
                    const int cur = b & 1;
                    const int nxt = cur ^ 1;
                    if (b + 1 < kb_total)
                        load_block(nxt, nxt, apb + 4096, brow + size_t{16} * N);

                    load_grf(cur, cur, a0, a1, a2, a3, b0, b1, b2, b3);
                    // 8 次 8x8x16 DPAS 计算 (16x16 累加块)
                    c00 = dpas<8, 8, float>(c00, b0, a0);
                    c00 = dpas<8, 8, float>(c00, b1, a1);
                    c01 = dpas<8, 8, float>(c01, b2, a0);
                    c01 = dpas<8, 8, float>(c01, b3, a1);
                    c10 = dpas<8, 8, float>(c10, b0, a2);
                    c10 = dpas<8, 8, float>(c10, b1, a3);
                    c11 = dpas<8, 8, float>(c11, b2, a2);
                    c11 = dpas<8, 8, float>(c11, b3, a3);

                    barrier();
                    // 最后一轮不再形成超出 B 分配范围的指针
                    if (b + 1 < kb_total) {
                        apb += 4096;
                        brow += size_t{16} * N;
                    }
                }

                // C 矩阵写回：支持 alpha * (A*B) + beta * C
                const int gr = wg_row * BM + wi_row * 16;
                const int gc = wg_col * BN + wi_col * 16;
                if constexpr (!AlphaOne) {
                    c00 *= alpha; c01 *= alpha; c10 *= alpha; c11 *= alpha;
                }
                if constexpr (BetaZero) {
                    // 任意 alpha、beta=0：不读取旧 C
                    for (int r = 0; r < 8; r++) {
                        simd<float, 16> row0, row1;
                        row0.select<8, 1>(0) = c00.select<8, 1>(r * 8);
                        row0.select<8, 1>(8) = c01.select<8, 1>(r * 8);
                        row1.select<8, 1>(0) = c10.select<8, 1>(r * 8);
                        row1.select<8, 1>(8) = c11.select<8, 1>(r * 8);
                        block_store<float, 16>(C + (size_t)(gr + r) * N + gc, row0, overaligned_tag<16>{});
                        block_store<float, 16>(C + (size_t)(gr + 8 + r) * N + gc, row1, overaligned_tag<16>{});
                    }
                } else {
                    // beta!=0：读取旧 C；alpha 缩放已在上方完成
                    for (int r = 0; r < 8; r++) {
                        simd<float, 16> old0 = block_load<float, 16>(C + (size_t)(gr + r) * N + gc, overaligned_tag<16>{});
                        simd<float, 16> row0;
                        row0.select<8, 1>(0) = c00.select<8, 1>(r * 8).read() + old0.select<8, 1>(0).read() * beta;
                        row0.select<8, 1>(8) = c01.select<8, 1>(r * 8).read() + old0.select<8, 1>(8).read() * beta;
                        block_store<float, 16>(C + (size_t)(gr + r) * N + gc, row0, overaligned_tag<16>{});

                        simd<float, 16> old1 = block_load<float, 16>(C + (size_t)(gr + 8 + r) * N + gc, overaligned_tag<16>{});
                        simd<float, 16> row1;
                        row1.select<8, 1>(0) = c10.select<8, 1>(r * 8).read() + old1.select<8, 1>(0).read() * beta;
                        row1.select<8, 1>(8) = c11.select<8, 1>(r * 8).read() + old1.select<8, 1>(8).read() * beta;
                        block_store<float, 16>(C + (size_t)(gr + 8 + r) * N + gc, row1, overaligned_tag<16>{});
                    }
                }
            });
    });
}
```

主机端先完成输入契约检查，再根据运行时系数选择模板实例，且保持同一 in-order 队列（或显式建立依赖）。下面的维度检查应在打包与分配前执行；分配大小乘法、缓冲区容量和对齐检查由实际工程补齐：

```cpp
// 需要 #include <stdexcept>
if (M <= 0 || N <= 0 || K <= 0 || M % 128 || N % 64 || K % 32)
    throw std::invalid_argument("GEMM requires positive, aligned M/N/K");

// 在通过完整输入检查并完成打包后分派
if (beta == 0.0f) {
    if (alpha == 1.0f)
        gemm_esimd_generalized<true, true>(Ap, Bp, C, M, N, K, alpha, beta, q);
    else
        gemm_esimd_generalized<true, false>(Ap, Bp, C, M, N, K, alpha, beta, q);
} else {
    if (alpha == 1.0f)
        gemm_esimd_generalized<false, true>(Ap, Bp, C, M, N, K, alpha, beta, q);
    else
        gemm_esimd_generalized<false, false>(Ap, Bp, C, M, N, K, alpha, beta, q);
}
```

原版本历史对拍记录如下（`errors = 0`；原始容差与覆盖方式仍需补充，尚未验证上述新分派）：

| 测试矩阵形状 ($M \times N \times K$) | 线性组合参数 ($\alpha, \beta$) | 单次迭代耗时 | 验证状态 |
|---|---|---:|---|
| 基准形状：$1024 \times 1536 \times 512$ | $\alpha=1.0, \beta=0.0$ | 0.0656 ms | `PASSED` (0 错误) |
| 小矩阵：$256 \times 512 \times 128$ | $\alpha=2.0, \beta=1.0$ | 0.0153 ms | `PASSED` (0 错误) |
| 高瘦矩阵（Tall）：$2048 \times 512 \times 512$ | $\alpha=0.5, \beta=0.0$ | 0.0551 ms | `PASSED` (0 错误) |
| 扁宽矩阵（Wide）：$1024 \times 2048 \times 256$ | $\alpha=1.0, \beta=-1.0$ | 0.0838 ms | `PASSED` (0 错误) |
| 深矩阵（Deep）：$512 \times 512 \times 1024$ | $\alpha=3.0, \beta=0.5$ | 0.0429 ms | `PASSED` (0 错误) |
| 最小对齐边界：$128 \times 64 \times 32$ | $\alpha=0.0, \beta=1.0$ | 0.0114 ms | `PASSED` (0 错误) |
| 混合尺寸：$512 \times 1024 \times 512$ | $\alpha=-2.0, \beta=0.25$ | 0.0350 ms | `PASSED` (0 错误) |

在工程落地过程中，总结出以下关键经验：
- **区分独立调用与递推**：若要每次验证同一个初始 C，需在每次调用前重置 C，并确保重置与计算的依赖。若有意连续执行 `C = alpha*AB + beta*C`，它是合法递推，参考结果也必须递推，不能比较单次结果。重置时间需单独统计；若计入批次时间，应标注口径。
- **分支分派的静态化**：模板分派可减少不必要的运行时计算与读写，但统一的标量条件不一定导致线程发散。动态分支下若出现挂起，应检查 barrier 一致性、依赖与编译器/驱动问题，不能概括为 ESIMD 的动态分支会导致死锁。
- **动态开销与适用范围**：历史基准由 0.0613 ms 增至 0.0656 ms（约 7%），但这是当时两个版本的整体差异，不能隔离为纯维度动态化成本。当前接口支持运行时对齐维度，未覆盖的输入应明确拒绝或回退。

## 访存延迟隐藏：基于 1D 模拟 2D 的异步软件预取

双缓冲为 SLM 搬运与 DPAS 计算提供重叠机会，但没有保证全局加载延迟全部隐藏。若缓存未命中或预取提前量不足，仍可能出现等待。

为探索进一步隐藏访存延迟的空间，我们尝试软件预取：在第 $b$ 轮发出未来第 $b + \text{dist}$ 块的缓存请求。它不返回数据，也不提供“已经驻留”的保证；是否降低 DRAM、缓存或后续加载等待，需要通过对照实验判断。

### 1. 当前 A770 软件栈的 Prefetch 支持记录

在设计预取方案前，我们针对 Intel Arc A770 (Xe-HPG DG2) 显卡展开了底层的微基准实测，记录了当前 API 路径的可用性：

1. **当前软件栈查询不支持 ESIMD 2D Block IO（`prefetch_2d` / `load_2d`）**：
   - 官方扩展设备属性查询：
     ```cpp
     bool has_2d = dev.get_info<sycl::ext::intel::esimd::info::device::has_2d_block_io_support>();
     // 本文测试的 A770 + oneAPI/驱动组合返回 FALSE；为 false 时不调用该 API
     ```
   - 强行调用 `prefetch_2d<bf16, BW, BH>(...)` 运行时会直接崩溃并报告：
     `level_zero backend failed with error: 20 (UR_RESULT_ERROR_DEVICE_LOST)`。
   - [ESIMD 扩展文档](https://github.com/intel/llvm/blob/sycl/sycl/doc/extensions/supported/sycl_ext_intel_esimd/sycl_ext_intel_esimd_functions.md) 要求支持属性为 true。属性为 false 和强行调用失败，只能支持本软件栈下该 API 路径不可用的结论，不能单独证明芯片不存在所有类型的 2D 硬件消息；ISA、编译器、驱动和参数限制应分别核对。
2. **本轮 1D 预取用例可执行**：
   - 本轮 1D 指针预取 `prefetch<T, N>` 测试可执行，下列 5 种缓存提示组合未触发错误。这不等于验证所有类型/长度/Gather 变体，也不能仅靠未报错证明缓存提示已按预期生效：
     - `L1: uncached, L2: cached`
     - `L1: cached, L2: uncached`
     - `L1: cached, L2: cached`
     - `L1: streaming, L2: uncached`
     - `L1: streaming, L2: cached`

因此，本文在当前可用的软件路径上选择协作发射 1D 预取，覆盖二维 tile 的地址集合；称为“1D 模拟 2D”不意味着复现了硬件 2D 消息的布局变换或边界语义。

### 2. 1D 模拟 2D Prefetch 核心设计方案

```mermaid
graph TD
    A["2D Matrix Block (Future K+dist Tile)"] --> B["A 矩阵: 2D 瓦片 (BM x BK = 128x32, 8KB)"]
    A --> C["B 矩阵: 2D 跨行 (BK/2 x BN = 16x64, 4KB)"]
    B --> D["32 个 Work-Item 协同发起 1D 连续 Prefetch<br/><code>prefetch&lt;uint32_t, 64&gt;(pf_a, cached/cached)</code>"]
    C --> E["各 Work-Item 按行跨度发起 1D 跨行 Prefetch<br/><code>prefetch&lt;uint32_t, 32&gt;(pf_b, cached/cached)</code>"]
    D --> F["请求未来 b+dist 块进入缓存"]
    E --> F
    F --> G["为后续加载与 DPAS 计算提供重叠机会"]
```

#### 核心实现机制
1. **A 矩阵 2D 瓦片预取**：
   每个 Work-Group 需要处理 $128 \times 32$ 的 A 瓦片（8KB）。32 个 Work-Item 各自分担 256 字节（64 个 `uint32_t`），通过：
   ```cpp
   prefetch<uint32_t, 64>(pf_a, properties{alignment<16>, cache_hint_L1<cached>, cache_hint_L2<cached>});
   ```
   并发发射 1D 预取，请求未来块的数据进入缓存；A 此时已经预打包为连续 tile，不能把这段连续地址公式直接用于原始 row-major A。
2. **B 矩阵 2D 跨行预取**：
   B 矩阵在显存中以跨行存储（行跨度为 $N$）。每个线程按行偏移量发射：
   ```cpp
   prefetch<uint32_t, 32>(pf_b, properties{alignment<16>, cache_hint_L1<cached>, cache_hint_L2<cached>});
   ```
   让不同 work-item 的行偏移共同覆盖 B 的未来 tile；该调用是缓存请求，不保证在后续 load 前完成。
3. **软件边界安全防御（Boundary Safe Prefetching）**：
   某些 2D 消息对描述符界定的 surface 有边界语义，但不能将其等同于任意无效指针都安全。本文 1D 预取应确保整个访问范围有效；测试中非法访问出现过 Device Lost，但这一错误码本身不能唯一定位到越界。以下 K 守卫仅在输入已满足维度、布局与分配契约时才充分：
   ```cpp
   if (dist > 0 && dist < kb_total - cur_b) {
       // 仅在合法 K-block 范围内发射预取
   }
   ```

### 3. 异步预取流水线内核实现

在双缓冲流水线内嵌入 1D 模拟 2D 预取逻辑：

```cpp
// 1D 模拟 2D Prefetch 核心实现
auto prefetch_2d_sim = [=](int dist, int cur_b, const bf16 *cur_apb, const uint32_t *cur_brow) SYCL_ESIMD_FUNCTION {
    if (dist > 0 && dist < kb_total - cur_b) {
        // A 矩阵 1D 瓦片连续预取 (每个线程 256B = 64 uint32, 32 线程覆盖 8KB)
        const uint32_t *pf_a = reinterpret_cast<const uint32_t*>(cur_apb + static_cast<size_t>(dist) * 4096 + lid * 128);
        prefetch<uint32_t, 64>(pf_a, 
            properties{alignment<16>, cache_hint_L1<cache_hint::cached>, cache_hint_L2<cache_hint::cached>});
        
        // B 矩阵 1D 跨行步进预取 (每个线程 128B = 32 uint32, 覆盖跨行 4KB)
        const uint32_t *pf_b = cur_brow + static_cast<size_t>(dist) * 16 * N;
        prefetch<uint32_t, 32>(pf_b, 
            properties{alignment<16>, cache_hint_L1<cache_hint::cached>, cache_hint_L2<cache_hint::cached>});
    }
};

// --- 流水线启动阶段 (Prologue) ---
// 第 0 轮预取只在这里发出一次；PF_DIST 为正的编译期常量
static_assert(PF_DIST > 0);
prefetch_2d_sim(PF_DIST, 0, apb, brow);

load_block(0, 0, apb, brow);
barrier();

// --- 主循环 (Main Loop) ---
for (int b = 0; b < kb_total; b++) {
    const int cur = b & 1;
    const int nxt = cur ^ 1;

    // apb/brow 此时指向第 b 块；跳过启动阶段已发出的第 0 轮请求
    if (b != 0)
        prefetch_2d_sim(PF_DIST, b, apb, brow);

    if (b + 1 < kb_total)
        load_block(nxt, nxt, apb + 4096, brow + size_t{16} * N);

    load_grf(cur, cur, a0, a1, a2, a3, b0, b1, b2, b3);
    
    // DPAS 硬件张量计算
    c00 = dpas<8, 8, float>(c00, b0, a0);
    c00 = dpas<8, 8, float>(c00, b1, a1);
    c01 = dpas<8, 8, float>(c01, b2, a0);
    c01 = dpas<8, 8, float>(c01, b3, a1);
    c10 = dpas<8, 8, float>(c10, b0, a2);
    c10 = dpas<8, 8, float>(c10, b1, a3);
    c11 = dpas<8, 8, float>(c11, b2, a2);
    c11 = dpas<8, 8, float>(c11, b3, a3);

    barrier();
    // 最后一轮不再形成超出 B 分配范围的指针
    if (b + 1 < kb_total) {
        apb += 4096;
        brow += size_t{16} * N;
    }
}
```

### 4. A770 历史硬件基准记录与算术核对

该节历史测试环境：Intel Arc A770 (16GB), oneAPI 2026.1, Driver 32.0.101.8974, Windows 11 25H2。未据此推定前文所有实验也使用完全相同版本。

以下保留历史耗时与错误计数，只按表内耗时统一重算两项指标：耗时降低率 `1 - t_new/t_old`，吞吐提高率 `t_old/t_new - 1`；负值表示退化。TFLOPS 按 `2*M*N*K / (耗时毫秒 * 10^9)` 计算。范围是记录端点的算术换算，不是置信区间，也不是修订后内核的复测结果。

| 形状 (M×N×K; alpha, beta) | 双缓冲历史耗时 / TFLOPS | 预取历史耗时 / TFLOPS | 耗时降低率 / 吞吐提高率 | 原始错误计数 |
|---|---|---|---|---|
| Deep (512×512×1024; 3, 0.5) | 0.04290 ms / 12.51 | 0.04107 ms / 13.07 | +4.3% / +4.5% | `errors: 0/262144` |
| Baseline (1024×1536×512; 1, 0) | 0.06565 ms / 24.53 | 0.06170 ~ 0.06701 ms / 24.04 ~ 26.10 | -2.1 ~ +6.0% / -2.0 ~ +6.4% | `errors: 0/262144` |
| Wide (1024×2048×256; 1, -1) | 0.08376 ms / 12.82 | 0.07836 ms / 13.70 | +6.4% / +6.9% | `errors: 0/262144` |
| Small (256×512×128; 2, 1) | 0.01534 ms / 2.19 | 0.01636 ms / 2.05 | -6.6% / -6.2% | `errors: 0/131072` |
| Tall (2048×512×512; 0.5, 0) | 0.05514 ms / 19.47 | 0.05111 ms / 21.01 | +7.3% / +7.9% | `errors: 0/262144` |
| Large (2048×2048×1024; 1, 0) | 0.21889 ms / 39.24 | 0.21448 ms / 40.05 | +2.0% / +2.1% | `errors: 0/262144` |
| Huge (2048×2048×2048; 1, 0) | 0.38800 ms / 44.28 | 0.36596 ~ 0.38799 ms / 44.28 ~ 46.94 | +0.0 ~ +5.7% / +0.0 ~ +6.0% | `errors: 0/262144` |

注意：Baseline、Wide、Tall、Large、Huge 的原始错误计数分母 262144 小于各自的 M×N。现有记录未说明是抽样还是记录遗漏，因此不能将其视为全量正确性验证；需回查测试程序、采样规则与原始日志。Small 的预取版本变慢，Baseline 范围也包含退化，当前表不能支持“普遍稳定加速”。

> **官方库历史基线对照**（基准形状 $1024 \times 1536 \times 512$）：
> - **oneDNN** 官方库耗时：`0.0525 ~ 0.0552 ms`
> - **oneMKL** 官方库耗时：`0.0512 ~ 0.0537 ms`
> - 本节 Baseline 记录为预打包条件下 `0.06170 ~ 0.06701 ms`。其他阶段还有不同记录，不能挑选跨轮次最佳值组成最终区间；接近官方库的比例需在相同输入契约、正确依赖和同轮计时下重新确认。

### 5. 关键调优经验与防御性准则

1. **预取距离（Prefetch Distance）的最佳选择**：
   - 按本节代码，循环第 b 轮的 `apb/brow` 指向第 b 块，所以 `PF_DIST=1` 请求的是 b+1，而随后 `load_block` 也加载 b+1；它不是“预取 b+2”。若要请求 b+2，应测试 `PF_DIST=2`，不能沿用 dist=1 的历史成绩。启动阶段与第 0 轮的重复预取已去重，效果需重测。
   - 历史记录中增大到 `PF_DIST >= 3` 未带来进一步收益；缓存置换、消息开销、提前量变化均是候选解释，需采集后才能归因。
2. **数据类型与 DWORD 对齐规约**：
   - 本例以 `uint32_t` 视图配合 `alignment<16>` 请求 256B/128B 数据。alignment 是调用方对真实地址的承诺，不会自动对齐指针；需核对当前 API 的类型、长度及对齐约束，不能只靠强制转换判断合法，也不能由此声称吞吐必然最高。
3. **软件边界检查必不可少**：
   - 保留 `dist > 0 && dist < kb_total - cur_b` 检查，并要求 dist 为正、维度对齐、指针与分配范围合法。对非对齐输入，这一个 K 条件不能替代所有边界检查。遇到 Device Lost 应保留最小复现，并检查越界、同步及软件栈错误。

# 五、Intel XPU (A770) 算子优化最佳实践总结

这组历史实验展示了从朴素实现逐步减少访存与辅助指令开销的过程。约 0.061 ms 的阶段性记录建立在预打包、对齐输入条件下；修订后的队列依赖、系数分派和预取代码仍待硬件重测。可迁移的方法是明确契约、测量瓶颈和逐项验证，而不是固定参数本身。

### 1. 存储层级与计算流水的重叠

- **比较缓冲方案**：双缓冲或多级 SLM 能为搬运与计算创造重叠机会，也会增加资源与同步需求。比较单缓冲、双缓冲和多级方案，结合生成指令确认实际依赖；不保证完全重叠，也不要求所有算子都使用 SLM。
- **验证软件预取收益**：预取距离以当前指针对应的块为基准定义。结合工作集、缓存提示与消息开销测试各距离，保留变慢和无显著变化的结果，不把本轮 dist=1 经验当作 DG2 通用最优值。

### 2. 工作组几何与寄存器预算

- **明确线程单位**：区分 SYCL work-item、subgroup、ESIMD work-item 和硬件线程槽。本文 32 个 ESIMD work-item、每项 16×16 输出是所测配置中的较优组合；工作组实际执行顺序和驻留数量不能只由线性 ID 或全局线程总数推导。
- **核对实际 GRF 分配**：操作数字节数不是完整寄存器报告。Large GRF 的收益取决于是否生效、实际分配、spill 和驻留情况；保留默认与 Large GRF 的对照，而非直接排除一种模式。

### 3. 用编译产物解释辅助指令开销

- **操作数布局与转换成本一起评估**：减少最终生成的重排和细碎消息，允许上游直接产出目标布局时优先考虑融合。`select`/`bit_cast` 本身不必然生成昂贵指令，应依据反汇编判断；打包成本须按运行时复用方式计入。
- **地址计算外提**：尝试循环外计算基址、循环内常量步进，并检查整数范围与指针合法性。确认实际指令减少后，再以同轮性能数据判断收益。

### 4. SLM 容量与驻留的联合预算

- **区分容量层次**：Xe-HPG 架构资料给出每个 Xe-core 最高 128KB SLM；单工作组限制、分配粒度和实际驻留是不同问题。24KB 是本文较优配置的用量，不是保证两个工作组驻留的红线。
- **区分逻辑请求和物理流量**：重复 global load 可能命中缓存；SLM 中转则引入自己的读取、写入及同步开销。分别观察指令数、各层缓存/显存流量与停顿，验证具体配置的净收益。

### 5. API 支持、正确性与复现边界

- **逐层核对可用性**：先查询 API 支持与参数约束，再用合法的最小用例验证；接口不可用或测试失败，不能独立证明硬件缺少某种 ISA。动态分支、Large GRF 下的错误应单独定位。
- **对拍后再比较性能**：明确打包布局、尺寸、对齐及系数契约，beta 为零时不读取旧 C；记录全量/抽样方式、容差和特殊值测试。保护完整预取地址范围，所有 USM 调用建立必要依赖。

## 参考与待补验证

- [Khronos：SYCL 队列顺序与依赖](https://github.khronos.org/syclacademy/Lesson_Materials/In_Order_Queue/)。
- [Intel：Xe-HPG 架构与 L1/SLM](https://www.intel.com/content/www/us/en/developer/articles/technical/introduction-to-the-xe-hpg-architecture.html)。
- [Intel LLVM：ESIMD 函数及 2D Block IO 支持条件](https://github.com/intel/llvm/blob/sycl/sycl/doc/extensions/supported/sycl_ext_intel_esimd/sycl_ext_intel_esimd_functions.md)。
- [Netlib：GEMM 参数与 beta=0 语义](https://www.netlib.org/lapack/explore-html/d4/de2/sgemm_8f_source.html)。

下一轮硬件验证优先完成：修订示例的编译与全量对拍；正确依赖下的 oneMKL/oneDNN 同轮基线；beta=0 且旧 C 为 NaN 的回归；去重后各预取距离的比较；打包成本与设备执行时间分列；SLM/GRF 实际分配及驻留数据；回查历史表的错误计数覆盖范围。完成后再将对应历史数据替换为可复现的新记录。
