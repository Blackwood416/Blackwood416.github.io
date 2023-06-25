---
title: bspwm配置 01
date: 2023-03-09 14:18:28
tags: bspwm
---

# bspwm配置 01
# 软件安装
废话不多说，首先我们来安装bspwm及本博客中需要用到的其他的软件，在Arch Linux中输入：
```bash
sudo pacman -Syu bspwm sxhkd rofi polybar ranger ueberzug atool ffmpegthumbnailer libcaca poppler xorg-appres xorg-server-devel --noconfirm
```
本命令下载bspwm，sxhkd，rofi，polybar，ranger及其依赖（用于图片、视频预览和压缩包管理）。
还有终端模拟器**st**的安装，这里稍微讲一下，st配置的好用起来会非常舒服，我们这里先来讲一下基础的安装，后面再来讲怎么配置。
首先去[st官网](http://st.suckless.org)，找到Download下面的最新版本的**tar.gz**文件，回到我们的Linux终端中用wget下载并解压：
```bash
cd
wget -c http://dl.suckless.org/st/st-0.9.tar.gz
tar zxf st-0.9.tar.gz
```
可以将解压出来的**st-0.9**文件夹改名，当然也可以不改，差别不大。
然后我们进入文件夹进行编译安装：
```bash
cd st-0.9
sudo make install
```
等待编译安装完成后软件的安装就ok了。

# bspwm具体配置

我们先复制官方的配置到**~/.config**：
```bash
mkdir ~/.config/bspwm
mkdir ~/.config/sxhkd
install -Dm755 /usr/share/doc/bspwm/examples/bspwmrc ~/.config/bspwm/bspwmrc
install -Dm644 /usr/share/doc/bspwm/examples/sxhkdrc ~/.config/sxhkd/sxhkdrc
```

然后我们打开bspwm的配置文件来看看，使用你喜欢用的终端文本编辑器来打开**~/.config/bspwm/bspwmrc**，比如我喜欢用neovim，我就要输入：
```bash
nvim ~/.config/bspwm/bspwmrc
```
打开以后里面是这样的：

