# Lumo Mapper

Mevcut Windows app **RasStationComms**'in beklediği `ProjectorLayoutConfiguration` XML
formatında **layout dosyaları üreten / düzenleyen** web tabanlı editör.

Windows app'e dokunmuyoruz — sadece o app'in okuyacağı XML'i kolayca üretiyoruz.

## Hızlı Başlat

```sh
pnpm install
pnpm dev   # http://localhost:5173
```

Edge / Chrome / Firefox — fark etmez. Her tarayıcıda çalışır.

## Test Planı (yarın demo için)

### Test 1 — Round-trip (yapı doğru mu?)

1. `pnpm dev` ile çalıştır.
2. Tarayıcıda **XML Aç** butonuna bas.
3. `samples/projector-layout-3.xml` dosyasını seç.
4. Canvas'ta boundary + 34 hücreyi gör. Sidebar'da `RowCount=14`, `ColumnsPerRow`,
   `Face=[A,C]`, `Surface=4 Face Pod` görünmeli.
5. Hiçbir şeye dokunmadan **XML İndir** butonuna bas.
6. İndirilen dosyayı orijinal `samples/projector-layout-3.xml` ile karşılaştır.

Hücre sayısı, isimler, koordinatlar, boundary, RowCount aynı olmalı. Tek farklar:
- `LastModified` zaman damgası (her save'de güncellenir — beklenen)
- `MetadataConfiguration` üstüne `SurfaceType="FourFacePod"` ve `Surface="4 Face Pod"`
  attribute'ları eklenir (yeni format için, eski `IsPallet` da korunur — Windows app
  ikisini de tanır)

Eğer hücre koordinatları, boundary değerleri, isimler aynı çıkıyorsa **format'ı doğru
üretiyoruz** demektir.

### Test 2 — Windows app kabul ediyor mu?

1. İndirdiğin XML'i `%APPDATA%\OPLOG\RasStationComms\Saved Projector Layouts\` klasörüne
   `projector-layout-3.xml` adıyla at (mevcut dosyanın üzerine yazma riskine karşı önce
   yedekle).
2. Windows app'i aç → Dashboard'tan **Projector System** toggle'ını ON yap.
3. Beklenen: hata vermeden açılır, projektörde aynı boundary + hücreler görünür.

Hata verirse log'a bak: `%APPDATA%\OPLOG\RasStationComms\logs\` altında. XML
deserialization hatası genelde "expected element X" diye söyler — bize geri dön,
düzeltirim.

### Test 3 — Mapping doğru çalışıyor mu? (asıl iş)

1. Tool'da **boundary'nin Sol-Üst (TL)** köşesini canvas'ta sürükle veya sidebar'dan
   X/Y değerlerini değiştir (örn: X=288 yap, +50 piksel sağa).
2. **XML İndir**, klasöre at, app'i tekrar aktive et.
3. Beklenen: projektörde grid de 50 piksel sağa kaymış. Bir hücreye `LightCell` komutu
   gelirse, ışık yeni doğru yere düşmeli.

Bu adım çalışırsa: **Lumo Mapper'ın çıktısı = Windows app'in mapping'i**. Bittik.

## Tool'da Ne Yapabiliyorsun

- **Boundary 4 köşesi sürüklenebilir** (canvas üstünde TL/TR/BL/BR handle'ları)
- **Sayısal giriş** (sidebar'da pixel-precise X/Y)
- **Satır × her satır için sütun sayısı** (variable column desteği — bazı satırlar 2,
  bazıları 4 olabilir)
- **Auto-bilinear regenerate** (boundary değişince hücreler otomatik yenilensin —
  toggle var)
- **Tek hücre fine-tune** (canvas'ta hücreye tıkla → 4 cyan handle çıkar, tek tek
  sürükle)
- **İsim editleme** (sidebar'daki Hücreler listesinde inline)
- **Metadata** (Face, SurfaceType, Surface)
- **Screen config** (DeviceName `\\.\DISPLAY2`, Index, Width, Height, IsPrimary)
- **Validation** (save öncesi C# kodundaki kuralları çalıştırır)

## Üretilen XML

Hem **eski** (`IsPallet`) hem **modern** (`SurfaceType` + `Surface`) attribute'larını
yan yana yazar — Windows app hangi versiyonda olursa olsun deserialize edebilsin.

C# `XmlSerializer` bilmediği attribute'ları sessizce yutar, o yüzden bu yaklaşım
risksiz.

## Klasör Yapısı (yeni mapper)

```
lumo/
├── samples/
│   └── projector-layout-3.xml      ← test için kullanıcının örnek XML'i
├── src/
│   ├── App.tsx                      ← mapper shell
│   ├── lib/
│   │   ├── types.ts                 ← C# modelleri ile birebir
│   │   ├── bilinear.ts              ← interpolation algoritması
│   │   ├── cellNaming.ts            ← default isim pattern'i
│   │   ├── xml.ts                   ← parse + serialize
│   │   ├── validation.ts            ← C# kuralları
│   │   ├── defaults.ts              ← boş layout şablonu
│   │   └── store.ts                 ← Zustand store
│   └── components/mapper/
│       ├── Toolbar.tsx              ← Yeni / Aç / İndir butonları
│       ├── EditorCanvas.tsx         ← SVG canvas + drag handles
│       ├── Sidebar.tsx              ← sol panel
│       └── sections/                ← İstasyon, Ekran, Metadata, Grid, Boundary,
│                                       Hücre Listesi
└── (eski runtime kodu kenarda — Phase 1 demo'da yazılan screen detection,
   ileride lazım olunca dururuz)
```

## Stack

Vite 6 · React 19 · TypeScript 5 · Tailwind v4 · Zustand 5 · Biome
