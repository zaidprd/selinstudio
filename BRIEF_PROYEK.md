# Brief Proyek: Selin Studio — Affiliate Video Syar'i (Niche Teknologi & Peralatan Rumah Tangga)

> Dokumen master hasil riset kompetitor, perumusan arsitektur modal Rp0, dan rencana eksekusi produk di workspace `e:\latihan\AFF`.

---

## 1. Masalah & Peluang Pasar

Kreator **TikTok Affiliate** dan **Shopee Video** saat ini mengalami alur kerja yang terpecah: menulis skrip di ChatGPT, membuat gambar/klip di model lain, merekam suara di aplikasi lain, lalu mengedit dan mencari efek suara secara manual.

Di sisi lain, pasar **Muslim yang menjaga batasan syar'i (pemahaman Salafy/Sunnah)** belum terlayani oleh tool lokal maupun global yang ada:
- **Audio:** Tidak boleh ada lagu, musik, atau suara yang menyerupai alat musik/beatbox, dan tidak memakai tilawah Al-Qur'an sebagai latar promosi. Hanya boleh **suara narasi asli + efek suara (SFX) non-musikal yang terfilter**.
- **Visual:** Fokus **produk saja** atau **POV tangan dan produk (*hands-only*)**. Jika karakter tetap dibutuhkan, wajib **faceless** (kepala terpisah dari badan, **tanpa mata, hidung, dan mulut**).
- **Niche Awal:** **Teknologi (gadget, aksesoris meja, elektronik kecil) & Peralatan Rumah Tangga** — dua kategori dengan harga/komisi baik dan paling alami dijual lewat demo fungsi tanpa memperlihatkan wajah kreator.

---

## 2. Ringkasan Bedah Kompetitor

| Kompetitor | Cara Kerja & Model AI | Skema Harga | Celah yang Kita Menangkan |
| :--- | :--- | :--- | :--- |
| **ayoaicraft.id** | Portal edukasi/Notion + generator foto/copywriting + **Prompt Video**; eksekusi video diarahkan ke akun **Google Flow / Meta AI / Gemini Pro / Grok** milik user sendiri. | **Rp 147.000 Lifetime** (via Lynk.id). | Masih menghasilkan *prompt* video (bukan MP4 siap upload), user tetap bolak-balik antar-platform, belum ada guardrail syar'i. |
| **Karokulo Studio** | Studio 1-layar sampai MP4 1080p, multi-model (**Veo, Seedance, Wan, MiniMax**), kunci konsistensi produk & karakter, Auto Motion + subtitle kata-per-kata. | **Pay-as-you-go kredit** mulai Rp 50.000 (~Rp 8.000 per klip 8 detik). | Default masih memakai avatar/karakter berwajah penuh, tidak ada filter syar'i, dan setiap klip berbiaya kredit server. |
| **Creatify / Pippit / Vmake** | URL-to-video, AI talking-head avatar, template e-commerce. | Langganan \$9.99–\$39+/bln + sistem kredit. | Mahal bagi pemula lokal, mengandalkan avatar wajah & musik latar otomatis, serta copywriting kurang natural untuk gaya Shopee/TikTok Indonesia. |

---

## 3. Keputusan Arsitektur: Aplikasi Desktop Lokal + BYOK & Base URL (Modal Server Render = Rp 0)

Untuk menghindari risiko **token API server di-hack/boncos** dan menghindari **antrean berat di server Oracle** saat pengguna ramai:

1. **Aplikasi Desktop Standalone (Target Pembungkus: Tauri v2 — Tahap 1 berjalan di Node + Vite + FFmpeg lokal):**
   - Semua *rendering* video MP4 9:16 memakai **FFmpeg lokal** yang nantinya dibundel dalam installer `.exe`/`.dmg` (user tidak perlu install Python, Node.js, atau FFmpeg).
   - Foto produk, rekaman suara teleprompter (privasi terjaga di komputer sendiri), dan file ekspor disimpan lokal — biaya cloud storage & CPU render server = **Rp 0**.
2. **Model AI: BYOK (*Bring Your Own Key*) + Custom Base URL + Prompt Bridge:**
   - Mendukung endpoint OpenAI-compatible seperti **SumoPod (`https://ai.sumopod.com/v1`)**, **OpenRouter**, **Google Gemini API**, **Groq**, **Ollama lokal**, atau **Custom Base URL** dengan API Key milik user sendiri yang disimpan lokal di perangkat user.
   - Tersedia juga **Mode Tanpa API** (generator struktur skrip lokal + tombol *1-Klik Copy Prompt Syar'i* ke Gemini/Flow/ChatGPT milik user) agar pemula tetap bisa langsung pakai tanpa biaya API tambahan.
3. **Alur Suara & Render Hemat Biaya:**
   - **Teleprompter + Rekam Suara Asli Per Adegan** (`MediaRecorder` dengan *echo cancellation* & *noise suppression*). Biaya TTS & ASR = **Rp 0** (subtitle `.ass` dibuat langsung dari naskah + durasi audio tiap adegan).
   - **Auto-Motion FFmpeg:** Foto produk asli user diberi gerak kamera (*Ken Burns* zoom/pan), digabung rekaman suara (*loudnorm*), dicampur **SFX Halal (Whitelist)**, dan dibakar *subtitle* siap upload 1080×1920.

---

## 4. Guardrail Syar'i & Kepatuhan Platform

- **Audio Whitelist (Non-Musikal):** Hanya efek foley mekanik/benda/udara/alam (*soft whoosh, mechanical click, desk tap, paper rustle, shutter click*). **Blacklist:** nada musik, chord, arpeggio, lonceng bernada/melodi, beatbox, instrumen, dan tilawah sebagai BGM. *(Daftar akhir siap ditinjau ulang bersama ustaz rujukan.)*
- **Visual Guardrail & Product Fidelity Lock:** Mengunci foto produk asli agar AI tidak mengubah bentuk, warna, atau spesifikasi barang. *Prompt builder* otomatis menyuntikkan aturan *no eyes, no nose, no mouth, no living face* jika memilih mode karakter *faceless*.
- **Compliance Checker Shopee & TikTok:**
  - Pengingat wajib mengaktifkan toggle **"Konten dihasilkan AI"** saat mengunggah video yang memakai aset AI.
  - Deteksi kata berisiko *overclaim* (misal "100% ampuh", "permanen", "nomor 1 di dunia").

---

## 5. Roadmap

- **Tahap 1 (Aktif di `e:\latihan\AFF`):** Studio Web Lokal + Server Render FFmpeg Lokal (Input Produk Tech/Home $\rightarrow$ BYOK SumoPod/OpenAI/Gemini & Mode Tanpa API $\rightarrow$ Teleprompter Rekam Suara Per Adegan $\rightarrow$ SFX Halal Synthesizer $\rightarrow$ Compliance Checker $\rightarrow$ Export MP4 1080×1920).
- **Tahap 2:** Pembungkus Desktop Installer `.exe` via **Tauri v2** (butuh Rust/Cargo di mesin build) dengan `ffmpeg.exe` sebagai sidecar + validasi lisensi ringan (Cloudflare Workers).
- **Tahap 3 (Opsional):** Chrome Extension pendamping untuk sinkronisasi 1-klik dengan tab Gemini/Flow/ChatGPT milik user, serta versi Web/Mobile dengan Oracle/R2 untuk paket berlangganan.

