#!/usr/bin/env bash
set -e
git status
git add .
git commit -m "fix" || echo "Нечего коммитить — продолжаем"
git push