# ❄️ Yuki Botz - Asisten Otomatis WhatsApp

**Yuki Botz** adalah program komputer (bot) yang bisa berjalan otomatis di WhatsApp Anda. Bot ini bisa membantu Anda membuat stiker, mengunduh video, menjaga grup dari orang asing, hingga bermain game ekonomi bersama teman-teman.

---

## ✨ Apa saja yang bisa dilakukan Yuki?

*   **🎨 Pembuat Stiker Otomatis:** Kirim gambar atau video, dan Yuki akan mengubahnya menjadi stiker dalam hitungan detik.
*   **🛡️ Penjaga Grup (Security):** Otomatis mengeluarkan orang yang mengirim link iklan atau bot lain yang tidak dikenal.
*   **🎮 Game & Ekonomi:** Pengguna bisa mengumpulkan uang virtual (XP, Money, Gold) untuk naik level dan bersaing dengan pengguna lain.
*   **📥 Downloader:** Bisa mengunduh video dari media sosial (fitur tergantung plugin yang tersedia).
*   **🚫 Anti-Telepon:** Bot akan otomatis menolak telepon dan memblokir orang yang mencoba menelepon nomor bot agar tidak mengganggu.

---

## 🛠️ Persiapan Sebelum Memulai

Agar Yuki bisa berjalan, komputer atau VPS Anda harus memiliki 3 aplikasi ini:

1.  **Node.js (Versi 20 ke atas):** Ini adalah "mesin" utama untuk menjalankan kode bot. [Download di sini](https://nodejs.org/).
2.  **FFmpeg:** Aplikasi ini wajib ada agar bot bisa membuat stiker dan memproses audio/video.
3.  **Git:** Digunakan untuk mengambil kode bot ini dari internet.

---

## 🚀 Langkah-Langkah Instalasi (Untuk Pemula)

Ikuti langkah-langkah di bawah ini secara berurutan:

### 1. Ambil Kode Bot
Buka Terminal (atau CMD), lalu ketik:
```bash
git clone https://github.com/OhMyDitzzy/yuki-js.git
cd yuki-js
```

### 2. Instal Bahan-Bahan
Ketik perintah ini untuk mendownload semua pustaka yang dibutuhkan bot:
```bash
npm install
```

### 3. Pengaturan Nomor Owner (PENTING!)
Agar Anda menjadi "Tuan" dari bot ini dan bisa mengatur segalanya:
1.  Masuk ke folder `config`, lalu cari file bernama `index.example.js`.
2.  Ubah nama file tersebut menjadi `index.js`.
3.  Buka file `index.js` tersebut menggunakan Notepad atau VS Code.
4.  Cari bagian `global.owner` dan ganti nomor di dalamnya dengan nomor WhatsApp Anda (Gunakan format 62xxx). Contoh: `['6285123456789']`.

### 4. Pengaturan Identitas Bot
1.  Cari file bernama `.env.example` di folder utama.
2.  Ubah namanya menjadi `.env`.
3.  Buka file tersebut dan isi `PAIRING_NUMBER` dengan nomor yang akan dijadikan bot.

---

## 🚦 Cara Menjalankan Bot

Setelah semua pengaturan selesai, kembali ke Terminal/CMD dan ketik:
```bash
npm start
```

### Cara Menyambungkan ke WhatsApp:
1.  Setelah mengetik `npm start`, terminal akan menampilkan **8 digit kode pairing** (Contoh: `ABC1-DEF2`).
2.  Buka WhatsApp di HP Anda.
3.  Klik **Titik Tiga (Pojok Kanan Atas)** > **Perangkat Tertaut** > **Tautkan Perangkat**.
4.  Pilih **Tautkan dengan nomor telepon saja**.
5.  Masukkan 8 digit kode yang muncul di terminal tadi.
6.  Selesai! Bot sekarang sudah aktif.

---

## 📂 Mengenal Folder Yuki (Untuk Awam)

*   **`plugins/`**: Tempat semua "kepintaran" bot berada. Jika Anda ingin menambah fitur baru, di sinilah tempatnya.
*   **`data/`**: Tempat bot menyimpan ingatan, seperti siapa saja yang punya banyak uang atau siapa yang sedang di-banned.
*   **`tmp/`**: Folder sampah sementara untuk memproses foto atau video sebelum dikirim.

---

## ❓ Tanya Jawab (FAQ)

**Q: Kenapa bot tidak bisa bikin stiker?**
A: Pastikan **FFmpeg** sudah terinstal di komputer Anda dengan benar.

**Q: Bagaimana cara mematikan bot?**
A: Tekan tombol `Ctrl + C` secara bersamaan di Terminal/CMD Anda.

**Q: Apakah data saya aman?**
A: Ya, semua data disimpan di komputer Anda sendiri dalam file database SQLite di folder `data`.

---

**Dibuat dengan ❤️ oleh [Ditzzy](https://github.com/OhMyDitzzy)**
