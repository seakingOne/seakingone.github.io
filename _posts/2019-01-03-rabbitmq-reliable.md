---
layout: post
title:  "RabbitMQ messaging reliability delivery solution"
date:   2019-01-03
desc: "RabbitMQ messaging reliability delivery solution"
keywords: "RabbitMQ,reliability"
categories: [HTML]
tags: [RabbitMQ]
icon: icon-html
---

When it comes to the reliable delivery of messages, it is inevitable that they will be encountered in practical work. For example, some core businesses need to ensure that messages are not lost. Next, let's look at a flow chart of reliable delivery to illustrate the concept of reliable delivery:

<img src="{{ site.img_path }}/rabbitmq/rabbit.png" width="75%">

Step 1: First store the message information (business data) in the database, and then store the message record in a message log table (or a message log table from another homologous database).

Step 2: Send a message to the MQ Broker node (confirm is sent and an asynchronous result is returned)

Step 3 and 4: The producer side accepts the confirmed message result returned by the MQ Broker node, and then updates the message status in the message log table.For example, the default Status = 0, after receiving a message to confirm the success, update to 1!

Step 5: However, in the process of message confirmation, the echo message may fail or fail due to network flash, MQ Broker side exception, etc.At this time, the sender (producer) to the message reliability delivery, to ensure that the message is not lost, 100% of the delivery success!(there is a limit case is broken, the Broker to return to the success of the confirmation message, but the production end due to network failure received, this time to delivery may lead to duplication, need consumers to do idempotent processing) so we need to have a regular tasks, (such as pull every 5 minutes once somewhere in the middle of the message, of course, this news can set a timeout, such as more than 1 minute Status = 0, also explains 1 minute within the time window, our message has not been confirmed, then will be timed tasks pull out)

Step 6: Next, we repost the message in the intermediate state to retry send and continue to send the message to MQ. Of course, there may also be a variety of reasons leading to the failure of sending

Step 7: We can set the maximum number of attempts, such as 3 posts, and still fail, then we can set the final Status to Status = 2, and finally leave the problem to be solved manually (or dump the message to the failure table).