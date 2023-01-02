---
title:  开发日志 01
date: 2023-01-02 20:27:54
tags: unity
---

# 开发日志 01
## unity基础学习 01

### Transform 组件

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
        // transform 组件的属性和方法可以直接使用transform.xxx访问，如下：
        Vector3 pos = transform.localPosition;
    }
}
```
在unity中每一个GameObject都有transform组件（包括空物体），可以使用 **Translate()** 方法来移动物体。以下是示例：
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

    }
}
```