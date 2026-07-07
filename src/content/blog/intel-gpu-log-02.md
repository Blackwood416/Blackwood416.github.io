---
title: "Intel GPU折腾日志 02"
description: "这篇我们来讲讲A770的频率特性"
pubDate: 2026-06-27
categories: [Intel, A770]
tags: [显卡, 硬件]
draft: true
---

# Intel GPU折腾日志 02

## GPU 主频

我们可以使用 [xpu-smi](https://github.com/intel/xpumanager)来查看当前GPU频率，这个工具有点像N卡那边的**nvidia-smi**，不过是Intel XPU版本的，而且不像N卡那样是**top**命令一样的结构化显示（v2.0.0好像加了这个功能，不过有bug跑不了）。

这玩意的安装也很简单，我们去到[releases](https://github.com/intel/xpumanager/releases/tag/v1.3.5)，可以看到下面这个界面。

![图 1](https://files.seeusercontent.com/2026/06/29/Rqc5/pic_1782720000964.png)  

根据系统下载对应的压缩包就可以了，像Windows系统就下载后缀是**win.zip**的。

解压出来就可以运行了。

直接运行会得到下面这样的结果。

![图 2](https://files.seeusercontent.com/2026/06/29/n4Ps/pic_1782720553381.png)

可以用以下命令查看你的GPU基本信息：

```powershell
xpu-smi discovery -d 0
```

输出大概长这个样子：

![图 5](https://files.seeusercontent.com/2026/07/07/8toD/pic_1783425868904.png)  

那如果我们需要监控GPU核心频率，可以用这条命令：

```powershell
xpu-smi dump -m 2 -i 1
```

效果如图：

![图 3](https://files.seeusercontent.com/2026/06/29/r5wH/pic_1782723797104.png)  

可以观察到最低主频是600Mhz，然后如果驱动里没有超频的话，跑我这边的XMX极限吞吐测试程序只能跑到2000Mhz。

## 超频设置


![图 6](https://files.seeusercontent.com/2026/07/07/u5lR/pic_1783426394885.png)  

我们打开驱动面板，点侧边栏的性能。

![图 7](https://files.seeusercontent.com/2026/07/07/vQ8q/pic_1783426482181.png)  

进到这个页面点上面的调优。

![图 8](https://files.seeusercontent.com/2026/07/07/9Kbt/pic_1783426559904.png)  

打开GPU调优。
 
![图 10](https://files.seeusercontent.com/2026/07/07/0jGs/pic_1783426713720.png)  

`性能提升`调成`1`，然后点右下角`应用更改`，就算把AI算力的超频打开来了。

别看只调了1，但是它会对调度有影响，不调的话跑XMX测试，频率只能到2000Mhz，调了可以到2404Mhz。