---
title: 操作系统开发日志 01
date: 2023-01-04 23:41:19
tags: 操作系统
---

# 操作系统开发日志 01
## 参考田宇的《一个64位操作系统的设计与实现》和《一个UEFI引导程序的实现》

本日志主要记录本人参照《一个64位操作系统的设计与实现》和《一个UEFI引导程序的实现》制作一个基于x64架构的现代操作系统的过程。

使用NASM汇编语言与gcc的c语言内联汇编功能来为需要用到汇编的功能提供支持。其他代码使用c语言来编写。

# 开发环境搭建

本人在安卓手机上的proot容器内开发这个系统。使用termux + tmoe-linux 安装 kali rolling proot容器。

安装完成后先使用tmoe-linux脚本配置xfce桌面环境与vnc环境，接着删除 **~/.config** 目录下的xfce默认配置文件，然后使用apt包管理器安装kali官方封装的xfce桌面：

```bash
sudo apt install kali-desktop-xfce
```

使用apt安装编译工具链和汇编器等软件包
```bash
sudo apt install build-essential crossbuild-essential-amd64 nasm gnome-devel wx3.2 wx-common libwxgtk3.2-dev libgtk2.0-dev xorg-dev libtool-bin libreadline-dev
```

因为内核开发时要用到bochs,所以我们去bochs官网下载bochs最新版本的tarball源码包，在撰写本文时bochs的最新版本为2.7,所以我们接下来将编译2.7版本的bochs。

先去bochs官网找到源码链接为 https://udomain.dl.sourceforge.net/project/bochs/bochs/2.7/bochs-2.7.tar.gz

终端中使用wget下载它：
```bash
wget -c https://udomain.dl.sourceforge.net/project/bochs/bochs/2.7/bochs-2.7.tar.gz
```
加上 **-c** 参数以让下载进程支持断点续传防止下载途中从sourceforge站点掉线。

下载完之后解压tarball源码包：
```bash
tar zxf bochs-2.7.tar.gz
```
解压完成后我们进入源码目录准备编译：
```bash
cd bochs-2.7.tar.gz
```
使用目录下的 **configure** 脚本配置 **Makefile** ：
```bash
./configure --with-x11 --with-wx --enable-debugger --enable-all-optimizations --enable-readline --enable-long-phy-address --enable-ltdl-install --enable-idle-hack --enable-plugins --enable-a20-pin --enable-x86-64 --enable-smp --enable-cpu-level=6 --enable-large-ramfile --enable-repeat-speedups --enable-fast-function-calls --enable-handlers-chaining --enable-trace-linking --enable-configurable-msrs --enable-show-ips --enable-debugger-gui --enable-iodebug --enable-logging --enable-assert-checks --enable-fpu --enable-vmx=2 --enable-svm --enable-3dnow --enable-alignment-check --enable-monitor-mwait --enable-avx --enable-evex --enable-x86-debugger --enable-pci --enable-usb --enable-voodoo
```
然后使用 **make** 进行编译：
```bash
make -j4
```
上面我们使用手机的4个cpu核心进行编译工作，要是写成 **make -j8** 也就是调用手机的全部8个核心可能会导致编译进程占用过高将手机卡死的情况。
编译完成后我们安装bochs：
```bash
sudo make install
```
至此完成操作系统编译环境的搭建。