---
title: "Pytorch 实用技巧 01"
description: "这里是关于 Pytorch 实用技巧 01 的简短描述..."
pubDate: 2026-07-26
categories: [AI, 训练, 推理]
tags: []
draft: true
---

# Pytorch 实用技巧 01

本篇博客我们来讲一些pytorch的小技巧，方便我们更好地利用这个深度学习框架。

## 1. 安装技巧（uv + 国内源）

我们都知道torch库是比较大的，但是有时候我们想要使用不同pytorch后端来测试，那就需要创建多个虚拟环境，这时候除了使用`uv`来管理虚拟环境，我们还需要一个国内源来稳定快速的下载。

那么这里就推荐使用**南京大学源**，这个源同步pytorch上游非常积极，而且包括了pytorch上游源中的所有内容，而不是只有CUDA，具体地址是`https://mirror.nju.edu.cn/pytorch/whl/`，里面包含所有上游支持的后端。

比如我们要安装`CPU`后端的pytorch，就可以使用

```bash
# bash 环境下
uv venv torch-cpu # 可选 --python 参数来指定python版本，比如 --python 3.13
# 激活虚拟环境
source ./torch-cpu/Scripts/activate
# 安装 torch 的 CPU 版本
uv pip install torch torchvision --index-url https://mirror.nju.edu.cn/pytorch/whl/cpu
``` 
## 2. 