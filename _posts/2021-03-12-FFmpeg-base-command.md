---
layout: post
title:  "FFmpeg base command"
date:   2021-03-04
desc: "FFmpeg shell"
keywords: "FFmpeg base command"
categories: [HTML]
tags: [FFmpeg]
icon: icon-html
---

The command here is based on Windows, and Mac operations are similar.

Get devices

    ffmpeg -devices
    
    in windows:  D  dshow           DirectShow capture
    
                 D  gdigrab         GDI API Windows frame grabber
                 
                 D  lavfi           Libavfilter virtual input device
                 
                 E sdl,sdl2        SDL2 output device
                 
                 D  vfwcap          VfW video capture

Capture desktop screen (silent):
    
    windows: ffmpeg -f gdigrab -i desktop -r 30 fileName.mp4/.yuv/or other 
    
    -f: the input source
    -i desktop: Screen capture video
    -i: xxx : To capture audio


