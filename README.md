# 🍇 PiDash - Dashboard Node.js Ultra-Léger pour Raspberry Pi

**PiDash** est une application web Node.js ultra-réactive, moderne et extrêmement légère designée pour fonctionner sur tout modèle de Raspberry Pi (Raspberry Pi Zero, 3, 4, 5, etc.).

Elle consomme moins de **25 Mo de RAM** et ne nécessite aucun outil de build lourd (React, Next, Vite). Il suffit de la `pull` et de lancer `npm start`.

---

## ⚡ Fonctionnalités

- 📊 **Monitoring en temps réel** : Utilisation CPU (%), Température SOC (°C via `vcgencmd` / Linux thermal zone), RAM (Mo utilisés/libres), Espace Disque MicroSD/SSD, Temps d'activité (Uptime) & Load average.
- 📈 **Graphique de performances en direct** : Graphique Canvas ultra-fluide rafraîchi toutes les 3 secondes sans alourdir le processeur.
- 🚀 **Portail de services & raccourcis** : Lanceur d'applications avec icônes (Pi-hole, Home Assistant, Portainer, Plex, Samba, etc.) entièrement personnalisable directement depuis le navigateur.
- 📝 **Pense-bête & Bloc-notes** : Zone de prise de notes persistante avec sauvegarde automatique (parfait pour garder ses IPs, mémos ou commandes SSH).
- 🎨 **Design Dark Glassmorphism** : Interface sombre haute définition, responsive sur PC, tablette et smartphone.

---

## 📥 Installation sur le Raspberry Pi depuis le terminal

### 1. Cloner ou récupérer le projet

Depuis le terminal de votre Raspberry Pi (en SSH ou direct) :

```bash
# Cloner le dépôt Git sur votre Raspberry Pi
git clone <URL_DE_VOTRE_DEPOT_GIT> pirasp

# Accéder au dossier
cd pirasp
```

> **Note :** Si vous avez déjà le projet et souhaitez récupérer les dernières mises à jour :
> ```bash
> git pull
> ```

---

### 2. Installer les dépendances et démarrer

```bash
# Installation des dépendances (Express & Cors uniquement, ~3 secondes)
npm install

# Démarrer le serveur
npm start
```

Le serveur affichera :
```text
====================================================
🚀 PiDash - Serveur Raspberry Pi actif !
📡 URL Locale  : http://localhost:3000
🌐 URL Réseau  : http://192.168.x.x:3000
====================================================
```

Vous pouvez maintenant ouvrir `http://<IP_DE_VOTRE_RASPBERRY_PI>:3000` depuis n'importe quel appareil connecté à votre réseau Wi-Fi / LAN !

---

## 🔄 Exécution en arrière-plan au démarrage du Raspberry Pi

### Option A : Avec PM2 (Recommandé)

```bash
# Installer PM2 globalement
sudo npm install -g pm2

# Lancer le serveur avec PM2
pm2 start server.js --name "pidash"

# Activer le lancement automatique au démarrage
pm2 startup
pm2 save
```

### Option B : Avec un service systemd

Créer le fichier `/etc/systemd/system/pidash.service` :

```ini
[Unit]
Description=PiDash Raspberry Pi Dashboard
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/pirasp
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Puis activer le service :
```bash
sudo systemctl daemon-reload
sudo systemctl enable pidash
sudo systemctl start pidash
```

---

## 🛠️ Structure du Projet

```text
pirasp/
├── server.js          # Serveur Express & API de mesure des ressources système
├── package.json       # Dépendances légères (Express + Cors)
├── data/
│   └── config.json    # Stockage des raccourcis et notes personnalisés
└── public/
    ├── index.html     # Structure HTML5 sémantique
    ├── css/
    │   └── style.css  # Design system Glassmorphism Dark Mode
    └── js/
        └── app.js     # Logique client, graphique Canvas & requêtes API
```

---

## 📄 Licence
Projet open-source sous licence **MIT**.
# pirasp
