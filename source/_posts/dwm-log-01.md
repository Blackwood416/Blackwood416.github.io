---
title: 窗口管理器dwm配置日志 01
date: 2023-01-19 14:26:18
tags: dwm
---

# dwm是什么

dwm（dynamic window manager）是一个轻量化的平铺式窗口管理器，由纯C编写而成，今天我们就来使用dwm来配置我们的图形界面开发环境。

# 系统环境

这次我们使用基于ARM Arch Linux的termux proot容器，使用tmoe安装的arm64的Arch Linux可以正常地通过 **paru** 来使用aur安装软件。

# 基本环境配置

dwm的配置方式非常特殊，它需要用户自行更改源码中的相关配置，重新编译安装dwm后才能应用这些配置。所以我们需要提前配置dwm的编译环境。

```bash
sudo pacman -Syu xorg-server xorg-apps xorg-xinit xorg-xwayland --noconfirm
```

# 首次编译安装dwm
我们去dwm的[官网](https://dwm.suckless.org)找到最新版的dwm并用 **wget** 下载到系统内，在本文发布时最新版的dwm版本是6.4：

```bash
wget -c http://dl.suckless.org/dwm/dwm-6.4.tar.gz
```

下载完成后我们解压它：
```bash
tar zxf dwm-6.4.tar.gz
```

然后我们跳转到解压出来的目录：
```bash
cd dwm-6.4
```
先不做任何配置，尝试编译并安装dwm：
```bash
make -j8
make install
```
如果中间没有任何有颜色的字那就是安装成功了。

# dwm显示环境

我们使用termux-x11来显示我们的dwm,首先我们去termux-x11的[github界面](https://github.com/termux/termux-x11)，然后点击Action进入仓库的自动构建界面，找到最新的带有 **build** 标签的项目，点进去下载 **Artifact** 中的 **termux-x11.zip**，将其下载到内部存储空间中的 **Download** 目录中。

在termux中，安装xwayland
```bash
pkg i x11-repo -y
pkg i xwayland -y
```
安装完成后：
```bash
termux-setup-storage
```
为termux打开存储空间读取权限后输入：
```bash
unzip ~/storage/shared/Download/termux-x11.zip
rm -f output-metadata.json
mv termux-x11.deb ~
dpkg -i ~/termux-x11.deb
```
最后在termux外，宿主机的安卓系统内，找到内部存储中的Download目录下的 **app-debug.apk** 安装。

接下来我们使用termux-x11来显示dwm：

首先在termux中，输入`tmoe`来打开tmoe菜单，proot容器 > List installed 当前已安装容器列表 > arch_arm64 > 环境变量与登录项管理 > 挂载tmp (共享wayland socket)

在第一个弹出的对话框中选择 **true** ，随后的两个对话框则选择 **false**。

接着我们在安卓系统中启动termux-x11,看到弹出 **Service Created** 的提醒后切回termux使用termux左边侧边栏中的 **NEW SESSION** 来创建一个新的终端，在其中运行`termux-x11 :2`。

使用侧边栏切回之前那个终端，然后启动容器，因为tmoe容器默认设置了DISPLAY环境变量为:2,所以我们直接在容器中运行
```bash
dwm
```
然后切换回termux-x11，这时候我们就能看到dwm的默认界面显示在了termux-x11的界面中了。