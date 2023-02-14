---
layout: post
title:  "Linux编程之makefile"
date:   2022-12-30
desc: "C/C++ makefile 编译"
keywords: "C/C++ makefile 编译"
categories: [C_or_c++]
tags: [C/C++]
icon: icon-html
---

## GUN

>gcc（GNU Compiler Collection，GNU 编译器套件），是由 GNU 开发的编程语言编译器。gcc原本作为GNU操作系统的官方编译器，现已被大多数类Unix操作系统（如Linux、BSD、Mac OS X等）采纳为标准的编译器，gcc同样适用于微软的Windows。
>gcc最初用于编译C语言，随着项目的发展gcc已经成为了能够编译C、C++、Java、Ada、fortran、Object C、Object C++、Go语言的编译器大家族。

编译命令格式：

```sh
gcc [-option1] ... <filename>
g++ [-option1] ... <filename>
```
- 命令、选项和源文件之间使用空格分隔
- 一行命令中可以有零个、一个或多个选项
- 文件名可以包含文件的绝对路径，也可以使用相对路径
- 如果命令中不包含输出可执行文件的文件名，可执行文件的文件名会自动生成一个默认名，Linux平台为a.out，Windows平台为a.exe

| 选项 | 含义 |
| ------ | ------ |
| -o file | 指定输出文件名为file |
| -E | 只进行预处理 |
| -S(大写) | 只进行预处理与编译 |
| -c(小写) | 只进行预处理，编译，汇编 |

既然说到了这里，那么不得不提到C语言的编译过程
C代码编译成可执行程序经过4步：
- 预处理：宏定义展开、头文件展开、条件编译等，同时将代码中的注释删除，这里并不会检查语法
- 编译：检查语法，将预处理后文件编译生成汇编文件
- 汇编：将汇编文件生成目标文件(二进制文件)
- 链接：C语言写的程序是需要依赖各种库的，所以编译之后还需要把库链接到最终的可执行程序中去

比如：
- 预处理：gcc -E hello.c -o hello.i
- 编  译：gcc -S hello.i -o hello.s
- 汇  编：gcc -c hello.s -o hello.o
- 链  接：gcc    hello.o -o hello

那么还有更简单的一步编译：
```sh
gcc hello.c -o demo 经过：预处理、编译、汇编、链接的过程
```

##数据类型