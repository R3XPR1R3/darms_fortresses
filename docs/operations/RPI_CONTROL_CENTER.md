# RPi Control Center

`tools/rpi_control_center.py` — интерактивный центр управления для Raspberry Pi деплоя.

## Запуск

```bash
bash infra/control-center.sh
```

## Что умеет

1. Конфигурация (`Google Client ID`, `Google Client Secret`, `JWT secret`) с сохранением вне git в:
   - `/opt/darms-fortresses/control-center/config.json`
   - `.env` (перегенерируется из сохранённого конфига)
2. Управление инфраструктурой:
   - запуск/остановка стека
   - статус docker-compose
   - пересборка после `git pull --rebase`
3. Наблюдаемость:
   - live-логи сервера
   - история матчей (`infra/history.sh`)
   - live-tail последнего `.txt` лога катки
4. Контент-пайплайн:
   - генерация шаблона кампании (`content/campaigns/<slug>/campaign.json`)
   - регистрация кастомных артов (`content/custom-art/index.json`)
5. Git helper:
   - создание/обновление ветки
   - `git add .`, `git commit`, `git push`
   - подсказка для `gh pr create --fill`

## Почему это переживает обновления

Все настройки хранятся в `/opt/darms-fortresses/control-center/config.json`, который не затрагивается `git pull` и может жить между деплоями.
