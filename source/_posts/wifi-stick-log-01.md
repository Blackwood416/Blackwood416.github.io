---
title: 帝旭 UZ801 刷机教程
date: 2024-10-19 00:42:45
tags: 随身WiFi
categories: 随身WiFi
---

## 工具准备

- 一根帝旭 UZ801 随身 WiFi
- 一根 USB 延长线（用来连接电脑）
- 尖头的镊子（用来短接主板触电）（可选）
- 小型十字螺丝刀（用来拧螺丝）

## 软件工具

我不喜欢使用别人封装的某某工具箱，所以我使用 QPT（Qualcomm Premium Tool）这种比较纯粹轻量的工具。

网上就能下载到，不过还需要 key 来激活（激活是记得把电脑调到静音，你会感谢我的）。

## 进入 9008 模式

首先，我们需要进入 9008 模式。

进入 9008 模式有两种方式：

1. 通过后台页面访问对应链接进入 adb，通过 adb 命令进入 9008 模式。
2. 通过短接主板触点进入 9008 模式。

> Tips: 判断棒子进没进入 9008 模式，最显著的特征就是棒子上的 LED 灯，有通电但是不亮的就是正在 9008 模式，反之有灯亮起（不论什么颜色）都代表棒子没有进入 9008。

### 通过 ADB 进入 9008 模式

连接棒子发出的 wifi，在浏览器访问`http://192.168.100.1`，在以下界面输入账号密码，默认账号密码都是`admin`。

