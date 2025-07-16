# 🌐 PROMPTR Multiplayer - Network Access Guide

## ✅ Your Server is Running!

**Your computer (host):** http://localhost:4000
**Other devices on your network:** http://192.168.1.13:4000

---

## 📱 How Other Devices Can Join:

### 1. **Same WiFi Network Required**
- Make sure all devices are connected to the **same WiFi network**
- Your computer and the other devices must be on the same local network

### 2. **Access URL for Other Devices:**
```
http://192.168.1.13:4000
```

### 3. **Share Game Rooms:**
When you create a room, share this link format:
```
http://192.168.1.13:4000/game/[ROOM-CODE]
```

---

## 🔧 Troubleshooting:

### If other devices can't connect:

1. **Check Windows Firewall:**
   - Go to Windows Settings > Privacy & Security > Windows Security
   - Click "Firewall & network protection"
   - Click "Allow an app through firewall"
   - Look for Node.js or your app, or add it manually

2. **Alternative Firewall Command (Run as Administrator):**
   ```cmd
   netsh advfirewall firewall add rule name="PROMPTR Game Port 4000" dir=in action=allow protocol=TCP localport=4000
   ```

3. **Check Network Discovery:**
   - Make sure "Network discovery" is turned on in Windows
   - Control Panel > Network and Sharing Center > Change advanced sharing settings

4. **Router Settings:**
   - Some routers block device-to-device communication
   - Look for "AP Isolation" or "Client Isolation" settings and disable them

---

## 📋 Quick Test:

1. **On your computer:** Go to http://localhost:4000
2. **On another device:** Go to http://192.168.1.13:4000
3. **Create a room** on one device
4. **Join the room** from the other device using the room code

---

## 🎮 Game Instructions:

1. One person creates a room (becomes host)
2. Share the room code with friends
3. Friends join using the same network IP
4. Host starts the game when everyone is ready
5. Compete in 5 rounds of AI image generation!

**Have fun with your multiplayer PROMPTR game!** 🎉
