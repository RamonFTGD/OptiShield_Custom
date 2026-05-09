#!/bin/bash

ulimit -n 100000
export UV_THREADPOOL_SIZE=6

SCRIPT="index.js"
clear

while true; do
  echo "🕒 [$(date +'%T')] Iniciando servidor..."
  
  node --max-old-space-size=18432 \
       --expose-gc \
       $SCRIPT

  EXIT_CODE=$?
  echo "⚠️  El servidor se cerró con código: $EXIT_CODE"
  echo "⏳ Reiniciando en 2 segundos..."
  sleep 2
done
