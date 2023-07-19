---
title: bspwm配置 01
date: 2023-03-09 14:18:28
tags: bspwm
---

# bspwm配置 01
# 软件安装
废话不多说，首先我们来安装bspwm及本博客中需要用到的其他的软件，在Arch Linux中输入：
```bash
sudo pacman -Syu bspwm sxhkd rofi picom polybar ranger ueberzug atool ffmpegthumbnailer libcaca poppler xorg-appres xorg-server-devel --noconfirm
```
本命令下载bspwm，sxhkd，rofi，picom，polybar，ranger及其依赖（用于图片、视频预览和压缩包管理）。
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
```bash
#! /bin/sh

pgrep -x sxhkd > /dev/null || sxhkd &

bspc monitor -d I II III IV V VI VII VIII IX X

bspc config border_width         2
bspc config window_gap          12

bspc config split_ratio          0.52
bspc config borderless_monocle   true
bspc config gapless_monocle      true

bspc rule -a Gimp desktop='^8' state=floating follow=on
bspc rule -a Chromium desktop='^2'
bspc rule -a mplayer2 state=floating
bspc rule -a Kupfer.py focus=on
bspc rule -a Screenkey manage=off
```

可以看出这其实就是个shell脚本，我们先来逐行看看它们都是干什么用的。

> `#! /bin/sh`
> 这行是shell的执行程序的指定，没啥好说的。

> `pgrep -x sxhkd > /dev/null || sxhkd &`
> 这行就是启动sxhkd守护进程来开启我们bspwm的快捷键处理。

> `bspc monitor -d I II III IV V VI VII VIII IX X`
> 这行是bspwm出的工作区设置，或者说desktop（桌面）的设置，默认是给了10个桌面，桌面的名字就是这行里的I II这些。

> `bspc config border_width         2`
> 这行是bspwm的全局设置，设置bspwm窗口的边框的宽度，默认为2，可以根据自己的需求更改。

> `bspc config window_gap          12`
> 这行是设置bspwm窗口间的间距，默认为12，根据需求更改。

> `bspc config split_ratio          0.52`
> 这行是设置bspwm平铺窗口拆分桌面的比例，比如两个平铺窗口在一个桌面里，那么它们会把桌面按左边窗口52%，右边窗口占48%的比例分割开来。

> `bspc config borderless_monocle   true`
> 这行是设置当进入monocle模式时是否显示窗口边框。

> `bspc config gapless_monocle      true`
> 这行是设置当进入monocle模式时窗口与屏幕边界是否有间距。

> `bspc rule -a Gimp desktop='^8' state=floating follow=on`
> `bspc rule -a Chromium desktop='^2'`
> `bspc rule -a mplayer2 state=floating`
> `bspc rule -a Kupfer.py focus=on`
> `bspc rule -a Screenkey manage=off`
> 这几行是设置特定软件的窗口规则，这方面我也不太懂。

因为这个bspwmrc是一个shell脚本，所以我们可以在里面添加一些常规的命令，比如我们要是安装了picom可以在这个文件的末尾加一行`picom -b`，这样在启动bspwm的时候就会启动picom了。
