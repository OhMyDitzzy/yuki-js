<div align="center">
  <img src="https://telegra.ph/file/0eae512de17b5267d3fef.jpg" alt="Yuki Banner" />
  <h1>Yuki Suou</h1>
  <p><strong>Yuki</strong> adalah script bot WhatsApp yang stabil dan cocok untuk penggunaan jangka panjang (long runtime). Biarkan Yuki bekerja di balik layar, sementara kamu mengatur dan mengembangkan script‑nya dengan mudah.</p>
</div>

> [!WARNING] 
> This documentation is written in Indonesian. Please use your browser's translation feature if necessary.


## Perkenalan

Yuki.js adalah script bot WhatsApp yang stabil, modular, dan mudah dikembangkan. Script ini berjalan di atas Node.js.

Yuki.js merupakan penerus (successor) dari project Yuki sebelumnya yang dibangun menggunakan Bun. Project lama tersebut kini sudah deprecated dan tidak lagi dikembangkan. Kamu masih bisa melihat source code‑nya di sini: 👉 https://github.com/OhMyDitzzy/Yuki

## Kenapa Yuki Sekarang Menggunakan Node.js?

Keputusan untuk berpindah dari Bun ke Node.js bukan tanpa alasan. Beberapa pertimbangan utama antara lain:

- Kompatibilitas Library
Yuki menggunakan library [Baileys](https://github.com/WhiskeySockets/Baileys) yang secara native memang dirancang untuk lingkungan Node.js. Meskipun masih bisa berjalan di Bun, Node.js memberikan kompatibilitas yang lebih stabil.

- Kematangan Ekosistem
Walaupun secara performa Bun dikenal sangat cepat (bahkan Yuki versi lama memiliki performa yang mengesankan), Node.js unggul dalam hal kematangan fitur, stabilitas API, dan dukungan ekosistem yang lebih luas.

- Stabilitas Jangka Panjang
Untuk bot WhatsApp yang diharapkan berjalan lama tanpa gangguan, Node.js saat ini menjadi pilihan yang lebih aman.

---
## Instalasi

Proses instalasi Yuki.js sedikit berbeda dibandingkan Yuki versi lama. Ikuti langkah‑langkah berikut dengan seksama.

1. Clone Repository

Klon repositori ini atau unduh sebagai file ZIP langsung dari GitHub. Pastikan git sudah terpasang di sistem kamu.

```bash
git clone https://github.com/OhMyDitzzy/yuki-js
```

Masuk ke direktori project:
```bash
cd yuki-js
```

---

### 2. Mengatur Konfigurasi

Di dalam project, kamu akan menemukan dua file contoh konfigurasi:
- env.example
- config/index.example.js

Kedua file ini perlu kamu sesuaikan sebelum menjalankan bot.

#### a. Konfigurasi Environment (env.example)
```
# Path database untuk auth state dan user
DB_PATH="/data/auth.db"
USER_DB_PATH="/data/user.db"

# Nomor WhatsApp yang akan digunakan sebagai bot
PAIRING_NUMBER="628512345"
```

Ubah nilai PAIRING_NUMBER dengan nomor WhatsApp yang akan dijadikan bot.

> [!WARNING] 
> Tidak disarankan mengubah variabel lain selain PAIRING_NUMBER, kecuali kamu benar‑benar memahami apa yang kamu lakukan (misalnya ingin mengkustomisasi lokasi database).


Setelah itu, ubah nama file env.example menjadi:
```
.env
```

---

#### b. Konfigurasi Bot (config/index.example.js)

```javascript
// This is an example file
// To use this file, rename it to index.js or index.ts

global.owner = [
  ['62851xxxx'],
  ['62851xxxx'],
  ['62851xxxx', 'DitzDev', 'contact@ditzdev.my.id', true]
] // Daftar owner bot

global.mods = ['62851xxxx'] // Moderator (wajib diisi)
global.nomorown = '62851xxxx' // Nomor utama owner

// API configuration
global.APIs = {
  PaxSenix: 'https://api.paxsenix.org'
}

global.APIKeys = {
  PaxSenixAPIKey: 'your_api_key' // Dapatkan API Key di https://api.paxsenix.org
}

global.thumb = 'https://files.catbox.moe/7n4axc.png'
global.sourceUrl = 'https://github.com/OhMyDitzzy/Yuki'

global.docthumb = 'https://files.catbox.moe/gfwn8c.png'
global.multiplier = 100000
```

Di file ini kamu bisa:
- Menentukan Owner bot
- Menentukan Moderator (Mods)
- Mengatur API dan API Key
- Mengkustomisasi thumbnail dan informasi lainnya

Setelah selesai, ubah nama file index.example.js menjadi:
```
index.js
```

### 3. Instalasi Dependensi & Menjalankan Bot

Pastikan Node.js sudah terinstal. Jika belum, unduh dari sini: 👉 https://nodejs.org

Node.js sudah menyertakan NPM (Node Package Manager) secara default.

Install semua dependensi:
```bash
npm install
```

Jalankan bot:
```bash
npm start
```

### Pairing & Troubleshooting

Jika session belum terdeteksi, Yuki akan otomatis meminta proses pairing menggunakan nomor WhatsApp yang sudah kamu set di PAIRING_NUMBER.

Jika terjadi error saat pairing:

1. Hapus file auth.db
2. Hapus juga file pendukung seperti .shm dan .wal
3. Jalankan ulang bot

### Selesai 🎉

Jika semua langkah dilakukan dengan benar, bot Yuki seharusnya sudah berhasil terkoneksi dan siap digunakan.

## Dokumentasi 
TODO.