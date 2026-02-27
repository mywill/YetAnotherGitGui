#!/bin/bash
set -e

apt-get update && apt-get install -y --no-install-recommends \
  build-essential \
  curl \
  pkg-config \
  libssl-dev \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf \
  libglib2.0-dev \
  libnss3 \
  libnspr4 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libdbus-1-3 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libasound2 \
  libevent-2.1-7 \
  libgstreamer-plugins-bad1.0-0 \
  libx264-dev \
  && apt-get clean && rm -rf /var/lib/apt/lists/*
