# Data Sintetis: Sumber dan Asumsi

**Semua data siswa di repository ini adalah data sintetis (buatan).** Tidak ada data pribadi asli, nama asli, atau NISN. Data dibangkitkan oleh `ml/generate_data.py` dengan seed tetap (42), sehingga hasilnya selalu sama setiap kali dijalankan.

Data ini hanya untuk mendemonstrasikan cara kerja sistem. Model yang dilatih dari data ini **harus dilatih ulang dengan data riil sekolah** (dengan izin dan perlindungan privasi) sebelum dipakai untuk mengambil keputusan sungguhan.

## Inspirasi konteks

- Data Dapodik mencatat sekitar 28.201 anak putus sekolah di Provinsi Bali, tertinggi di Buleleng (8.125) dan Karangasem (5.522).
- Penyebab utama yang sering disebut: kesulitan ekonomi (anak ikut bekerja), jarak/akses sekolah, pernikahan dini dan kurangnya dukungan keluarga, serta tekanan belajar/perundungan.

Angka-angka di generator **bukan** hasil kalibrasi statistik terhadap data resmi. Angka itu adalah asumsi yang masuk akal agar polanya mirip kenyataan.

## Cara data dibangkitkan (4 langkah)

1. **Latar belakang siswa**: kabupaten, jenjang/kelas, kondisi ekonomi keluarga, pekerjaan orang tua, bantuan (KIP/PKH), jumlah saudara, status tinggal, jarak dan waktu tempuh.
2. **Perilaku sekolah** yang dipengaruhi latar belakang: ikut bekerja, perundungan, kehadiran, nilai, tren nilai, pelanggaran.
3. **Skor risiko tersembunyi** dihitung dengan rumus logistik dari semua faktor.
4. **Label `putus_sekolah`** (0/1) diundi sesuai peluang dari skor itu. Karena diundi, siswa berisiko tinggi tidak selalu putus sekolah, sama seperti kenyataan.

## Asumsi utama

| Faktor | Asumsi |
|---|---|
| Kabupaten | Peluang keluarga kesulitan ekonomi: Karangasem 42%, Buleleng 38%, Bangli 32%, ... Denpasar 8%. Kabupaten pedesaan punya jarak sekolah lebih jauh. |
| Bantuan | Keluarga sulit: 65% menerima KIP/PKH (tidak semua, karena data bantuan belum tepat sasaran). Keluarga mampu: 9%. |
| Status tinggal | Anak pekerja migran lebih sering tinggal dengan kerabat. Siswa SMA/SMK lebih sering tinggal sendiri (kos). |
| Waktu tempuh | Keluarga sulit lebih sering jalan kaki/menumpang, jadi menit per km lebih besar. |
| Ikut bekerja | Lebih mungkin jika ekonomi sulit, kelas lebih tinggi, dan saudara lebih banyak. |
| Perundungan | 8% siswa punya laporan perundungan. |
| Kehadiran | Turun jika ikut bekerja (-9), perjalanan > 20 menit, perundungan (-6), tidak tinggal dengan orang tua (-4), tekanan keluarga (-6). |
| Nilai | Naik seiring kehadiran, turun jika ada perundungan atau ikut bekerja. |
| Tekanan keluarga / pernikahan dini | Faktor tersembunyi: **tidak menjadi kolom tabel**, hanya muncul di catatan guru BK (teks). Ini meniru kenyataan bahwa info seperti rencana pernikahan biasanya hanya diketahui lewat catatan konseling. Catatan ini nanti dibaca LLM, bukan model ML. |

Faktor yang menaikkan risiko putus sekolah (dari terkuat): kehadiran rendah, tekanan keluarga, ikut bekerja, ekonomi sulit tanpa bantuan, status tinggal sendiri/kerabat, perundungan, tren nilai turun, waktu tempuh lama, pelanggaran, nilai rendah, jenjang SMA/SMK, jumlah saudara banyak.

## Hasil (n = 3.000, seed 42)

- Proporsi putus sekolah: **15,3%**. Angka ini sengaja lebih tinggi dari kenyataan agar model punya cukup contoh kasus positif untuk belajar.
- Per kabupaten: Karangasem 25,8%, Buleleng 23,0%, Klungkung 20,6%, Bangli 18,0%, Jembrana 12,2%, Tabanan 11,6%, Badung 10,2%, Gianyar 10,1%, Denpasar 8,7%.
- Cek sebab-akibat: siswa yang ikut bekerja 44,9% putus sekolah vs 8,0% yang tidak; kehadiran ≤ 80% jauh lebih rawan daripada > 90% (3,8%).

## Kolom data

| Kolom | Tipe | Keterangan |
|---|---|---|
| id_siswa | teks | ID anonim (S00001, ...) |
| nama | teks | Inisial acak |
| jenjang | SMP/SMA/SMK | |
| kelas | 7-12 | |
| kabupaten | teks | 9 kabupaten/kota di Bali |
| kehadiran_persen | 35-100 | |
| rata_nilai | 40-98 | |
| tren_nilai | Naik/Turun/Stabil | |
| jarak_km | 0,2-30 | |
| waktu_tempuh_menit | 3-150 | |
| penerima_bantuan | KIP/PKH/Tidak | |
| pekerjaan_ortu | teks | |
| status_tinggal | Orang tua/Kerabat/Sendiri | |
| ikut_bekerja | Ya/Tidak | |
| jumlah_saudara | angka | |
| laporan_perundungan | Ya/Tidak | |
| jumlah_pelanggaran | angka | Jumlah catatan pelanggaran |
| catatan_bk | teks | Catatan guru BK (sintetis) |
| putus_sekolah | 0/1 | **Label** untuk melatih model |

## Cara menjalankan ulang

```bash
cd ml
pip install -r requirements.txt
python generate_data.py            # 3000 siswa, seed 42
python generate_data.py --n 5000 --seed 7
```
