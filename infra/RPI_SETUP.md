# Настройка Raspberry Pi 4 для автодеплоя

## Архитектура

```
GitHub (push main) → GitHub Actions (тесты на ubuntu)
                          ↓ (тесты ок)
                    Self-hosted runner на RPi
                          ↓
                    docker compose up
                          ↓
                ┌─────────┴─────────┐
                │  app (nginx:80)   │
                │  tunnel (cloudflared) → https://xxx.trycloudflare.com
                └───────────────────┘
```

## 1. Клонируем приватный репо на RPi

```bash
# Создаём deploy key (на RPi)
ssh-keygen -t ed25519 -C "rpi-deploy" -f ~/.ssh/deploy_key -N ""

# Добавляем публичный ключ в GitHub:
# Репо → Settings → Deploy keys → Add deploy key
cat ~/.ssh/deploy_key.pub

# Клонируем
GIT_SSH_COMMAND='ssh -i ~/.ssh/deploy_key' git clone git@github.com:R3XPR1R3/darms_fortresses.git /opt/darms-fortresses

# Настраиваем SSH для этого репо
cd /opt/darms-fortresses
git config core.sshCommand "ssh -i ~/.ssh/deploy_key"
```

## 2. Ставим self-hosted runner

На GitHub: Репо → Settings → Actions → Runners → New self-hosted runner → Linux ARM64

На RPi:
```bash
mkdir ~/actions-runner && cd ~/actions-runner

# Скачиваем (GitHub покажет актуальную ссылку)
curl -o actions-runner-linux-arm64.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.321.0/actions-runner-linux-arm64-2.321.0.tar.gz
tar xzf actions-runner-linux-arm64.tar.gz

# Конфигурируем (токен покажет GitHub)
./config.sh --url https://github.com/R3XPR1R3/darms_fortresses --token <TOKEN>

# Ставим как systemd-сервис (автозапуск)
sudo ./svc.sh install
sudo ./svc.sh start
```

## 3. Проверяем

```bash
# Подготовка env (иначе docker compose будет ругаться на пустые переменные)
cp .env.example .env

# Статус раннера
sudo ./svc.sh status

# Ручной деплой
cd /opt/darms-fortresses
# (если есть .env, deploy/start автоматически подхватят его через --env-file)
bash infra/deploy.sh

# Центр управления проектом (настройки, логи, кампании, обновление, PR helper)
bash infra/control-center.sh
```

После деплоя в логах появится URL вида `https://xxx-yyy-zzz.trycloudflare.com` — по нему можно играть из интернета.

## 4. Посмотреть URL туннеля

```bash
docker compose -f /opt/darms-fortresses/infra/docker/docker-compose.yml logs tunnel
```

## Как работает

1. Push в `main` → GitHub Actions: тесты на ubuntu-latest
2. Тесты прошли → job `deploy` запускается на self-hosted runner (RPi)
3. RPi: `docker compose build` → `docker compose up -d`
4. Поднимается app (nginx) + cloudflared tunnel
5. Cloudflared автоматически создаёт публичный URL `*.trycloudflare.com`
6. Кидаешь ссылку друзьям — играете

## Важно

- **trycloudflare** даёт случайный URL при каждом перезапуске контейнера tunnel
- Для постоянного домена: зарегай бесплатный аккаунт на Cloudflare, создай именованный туннель и подставь токен:
  ```yaml
  # в docker-compose.yml замени command у tunnel на:
  command: tunnel run --token <TUNNEL_TOKEN>
  ```
- **Секреты в репо НЕ нужны** — раннер уже на малинке, SSH не используется
- Раннер сам подключается к GitHub (исходящее соединение), NAT не проблема