![图 2](https://s2.loli.net/2024/11/28/oPuXkxGQMJdgEIB.png)  

看到如下界面证明棒子运行正常。

![图 3](https://s2.loli.net/2024/11/28/FvqsHe5ugMXK8yL.png)  

然后我们访问`http://192.168.100.1/usbdebug.html`，这个链接的界面是空白的，但是访问后棒子会自动重启并开启`adb`。

如果我们在电脑上安装了`adb`，我们就可以通过`adb devices`命令查看设备是否连接成功。

![图 4](https://s2.loli.net/2024/11/28/b7ZvHx2zE9ld3nm.png)  

如果能识别到设备，那么我们可以使用命令`adb reboot edl`来进入 9008 模式。

![图 5](https://s2.loli.net/2024/11/28/NvKJOxYlW4k38Pb.png)  

### 通过短接触点进入 9008 模式

首先，我们需要将棒子拆开，拧开螺丝，取出主板。

然后，我们找到主板上的这两个触点，使用尖头的镊子短接这两个触点，并连接电脑。

![图 6](https://s2.loli.net/2024/11/28/Rl7oZznSxEKP4r5.png)  

## 备份

### 切换 SIM 卡（可选）

在刷机之前，我们需要通过棒子的后台界面将棒子的 SIM 卡切换到卡槽，不然刷完机，是无法使用我们自己的卡来上网的（因为 UZ801 无法在 OpenWrt/Debian 中切卡）。

访问后台`http://192.168.100.1`，点击`高级设置`，在`SIM 卡信息`里，在`SIM 卡选择`里从`ESIM`换到`SIM`，切卡密码是`admin8888`。

![图 7](https://s2.loli.net/2024/11/28/SPp93Xg1wNdZvhe.png)  

![图 8](https://s2.loli.net/2024/11/28/TULh2YXma5VJWy7.png)  

![图 9](https://s2.loli.net/2024/11/28/cZNxvofnQP9q7OH.png)  

### QPT 的备份

在刷入系统之前，建议备份好原有的数据。QPT 的备份分三种：Block0、Partition、Firmware，我们需要用到前两种。

- Block0：会备份 emmc 中的所有数据，建议首先备份，只会导出一个`.bin` 文件。

- Partition：可以以分区的形式备份所有的分区，每个分区都会导出一个`.img` 或`.bin` 文件。

- Firmware：用于备份系统的固件，但是 QPT 的 Firmware 备份有点问题，会报 Error，有些备份出来的文件也是空文件。

> Tips：每次进入 9008 模式，只能进行一次 scan（扫描）或者 read（读取）操作，所以我们需要进入 9008 模式两次才能完成 Block0 和 Partition 备份。

### Block0 备份

我们一定要首先进行 Block0 备份，否则一旦刷机过程出错，我们就无法恢复到最开始的状态以便重新开始了。

进入 9008 模式，打开 QPT，选择`Block0`选项卡，点击`Read( 9008 )`，。

![图 1](https://s2.loli.net/2024/11/28/WTFuphcUsVY2Jdm.png)  

### Partition 备份

进入 9008 模式，打开 QPT，选择`partition`选项卡，选择`scan`后点击红色的`DoJob`，待读取出全部分区后，选择第一项`modem`分区，选择`backup`，`DoJob`，然后选择备份文件夹，等待备份完成。

![图 11](https://s2.loli.net/2024/12/02/IHvJkqVPTA6WUD4.png)  

![图 12](https://s2.loli.net/2024/12/02/B9FWblGj3rn6Aai.png)  



## 刷机

我们首先需要下载对应板号的系统，你要刷 OP 就找 OP 的系统，要刷 Debian 就找 Debian 的系统，这里我以刷入 Debian 为例。

### 下载系统

#### OpenWrt

这里以苏苏小亮亮的 OpenWrt 为例，访问 [这里](https://www.kancloud.cn/a813630449/ufi_car/2792820) 找到下载地址。

#### Debian

这里推荐下载 js 佬的超频版 Debian，可以充分发挥出棒子的性能，而且系统里没有什么乱七八糟的东西。可以在 [这篇帖子](https://www.coolapk.com/feed/41664623?shareKey=NzQzOTdlZjRlMzk2Njc0ODIyMjA~&shareUid=31652160&shareFrom=com.coolapk.market_14.6.0) 里找到下载地址。

### 刷入系统

#### 进入 fastboot 的两种方式

1. 使用`adb reboot bootloader`命令进入 fastboot 模式，跟 adb 一样，我们也可以通过`fastboot devices`来查看设备是否进入了 fastboot 模式。
2. 在 9008 模式时用 QPT 格式化`boot`分区，重启后系统会因为找不到`boot`分区而自动进入 fastboot 模式。

#### OpenWrt

苏苏小亮亮包里的`flash.bat`写的有些问题，以下是我修改后的版本：

```bat
@echo off
echo OpenStick Bootloader
echo please make sure your device in fastboot mode
pause
fastboot erase boot
fastboot flash aboot aboot.bin
fastboot reboot
echo when detected a fastboot device
pause
fastboot oem dump fsc && fastboot get_staged fsc.bin
fastboot oem dump fsg && fastboot get_staged fsg.bin
fastboot oem dump modemst1 && fastboot get_staged modemst1.bin
fastboot oem dump modemst2 && fastboot get_staged modemst2.bin
fastboot erase boot
fastboot reboot bootloader
echo when detected a fastboot device
pause
fastboot flash partition gpt_both0.bin
fastboot flash hyp hyp.mbn
fastboot flash rpm rpm.mbn
fastboot flash sbl1 sbl1.mbn
fastboot flash tz tz.mbn
fastboot flash fsc fsc.bin
fastboot flash fsg fsg.bin
fastboot flash modemst1 modemst1.bin
fastboot flash modemst2 modemst2.bin
fastboot flash aboot aboot.bin
fastboot flash cdt sbc_1.0_8016.bin
fastboot erase boot
fastboot erase rootfs
fastboot reboot
echo flashing OpenWrt!
echo when detected a fastboot device
pause
fastboot flash boot boot.img
fastboot -S 200m flash rootfs rootfs.img
fastboot reboot
echo all done!!
pause
```

你可以把`flash.bat`改成我上面这样，然后运行刷入即可。

#### Debian

没啥好说的，运行`一键刷入工具。bat`，然后通过输入数字来选择对应的超频频率就可以了，`释放内存`版是阉割了 SIM 卡上网能力，所以如果你要用 SIM 卡槽的功能就不要刷`释放内存`版。

## 连接系统

### Windows设备驱动

我们需要确保我们连接到棒子是用到`Microsoft`的`远程NDIS兼容设备`这个驱动，否则我们无法让棒子以NDIS模式连接到 Windows。

使用`Win + X M`快捷键打开设备管理器，如果你的设备管理器在刷完OpenWrt/Debian后出现了如下的设备，那么你需要调整该设备的驱动。

![图 13](https://s2.loli.net/2024/12/02/peQOt1Kdk6sIVAW.png)  

我们右键卸载设备并删除它的驱动程序。

![图 14](https://s2.loli.net/2024/12/02/UOlYRbrKHxJ357z.png)  

拔插一下棒子（重启），然后你会在设备管理器看到这样一个设备或者未知设备。

![图 15](https://s2.loli.net/2024/12/02/qN8E7SLRrn1aPzy.png)  

我们右键更新它的驱动，点击下面的`浏览我的电脑以查找驱动程序`。

![图 16](https://s2.loli.net/2024/12/02/MuXqC3hTwpBmVeA.png)  


然后点击`让我从计算机上的可用驱动程序列表中选取`，然后点击下一步。

![图 17](https://s2.loli.net/2024/12/02/wMemCDLNK5kgGyI.png)  

下滑找到`网络适配器`，然后点击下一步。

![图 18](https://s2.loli.net/2024/12/02/TZJ9lAPrt2kwM5y.png)  

找到`厂商`为`Microsoft`的驱动，在右边的列表里找到`远程NDIS兼容设备`，然后点击下一步。

![图 19](https://s2.loli.net/2024/12/02/7s6dqXBeCjuYvPO.png)  

这个弹窗选择`是`，然后驱动就换好了。

![图 20](https://s2.loli.net/2024/12/02/IbqtECfPO6o8pxz.png)  

这时在设备管理器的`网络适配器`栏目下应该能找到设备名为`远程NDIS兼容设备`的设备，这个就是我们的棒子。

![图 21](https://s2.loli.net/2024/12/02/TSDOGhbXRQUrz1p.png)  


### OpenWrt

OpenWrt作为路由器系统是有Web后台的，完成驱动安装后，浏览器访问`http://192.168.1.1`，登录`root`用户，默认没有密码。

![图 22](https://s2.loli.net/2024/12/02/WeMky1EJOqup4nw.png)  


### Debian

Debian 没有 Web 后台，需要使用 ssh 连接，`root`的默认密码是`1313144`。

我个人现在使用`WindTerm`来连接 ssh，你也可以使用`Putty`、`MobaXterm`等工具，如果你喜欢纯命令行操作那么直接用`Windows 可选功能`里安装的`OpenSSH 客户端`也可以。

## 配置系统

### OpenWrt 更新

更新系统，截至2024年12月2日，这个OpenWrt版本无法直接用`opkg update`更新软件源。

我们在终端里`vi /etc/opkg/distfeeds.conf`，会显示以下内容：

![图 24](https://s2.loli.net/2024/12/02/42PsoBXrlOihv31.png)  

将里面的链接换成可以用的链接。

```
src/gz handsomemod_core https://downloads.immortalwrt.org/releases/23.05.4/targets/armsr/armv8/packages
src/gz handsomemod_base https://downloads.immortalwrt.org/releases/23.05.4/packages/aarch64_cortex-a53/base
src/gz handsomemod_luci https://downloads.immortalwrt.org/releases/23.05.4/packages/aarch64_cortex-a53/luci
src/gz handsomemod_packages https://downloads.immortalwrt.org/releases/23.05.4/packages/aarch64_cortex-a53/packages
src/gz handsomemod_routing https://downloads.immortalwrt.org/releases/23.05.4/packages/aarch64_cortex-a53/routing
src/gz handsomemod_telephony https://downloads.immortalwrt.org/releases/23.05.4/packages/aarch64_cortex-a53/telephony
```

现在就可以正常更新了。

### 修复基带固件

无论是刷 OpenWrt 还是 Debian，都需要修复基带固件，否则无法正常使用 SIM 卡的网络。

![图 23](https://s2.loli.net/2024/12/02/Oy9BSh3wHJlRx6k.png)  


将之前 9008 备份`modem`分区备份出来的`NON-HLOS.bin`改名为`NON-HLOS.img`，然后使用`DiskGenius`打开，将`image`文件夹复制出来，下图是`image`文件夹里的内容。

![图 10](https://s2.loli.net/2024/11/28/ilvS3trxfGY85zH.png)  

我们需要将`image`里的所有文件复制到 OpenWrt 的`/lib/firmware`或者 Debian 的`/usr/lib/firmware`目录下，然后重启棒子。

> Tips：如果你是用命令行来使用 ssh，那么你可以使用`scp`命令来复制文件。
>
> **OpenWrt**
> ```
> scp -r /path/to/image/* root@192.168.1.1:/lib/firmware
> ```
> **Debian**
> ```
> scp -r /path/to/image/* root@10.42.0.1:/usr/lib/firmware
> ```

## 短信转发



## FAQ

Q：为什么我访问`http://192.168.100.1/usbdebug.html`后，用`adb devices`命令无法识别到设备？

A：请使用`设备管理器`检查你的设备驱动是否正常（即设备图标旁边是否有个感叹号），如果有感叹号，请把设备卸载（勾选删除驱动），然后重新尝试进入 adb 模式。

Q：为什么我进入了 9008 模式，但是在 QPT 里识别不到设备？

A：还是驱动问题，请确保你安装了 9008 驱动并且重启了电脑，然后再次让棒子进入 9008 模式就可以成功识别。

Q：为什么我的`OpenWrt/Debian`系统上不了网？

A：请先确保你的棒子连接到了可以访问互联网的网络：WiFi、GSM 等。如果还是不能联网，请检查系统的 DNS 设置，使用`vim`或者`nano`编辑`/etc/resolv.conf`文件，添加`nameserver 8.8.8.8`，保存并退出。