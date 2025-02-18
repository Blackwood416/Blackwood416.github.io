---
title: 操作系统学习日志 03
date: 2024-11-16 15:16:51
tags: OS
categories: 开发
---

## BenOS 源码分析

上一篇我们运行成功的 BenOS，只是一个通过串口显示输出的最简单的裸机程序，我们后续会逐步扩展和丰富，让其具有进程调度、系统调用等现代操作系统的基本功能。

## 链接脚本

因为我们写的是裸机程序，因此需要手动编写 Makefile 和链接脚本，链接这个过程平时是操作系统做的，所以裸机程序这个跟操作系统同级的程序需要自己手动链接。

对于任何一种可执行程序，不论是。elf 还是。exe，的都是由代码（.text）段、数据（.data）段、未初始化数据（.bss）段等段（sectioin）组成的。

链接脚本最终会把一大堆编译好的二进制文件（.o 文件）链接成一个可执行文件，这个可执行文件由总体的。text/.data/.bss 段描述。

下面看一下 BenOS 的链接脚本，名为`link.ld`，内容如下：

```
SECTIONS
{
. = 0x80000;
.text.boot : { *(.text.boot) }
.text : { *(.text) }
.rodata : { *(.rodata) }
.data : { *(.data) }
. = ALIGN(0x8);
bss_begin = .;
.bss : { *(.bss*) }
bss_end = .;
}
```

第 1 行中，`SECTIONS`是链接脚本（Linker Script，简称 LS）语法中的关键命令，用来描述输出文件的内存布局。它告诉链接文件如何把输入文件的段映射到输出文件的各个段，如何将输入段整合为输出段，以及如何把输出段放入程序地址控件和进程地址空间。

在第 3 行中，`.`非常关键，它代表位置计数 (Location Counter,LC), 这里把`.text`段的
链接地址设置为 0x80000, 这里的链接地址指的是加载地址 (load address)。

在第 4 行中，输出文件的`.text.boot` 段内容由所有输入文件（其中的“*”可理解为所有的`.o` 文件，也就是二进制文件）的`.text.boot`段组成。

在第 5 行中，输出文件的`.text` 段内容由所有输入文件（其中的“*”可理解为所有的`.o`文件，也就是二进制文件）的`.text` 段组成。

在第 6 行中，输出文件的`.rodata` 段由所有输入文件的`.rodata` 段组成。

在第 7 行中，输出文件的`.data` 段由所有输入文件的`.data` 段组成。

在第 8 行中，设置为按 8 字节对齐。

在第 9~11 行中，定义了一个`.bss` 段。

因此，上述链接文件定义了如下几个段。
- .text.boot 段：启动首先要执行的代码。
- .text 段：代码段。
- .rodata 段：只读数据段。
- .data 段：数据段。
- .bss 段：包含未初始化的全局变量和静态变量。

## 启动（Boot）

下面我们来看用于启动的汇编代码`boot.S`，内容如下：

```assembly
#include "mm.h"

.section ".text.boot"

.globl _start
_start:
	mrs	x0, mpidr_el1		
	and	x0, x0,#0xFF		// 检查处理器核心 ID
	cbz	x0, master		// 除了 CPU0，其他 CPU 都会在这里死循环等待
	b	proc_hang

proc_hang: 
	b 	proc_hang

master:
	adr	x0, bss_begin
	adr	x1, bss_end
	sub	x1, x1, x0
	bl 	memzero

	mov	sp, #LOW_MEMORY 
	bl	kernel_main
	b 	proc_hang
```

启动用的汇编代码不长，下面做简要分析。

在第 3 行中，把 `boot.S` 文件编译链接到`.text.boot` 段中。我们可以在链接文件 `link.ld` 中

把`.text.boot` 段链接到这个可执行文件的开头，这样当程序执行时将从这个段开始执行。

在第 6 行中，`_start` 为程序的入口点。

在第 7 行中，由于树莓派 4B 有 4 个 CPU 内核，但是本实验的裸机程序不希望 4 个 CPU 内核都运行，我们只想让第一个 CPU 内核运行起来。mpidr_el1 寄存器是表示处理器内核的编号。

在第 8 行中，`and` 指令用于完成与操作。

