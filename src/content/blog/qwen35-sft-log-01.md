---
title: "Qwen3.5 SFT微调训练日志 01"
description: "这篇日志是关于如何使用unsloth来SFT微调训练一个Qwen3.5 4B模型，在A770 16G上"
pubDate: 2026-07-23
categories: [AI, 训练, SFT, LORA]
tags: [Qwen3.5]
draft: true
---

# Qwen3.5 SFT微调训练日志 01

## 微调目的

为了更好地适配我的AI虚拟伴侣项目，我打算对原始模型权重进行微调而不是仅仅靠提示词来塑造人格，因为提高指令遵循能力的方式，效果是这样排的：

`prompt engineering` < `SFT` ≈ `RL`

## 训练框架选型

这里使用unsloth作为训练框架，因为它兼容各种显卡而不是局限于N卡的CUDA生态。

## 训练环境搭建

unsloth为N、A、I卡都提供了CLI训练环境，而且使用uv可以很方便地安装预设环境。

对于Intel显卡：

```powershell
git clone https://github.com/unslothai/unsloth.git
cd unsloth
uv venv unsloth_env --python 3.13
uv pip install .[intel-gpu-torch2120]
```

## 准备数据集

### 私有对话数据

这里我们使用**ChatML**格式的对话数据。
```json
{
    "messages":
    [
        {
            "role":"user",
            "content":"你平时直播都玩什么游戏啊？"
        },
        {
            "role":"assistant",
            "content":"唔…父亲大人教过我玩一些休闲游戏，像《星露谷物语》或者《动物森友会》。不过遇到恐怖游戏的话，我可能会吓得躲在屏幕后面……"
        }
    ]
}
```

以**JSONL**的形式存储。
```json
{"messages":[{"role":"user","content":"你平时直播都玩什么游戏啊？"},{"role":"assistant","content":"唔…父亲大人教过我玩一些休闲游戏，像《星露谷物语》或者《动物森友会》。不过遇到恐怖游戏的话，我可能会吓得躲在屏幕后面……"}]}
```

### 公开数据集

这里使用**COIG-CQIA**数据集作为通用任务的数据集。

### 数据配方

对于人格塑造任务人格数据肯定是需要比较多的，本次微调为了实现无系统提示词下的人格覆盖，数据集放了4000条对话数据，其中人格方面的占比较多，具体数据配方如下：

|类型|条数|比例|
|:-:|:-:|:-:|
|直接身份锚定|1800|45%|
|身份扩展/边界|600|15%|
|日常问答|400|10%|
|人格风格的技术问答|600|15%|
|对抗纠偏（防提示词攻击）|400|10%|
|通用问答|200|5%|

对于人格数据，除了你自己写，还可以让其他AI来帮你生成