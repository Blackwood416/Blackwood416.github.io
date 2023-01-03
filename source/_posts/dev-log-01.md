---
title:  开发日志 01
date: 2023-01-02 20:27:54
tags: unity
---

# 开发日志 01
## unity基础学习 01

### Transform 组件

Transform 组件常用的有三个属性，它们分别是 **position** 、 **rotation** 、 **scale** ， 它们分别是

```csharp
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
public class TestScript : MonoBehaviour
{
    // Start is called before the first frame update
    void Start()
    {

    }
    // Update is called once per frame
    void Update()
    {
        // transform 组件的属性和方法可以直接使用transform.xxx访问，访问position属性的代码如下：
        Vector3 pos = transform.localPosition;
        // 或者
        Vector3 pos = transform.positoion;
    }
}
```
在unity中每一个GameObject都有Transform组件（包括空物体），可以使用 **Translate()** 方法来移动物体。以下是示例：
```csharp
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
public class TestScript : MonoBehaviour
{
    // Start is called before the first frame update
    void Start()
    {

    }
    // Update is called once per frame
    void Update()
    {
        // Translate 默认有 4 个参数，第 4 个参数是可选的
        transform.Translate(0.1f,0,0);
        // 第 4 个参数可以用来指定位移所使用的参考坐标系
        transform.Translate(0,0.1f,0,Space.World);
        transform.Translate(0,0,0.1f,Space.Self);
    }
}
```
想要计算出两个GameObject之间的距离，我们可以采用将两个GameObject的position属性相减后取模的方法，如下：
```csharp
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
class TestScript : MonoBehaviour
{
    GameObject obj;
    // Start is called before the first frame update
    void Start()
    {
        obj = GameObject.Find("Another Object");
    }
    // Update is called once per frame
    void Update()
    {
        // 一个物体的世界坐标
        Vector3 p1 = transform.postion;
        // 另一个物体的世界坐标
        Vector3 p2 = obj.transform.postion;
        // 将两物体的世界坐标相减后取模即为距离
        float distance = (p2 - p1).magnitude;
    }
}
```
而如果想要得知GameObject的朝向信息，可以使用获取 **rotation** 属性，但是它是个四元的属性，用起来并不方便，所以遇到这种情况应该获取该GameObject的Transform组件中的 **eulerAngles** 属性，如下：
```csharp
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
public class TestScript : MonoBehaviour
{
    // Start is called before the first frame update
    void Start()
    {

    }
    // Update is called once per frame
    void Update()
    {
        Vector3 angle = transform.eulerAngles;
        //或者
        Vector3 angle = transform.localEulerAngles;
    }
}
```
而要是想要旋转物体，我们可以使用 **Rotate()** 这个方法，如下：
```csharp
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
class TestScript : MonoBehaviour
{
    // Start is called before the first frame update
    void Start()
    {

    }
    // Update is called once per frame
    void Update()
    {
        // 与 Translate() 相似，第 4 个参数也是可选的
        transform.Rotate(10.0f,0,0);
        // 也可以指定相对旋转的坐标系
        transform.Rotate(0,10.0f,0,Space.World);
        transform.Rotate(0,0,10.0f,Space.Self);
    }
}
```
可以使用 transform 类的 LookAt() 方法来使物体朝向某个position, LookAt()的参数即为一个Vector3类型的数值，可以为 position属性，也可以是单纯的坐标。

scale属性没什么好说的，就是物体的缩放属性，是Vector3类型。