第 9 行，`cbz` 为比较并跳转指令。如果 X0 寄存器的值为 0, 则跳转到 `master` 标签处。若 X0 寄存器的值为 0, 则表示第 1 个 CPU 内核。其他 CPU 内核则跳转到 `proc_hang` 标签处。

在第 12 和 13 行，`proc_hang` 标签这里是死循环。

在第 15 行，对于 `master` 标签，只有第一个 CPU 内核才能运行到这里。

在第 16~19 行，初始化`.bss` 段。

在第 21 行中，使 SP 指向内存的 4 MB 地址处。树莓派至少有 1GB 内存，我们这个裸机程序用不到那么大的内存。

在第 22 行中，跳转到 C 语言的 `start_kernel` 函数，这里最重要的一步是设置 C 语言运行环境，即栈。

总之，上述汇编代码还是比较简单的，我们只做了 3 件事情。
- 只让第一个 CPU 内核运行，让其他 CPU 内核进入死循环。
- 初始化。bss 段。
- 设置栈，跳转到 C 语言入口。

## 加载内核

我们已经完成了启动，下面我们来看如何加载一个内核程序，在这个示例中，我们将加载一个名为 `kernel.c` 的 C 语言程序，内容如下：

```c
#include "mini_uart.h"
void start_kernel(void)
{
    uart_init();
    uart_send_string("Welcome BenOS!\r\n");
    while (1) 
    {
        uart_send(uart_recv());
    }
}
```

这个程序很简单，就是初始化串口并向串口中输出欢迎信息。

## 串口驱动

我们还需要实现一个串口驱动，来驱动串口。

树莓派有两个串口设备：
- PL011 串口，在 BCM2711 芯片手册中简称 UART0，是一种全功能的串口设备。
- Mini 串口，在 BCM2711 芯片手册中简称 UART1。

我们使用 PL011 串口，因为 Mini 串口设备比较简单，不支持流量控制（flow control），在高速传输过程中还有可能丢包。

BCM2711 里有不少片内外设复用相同的 GPIO 接口，这称为 GPIO 可选功能配置（GPIO Alternative Function）。GPIO14 和 GPIO15 可以复用 UART0 和 UART1 串口的 TXD 引脚和 RXD 引脚，如下表所示：

|GPIO|电平|可选项 0|可选项 1|可选项 2|可选项 3|可选项 4|可选项 5|
|-|-|-|-|-|-|-|-|
|GPIO0|高|SDA0|SA5|||||
|GPIO1|高|SCL0|SA4|||||
|GPIO14|低|TXD0|SD6||||TXD1|
|GPIO15|低|RXD0|||||RXD1|

BCM2711 提供了`GFPSELn`寄存器来设置 GPIO 可选功能配置，其中 GPFSEL0 同来配置 GPIO0~GPIO9，而 GPFSEL1 用来配置 GPIO10~GPIO19，以此类推。

其中，每个 GPIO 使用 3 位来表示不同的含义：

- 000: 表示 GPIO 配置为输入。
- 001: 表示 GPIO 配置为输出。
- 100: 表示 GPIO 配置为可选项 0。
- 101: 表示 GPIO 配置为可选项 1。
- 110: 表示 GPIO 配置为可选项 2。
- 111: 表示 GPIO 配置为可选项 3。
- 011: 表示 GPIO 配置为可选项 4。
- 010: 表示 GPIO 配置为可选项 5。

我们首先设置树莓派寄存器的基地址，在`include/asm/base.h`头文件中定义：

```c
#ifndef
#define
_P_BASE_H
#ifdef CONFIG_BOARD_PI3B
#define PBASE 0x3F000000
#else
#define PBASE 0xFE000000
#endif
/*_P_BASE_H */
```

因为考虑到可能有人只有树莓派 3B，所以这里也定义了树莓派 3B 的基地址。

下面是 PL011 串口的初始化代码，是`pl_uart.c`文件中的内容：

```c
void uart_init ( void )
{
unsigned int selector;
selector = readl(GPFSEL1); selector &= ~(7<<12);
/* 为 GPIO14 设置可选项 0*/
selector |= 4<<12;
selector &= ~(7<<15);
/* 为 GPIO15 设置可选项 0 */
selector |= 4<<15;
writel(selector, GPFSEL1);
```

上述代码把 GPIO14 和 GPIO15 设置为可选项 0，也就是用作 PL011 串口的 TXD0 和 RXD0 引脚。

