---
title: 操作系统学习日志 02
date: 2024-11-16 14:42:11
tags: OS
categories: 开发
---

## 获取 BenOS

我们可以在 github 上找到 BenOS 的源码，[地址](https://github.com/runninglinuxkernel/arm64_programming_practice)

我们使用 git clone 命令下载到本地：

```
git clone https://github.com/runninglinuxkernel/arm64_programming_practice.git
```

## 编译 BenOS

我们需要安装编译工具链：

```bash
sudo apt install qemu-system-arm libncurses5-dev gcc-aarch64-linux-gnu build-essential git bison flex libssl-dev
```

我们进入到`chapter02/lab01_hello_benos/BenOS`目录下，执行如下命令编译：

```bash
make
```

然后目录下就会生成`benos.bin`可执行文件以及`benos.elf`文件，如果你的 qemu 支持树莓派 4，可直接使用`make run`命令来调用 qemu 虚拟机来模拟树莓派运行：

```bash
make run
#较新的 qemu 支持树莓派 4B： qemu-system-aarch64 -machine raspi4b -nographic -kernel benos.bin
Welcome BenOS!
```

## GDB 调试

我们可以使用 GDB 调试器来调试 BenOS，首先安装 gdb：

```bash
sudo apt install gdb-multiarch
```

然后我们需要设置 qemu 的串口以及进入调试模式：

```bash
qemu-system-arm -machine raspi4b -serial null -serial mon:stdio -nographic -kernel benos.bin -S -s
# 要退出 qemu，按下 Ctrl-A X 即可。
```

接着我们在另一个终端执行 gdb 命令：

```bash
gdb-multiarch --tui build/benos.elf
```

![图 0](https://s2.loli.net/2024/11/22/C2YMnSbBdZNmAya.png)  

进入这个界面后回车，然后依次输入三个命令：

```gdb
target remote localhost:1234
b _start
c
```

结果如下图：

![图 1](https://s2.loli.net/2024/11/22/DCk16HrwtGXYizl.png)  

然后我们在 gdb 里输入`s`命令来单步执行，可以看到程序的执行流程：

![图 2](https://s2.loli.net/2024/11/22/OMXEgWe1Hbq8xYP.png)  

## 总结

本文介绍了如何获取 BenOS，编译，以及使用 GDB 调试器来调试 BenOS，下一篇我们来解构 BenOS 的源码。