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

> Tips：KernelSU可直接给跳过此步，在KernelSU的管理器中给termux root权限即可

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

## 创建/dev/shm

因为我们可能会用chroot容器来运行一些基于chromium内核的软件，比如electron应用以及chromium本体，所以我们需要创建`/dev/shm`这个目录来让这些软件能够正常运行。

```bash
# 在宿主机文件系统中创建
mkdir /dev/shm
# 在容器文件系统中创建
mkdir /data/linux/arch/dev/shm
```

## 编写启动脚本

我们需要挂载一些宿主机的分区到容器系统才能驱动让其成为一个独立运行的容器，所以我们来编辑chroot容器的启动脚本。我们先使用`exit`来退出root shell，然后输入`nano a`来创建并编辑一个名叫**a**的脚本文件，在其中输入以下内容：

```bash
#!/bin/sh
ARCHPATH=/data/linux/arch
TERMUX_PREFIX=/data/data/com.termux/files/usr
mount -o remount,dev,suid /data
mount -t tmpfs -o size=256M /dev/shm $ARCHPATH/dev/shm
mount -o bind /dev $ARCHPATH/dev
mount -t devpts devpts $ARCHPATH/dev/pts
mount -o bind /sys $ARCHPATH/sys
mount -o bind /proc $ARCHPATH/proc
mount -t tmpfs tmpfs $ARCHPATH/tmp
chroot $ARCHPATH /bin/su - root
umount -f $ARCHPATH/dev/pts
umount -f $ARCHPATH/dev
umount -f $ARCHPATH/sys
umount -f $ARCHPATH/proc
```

## 新建用户与配置用户组

作为一个“普通”的Linux用户，我们肯定不能在平常用root用户的，我们进容器后第一件事就是创建一个新的用户：

```bash
useradd -m -s /bin/bash axis
passwd axis
```

axis是我自己定的用户名。

Android只允许在某些用户组里的用户执行某些操作，在chroot容器中也是如此。

使用以下命令添加用户组并将新建的用户加入其中：

```bash
groupadd -g 3001 android_bt
groupadd -g 3002 android_bt-net
groupadd -g 3003 android_inet
groupadd -g 3004 android_net-raw
groupadd -g 1015 sdcard-rw
groupadd -g 1028 sdcard-r
gpasswd -a axis android_bt
gpasswd -a axis android_bt-net
gpasswd -a axis android_inet
gpasswd -a axis android_net-raw
gpasswd -a axis sdcard-rw
gpasswd -a axis sdcard-r
```

大功告成之后我们不急着换用户，先用着root，可以少打点sudo。

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

将`/etc/pacman.d/`下的`mirrorlist`改名为`mirrorlist.bak`来备份下原本的软件源。

```bash
mv /etc/pacman.d/mirrorlist /etc/pacman.d/mirrorlist.bak
```

重新创建并编辑`/etc/pacman.d/mirrorlist`

```bash
nano /etc/pacman.d/mirrorlist
```

在其中加入以下几行从tmoe脚本那抄过来的软件源：

```txt
## Archlinux arm
Server = https://mirrors.ustc.edu.cn/archlinuxarm/$arch/$repo
Server = https://mirror.archlinuxarm.org/$arch/$repo
Server = https://mirrors.bfsu.edu.cn/archlinuxarm/$arch/$repo
Server = https://mirrors.tuna.tsinghua.edu.cn/archlinuxarm/$arch/$repo
Server = https://mirrors.163.com/archlinuxarm/$arch/$repo
```

编辑完保存后我们使用`pacman -Syu`来更新一下。
 
我们还可以添加一些额外的软件源，比如archlinuxcn、arch4edu、blackarch，我们编辑`/etc/pacman.conf`：

```bash
nano /etc/pacman.conf
```

在文件末尾加入以下文本：

