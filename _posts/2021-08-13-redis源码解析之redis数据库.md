---
layout: post
title:  "redis源码解析之redis数据库"
date:   2021-08-13
desc: "redis redisDb"
keywords: "redis redisDb"
categories: [Article]
tags: [C/C++,redis,内存]
icon: icon-html
---

Redis服务器将所有数据库都保存在服务器状态redis.h/redisServer结构的db数组中，
db数组的每个项都是一个redis.h/redisDb结构，每个redisDb结构代表一个数据库：<br/>
<img src="{{ site.img_path }}/redis/redisdb.jpg" width="75%">   

在初始化服务器时，程序会根据服务器状态的dbnum属性来确定创建多少个数据库：

    struct redisServer {
    
        ....
        
        int dbnum;                      /* Total number of configured DBs */
        
        ....
    
    }       

dbnum属性的值有服务器配置的database决定 ，默认情况下，为16，所以Redis默认会创建16个数据库
    
    typedef struct redisDb {
        dict *dict;                 /* The keyspace for this DB */
        dict *expires;              /* Timeout of keys with a timeout set */
        dict *blocking_keys;        /* Keys with clients waiting for data (BLPOP) */
        dict *ready_keys;           /* Blocked keys that received a PUSH */
        dict *watched_keys;         /* WATCHED keys for MULTI/EXEC CAS */
        struct evictionPoolEntry *eviction_pool;    /* Eviction pool of keys */
        int id;                     /* Database ID */
        long long avg_ttl;          /* Average TTL, just for stats */
    } redisDb;
    
    
    结构如下：
     -----
    |redis|    
     -----
    |.....|
     -----
    | db  | -> db[0] | db[1] | ... | db[15]
     -----
     
在服务器内部，客户端状态redisClient结构的db属性记录了客户端当前的目标数据库，这个属性是指向redisDb结构的指针

    struct redisClient {
    
        //记录客户端当前正在使用的数据库
        redisDb *db;
    
    }     
    
    这也正是select 切换数据库的原理
    
数据库键空间，在上面redisDb结构中dict字典保存了数据库中的所有键值对<br/>
举个例子：

    set message "hello world"
    
那么在数据结构中表示为:<br/>   
<img src="{{ site.img_path }}/redis/redisDb_dict.jpg" width="75%">

添加新的键值对到数据库，实际上也就是将键值对添加到dict指针里面去

对于键的生存时间或过期时间<br/>
通过expire或者pexpire命令，客户端可以以秒或者毫秒精度为数据中的某个键设置生存时间

    set key value
    expire key 5
    
    // 表示5秒之后失效
    // redisDb中正好保存了过期时间，字段为expires

结构图如下：<br/>
<img src="{{ site.img_path }}/redis/redisDb_expire.jpg" width="75%">

对于过期键的判定，我们下次再讨论 ☺  
       
    
    
    