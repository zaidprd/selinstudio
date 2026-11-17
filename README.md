# Selin Studio — Affiliate Video Syar'i (Apple Liquid Glass Edition)

Studio desktop/web lokal untuk membuat video vertikal **TikTok Shop & Shopee Affiliate (9:16, 1080×1920)** khusus pasar **Syar'i** (0% musik, hanya suara manusia + foley SFX halal) dengan gaya visual **Apple Liquid Glass** dan **After Effects / EffectCraft Hook Animation**.

## Cara Lanjut di Komputer Rumah

1. **Clone & Install Dependency:**
   ```bash
   git clone https://github.com/zaidprd/selinstudio.git
   cd selinstudio
   npm install
   ```

2. **Pastikan `ffmpeg` Terpasang di PATH Windows:**
   - Cek dengan `ffmpeg -version`.
   - (Opsional) Jika memiliki `effectcraft-cli.exe` di lokasi berbeda, set environment variable `EFFECTCRAFT_PATH` atau sesuaikan path di `server/render-server.mjs`.

3. **Jalankan Studio:**
   ```bash
   npm run dev
   ```
   Buka `http://localhost:5173`.
