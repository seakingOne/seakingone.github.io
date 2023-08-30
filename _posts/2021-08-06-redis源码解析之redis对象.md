---
layout: post
title:  "redis源码解析之redis对象"
date:   2021-08-06
desc: "redis redisObject"
keywords: "redis redisObject"
categories: [Database]
tags: [C/C++,redis,内存]
icon: icon-html
---

## 注意：所有源码分析基于redis3.0

Redis中有基本的数据结构，如sds,双端队列,双端链表,字典,压缩列表,集合等等。

Redis中并没有直接使用这些数据结构来实现键值对数据库，而是基于这些数据结构创建了一个对象系统，这个系统中
包含字符串对象，列表对象，哈希对象，集合对象和有序集合对象。

Redis中每个对象都由一个RedisObject结构表示，该结构中和保存数据有关的三个熟悉为：
    
```sh
typedef struct redisObject {

    // 类型
    unsigned type:4;
    
    // 编码
    unsinged encoding:4;
    
    // 指向底层实现数据结构的指针
    void *ptr;

}
```    
    
    更加详细的类型定义如下
    /* Object types */
    #define REDIS_STRING 0
    #define REDIS_LIST 1
    #define REDIS_SET 2
    #define REDIS_ZSET 3
    #define REDIS_HASH 4
    #define REDIS_HASH_ZIPMAP 9
    #define REDIS_LIST_ZIPLIST 10
    #define REDIS_SET_INTSET 11
    #define REDIS_ZSET_ZIPLIST 12
    #define REDIS_HASH_ZIPLIST 13
    
    #define REDIS_ENCODING_RAW 0     简单动态字符串
    #define REDIS_ENCODING_INT 1     整数
    #define REDIS_ENCODING_HT 2      字典
    #define REDIS_ENCODING_ZIPMAP 3  /* Encoded as zipmap */
    #define REDIS_ENCODING_LINKEDLIST 4 双端链表
    #define REDIS_ENCODING_ZIPLIST 5 压缩列表
    #define REDIS_ENCODING_INTSET 6  整数集合
    #define REDIS_ENCODING_SKIPLIST 7  跳跃表和集合
    #define REDIS_ENCODING_EMBSTR 8  embstr编码的简单动态字符串（sds）   
    
对于字符串对象编码可以是int,raw,embstr <br/>
1 如果一个字符串对象保存的是整数值，并且这个整数值可以用long表示,那么字符串对象会将整数值保存在字符串对象
结构中的ptr属性里面（void* 转换为long），并将字符串编码设置为int

    假设我们执行 set number 10086
    保存结构如下：

    -----------redisObject-----------
    type   |  encoding  |  ptr | ....
                            |    
                          10086
        
2 如果字符串对象保存的是一个字符串值，并且这个字符串值长度>32字节，那么字符串对象会使用raw来编码，即sds

    假设我们执行 set str "11212121....."
    保存结构如下：
    
    -----------redisObject-----------
    type   |  encoding  |  ptr | ....
                            |
                ---------sdshdr--------
                free  |  len  |  buf
                  |       |       |
                  0      37     11212121.....

    那么一起看下sds的结构

```sh

struct sdshdr {

    // 记录buf数组中的已使用的字节数量
    int len;

    // 记录buf数组中没有使用的字节数量
    int free;

    // 字节数组，用于保存字符串
    char buf[];

}

```                  

3 如果字符串对象保存的是一个字符串值，并且这个字符串值长度<=32字节，那么字符串对象会使用embstr来编码<br/>
&emsp;3.1 embstr编码是专门用于保存短字符串的一种编码优化方式，这种编码与raw编码一样，都是用sds结构来表示字符串
对象，但raw会调用2次内存分配函数来创建RedisObject和sds结构，而embstr是分配一次内存即可

对于其他数据结构涞水类型情况，都是通过ptr指向底层数据结构

其二，介绍一下RedisObject内存回收

```sh 
typedef struct redisObject {
        
    // 引用计算 
    int refcount;
        
}
```
     
     对象的引用计数会随着对象的使用状态发生变化：
     1.1 创建新对象，引用计数为1
     1.2 被其他程序引用+1 (incrRefCount)
     1.3 程序不再使用-1   (decrRefCount)
     1.4 引用计数变为0，对象内存被释放
     
除了用于实现引用计数之外，对象的引用计数还带有共享对象的作用，当然一般只针对于数字

其三，关于lru属性

```sh
typedef struct redisObject {
            
    // 改属性记录了对象最后一次被访问的时间     
    unsigned lru:24
            
}
```    
    
    OBJECT IDLETIME key命令可以打印出key的空转时长，通过当前时间减去lru时间得出的
    除了这个作用之外，如果服务器打开了maxmemory选项，并且服务器回收内存算法为volatile-lru或者allkeys-lru，那么空转时间较长的
    key会被优先释放。     

         
     
     
    
    
    
    