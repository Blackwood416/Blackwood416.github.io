---
title: OpenGL 学习日志 01
date: 2023-01-24 14:16:08
tags: OpenGL
categories: 开发
---
# OpenGL 学习日志 01

为了学习图形学相关知识，我选择了OpenGL这个跨平台的图形API来进行学习，使用本博客对学习过程进行记录。参考了(LearnOpenGL)[https://learnopengl-cn.github.io]上的内容。

# 声明

我个人相对于LearnOpenGL上面用的C++更喜欢C语言，所以会将示例代码改成C语言的形式。

# OpenGL 是什么？

OpenGL一般被认为是图形API,但它其实是由Khronos组织制定并维护的规范。OpenGL规范严格规定了每个函数该如何执行，以及它们的输出值。至于函数的具体实现则是由OpenGL库的开发者（一般为显卡厂商）决定的。

# 版本问题

因为OpenGL 3.2版本之前使用的立即渲染模式（Immediate mode，也就是固定渲染管线）在使用上不够灵活自由，所以3.3以后开始推行核心模式（Core-profile），本文也是参考LearnOpenGL上面的教程指定OpenGL版本为3.3。

# 扩展

OpenGl的一大特性是支持扩展（Extension），当显卡厂商提出一个新特性或者渲染上的大优化，通常会以扩展的方式在驱动中实现。

使用扩展的代码大多看上去如下：
```
if(GL_ARB_extension_name)
{
    // 使用硬件支持的全新的现代特性
}
else
{
    // 不支持此扩展则用旧方法
}
```

# 状态机

OpenGL本身是一个巨大的状态机（State Machine）：一系列的变量描述OpenGL此刻应当如何运行。OpenGL的状态通常被称为OpenGL上下文(Context)。我们通常使用如下途径去更改OpenGL状态：设置选项，操作缓冲。最后，我们使用当前OpenGL上下文来渲染。

假设当我们想告诉OpenGL去画线段而不是三角形的时候，我们通过改变一些上下文变量来改变OpenGL状态，从而告诉OpenGL如何去绘图。一旦我们改变了OpenGL的状态为绘制线段，下一个绘制命令就会画出线段而不是三角形。

当使用OpenGL的时候，我们会遇到一些状态设置函数(State-changing Function)，这类函数将会改变上下文。以及状态使用函数(State-using Function)，这类函数会根据当前OpenGL的状态执行一些操作。只要你记住OpenGL本质上是个大状态机，就能更容易理解它的大部分特性。

# 对象

OpenGL库是用C语言写的，同时也支持多种语言的派生，但其内核仍是一个C库。由于C的一些语言结构不易被翻译到其它的高级语言，因此OpenGL开发的时候引入了一些抽象层。“对象(Object)”就是其中一个。

在OpenGL中一个对象是指一些选项的集合，它代表OpenGL状态的一个子集。比如，我们可以用一个对象来代表绘图窗口的设置，之后我们就可以设置它的大小、支持的颜色位数等等。可以把对象看做一个C风格的结构体(Struct)：

```c
Struct object_name {
    float option1;
    int option2;
    char[] name;
}
```

当我们使用一个对象时，通常看起来像如下一样（把OpenGL上下文看作一个大的结构体）：

```c
// OpenGL的状态
struct OpenGL_Context {
    ...
    object* object_Window_Target;
    ...
};
// 创建对象
unsigned int objectId = 0;
glGenObject(1, &objectId);
// 绑定对象至上下文
glBindObject(GL_WINDOW_TARGET, objectId);
// 设置当前绑定到 GL_WINDOW_TARGET 的对象的一些选项
glSetObjectOption(GL_WINDOW_TARGET, GL_OPTION_WINDOW_WIDTH, 800);
glSetObjectOption(GL_WINDOW_TARGET, GL_OPTION_WINDOW_HEIGHT, 600);
// 将上下文对象设回默认
glBindObject(GL_WINDOW_TARGET, 0);
```

这一段代码展示了OpenGL常见的工作流。我们首先创建一个对象，然后用一个id保存它的引用（实际数据被储存在后台）。然后我们将对象绑定至上下文的目标位置（例子中窗口对象目标的位置被定义成GL_WINDOW_TARGET）。接下来我们设置窗口的选项。最后我们将目标位置的对象id设回0，解绑这个对象。设置的选项将被保存在objectId所引用的对象中，一旦我们重新绑定这个对象到GL_WINDOW_TARGET位置，这些选项就会重新生效。

# 结尾

下篇就开始配置OpenGL开发环境喽。
