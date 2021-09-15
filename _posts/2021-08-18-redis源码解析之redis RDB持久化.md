---
layout: post
title:  "redis源码解析之redis RDB持久化"
date:   2021-08-18
desc: "redis 持久化 RDB"
keywords: "redis 持久化 RDB"
categories: [Database]
tags: [C/C++,redis,持久化]
icon: icon-html
---

对于rdb的文件的创建<br/>
有2个命令可以用于生成RDB文件，一个是save，一个是bgsave

save命令会阻塞Redis服务器进程，知道RDB文件创建完成为止，服务器期间不能处理任何的请求，其二rdb的持久化存储不具备实时性

    源码如下：
    void saveCommand(redisClient *c) {
        if (server.rdb_child_pid != -1) {
            addReplyError(c,"Background save already in progress");
            return;
        }
        if (rdbSave(server.rdb_filename) == REDIS_OK) {
            addReply(c,shared.ok);
        } else {
            addReply(c,shared.err);
        }
    }
    
    /* Save the DB on disk. Return REDIS_ERR on error, REDIS_OK on success. */
    int rdbSave(char *filename) {
        char tmpfile[256];
        FILE *fp;
        rio rdb;
        int error;
    
        snprintf(tmpfile,256,"temp-%d.rdb", (int) getpid());
        fp = fopen(tmpfile,IF_WIN32("wb","w"));
        if (!fp) {
            redisLog(REDIS_WARNING, "Failed opening .rdb for saving: %s",
                strerror(errno));
            return REDIS_ERR;
        }
    
        rioInitWithFile(&rdb,fp);
        if (rdbSaveRio(&rdb,&error) == REDIS_ERR) {
            errno = error;
            goto werr;
        }
    
        /* Make sure data will not remain on the OS's output buffers */
        if (fflush(fp) == EOF) goto werr;
        if (fsync(fileno(fp)) == -1) goto werr;
        if (fclose(fp) == EOF) goto werr;
    
        /* Use RENAME to make sure the DB file is changed atomically only
         * if the generate DB file is ok. */
        if (rename(tmpfile,filename) == -1) {
            redisLog(REDIS_WARNING,"Error moving temp DB file on the final destination: %s", strerror(errno));
            unlink(tmpfile);
            return REDIS_ERR;
        }
        redisLog(REDIS_NOTICE,"DB saved on disk");
        server.dirty = 0;
        server.lastsave = time(NULL);
        server.lastbgsave_status = REDIS_OK;
        return REDIS_OK;
    
    werr:
        redisLog(REDIS_WARNING,"Write error saving DB on disk: %s", strerror(errno));
        fclose(fp);
        unlink(tmpfile);
        return REDIS_ERR;
    }
    
而bgsave会创建一个子进程来执行生成RDB文件操作

    源码如下：
    void bgsaveCommand(redisClient *c) {
        if (server.rdb_child_pid != -1) {
            addReplyError(c,"Background save already in progress");
        } else if (server.aof_child_pid != -1) {
            addReplyError(c,"Can't BGSAVE while AOF log rewriting is in progress");
        } else if (rdbSaveBackground(server.rdb_filename) == REDIS_OK) {
            addReplyStatus(c,"Background saving started");
        } else {
            addReply(c,shared.err);
        }
    } 
    
    rdbSaveBackground方法间接调用了上面的rdbSave方法
    
    int rdbSaveBackground(char *filename) {
        pid_t childpid;
        PORT_LONGLONG start;
    
        if (server.rdb_child_pid != -1) return REDIS_ERR;
    
        server.dirty_before_bgsave = server.dirty;
        server.lastbgsave_try = time(NULL);
    
        start = ustime();
    #ifdef _WIN32
        childpid = BeginForkOperation_Rdb(filename, &server, sizeof(server), dictGetHashFunctionSeed());
    #else
        if ((childpid = fork()) == 0) {
            int retval;
    
            /* Child */
            closeListeningSockets(0);
            redisSetProcTitle("redis-rdb-bgsave");
            retval = rdbSave(filename);
            if (retval == REDIS_OK) {
                size_t private_dirty = zmalloc_get_private_dirty();
    
                if (private_dirty) {
                    redisLog(REDIS_NOTICE,
                        "RDB: %zu MB of memory used by copy-on-write",
                        private_dirty/(1024*1024));
                }
            }
            exitFromChild((retval == REDIS_OK) ? 0 : 1);
        } else {
    #endif
            /* Parent */
            server.stat_fork_time = ustime()-start;
            server.stat_fork_rate = (double) zmalloc_used_memory() * 1000000 / server.stat_fork_time / (1024*1024*1024); /* GB per second. */
            latencyAddSampleIfNeeded("fork",server.stat_fork_time/1000);
            if (childpid == -1) {
                server.lastbgsave_status = REDIS_ERR;
                redisLog(REDIS_WARNING,"Can't save in background: fork: %s",
                    strerror(errno));
                return REDIS_ERR;
            }
            redisLog(REDIS_NOTICE,"Background saving started by pid %d",childpid);
            server.rdb_save_time_start = time(NULL);
            server.rdb_child_pid = childpid;
            server.rdb_child_type = REDIS_RDB_CHILD_TYPE_DISK;
            updateDictResizePolicy();
            return REDIS_OK;
    #ifndef _WIN32
        }
    #endif
        return REDIS_OK; /* unreached */
    }
    
