#!/bin/bash

# ==============================
# INSTALLER BOT WA - ULTIMATE
# ==============================

while true; do
clear
echo "==== MAIN MENU ===="
echo "0. Install System"
echo "1. Install Bot"
echo "2. Run Bot"
echo "3. Hapus Session"
echo "4. Exit"
echo "5. AUTO INSTALL + RUN (PM2)"
echo ""
read -p "Pilih: " pilih

case $pilih in

0)
    pkg update -y
    pkg install bash -y
    pkg install nodejs-lts -y
    echo "[✓] System siap"
    read -p "Enter..."
    ;;

1)
    npm init -y
    npm install @whiskeysockets/baileys pino
    echo "[✓] Bot siap"
    read -p "Enter..."
    ;;

2)
    if [ ! -f "index.js" ]; then
        echo "index.js tidak ada!"
    else
        node index.js
    fi
    read -p "Enter..."
    ;;

3)
    rm -rf session
    echo "Session dihapus"
    read -p "Enter..."
    ;;

5)

    echo "[AUTO INSTALL MODE]"

    # SYSTEM
    pkg update -y
    pkg install nodejs-lts -y

    # BOT
    npm init -y
    npm install @whiskeysockets/baileys pino

    # PM2 INSTALL
    npm install -g pm2

    if [ ! -f "index.js" ]; then
        echo "[!] index.js tidak ditemukan!"
        exit 1
    fi

    # RUN WITH PM2
    pm2 start index.js --name "wa-bot"
    pm2 save

    echo "[✓] BOT BERJALAN DENGAN PM2"
    echo "Gunakan 'pm2 logs' untuk lihat log"
    echo "Gunakan 'pm2 restart wa-bot' untuk restart"

    read -p "Enter..."
    ;;

4)
    exit 0
    ;;

*)
    echo "Salah pilih!"
    sleep 1
    ;;

esac

done
