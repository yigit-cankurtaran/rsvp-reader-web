# GitHub Pages Deployment Sunum Metinleri

## 1. Giriş - Projenin Durumu

Bu projede React ve Vite ile geliştirilmiş bir web uygulaması vardı. Uygulama daha önce Vercel üzerinde çalışıyordu. Amacımız deployment sürecini Vercel'den GitHub Pages'a taşımaktı.

## 2. Neden GitHub Pages?

GitHub Pages, statik web uygulamalarını doğrudan GitHub reposundan yayınlamaya yarar. Bu proje tamamen frontend tarafında çalışan bir Vite uygulaması olduğu için GitHub Pages'a uygundu. Böylece kod ve yayınlama süreci aynı platformda yönetilebilir hale geldi.

## 3. Mevcut Deployment Yapısının İncelenmesi

İlk olarak projede deployment ile ilgili dosyalar arandı. `vercel.json` dosyasının bulunduğu ve burada tüm isteklerin `index.html` dosyasına yönlendirildiği görüldü. Bu yapı, React Router kullanan tek sayfa uygulamaları için Vercel tarafında sayfa yenileme sorununu çözüyordu.

## 4. GitHub Pages İçin Gerekli Fark

GitHub Pages, Vercel gibi otomatik rewrite desteği sağlamaz. Ayrıca proje bir kullanıcı sayfası yerine repo sayfası olarak yayınlanacağı için URL `/rsvp-reader-web/` altında çalışır. Bu yüzden hem Vite build ayarlarında hem de React Router tarafında bu base path dikkate alınmalıdır.

## 5. Build Script'inin Eklenmesi

`package.json` içine `build:github-pages` adında yeni bir script eklendi. Bu script TypeScript kontrolünü çalıştırır ve Vite build işlemini `/rsvp-reader-web/` base path'i ile üretir. Böylece CSS, JavaScript ve ikon dosyaları GitHub Pages üzerindeki doğru klasörden yüklenir.

## 6. React Router Ayarının Güncellenmesi

Uygulama `BrowserRouter` kullandığı için GitHub Pages altında çalışırken base path bilmeliydi. Bunun için `import.meta.env.BASE_URL` değeri okunarak router'a `basename` olarak verildi. Lokal geliştirmede `/`, GitHub Pages build'inde ise `/rsvp-reader-web` kullanılır.

## 7. Sayfa Yenileme Sorununun Çözülmesi

GitHub Pages'ta `/reader` veya `/library` gibi route'lar doğrudan açıldığında sunucu bu dosyaları fiziksel olarak arar ve 404 dönebilir. Bunu çözmek için `public/404.html` eklendi. Bu dosya gelen adresi ana sayfaya yönlendirir, uygulama açıldıktan sonra React Router doğru sayfayı gösterir.

## 8. GitHub Actions Workflow'u

`.github/workflows/deploy.yml` dosyası oluşturuldu. Bu workflow her `main` branch push'unda çalışır. Sırasıyla kodu indirir, Node kurar, `npm ci` ile bağımlılıkları yükler, GitHub Pages build'ini alır ve `dist` klasörünü GitHub Pages'a deploy eder.

## 9. Vercel Dosyasının Kaldırılması

Artık deployment Vercel üzerinden yapılmayacağı için `vercel.json` dosyası silindi. Ayrıca `robots.txt` ve `sitemap.xml` içindeki eski Vercel adresleri GitHub Pages adresiyle değiştirildi. Bu sayede proje metadata tarafında da yeni yayın adresini gösterir.

## 10. GitHub Pages Ayar Ekranı

GitHub reposunda `Settings` sekmesine girilir ve sol menüden `Pages` sayfası açılır. Burada `Build and deployment` bölümünde `Source` seçeneği `GitHub Actions` yapılır. Bu ayar, GitHub'ın bizim yazdığımız workflow ile siteyi yayınlamasını sağlar.

## 11. Deploy Sürecini Başlatma

Değişiklikler commit edilip `main` branch'e push edilir. Push işleminden sonra GitHub'da `Actions` sekmesinde `Deploy to GitHub Pages` workflow'u görünür. Workflow başarılı olduğunda uygulama GitHub Pages URL'i üzerinden erişilebilir olur.

## 12. Sonuç

Bu işlem sonunda deployment süreci Vercel'den GitHub Pages'a taşındı. Uygulama artık `https://yigit-cankurtaran.github.io/rsvp-reader-web/` adresinden yayınlanabilir. Kod, build ve deployment süreci tek repo içinde yönetildiği için proje daha sade bir yapıya kavuştu.
