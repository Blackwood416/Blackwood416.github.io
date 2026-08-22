---
title: 为随身WiFi编译主线内核
description: 最近在折腾随身 WiFi，发现内核版本比较老，于是想编译一个主线内核，但是随身 WiFi 的内核编译环境比较复杂，所以记录一下编译过程。
pubDate: '2024-12-06T11:06:46.000Z'
tags:
  - 随身WiFi
categories:
  - 随身WiFi
draft: false
---
## 前言

最近在折腾随身 WiFi，发现内核版本比较老，于是想编译一个主线内核，但是随身 WiFi 的内核编译环境比较复杂，所以记录一下编译过程。

## 流程梳理

因为本文的内容较多，所以在开始之前，需要了解本次我们通过这篇文章是要得到什么东西：

1. boot.img：存储着内核和对应机型的dtb（文章中为UZ801的dtb），用于引导和加载系统。
2. rootfs.img：用于存放系统。

下图简要列出了整个流程：


## 准备工作

1. 下载内核源码

   ```bash
   # 需要科学上网，或者使用国内镜像加速
   git clone https://github.com/msm8916-mailine/linux.git --depth=1
   ```

2. 下载编译工具

   ```bash
   # 我使用WSL 2的Arch Linux来编译，所以我们使用pacman来安装工具链
   sudo pacman -S base-devel aarch64-linux-gnu-gcc openssl minizip libidn11 bc git qemu-user-static-binfmt android-tools wget btrfs-progs
   ```

## 配置 Makefile

> 假设前面下载的内核源码是在`~/msm8916/linux`目录下。

在当前终端中，执行以下命令：

```bash
cd ~/msm8916/linux
export ARCH=arm64
export CROSS_COMPILE=aarch64-linux-gnu-
```

然后，执行以下命令：

```bash
make msm8916_defconfig
make menuconfig
```

就会弹出一个配置菜单，我们需要修改以下几项：

1. General setup -> Local version - append to kernel release -> 修改为自己想要显示在内核版本后的内容，比如`-blackwood416`。
2. General setup -> Automatically append version information to the version string -> 选择`n`，这会让内核版本信息更短，不然后面会加一长串的信息。
3. Device Drivers -> USB Support -> USB Gadget Support -> USB Gadget functions configurable through configfs 及子项全开，保证usb功能完整。
4. Power management options -> Suspend to RAM and standby 启用睡眠。
5. Power management options -> Hibernation (aka 'suspend to disk') 启用休眠。
6. File systems -> Btrfs filesystem support改成`M`，子项 Btrfs POSIX Access Control Lists启用。

## 超频设置

添加以下代码可以让CPU最高频率达到2.0Ghz。

```diff title='arch/arm64/boot/dts/qcom/msm8916.dtsi'
--- a/arch/arm64/boot/dts/qcom/msm8916.dtsi
+++ b/arch/arm64/boot/dts/qcom/msm8916.dtsi
@@ -259,7 +259,22 @@ opp-800000000 {
                opp-998400000 {
                        opp-hz = /bits/ 64 <998400000>;
                };
-       };
+                opp-1363200000 {
+                        opp-hz = /bits/ 64 <1363200000>;
+                };
+                opp-1401600000 {
+                        opp-hz = /bits/ 64 <1401600000>;
+                };
+                opp-1621600000 {
+                        opp-hz = /bits/ 64 <1621600000>;
+                };
+                opp-1841600000 {
+                        opp-hz = /bits/ 64 <1841600000>;
+                };
+                opp-2000000000 {
+                        opp-hz = /bits/ 64 <2000000000>;
+                };
+        };

        firmware {
                scm: scm {
```

```diff title='drivers/clk/qcom/a53-pll.c'
--- a/drivers/clk/qcom/a53-pll.c
+++ b/drivers/clk/qcom/a53-pll.c
@@ -25,6 +25,9 @@ static const struct pll_freq_tbl a53pll_freq[] = {
        { 1248000000, 65, 0x0, 0x1, 0 },
        { 1363200000, 71, 0x0, 0x1, 0 },
        { 1401600000, 73, 0x0, 0x1, 0 },
+       { 1621600000, 84, 0x0, 0x1, 0 },
+       { 1841600000, 96, 0x0, 0x1, 0 },
+       { 2000000000, 110, 0x0, 0x1, 0 },
        { }
 };
```

