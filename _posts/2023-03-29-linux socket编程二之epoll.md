---
layout: post
title:  "linux socket编程二之epoll"
date:   2023-03-29
desc: "Linux socket epoll"
keywords: "linux socket epoll"
categories: [Linux]
tags: [Linux]
icon: icon-html
---

## epoll

>epoll是对于传统socket编程的一种优化，由内核维护一套结构，存储所有的client fd, 如果有数据到达，用户态订阅事件，一旦有事件到达，内核监听后返回对应有事件的fd，用户态做相应的处理。
>对于epoll的内核结构，epoll_create会创建一个efd, 作为内核红黑树的根节点，然后上树lfd，cfd，当有事件触发的时候，返回有事件的fd（链表结构）

基本demo如下：
```sh
#include <sys/epoll.h>
Example for suggested usage
While the usage of epoll when employed as a level-triggered interface does have  the  same  semantics  as  poll(2),  the  edge-triggered  usage
requires  more  clarification  to  avoid stalls in the application event loop.  In this example, listener is a nonblocking socket on which lis‐
ten(2) has been called.  The function do_use_fd() uses the new ready file descriptor until EAGAIN is returned by either  read(2)  or  write(2).
An  event-driven  state  machine  application  should,  after  having  received  EAGAIN,  record  its current state so that at the next call to
do_use_fd() it will continue to read(2) or write(2) from where it stopped before.

#define MAX_EVENTS 10
struct epoll_event ev, events[MAX_EVENTS];
int listen_sock, conn_sock, nfds, epollfd;

/* Code to set up listening socket, 'listen_sock',
    (socket(), bind(), listen()) omitted */

epollfd = epoll_create1(0);
if (epollfd == -1) {
    perror("epoll_create1");
    exit(EXIT_FAILURE);
}

ev.events = EPOLLIN;
ev.data.fd = listen_sock;
if (epoll_ctl(epollfd, EPOLL_CTL_ADD, listen_sock, &ev) == -1) {
    perror("epoll_ctl: listen_sock");
    exit(EXIT_FAILURE);
}
for (;;) {
    nfds = epoll_wait(epollfd, events, MAX_EVENTS, -1);
    if (nfds == -1) {
        perror("epoll_wait");
        exit(EXIT_FAILURE);
    }

    for (n = 0; n < nfds; ++n) {
        if (events[n].data.fd == listen_sock) {
            conn_sock = accept(listen_sock,
                                (struct sockaddr *) &addr, &addrlen);
            if (conn_sock == -1) {
                perror("accept");
                exit(EXIT_FAILURE);
            }
            setnonblocking(conn_sock);
            ev.events = EPOLLIN | EPOLLET;
            ev.data.fd = conn_sock;
            if (epoll_ctl(epollfd, EPOLL_CTL_ADD, conn_sock,
                        &ev) == -1) {
                perror("epoll_ctl: conn_sock");
                exit(EXIT_FAILURE);
            }
        } else {
            do_use_fd(events[n].data.fd);
        }
    }
}

When used as an edge-triggered interface, for performance reasons, it is possible to  add  the  file  descriptor  inside  the  epoll  interface
(EPOLL_CTL_ADD)  once  by  specifying (EPOLLIN|EPOLLOUT).  This allows you to avoid continuously switching between EPOLLIN and EPOLLOUT calling
epoll_ctl(2) with EPOLL_CTL_MOD.

```

通过上面的demo我们可以分析一下基本的API:
```sh

#epoll_create()  creates  a  new  epoll(7)  instance.  Since Linux 2.6.8, the size argument is ignored, but must be greater 
# than  zero; see NOTES below.
# 创建文件文件句柄，类似socket的创建lfd
int epoll_create(int size); 

#创建lfd之后，目的是为了接受来自客户端的请求，所以上树，事件为read事件
int epoll_ctl(int epfd, int op, int fd, struct epoll_event *event);
epfd:上个api创建的fd
op:EPOLL_CTL_ADD表示当前添加新的节点
fd:第一次这个添加的为lfd，一般来说cfd设置为非阻塞，来更快的接受请求
event:
typedef union epoll_data {
    void        *ptr;  
    int          fd;  /* 当前的fd，lfd或者cfd */
    uint32_t     u32;
    uint64_t     u64;
} epoll_data_t;

struct epoll_event {
    uint32_t     events;      /* Epoll events */
    epoll_data_t data;        /* User data variable */
};


#等待有处理的事件返回
int epoll_wait(int epfd, struct epoll_event *events,
                      int maxevents, int timeout);
events为传出参数，通过他来判断是读还是写事件

```

附上完整的epoll_server代码：
```sh



```