除了命令保存数据之外，Redis回自动间隔性保存<br/>

    举个例子，我们向服务器提供以下配置：
    save 900 1
    save 300 10
    save 60 10000
    
    只要满足3个条件，rdb保存会自动触发
    服务器在900秒之内，有1次数据修改
    服务器在300秒之内，有10次数据修改
    服务器在60秒之内，有10000次数据修改
    
    
    这些条件被保存在RedisServer中
    struct redisServer {
    
        ...
        
        //记录距离上一次成功执行save/bgsave之后，服务器对数据库进行了多少次修改
        long dirty
        
        //unix时间戳，记录上一次执行save成功的时间
        time_t lastsave;
        
        //记录保存条件的数组
        struct saveParam *saveParam;
        
        ...
    
    }
    
    struct saveParam {
    
        //秒数
        time_t seconds;
    
        //修改数
        int changes;
    
    }
    
对于轮询检查是否满足条件，和上一章的一样，在redis.c/serverCron方法中执行，由此可见Redis默认持久化是通过RDB实现  

    int serverCron(struct aeEventLoop *eventLoop, PORT_LONGLONG id, void *clientData) {
    
        .......
        
         /* If there is not a background saving/rewrite in progress check if
                 * we have to save/rewrite now */
         for (j = 0; j < server.saveparamslen; j++) {
            struct saveparam *sp = server.saveparams+j;
    
            /* Save if we reached the given amount of changes,
             * the given amount of seconds, and if the latest bgsave was
             * successful or if, in case of an error, at least
             * REDIS_BGSAVE_RETRY_DELAY seconds already elapsed. */
            if (server.dirty >= sp->changes &&
                server.unixtime-server.lastsave > sp->seconds &&
                (server.unixtime-server.lastbgsave_try >
                 REDIS_BGSAVE_RETRY_DELAY ||
                 server.lastbgsave_status == REDIS_OK))
            {
                redisLog(REDIS_NOTICE,"%d changes in %d seconds. Saving...",
                    sp->changes, (int)sp->seconds);
                rdbSaveBackground(server.rdb_filename);
                break;
            }
         }
    
    }  
    
    
关于rdb的文件结构：<br/>
<img src="{{ site.img_path }}/redis/rdb_struct.png" width="65%"> <br/>
Redis文件的最开头是REDIS部分，这个部分长度为5个字节，保存着"REDIS"五个字符，程序可以在载入文件的时候
，快速检查文件是否为rdb文件。从源码中我们也可以看出蛛丝马迹<br/>
<img src="{{ site.img_path }}/redis/rdb_struct-1.png" width="65%"> <br/>

    REDIS_RDB_VERSION 6
    可以看出当前db版本为0006
    
databases部分，一个rdb文件的databases部分可以保存任意多个非空数据库
    
    假设0号数据库和3号数据库非空，则结构如下：
    REDIS | db_version | database 0 | database 3 | EOF | check_sum    
                             |
               SELECT DB | db_number | key_value_pairs
                                              |
                            不带过期时间：type | key | value
                            带过期时间：EXPIREME_MS | ms | type | key | value  
               
    SELECT DB长度为1字节，当读入程序遇到这个值，它会知道接下来是一个数据库号码，db_number保存着数据库
    号码，根据号码的不同，长度可以是1字节，2字节或5字节，key_value_pairs保存了数据库中的所有键值对，
    如果有过期时间也会带过期时间 ,type为数据类型，可以解析value的类型  
    
    源码如下：
    for (j = 0; j < server.dbnum; j++) {
        redisDb *db = server.db+j;
        dict *d = db->dict;
        if (dictSize(d) == 0) continue;
        di = dictGetSafeIterator(d);
        if (!di) return REDIS_ERR;

        /* Write the SELECT DB opcode */
        if (rdbSaveType(rdb,REDIS_RDB_OPCODE_SELECTDB) == -1) goto werr;
        if (rdbSaveLen(rdb,j) == -1) goto werr;

        /* Iterate this DB writing every entry */
        while((de = dictNext(di)) != NULL) {
            sds keystr = dictGetKey(de);
            robj key, *o = dictGetVal(de);
            PORT_LONGLONG expire;

            initStaticStringObject(key,keystr);
            expire = getExpire(db,&key);
            if (rdbSaveKeyValuePair(rdb,&key,o,expire,now) == -1) goto werr;
        }
        dictReleaseIterator(di);
    }      
      
    
EOF长度为1字节，这个字段标识着RDB文件的结束<br/>
check_sum是一个8字节的无符号整数，保存着一个校验和，这个校验和是对前面4个部分的内容计算得出，服务器在载入rdb文件的时候，会做校验

    源码如下：
    /* EOF opcode */
    if (rdbSaveType(rdb,REDIS_RDB_OPCODE_EOF) == -1) goto werr;

    /* CRC64 checksum. It will be zero if checksum computation is disabled, the
     * loading code skips the check in this case. */
    cksum = rdb->cksum;
    memrev64ifbe(&cksum);
    if (rioWrite(rdb,&cksum,8) == 0) goto werr;    
    
<font color="red">(从源码中获取一些信息，需要注意的特殊情况,在bgSave执行过程中，客户端发送的save命令
会被服务器拒绝，然后aof的重写bgrewriteaof和bgsave也不能同时执行，因为这2个命令都是通过子进程去执行，出于
性能的考虑这不是一个好的选择)</font>