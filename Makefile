# Değişkenler
NODE = node
NPM = npm
APP = index.js

# Varsayılan komut (Sadece 'make' yazarsan çalışır)
all: install start

# Bağımlılıkları yükle
install:
	@echo "Bağımlılıklar yükleniyor..."
	$(NPM) install

# Servisi başlat
start:
	@echo "Servis başlatılıyor..."
	$(NODE) $(APP)

# Temiz kurulum (node_modules siler ve tekrar yükler)
clean-install:
	@echo "Temiz kurulum yapılıyor..."
	rm -rf node_modules package-lock.json
	$(NPM) install

# Servisin çalışıp çalışmadığını curl ile test et
test:
	@echo "Servis test ediliyor..."
	curl -v http://localhost:3000/book-content/0

# Logları takip et (Eğer bir log dosyası tutuyorsan)
logs:
	tail -f nohup.out 2>/dev/null || echo "Log dosyası bulunamadı."

.PHONY: all install start clean-install test logs