```txt
[arch4edu]
Server = https://mirrors.bfsu.edu.cn/arch4edu/$arch
Server = https://mirrors.tuna.tsinghua.edu.cn/arch4edu/$arch
Server = https://mirror.autisten.club/arch4edu/$arch
Server = https://arch4edu.keybase.pub/$arch
Server = https://mirror.lesviallon.fr/arch4edu/$arch
Server = https://mirrors.tencent.com/arch4edu/$arch
SigLevel = Never
[archlinuxcn]
Server = https://mirrors.bfsu.edu.cn/archlinuxcn/$arch
Server = https://mirrors.tuna.tsinghua.edu.cn/archlinuxcn/$arch
Server = https://repo.archlinuxcn.org/$arch
SigLevel = Never
[blackarch]
Server = https://mirrors.ustc.edu.cn/blackarch/$repo/os/$arch
Server = https://mirrors.tuna.tsinghua.edu.cn/blackarch/$repo/os/$arch
Server = https://mirrors.aliyun.com/blackarch/$repo/os/$arch
Server = https://www.blackarch.org/blackarch/$repo/os/$arch
SigLevel = Never
```

## 配置语言

容器的默认语言是英文，如果需要将其改成中文，我们需要手动生成语言包并将系统语言配置成中文。

编辑`/etc/locale.gen`，找到`zh_CN.UTF-8`，将这俩行取消注释。

在shell中输入：

```bash
sudo locale-gen
```

等待生成完毕，我们编辑`/etc/locale.conf`，将其中的`LANG=C`替换成`LANG=zh_CN.UTF-8`，之后重启容器即可。

## 配置时区

如果你在容器里使用date命令你会发现你的容器内时间是不对的，是标准的零时区时间，为了同步我们自己的时间，我们需要把时区文件软链接到`/etc/localtime`来改变容器的系统时区。

时区文件在`/usr/share/zoneinfo/`下，我们需要在下面找到符合我们时区的城市。北京时间的设置如下：

```bash
ln -svf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime
```

之后重启容器即可。

## 安装图形界面

我们装个xfce来当图形界面，因为只装WM真的太折磨人了，你连壁纸软件都得另外装，可能还不如装xfce这种轻量化的DE。使用以下命令在Arch中安装xfce桌面：

```bash
sudo pacman -Syu xfce4 xfce4-goodies
```

## 精简系统

对于一个不需要引导和加载的容器系统来说，/boot分区里的东西直接删了都没关系，另外，我们也不需要更新ramdisk，所以我们直接卸载mkinitcpio和删除/boot分区下的内容。

```bash
sudo pacman -Rsc mkinitcpio
sudo rm -rf /boot/*
```

这么整可以省出几百MB的存储空间，还是很香的。

## 使用termux-x11显示图形界面

将启动脚本中的`mount -t tmpfs tmpfs $ARCHPATH/tmp`改为`mount -o bind $TERMUX_PREFIX/tmp $ARCHPATH/tmp`。

然后我建议启动容器时将selinux设置成宽容模式，并将/tmp取消挂载，这样不会产生一些莫名其妙的bug，然后为了少打个su来启动root终端，因为我换到了kernelsu，不用tsu了，所以直接用`su -c ""`来用root权限运行命令。最终的容器启动脚本如下：

```bash
#!/bin/sh
ARCHPATH=/data/linux/arch
TERMUX_PREFIX=/data/data/com.termux/files/usr
# KernelSU 可注释下行
su -c "setenforce permissive"
su -c "mount -o remount,dev,suid /data"
su -c "mount -t tmpfs -o size=256M /dev/shm $ARCHPATH/dev/shm"
su -c "mount -o bind /dev $ARCHPATH/dev"
su -c "mount -t devpts devpts $ARCHPATH/dev/pts"
su -c "mount -o bind /sys $ARCHPATH/sys"
su -c "mount -o bind /proc $ARCHPATH/proc"
su -c "mount -o bind $TERMUX_PREFIX/tmp $ARCHPATH/tmp"
pkill -f "/system/bin/app_process / com.termux.x11.Loader :0 -ac"
nohup termux-x11 :0 -ac >/dev/null 2>&1 &
su -c "chroot $ARCHPATH /bin/su - axis"
su -c "umount -f $ARCHPATH/dev/pts"
su -c "umount -f $ARCHPATH/dev"
su -c "umount -f $ARCHPATH/sys"
su -c "umount -f $ARCHPATH/proc"
su -c "umount -f $ARCHPATH/tmp"
# KernelSU 可注释下行
su -c "setenforce enforcing"
```

记得在容器内的`/etc/profile`的末尾添加此行来让挂载的tmp目录在容器内可读写：

```bash
sudo chmod -R 777 /tmp
```
