---
layout: post
title:  "Linux编程之makefile"
date:   2022-12-30
desc: "C/C++ makefile 编译"
keywords: "C/C++ makefile 编译"
categories: [Linux]
tags: [C/C++]
icon: icon-html
---

什么是makefile？或许很多Windows的程序员都不知道这个东西，因为那些Windows的集成开发环境（integrated development environment，IDE）都为你做了这个工作，
但我觉得要作一个好的和专业的程序员，makefile还是要懂。

makefile带来的好处就是——“自动化编译”，一旦写好，只需要一个make命令，整个工程完全自动编译，极大的提高了软件开发的效率。 
make是一个命令工具，是一个解释makefile中指令的命令工具，一般来说，大多数的IDE都有这个命令，比如：Delphi的make，Visual C++的nmake，Linux下GNU的make。
可见，makefile都成为了一种在工程方面的编译方法。

一、基本介绍<br/>
1、makefile的规则：

    target ... : prerequisites ...
        command
        ...
        ...
        
    target可以是一个object file（目标文件），也可以是一个执行文件，还可以是一个标签（label）。
    prerequisites生成该target所依赖的文件和/或target
    command该target要执行的命令（任意的shell命令）
    
一个demo:

    edit : main.o kbd.o command.o display.o \
            insert.o search.o files.o utils.o
        gcc -o edit main.o kbd.o command.o display.o \
            insert.o search.o files.o utils.o
    
    main.o : main.c defs.h
        gcc -c main.c
    kbd.o : kbd.c defs.h command.h
        gcc -c kbd.c
    command.o : command.c defs.h command.h
        gcc -c command.c
    display.o : display.c defs.h buffer.h
        gcc -c display.c
    insert.o : insert.c defs.h buffer.h
        gcc -c insert.c
    search.o : search.c defs.h buffer.h
        gcc -c search.c
    files.o : files.c defs.h buffer.h command.h
        gcc -c files.c
    utils.o : utils.c defs.h
        cc -c utils.c
    clean :
        rm edit main.o kbd.o command.o display.o \
            insert.o search.o files.o utils.o
    
    在这个makefile中，目标文件（target）包含：执行文件edit和中间目标文件（ *.o ），依赖文件（prerequisites）就是冒号后面的那些 .c 文件和 .h 文件。
    每一个 .o 文件都有一组依赖文件，而这些 .o 文件又是执行文件 edit 的依赖文件。依赖关系的实质就是说明了目标文件是由哪些文件生成的，换言之，目标文件是哪些文件更新的。      
    于是在我们编程中，如果这个工程已被编译过了，当我们修改了其中一个源文件，比如 file.c ，那么根据我们的依赖性，我们的目标 file.o 会被重编译（也就是在这个依性关系后面所定义的命令），于是 file.o 的文件也是最新的啦，于是 file.o 的文件修改时间要比 edit 要新，所以 edit 也会被重新链接了（详见 edit 目标文件后定义的命令）。
    而如果我们改变了 command.h ，那么， kdb.o 、 command.o 和 files.o 都会被重编译，并且， edit 会被重链接。
    
2、makefile使用变量

    edit : main.o kbd.o command.o display.o \
            insert.o search.o files.o utils.o
        cc -o edit main.o kbd.o command.o display.o \
            insert.o search.o files.o utils.o
            
    我们可以看到 .o 文件的字符串被重复了两次，如果我们的工程需要加入一个新的 .o 文件，那么我们需要在两个地方加（应该是三个地方，还有一个地方在clean中）。
    当然，我们的makefile并不复杂，所以在两个地方加也不累，但如果makefile变得复杂，那么我们就有可能会忘掉一个需要加入的地方，而导致编译失败。所以，为了makefile的易维护，在makefile中我们可以使用变量。makefile的变量也就是一个字符串，理解成C语言中的宏可能会更好。          
    
    objects = main.o kbd.o command.o display.o \
         insert.o search.o files.o utils.o
         
于是，我们就可以很方便地在我们的makefile中以 $(objects) 的方式来使用这个变量了，于是我们的改良版makefile就变成下面这个样子：       

    objects = main.o kbd.o command.o display.o \
        insert.o search.o files.o utils.o
    
    edit : $(objects)
        cc -o edit $(objects)
    main.o : main.c defs.h
        cc -c main.c
    kbd.o : kbd.c defs.h command.h
        cc -c kbd.c
    command.o : command.c defs.h command.h
        cc -c command.c
    display.o : display.c defs.h buffer.h
        cc -c display.c
    insert.o : insert.c defs.h buffer.h
        cc -c insert.c
    search.o : search.c defs.h buffer.h
        cc -c search.c
    files.o : files.c defs.h buffer.h command.h
        cc -c files.c
    utils.o : utils.c defs.h
        cc -c utils.c
    clean :
        rm edit $(objects)
        
3、makefile文件名

    默认的情况下，make命令会在当前目录下按顺序找寻文件名为“GNUmakefile”、“makefile”、“Makefile”的文件，找到了解释这个文件。在这三个文件名中，最好使用“Makefile”这个文件名，因为，这个文件名第一个字符为大写，这样有一种显目的感觉。最好不要用“GNUmakefile”，这个文件是GNU的make识别的。
    有另外一些make只对全小写的“makefile”文件名敏感，但是基本上来说，大多数的make都支持“makefile”和“Makefile”这两种默认文件名。
    当然，你可以使用别的文件名来书写Makefile，比如：“Make.Linux”，“Make.Solaris”，“Make.AIX”等，如果要指定特定的Makefile，你可以使用make的 -f 和 --file 参数，如： make -f Make.Linux 或 make --file Make.AIX 。
    
4、引用其他的makefile

    在Makefile使用 include 关键字可以把别的Makefile包含进来，这很像C语言的 #include ，被包含的文件会原模原样的放在当前文件的包含位置。 include 的语法是：
    include <filename>            
    
    
二、参考链接
[更多makefile学习链接](https://seisman.github.io/how-to-write-makefile/conditionals.html)
    