## 编译内核

使用以下命令开始编译，`-j$(nproc)`表示使用全部`逻辑处理器`来编译，这会使 CPU 满载，如果不希望满载可以根据自己的 CPU 更改为`-j4`或者`-j6`：

```bash
make -j$(nproc)
```

这个命令会自动编译内核镜像、模块以及 dtb 文件。

## 制作系统镜像文件

1. 下载 Arch Linux ARM 根文件系统
   ```bash
   cd ~/msm8916
   wget -c https://mirrors.tuna.tsinghua.edu.cn/archlinuxarm/os/ArchLinuxARM-aarch64-latest.tar.gz
   ```
2. 创建系统镜像文件
   ```bash
   # 创建一个 3372M 的镜像文件以匹配随身 WiFi 的存储空间大小
   dd if=/dev/zero of=root.img bs=1M count=3372
   ```
3. 初始化镜像文件的文件系统
   ```bash
   mkfs.btrfs root.img
   ```
4. 挂载镜像文件
   ```bash
   mkdir rootfs
   sudo mount -o compress=zstd:1 root.img rootfs
   ```
5. 解压根文件系统到镜像文件
   ```bash
   sudo tar -zxpf ArchLinuxARM-aarch64-latest.tar.gz -C rootfs
   ```
6. 使用 arch-chroot 进入镜像文件
   ```bash
   # arch-chroot 会自动挂载必要的目录
   sudo arch-chroot ~/msm8916/rootfs
   ```
7. 配置 pacman

   开启并行下载和颜色显示，以及添加一些第三方软件源：

   ```bash
   nano /etc/pacman.conf
   # 将下面这两行取消注释以提升pacman使用体验
   Color
   ParallelDownloads = 5
   # WSL 下可能需要关闭沙盒功能
   DisableSandboxFilesystem
   DisableSandboxSyscalls
   # 在文件末尾添加以下软件源
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
   [danctnix]
   Server = https://p64.arikawa-hi.me/$repo/$arch
   SigLevel = Never
   ```

   更换国内源：

   ```bash
   mv /etc/pacman.d/mirrorlist /etc/pacman.d/mirrolist.bak
   nano /etc/pacman.d/mirrorlist
    # 更换成以下内容
    ## Archlinux arm
   Server = https://mirrors.ustc.edu.cn/archlinuxarm/$arch/$repo
   Server = https://mirror.archlinuxarm.org/$arch/$repo
   Server = https://mirrors.bfsu.edu.cn/archlinuxarm/$arch/$repo
   Server = https://mirrors.tuna.tsinghua.edu.cn/archlinuxarm/$arch/$repo
   Server = https://mirrors.163.com/archlinuxarm/$arch/$repo
   ```

8. 配置网络

   因为根文件系统默认的 DNS 是从 systemd 的文件链接过来，而我们使用 chroot，没有启动 systemd，所以需要手动配置 DNS：

   ```bash
   rm /etc/resolv.conf
   echo "nameserver 8.8.8.8" > /etc/resolv.conf
   ```

9. 删除旧内核及固件包

   ```bash
   pacman -R linux-aarch64 linux-firmware linux-firmware-whence
   ```

10. 更新系统

```bash
pacman-key --init
pacman-key --populate
pacman -Syu
```

11. 安装必要的软件包
```bash
pacman -S usbutils danctnix-usb-tethering networkmanager btrfs-progs
```
12. 开启 systemd 服务
```bash
systemctl enable usb-tethering
systemctl enable NetworkManager
systemctl enable sshd
# 需要配置基带（插卡）的话才开这个
systemctl enable ModemManager
```
13. 安装 vmlinuz 与内核模块
14. 制作 initramfs 镜像文件

