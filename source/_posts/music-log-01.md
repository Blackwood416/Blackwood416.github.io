---
title: 音乐数字信号学习日志 01
date: 2024-02-17 23:28:34
tags: 音乐
categories: DSP
---

## 为啥学音乐数字信号处理？

作为一个游戏开发者，开发一个游戏时总免不了添加音乐和音效，此时，了解音乐数字信号处理的知识，可以帮助我们更好的理解音乐的原理，从而更好的实现游戏音乐的效果。

## 音乐的原理

我们在`Octave`里输入以下代码：

```octave
function sine()
    x = [0:44099]
    y = sin(2*pi*440/44100*x)
    for i = 1:5
        sound(y, 44100)
        pause(0.5)
    end
end
```

运行这段代码，你会听到 5 声类似电话忙线的声音。其实这就是通过数字信号模拟出的声音。

我们都知道声音是由振动产生的，而振动是由正弦波和方波叠加而成的。正弦波是最基本的波形，它的频率越高，声音越响，而方波则是其中的一种。

上面这段代码生成了一个`440Hz`的正弦波，并播放出来，我们用 for 循环播放 5 次，每次播放的时间为`0.5s`。

我们更改一下代码，让其生成一张波形图：

```octave
function sine()
    x = [0:44099]
    y = sin(2*pi*440/44100*x)
    samples_per_cycle = 44100 / 440;
    plot(x(1:samples_per_cycle), y(1:samples_per_cycle));
    grid on;
    xlabel('Sample Index');
    ylabel('Amplitude');
    title('Sine Wave');
    print -dpng "sin.png";
end
```

![sin.png](https://s2.loli.net/2024/11/21/VDtTmlYdxJjX3ru.png)  

这张图展示了这段音频单个周期的波形，我们可以看到它是一个标准的正弦波。
