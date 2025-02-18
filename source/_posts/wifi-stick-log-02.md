---
title: 为随身WiFi编译主线内核
date: 2024-12-06 19:06:46
tags: 随身WiFi
categories: 随身WiFi
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

## 编译内核

使用以下命令开始编译，`-j$(nproc)`表示使用全部逻辑处理器来编译，这会使 CPU 满载，如果不希望满载可以根据自己的 CPU 更改为`-j4`或者`-j6`：

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
   dd if=/dev/zero of=rootfs.img bs=1M count=3372
   ```
3. 初始化镜像文件的文件系统
   ```bash
   mkfs.btrfs rootfs.img
   ```
4. 挂载镜像文件
   ```bash
   mkdir rootfs
   sudo mount -o compress=zstd:1 rootfs.img rootfs
   ```
5. 解压根文件系统到镜像文件
   ```bash
   tar -zxpf ArchLinuxARM-aarch64-latest.tar.gz -C rootfs
   ```
6. 使用 chroot 进入镜像文件
   ```bash
    # 需要挂载一些必要的目录
   sudo mount --bind /dev ~/msm8916/dev
   sudo mount -t devpts devpts ~/msm8916/rootfs/dev/pts -o gid=5,mode=620
   sudo mount -t proc proc ~/msm8916/rootfs/proc
   sudo mount -t sysfs sysfs ~/msm8916/rootfs/sys
   sudo mount -t tmpfs tmpfs ~/msm8916/rootfs/run
   sudo chroot ~/msm8916/rootfs
   ```
7. 配置 pacman

   开启并行下载和颜色显示，以及添加一些第三方软件源：

   ```bash
   nano /etc/pacman.conf
   # 将下面这两行取消注释
   Color
   ParallelDownloads = 5
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
   mv /etc/pacman.d/mirrolist /etc/pacman.d/mirrolist.bak
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
pacman -S usbutils danctnix-usb-tethering 
```
12. 开启 systemd 服务
```bash
systemctl enable usb-tethering
systemctl enable NetworkManager
systemctl enable ModemManager
```
13. 安装 vmlinuz 与内核模块
14. 制作 initramfs 镜像文件

```bash
kerver=$(ls /usr/lib/modules)
mkinitcpio --generate /boot/initrd.img-$kerver --kernel $kerver
```
运行完上面的命令后还需要再开一个终端，在chroot外将镜像文件里的`initrd.img-*`拷贝出来：
```bash
sudo cp ~/msm8916/rootfs/boot/initrd.img-* ~/msm8916/initrd.img
# 更改一下所有者
sudo chown $(users):$(groups) ~/msm8916/initrd.img
```

15. 取消挂载

```bash
sudo umount ~/msm8916/rootfs/run
sudo umount ~/msm8916/rootfs/sys
sudo umount ~/msm8916/rootfs/proc
sudo umount ~/msm8916/rootfs/dev/pts
sudo umount ~/msm8916/rootfs/dev
sudo umount ~/msm8916/rootfs
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
