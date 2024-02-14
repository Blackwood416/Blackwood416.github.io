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
#!/bin/sh
ARCHPATH=/data/linux/arch
TERMUX_PREFIX=/data/data/com.termux/files/usr
if ![ -d /dev/shm ]; then
    mkdir -p /dev/shm
fi
if ![ -d $ARCHPATH/dev/shm ]; then
    mkdir -p $ARCHPATH/dev/shm
fi
mount -o remount,dev,suid /data
mount -t tmpfs -o size=256M /dev/shm $ARCHPATH/dev/shm
mount -o bind /dev $ARCHPATH/dev
mount -t devpts devpts $ARCHPATH/dev/pts
mount -o bind /sys $ARCHPATH/sys
mount -o bind /proc $ARCHPATH/proc
mount -t tmpfs tmpfs $ARCHPATH/tmp
chroot $ARCHPATH /bin/su - root
umount -f $ARCHPATH/dev/shm
umount -f $ARCHPATH/dev/pts
umount -f $ARCHPATH/dev
umount -f $ARCHPATH/sys
umount -f $ARCHPATH/proc
```

## 配置用户组

Android只允许在某些用户组里的用户执行某些操作，在chroot容器中也是如此。



## 更新系统软件

在使用pacman更新系统软件之前，我们先导入公钥。

```bash
pacman-key --init
pacman-key --populate
```

导入完成后就可以愉快的更新了：

```bash
# 在更新前可以编辑 /etc/pacman.conf 将 ParallelDownloads = 5 取消注释以提高下载速度
pacman -Syu
```

> Tips：如遇到error: could not determine cachedir mount point /var/cache/pacman/pkg 的情况，需要编辑 /etc/pacman.confg，将其中的CheckSpace注释起来。

## 配置软件源

ArchLinuxARM默认的软件源在国外，对大陆用户不太友好，这时我们可以替换为大陆的镜像源来提高pacman的下载速度。

编辑`/etc/pacman.d/mirrorlist`，将以下几行添加到

## 配置语言

容器的默认语言是英文，如果需要将其改成中文，我们需要手动生成语言包并将系统语言配置成中文。

编辑`/etc/locale.gen`，找到`en_US.UTF-8`和`zh_CN.UTF-8`，将这俩行取消注释。

在shell中输入：

```bash
sudo locale-gen
```

等待生成完毕，我们编辑`/etc/locale.conf`，将其中的`LANG=C`替换成`LANG=zh_CN.UTF-8`，之后重启容器即可。

## 配置时区

如果你在容器里使用date命令你会发现你的容器内时间是不对的，是标准的零时区时间，为了同步我们自己的时间，我们需要把时区文件软链接到`/etc/localtime`来改变容器的系统时区。

时区文件在`/usr/share/zoneinfo/`下，我们需要在下面找到符合我们时区的城市

## 使用termux-x11显示图形界面

将启动脚本中的`mount -t tmpfs tmpfs $ARCHPATH/tmp`改为`mount -o bind $TERMUX_PREFIX/tmp $ARCHPATH/tmp`。

然后我建议启动容器时将selinux设置成宽容模式，并将/tmp取消挂载，这样不会产生一些莫名其妙的bug。最终的容器启动脚本如下：

```bash
#!/bin/sh
ARCHPATH=/data/linux/arch
TERMUX_PREFIX=/data/data/com.termux/files/usr
if ![ -d /dev/shm ]; then
    mkdir -p /dev/shm
fi
if ![ -d $ARCHPATH/dev/shm ]; then
    mkdir -p $ARCHPATH/dev/shm
fi
mount -o remount,dev,suid /data
mount -t tmpfs -o size=256M /dev/shm $ARCHPATH/dev/shm
mount -o bind /dev $ARCHPATH/dev
mount -t devpts devpts $ARCHPATH/dev/pts
mount -o bind /sys $ARCHPATH/sys
mount -o bind /proc $ARCHPATH/proc
mount -o bind $TERMUX_PREFIX/tmp $ARCHPATH/tmp
setenforce 0
chroot $ARCHPATH /bin/su - root
umount -f $ARCHPATH/dev/shm
umount -f $ARCHPATH/dev/pts
umount -f $ARCHPATH/dev
umount -f $ARCHPATH/sys
umount -f $ARCHPATH/proc
umount -f $ARCHPATH/tmp
setenforce 1
```

并在容器内的/etc/profile的末尾添加此行来让挂在的tmp目录在容器内可读写：

```bash
sudo chmod -R 777 /tmp
```
