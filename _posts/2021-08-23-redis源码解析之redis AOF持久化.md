---
layout: post
title:  "redis源码解析之redis AOF持久化"
date:   2021-08-23
desc: "redis 持久化 AOF"
keywords: "redis 持久化 AOF"
categories: [Article]
tags: [C/C++,redis,持久化]
icon: icon-html
---

AOF是Redis另外一种持久化方式，是通过保存Redis服务器所执行的写命令来记录数据库状态的<br/>

    比如：
    set msg "hello"
    
    对于上面执行的写命令来说，AOF文件内容为：
    2\r\n$6\r\nSELECT\r\n$1\r\n0\r\n
    3\r\n$3\r\nSET\r\n$3\r\nmsg\r\n$5\r\nhello\r\n
    
AOF持久化功能处于打开状态时，服务器在执行完之后，会以协议格式将被执行的写命令追加到服务器状态的aof_buf
缓冲区的末尾

    struct redisServer {
    
        // aof缓冲区
        sds aof_buf;
    
    }    
    
    /* AOF postponed flush: Try at every cron cycle if the slow fsync
         * completed. */
    if (server.aof_flush_postponed_start) flushAppendOnlyFile(0);
    
    /* AOF write errors: in this case we have a buffer to flush as well and
         * clear the AOF error in case of success to make the DB writable again,
         * however to try every second is enough in case of 'hz' is set to
         * an higher frequency. */
    run_with_period(1000) {
        if (server.aof_last_write_status == REDIS_ERR)
            flushAppendOnlyFile(0);
    }
    
flushAppendOnlyFile的函数行为由服务器所配置appendfsync选项的值来决定<br/>
always,将aof_buf缓冲区的所有内容写入并同步到AOF文件中;<br/>
everysec,将aof_buf缓冲区的所有内容写入到AOF文件，如果上次同步的时候距离现在一秒钟，那么再次对AOF文件进行同步，这个操作由一个线程掌控;<br/>
no,将aof_buf缓冲区的所有内容写到AOF文件中，但并不对AOF文件进行同步，何时同步由操作系统决定。<br/>

    #define REDIS_BIO_AOF_FSYNC     1 /* Deferred AOF fsync. */
    
    void flushAppendOnlyFile(int force) {
        ssize_t nwritten;
        int sync_in_progress = 0;
        mstime_t latency;
    
        if (sdslen(server.aof_buf) == 0) return;
    
        // 每秒进行同步
        if (server.aof_fsync == AOF_FSYNC_EVERYSEC)
            sync_in_progress = bioPendingJobsOfType(REDIS_BIO_AOF_FSYNC) != 0;
            
    }
    
     /* Perform the fsync if needed. */
    if (server.aof_fsync == AOF_FSYNC_ALWAYS) {
        /* aof_fsync is defined as fdatasync() for Linux in order to avoid
         * flushing metadata. */
        latencyStartMonitor(latency);
        aof_fsync(server.aof_fd); /* Let's try to get this data on the disk */
        latencyEndMonitor(latency);
        latencyAddSampleIfNeeded("aof-fsync-always",latency);
        server.aof_last_fsync = server.unixtime;
    } else if ((server.aof_fsync == AOF_FSYNC_EVERYSEC &&
                server.unixtime > server.aof_last_fsync)) {
        if (!sync_in_progress) aof_background_fsync(server.aof_fd);
        server.aof_last_fsync = server.unixtime;
    }  
    
AOF文件的载入与数据还原<br/>
因为AOF文件里面包含了重建数据库状态所需的所有写命令，所以服务器只要读入并重新执行一遍AOF文件里面保存的写命令，源码在redis.c/initServer方法<br/>
Redis读取AOF文件并还原数据库状态的详细步骤如下：<br/>
<img src="{{ site.img_path }}/redis/aof_process.png" width="65%"> <br/>    
    
    一般来说，会优先加载AOF文件：
    /* Open the AOF file if needed. */
        if (server.aof_state == REDIS_AOF_ON) {
    #ifdef _WIN32
            server.aof_fd = open(server.aof_filename,
                                   O_WRONLY|O_APPEND|O_CREAT|_O_BINARY,_S_IREAD|_S_IWRITE);
    #else
            server.aof_fd = open(server.aof_filename,
                                   O_WRONLY|O_APPEND|O_CREAT,0644);
    #endif
            if (server.aof_fd == -1) {
                redisLog(REDIS_WARNING, "Can't open the append-only file: %s",
                    strerror(errno));
                exit(1);
            }
        }
        
    /* Function called at startup to load RDB or AOF file in memory. */
    void loadDataFromDisk(void) {
        PORT_LONGLONG start = ustime();
        if (server.aof_state == REDIS_AOF_ON) {
            //loadAppendOnlyFile为AOF加载持久化文件
            if (loadAppendOnlyFile(server.aof_filename) == REDIS_OK)
                redisLog(REDIS_NOTICE,"DB loaded from append only file: %.3f seconds",(float)(ustime()-start)/1000000);
        } else {
            if (rdbLoad(server.rdb_filename) == REDIS_OK) {
                redisLog(REDIS_NOTICE,"DB loaded from disk: %.3f seconds",
                    (float)(ustime()-start)/1000000);
            } else if (errno != ENOENT) {
                redisLog(REDIS_WARNING,"Fatal error loading the DB: %s. Exiting.",strerror(errno));
                exit(1);
            }
        }
    }  
    
    
    int loadAppendOnlyFile(char *filename) {
    
        struct redisClient *fakeClient;
        
        .....
        
        //创建一个Redis伪客户端   
        fakeClient = createFakeClient();
    }      
    
    
    /* In Redis commands are always executed in the context of a client, so in
     * order to load the append only file we need to create a fake client. */
    struct redisClient *createFakeClient(void) {
        struct redisClient *c = zmalloc(sizeof(*c));
    
        selectDb(c,0);
        c->fd = -1;   //创建伪客户端，所有文件句柄为-1
        c->name = NULL;
        c->querybuf = sdsempty();
        c->querybuf_peak = 0;
        c->argc = 0;
        c->argv = NULL;
        c->bufpos = 0;
        c->flags = 0;
        c->btype = REDIS_BLOCKED_NONE;
        /* We set the fake client as a slave waiting for the synchronization
         * so that Redis will not try to send replies to this client. */
        c->replstate = REDIS_REPL_WAIT_BGSAVE_START;
        c->reply = listCreate();
        c->reply_bytes = 0;
        c->obuf_soft_limit_reached_time = 0;
        c->watched_keys = listCreate();
        c->peerid = NULL;
        listSetFreeMethod(c->reply,decrRefCountVoid);
        listSetDupMethod(c->reply,dupClientReplyValue);
        initClientMultiState(c);
        return c;
    }