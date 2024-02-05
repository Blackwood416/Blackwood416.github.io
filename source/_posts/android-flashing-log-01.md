---
title: 安卓刷机学习日志 01
date: 2024-01-23 20:28:58
tags: 安卓
categories: 开发
---

## 安卓刷机的意义

一般来说，国内安卓手机厂商的ROM都带有不少的限制，比如杀不掉的后台进程和服务啦、烦人的系统推送啦、恶心人的云控啦等等。而第三方的基于国内ROM的修改版ROM或者类原生ROM都没有这些毛病，并且提供很多个性化的设置（虽然不一定比官方ROM好）。

## 前置工作

### 一台可以解锁BootLoader的手机

我使用的是一台内存配置为8+128GB的**Redmi Note12R**，CPU是**骁龙4gen2**，在低端机里算是很能打的了，但是小米官方对它预装的MIUI14进行了阉割，就算root了换了民间大神的系统桌面还用模块伪装成了高端机型，系统界面（控制中心）的背景依然是一个灰色的遮罩，非常的丑。

### 解锁BootLoader

> 重要提醒：解锁Bootloader会丢失手机的所有数据，请提前做好备份！！！

我们在**设置**中的**关于手机**界面点击全部参数，然后连续点击**MIUI版本**这一栏**7**次打开**开发者选项**，然后在设置中找到开发者选项，找到选项**查看设备解锁状态**，然后按文字提示操作申请解锁BootLoader即可。

等待7天后我们在Windows电脑上下载安装**小米解锁助手**，登录小米账号后选择解锁手机。手机关机后**长按音量下键 + 关机键**进入**Fastboot**模式，手机屏幕此时会显示橙色的**FASTBOOT**字样，这时将手机使用数据线连接到电脑的USB接口上，当电脑屏幕上显示找到设备后我们点击解锁设备即可开始解锁，等待一段时间等进度条满了显示解锁成功即表示本设备已成功解锁BootLoader。

### 开启OEM解锁

在**开发者选项**中找到**OEM解锁**，启用后重启手机。

### 找一个合适的ROM

MIUI有很多第三方的官改ROM，但官改系统大部分不支持低端机，而且官改系统不是开源系统，无法保证里面是否藏有锁机或格机的程序。

鉴于以上原因，我最终将目光转向了开源的类原生ROM。遗憾的是大名鼎鼎的**LineageOS**并不支持我的这部Redmi Note12R及其衍生机型。所以在多方查找后，我选择了一个冷门但有官方支持的类原生ROM——**Bliss ROM**。

这台Redmi Note12R可以刷入基于 **Android 14** 的 **Bliss ROM 17**，而且还带gapps。在[这里](https://sourceforge.net/projects/blissroms/files/Universe/sky/)可以下载到。

### TWRP

**TWRP**是一个开源的第三方Recovery程序，我们需要使用第三方Recovery才能刷入非官方的ROM，否则会无法进入系统。红米Note12R暂时没有官方的TWRP，但是可以通用[红米Note12 5G的TWRP](https://www.pling.com/p/2117793/)，不过目前该版本的TWRP有些bug我们后面再说。

## 开始刷机

### 准备文件与工具

在[这里](https://developer.android.google.cn/tools/releases/platform-tools?hl=zh-cn#downloads)下载Android platform-tools，解压后里面有我们刷机需要的**adb**和**fastboot**（这个也可以用miui解锁助手文件夹里的）

为了减少低级错误发生的可能性，我们先把要刷的ROM卡刷包和TWRP放在platform-tools的文件夹下面。

### 退出小米账号

在开始刷机前我们先退出小米账号以防一些莫名其妙的问题。

### 进入Fastboot

我们将手机关机，**长按音量下键+关机键**进入橙色的**FASTBOOT**模式。

### 刷入TWRP Recovery

我们先在Windows CMD或PowerShell中切换到platform-tools的目录，这里假设我们把它解压到了D盘的根目录下（实际情况要看你自己解压到哪里），那么我们应该输入：

```bat
cd D:\platform-tools
```

我们在开发者选项中打开**USB调试**选项，然后我们将手机用数据线连接电脑的USB接口。

在命令窗口输入命令将手机重启到bootloader：

```bat
.\adb.exe reboot bootloader
```

接着我们输入以下命令来查看设备是否有成功被识别：

```bat
.\fastboot.exe devices
```

如果显示出一个表，前面一列的是乱码后面一列显示device则表示电脑连接成功。

这时我们输入：

```bat
.\fastboot.exe boot twrp.img
```

> 注：其中twrp.img请根据实际文件名，善用鼠标和tab补全

这会使我们的手机黑屏重启，这时**立刻按住音量上键+关机键**，**直到手机发出震动时松开关机键保持按住音量上键直到TWRP的画面出现为止**。

这时我们会成功进入到TWRP的界面。

右侧有个language选项里面可以选择简体中文。

我们输入手机锁屏密码进入TWRP。

### 刷入ROM卡刷包

在这一步我们需要用到一个叫作**adb sideload**的功能。

在TWRP的左下角，有个叫**Advanced（中文为“高级”）**的选项。我们点进去，里面有我们要找的adb sideload。

我们点击adb sideload，上面有两个选项，我们先勾一下，然后滑动下方的拖动条启动adb sideload。

看到`Starting adb sideload feature`或`启动adb sideload中`就表示adb sideload已经启动了。

这时我们回到电脑这边来，在命令行输入：

```bat
.\adb sideload rom.img
```

> 其中rom.img是ROM卡刷包的名称，善用鼠标和tab补全

等待刷入完成后手机上的日志会有几个报红，这是正常现象，下方会显示个按钮叫我们Reboot或者重启，点击那个按钮重启就可以了。

### 清除数据

可能会在重启一半时跳到MIUI Recovery界面，这时我们选择清除数据，清除完后重启，即可进入刷入的第三方ROM。

### 刷机完成

如果你看到了第三方ROM的开机动画，这时就代表你已经刷机成功了！

## Bliss，启动！

因为Bliss的这个包是自带gapps的，所以我们第一次进的时候不要连wifi，不然可能会因为没有魔法而卡在谷歌认证。建议进系统后自行安装梯子软件。经过一些简单的设置我们就可以进入系统了。

至此我们已经完成了Bliss ROM在红米Note12R上的刷入。