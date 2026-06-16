#!/bin/bash

ulimit -n 100000

export NODE_OPTIONS="--max-old-space-size=1024 --expose-gc"

SCRIPT="index.js"
clear

while true; do
  echo "🕒 [$(date +'%T')] Iniciando servidor..."
  
  node $NODE_OPTIONS $SCRIPT

  EXIT_CODE=$?
  echo "⚠️  El servidor se cerró con código: $EXIT_CODE"
  
  if [ $EXIT_CODE -eq 0 ]; then
    echo "🏁 Salida voluntaria. No se reinicia."
    exit 0
  fi
  
  echo "⏳ Reiniciando en 2 segundos..."
  sleep 2
done
