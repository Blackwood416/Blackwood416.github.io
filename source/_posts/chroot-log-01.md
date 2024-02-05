---
title: chroot容器研究日志 01
date: 2024-01-30 00:08:19
tags: chroot
categories: 开发环境
---

## 什么是chroot容器？

chroot是Linux发行版中一个用于隔离文件系统的软件，而由于隔离了文件系统，我么只要将系统运行所必要的分区挂载在这个隔离的文件系统中就可以使用chroot创建一个与宿主系统同内核的容器系统了。内核基于Linux的安卓系统当然也是可以使用的，但是需要root。接下来我们就来在已root的安卓设备上安装一个Linux容器吧。

## 前置环境

### Root权限

首先你的安卓手机需要获得root权限，这里就不说了，可以看看我的其他博客。

### 终端模拟器

然后你需要一个终端模拟器来操作root shell，建议使用**termux**。

首次进入termux中，我们先换国内源来提高下载速度：

```bash
termux-change-repo
```

使用上下箭头键来切换选项，使用空格选中选项，回车键确定换源，选tsinghua、ustc、bfsu等大学的源即可。

回车后会自动更新源索引文件，我们再手动更新下自带软件：

```bash
apt upgrade -y
```

然后再跑一次`termux-change-repo`，选**Single Mirror**，将我们之前选的镜像源再选中确定一次。

使用以下命令给termux赋予存储读写权限：

```bash
termux-setup-storage
```

### 必要软件

如果想使用Magisk赋予termux root权限，那么需要使用**tsu**来申请root权限。

> Tips：KernelSU可直接给跳过此步

```bash
pkg install tsu -y
# 或用简写
pkg i tsu -y
```

## 下载rootfs

**rootfs**，顾名思义就是**根文件系统**。众所周知Linux的最顶层目录就是 **/**，也就是**根目录**，而rootfs就是根目录的文件系统，为了让容器能像一个操作系统一样运行，我们需要一个Linux发行版的根目录文件系统来作为容器系统的根目录。

这里我们选择**Arch Linux ARM**系统来作为我们的容器系统，我们在[官网](https://archlinuxarm.org/about/downloads)可以下载到，一般的安卓设备选择名称为**ARMv8 AArch64 Multi-platform**、文件名为	**ArchLinuxARM-aarch64-latest.tar.gz**的rootfs下载即可。

可以在termux里使用**wget**或者**curl**下载，或者用安卓自带浏览器下载，只要你知道下载到哪里就行。

## 解压rootfs

我们首先创建一个用于存放容器文件系统的目录，这里我选择在**/data/linux下**创建一个叫**arch**的目录。

```bash
# 先进入root shell
su
# 创建目录
mkdir -p /data/linux/arch
```

然后我们将下载的rootfs压缩包解压缩到这个目录中：

```bash
tar zxpf ArchLinuxARM-aarch64-latest.tar.gz -C /data/linux/arch/
```

## 编写启动脚本

我们需要挂载一些宿主机的分区到容器系统才能驱动让其成为一个独立运行的容器，所以我们来编辑chroot容器的启动脚本。我们先使用`exit`来退出root shell，然后输入`nano a`来创建并编辑一个名叫**a**的脚本文件，在其中输入以下内容：

```bash
if []
fi
ARCHPATH=/data/linux/arch
TERMUX_PREFIX=/data/data/com.termux/files/usr
if ![ -d /dev/shm ]; then
    mkdir /dev/shm
fi
if ![ -d ARCHPATH/dev/shm ]; then
    mkdir ARCHPATH/dev/shm
fi
mount -o bind -t tmpfs -s 256M /dev/shm ARCHPATH/dev/shm
mount -o bind 
mount -o bind 
chroot ARCHPATH ARCHPATH/bin/su - root
umount -f ARCHPATH/dev/pts
umount -f ARCHPATH/dev
umount -f ARCHPATH/proc
```