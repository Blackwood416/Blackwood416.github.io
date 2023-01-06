---
title: 游戏开发日志 02
date: 2023-01-06 16:57:40
tags:
---

# 游戏开发日志 02
## unity基础学习 02

### 脚本执行优先级

在unity中，挂载在各个物体上的脚本默认的运行优先级都为 **0** 。而要是想改变某个脚本的运行优先级使其比其他脚本更早或更晚运行，可以在unity的 **Edit > Project Settings...** 窗口下找到 **Script Execution Order** ，单击右下角的 **+** 就可以单独调整已挂载的脚本的运行优先级了，或者在资源窗口内找到一个脚本，然后在 **Inspector** 界面也能在脚本组件的右上角找到 **Execution Order...** ，点击它也能跳转到脚本优先级的调整界面，脚本运行优先级的处理原则是：**优先级数值越低，优先级越高** 。

可以在空物体上挂载脚本并提高脚本的运行优先级来处理一些场景内全局性的设置。

### 脚本组件的参数

脚本组件在inspector界面里也是可以显示参数的，只需在脚本类中定义全局变量即可：
```csharp
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
class TestScript : MonoBehaviour
{
    [Tooltip("This is a integer parameter")]
    public int IntegerParameter = 10;
    // Start is called before the first frame update
    void Start()
    {

    }
    // Update is called once per frame
    void Update()
    {

    }
}
```

保存上例会使你挂载脚本的物体的 **Inspector** 窗口下的脚本组件中多出名称为 **Integer Parameter** 的可调节参数，而参数的输入框中的值为 **10**，当鼠标悬停在参数上时会显示 **This is a integer parameter**。

由上例我们可以看出，脚本组件类的公共成员变量会被unity当成该脚本的参数处理，参数的名称类似大驼峰命名法，要是变量名为 **integerParameter** ，参数的名称依然为 **Integer Parameter** ；参数的默认值即为变量的值，若变量只被声明但未被初始化则会使用C#语言中对应类型的默认值作为参数的默认值；参数还可以有提示，写在变量定义上的 **Tooltip** attribute中。

### unity 实时调试小技巧

在游戏play的时候调整的组件参数可以使用组件右上角选项中的 **Copy > Component** 记录对应组件的值，在结束play回到edit模式后可以使用组件右上角选项中的 **Paste > Component Values** 来让组件的值变成play模式下调整过的参数。

### 