FROM ubuntu:14.04
MAINTAINER Benedikt Lang <mail@blang.io>
ENV DEBIAN_FRONTEND noninteractive

RUN apt-get update -q
RUN apt-get install -qy texlive-full
RUN apt-get install -qy python-pygments
RUN apt-get install -qy gnuplot

WORKDIR /download
