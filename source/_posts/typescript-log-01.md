---
title: Typescript学习日志 01
date: 2024-12-31 16:02:23
tags: typescript
categories: 开发
---

## 为什么要学习Typescript

TypeScript 是 JavaScript 的超集，它有着静态类型检查，可以避免很多运行时错误，避免了JavaScript中的一些坑，并且可以提升开发效率。

## 安装

```bash
npm install -g typescript
```
## 开发环境

我们使用VSCode作为开发环境，VSCode内置了TypeScript支持，我们只需要创建一个目录，然后在里面新建一个`.ts`后缀的文件即可开始写代码。

## Hello World

我们将下面的代码保存为`hello.ts`文件：

```typescript
console.log(`Hello ${name}`);
```
## 运行

```bash
tsc hello.ts
node hello.js
```

## 类型

### 基本类型

- `number`：数字类型，包括整数和浮点数
- `string`：字符串类型
- `boolean`：布尔类型
- `null`：空类型