```c
/*设置 gpio14/15 为下拉状态*/
selector = readl(GPIO_PUP_PDN_CNTRL_REG0);
selector |= (0x2 << 30) | (0x2 << 28);
writel(selector, GPIO_PUP_PDN_CNTRL_REG0);
```

通常 GPIO 引脚有 3 种状态——上拉（pull up）、下拉（pull down）以及连接（connect）。其中连接状态指的是既不上拉也不下拉，仅仅连接。上述代码就是把 GPIO14 和 GPIO15 设置为连接状态。

下面的代码用来初始化 PL011 串口：

```c
/* 暂时关闭串口 */
writel(0, U_CR_REG);
/* 设置波特率 */
writel(26, U_IBRD_REG);
writel(3, U_FBRD_REG);
/* 使能 FIFO 设备 */
writel((1<<4) | (3<<5), U_LCRH_REG);
/* 屏蔽中断 */
writel(0, U_IMSC_REG);
/* 使能串口，打开收发功能 */
writel(1 | (1<<8) | (1<<9), U_CR_REG);
```

接下来实现几个函数用来收发字符串：

```c
void uart_send(char c)
{
    while (readl(U_FR_REG) & (1<<5));
    writel(c, U_DATA_REG);
}
char uart_recv(void)
{
    while (readl(U_FR_REG) & (1<<4));
    return(readl(U_DATA_REG) & 0xFF);
}
```

`uart_send`和`uart_recv`分别用于在`while`循环中判断是否有数据需要发送和接收，这里只需要判断`U_FR_REG`寄存器的相应位即可。

代码里的一些函数比如`readl`和`writel`以及一些宏定义都在`include`下的其他头文件中。

## 编译

最后我们写好`Makefile`，内容如下：

```makefile
board ?= rpi3
ARMGNU ?= aarch64-linux-gnu
COPS += -DCONFIG_BOARD_PI4B
QEMU_FLAGS += -machine raspi4
COPS += -g -Wall -nostdlib -nostdinc -Iinclude
ASMOPS = -g -Iinclude
BUILD_DIR = build
SRC_DIR = src

all : benos.bin

clean :
    rm -rf $(BUILD_DIR) *.bin

$(BUILD_DIR)/%_c.o: $(SRC_DIR)/%.c
    mkdir -p $(@D)
    $(ARMGNU)-gcc $(COPS) -MMD -c $< -o $@

$(BUILD_DIR)/%_s.o: $(SRC_DIR)/%.S
    $(ARMGNU)-gcc $(ASMOPS) -MMD -c $< -o $@

C_FILES = $(wildcard $(SRC_DIR)/*.c)
ASM_FILES = $(wildcard $(SRC_DIR)/*.S)
OBJ_FILES = $(C_FILES:$(SRC_DIR)/%.c=$(BUILD_DIR)/%_c.o)
OBJ_FILES += $(ASM_FILES:$(SRC_DIR)/%.S=$(BUILD_DIR)/%_s.o)
DEP_FILES = $(OBJ_FILES:%.o=%.d)
-include $(DEP_FILES)

benos.bin: $(SRC_DIR)/linker.ld $(OBJ_FILES)
    $(ARMGNU)-ld -T $(SRC_DIR)/linker.ld -o $(BUILD_DIR)/benos.elf
    $(ARMGNU)-objcopy $(BUILD_DIR)/benos.elf -O binary benos.bin

QEMU_FLAGS += -nographic

run:
    qemu-system-aarch64 $(QEMU_FLAGS) -kernel benos.bin
debug:
    qemu-system-aarch64 $(QEMU_FLAGS) -kernel benos.bin -S -s
```

COPS 和 ASMOPS 用来指定编译选项：
- `-g`：在编译时加入调试符号表等信息，用于 gdb 调试。
- `-Wall`：显示所有警告信息。
- `-nostdlib`：不使用标准库。
- `-nostdinc`：不使用标准头文件。

因为我们编译的是内核和 bootloader，所以不需要标准库和头文件，添加`-nostdlib`和`-nostdinc`选项使我们能用`-gnu`后缀的编译器来编译我们的程序。

## 总结

本文我们完成了操作系统的第一个裸机程序，并分析了其链接脚本和启动过程。下一篇我们开始深入了解 A64 指令集。