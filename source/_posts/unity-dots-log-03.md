---
title: Unity Dots学习日志 03
date: 2023-08-10 23:52:50
tags: unity
categories: 开发
---

## Dots实现FPS踩坑

首当其冲的就是输入，可以使用input system，参考[油管大神**TurboMakesGame**的视频](https://www.youtube.com/watch?v=bFHvgqLUDbE)。

这只是实现了移动的输入，视角转动的输入还没实现呢，这时我们会遇到一个问题，那就是camera。

将camera转化为entity，看似可行，实则不行，transform组件没被转化，实现了转不动（我已经试过了）。

经过多番查找，我发现，camera还是得留在subscene外继续当GameObject，我们把它当成一个普通的GameObject处理，那么怎么跟ECS对接呢？

这里我们可以参考[油管大神**TurboMakesGame**的另一个视频](https://www.youtube.com/watch?v=IO6_6Y_YUdE)，在制作的最后部分有涉及camera control。

你以为能这样就完事了？并没有。

我们的camera不通过设置是看不到Entity的，我们需要去**Edit > Preferences > Entities > Baking**下的**Scene View Mode**切换成**Runtime Data**。这样才能让我们的camera渲染出entity。

这就结束了？还没呢。因为player是Entity而camera是GameObject，所以我们并不能像在它们都是GameObject时那样通过将它们设置为父子物体来同步它们的transform，我们需要手动进行同步。

好了，我们先同步了位置，但是你会发现，视角转动和移动方向并没有关系，照抄大神的代码是不行的，我们还需要同步一下rotation。

写完同步rotation的代码，好嘛，运行起来一看，往下和往上看时player的模型也跟着上下转动，这是rotation的问题，我们不能同步所有的rotation。

解决方法是只同步camera rotation的quaternion的y和w值，其他两个设置为0，这会只同步水平方向的rotation。

至此我们才完成了一个基本的FPS角色移动和视角转动。
