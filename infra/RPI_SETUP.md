# Настройка Raspberry Pi 4 для автодеплоя

## 1. Клонируем приватный репо на RPi

```bash
# Создаём deploy key (на RPi)
ssh-keygen -t ed25519 -C "rpi-deploy" -f ~/.ssh/deploy_key -N ""

# Добавляем публичный ключ в GitHub:
# Settings → Deploy keys → Add deploy key
cat ~/.ssh/deploy_key.pub

# Клонируем
GIT_SSH_COMMAND='ssh -i ~/.ssh/deploy_key' git clone git@github.com:R3XPR1R3/darms_fortresses.git /opt/darms-fortresses

# Настраиваем SSH для этого репо
cd /opt/darms-fortresses
git config core.sshCommand "ssh -i ~/.ssh/deploy_key"
```

## 2. Настраиваем GitHub Secrets

В репо GitHub → Settings → Secrets and variables → Actions:

| Secret | Описание | Пример |
|--------|----------|--------|
| `RPI_HOST` | IP или домен RPi | `192.168.1.100` |
| `RPI_USER` | SSH юзер | `pi` |
| `RPI_SSH_KEY` | Приватный SSH ключ для доступа к RPi | содержимое `~/.ssh/id_ed25519` |
| `RPI_PORT` | SSH порт (опционально) | `22` |
| `RPI_REPO_DIR` | Путь к репо на RPi (опционально) | `/opt/darms-fortresses` |

## 3. SSH ключ для доступа к RPi

```bash
# На своей машине генерируем ключ
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/rpi_deploy

# Копируем публичный ключ на RPi
ssh-copy-id -i ~/.ssh/rpi_deploy.pub pi@<RPI_IP>

# Содержимое приватного ключа добавляем в RPI_SSH_KEY secret
cat ~/.ssh/rpi_deploy
```

## 4. Тестируем вручную

```bash
ssh pi@<RPI_IP>
cd /opt/darms-fortresses
bash infra/deploy.sh
```

## Как работает

1. Push в `main` → GitHub Actions запускает тесты
2. Тесты прошли → SSH на RPi → `deploy.sh`
3. Скрипт: `git pull` → `docker compose build` → `docker compose up -d`
4. Приложение доступно на `http://<RPI_IP>:80`