```bash
# 刚才把mkinitcpio也清理掉了，先装回来
pacman -Sy mkinitcpio
kerver=$(ls /usr/lib/modules)
mkinitcpio --generate /boot/initrd.img-$kerver --kernel $kerver
```
运行完上面的命令后还需要再开一个终端，在chroot外将镜像文件里的`initrd.img-*`拷贝出来：
```bash
sudo cp ~/msm8916/rootfs/boot/initrd.img-* ~/msm8916/initrd.img
# 更改一下所有者
sudo chown $(users):$(groups) ~/msm8916/initrd.img
```

15. 卸载镜像

```bash
sudo umount ~/msm8916/rootfs
```

16. 打包镜像
```bash
img2simg root.img rootfs.img
```

## 制作 boot.img

这一步，我们需要之前编译出来的内核镜像、dtb 文件以及刚刚制作的 initramfs 镜像文件。

```bash
# 将它们都复制到 ~/msm8916/output 目录下
mkdir ~/msm8916/output
cd ~/msm8916/output
cp ~/msm8916/linux/arch/arm64/boot/Image.gz .
cp ~/msm8916/linux/arch/arm64/boot/dts/qcom/msm8916-yiming-uz801v3.dtb .
mv ~/msm8916/initrd.img .

# 合并内核镜像与dtb文件
cat Image.gz msm8916-yiming-uz801v3.dtb > kernel-dtb
# 生成boot.img
# 其中root=UUID=2722581e-5f1b-4684-b07b-8d26bf6d8b6f 是根文件系统的UUID，可以通过以下命令获取：
# file ~/msm8916/rootfs.img
mkbootimg --base 0x80000000 \
--kernel_offset 0x00080000 \
--ramdisk_offset 0x02000000 \
--tags_offset 0x01e00000 \
--pagesize 2048 \
--second_offset 0x00f00000 \
--ramdisk initrd.img \
--cmdline "earlycon root=UUID=2722581e-5f1b-4684-b07b-8d26bf6d8b6f console=ttyMSM0,115200 rw" \
--kernel kernel-dtb \
-o boot.img
```

## 刷机脚本

```bat
@echo off
@title 一键刷入Archlinux----Blackwood416
color 3f
:1
mode con cols=100 lines=30
set tm1=%time:~0,2%
set tm2=%time:~3,2%
set tm3=%time:~6,2%
set h=%time:~0,2%
set h=%h: =0%
set mknowtime=%date:~0,4%%date:~5,2%%date:~8,2%%h%%time:~3,2%%time:~6,2%
set pa=%cd%
ECHO %date% %tm1%点%tm2%分%tm3%秒
rem 全局变量，包名

@echo fastboot模式刷入-adb重启至fastboot模式中
adb reboot bootloader
set /p a=确定执行吗？ （y继续，n退出）
if /i '%p%'=='y' goto continue
if /i '%a%'=='n' goto end
timeout /NOBREAK 3
fastboot erase boot
fastboot flash aboot aboot.bin
fastboot reboot
fastboot oem dump fsc && fastboot get_staged fsc.bin
fastboot oem dump fsg && fastboot get_staged fsg.bin
fastboot oem dump modemst1 && fastboot get_staged modemst1.bin
fastboot oem dump modemst2 && fastboot get_staged modemst2.bin
fastboot erase boot
fastboot reboot bootloader
timeout /NOBREAK 5
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
@echo   此过程需几分钟请稍等
fastboot flash boot boot.img
fastboot -S 100M flash rootfs rootfs.img
pause
@echo 刷机完成，重启中……
timeout 5
fastboot reboot
```

> boot.img 和 rootfs.img 外的文件需要自备，可以从随便一个整合包里提取。

## 实际刷入过程

需要先进9008备份，板号不同进入方法不同，一般分为：

1. 按钮法。一般是UFI系列，按住RESET键插入电脑即可进入9008模式。
2. 短接法。需要使用镊子短接对应的调试触点，并在保持短接的状态下通电，适用于大多数棒子。

然后需要通过adb连接棒子，开启adb的方法也跟具体型号有关，有些型号自带有些则没有，这里就不再赘述了。

连接完成后即可用刷机脚本一键刷机，因为使用了btrfs+zstd压缩，所以刷入会久一点（20分钟或更久）。