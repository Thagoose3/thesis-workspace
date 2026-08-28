@echo off
title ThesisMind - Thesis Reading & Research Workspace
echo Starting ThesisMind Web Server...
cd /d "%~dp0"
python serve.py
pause
