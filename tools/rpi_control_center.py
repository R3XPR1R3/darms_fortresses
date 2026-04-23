#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import shutil
import subprocess
import textwrap
import time
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
STATE_DIR = Path(os.environ.get("DARMS_CONTROL_HOME", "/opt/darms-fortresses/control-center"))
STATE_FILE = STATE_DIR / "config.json"
ENV_FILE = REPO_ROOT / ".env"
COMPOSE_FILE = REPO_ROOT / "infra/docker/docker-compose.yml"
CAMPAIGNS_DIR = REPO_ROOT / "content/campaigns"
ART_DIR = REPO_ROOT / "content/custom-art"


def run(cmd: list[str], *, check: bool = False, capture: bool = False) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        cwd=REPO_ROOT,
        check=check,
        text=True,
        capture_output=capture,
    )


def pause() -> None:
    input("\nНажмите Enter, чтобы продолжить...")


def ensure_dirs() -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    CAMPAIGNS_DIR.mkdir(parents=True, exist_ok=True)
    ART_DIR.mkdir(parents=True, exist_ok=True)


def load_state() -> dict[str, Any]:
    ensure_dirs()
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    return {
        "google_client_id": "",
        "google_client_secret": "",
        "jwt_secret": "change-me",
        "default_room_prefix": "DARMS",
        "last_update": None,
    }


def save_state(data: dict[str, Any]) -> None:
    ensure_dirs()
    STATE_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_env_from_state(state: dict[str, Any]) -> None:
    lines = [
        f"GOOGLE_CLIENT_ID={state.get('google_client_id', '')}",
        f"GOOGLE_CLIENT_SECRET={state.get('google_client_secret', '')}",
        f"JWT_SECRET={state.get('jwt_secret', 'change-me')}",
        "POSTGRES_DB=darms",
        "POSTGRES_USER=darms",
        "POSTGRES_PASSWORD=darms_secret",
    ]
    ENV_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")


def menu_header() -> None:
    print("\n" + "=" * 68)
    print("⚔ DARMS Control Center (Raspberry Pi)")
    print("=" * 68)


def configure_project(state: dict[str, Any]) -> None:
    print("\nНастройка проекта (значения сохраняются отдельно от кода).")
    cid = input(f"Google Client ID [{state.get('google_client_id', '')}]: ").strip()
    csec = input("Google Client Secret [скрыто/оставить как есть]: ").strip()
    jwt = input(f"JWT Secret [{state.get('jwt_secret', 'change-me')}]: ").strip()

    if cid:
        state["google_client_id"] = cid
    if csec:
        state["google_client_secret"] = csec
    if jwt:
        state["jwt_secret"] = jwt

    save_state(state)
    write_env_from_state(state)
    print("✅ Конфигурация сохранена:")
    print(f"   - {STATE_FILE}")
    print(f"   - {ENV_FILE}")


def show_status() -> None:
    print("\nСервисы Docker:")
    run(["docker", "compose", "-f", str(COMPOSE_FILE), "ps"])


def start_stack() -> None:
    print("\nЗапускаю стек...")
    run(["bash", "infra/start.sh"])


def stop_stack() -> None:
    print("\nОстанавливаю стек...")
    run(["bash", "infra/stop.sh"])


def stream_server_logs() -> None:
    print("\nLive-логи сервера (Ctrl+C чтобы выйти)")
    try:
        subprocess.run(
            ["docker", "compose", "-f", str(COMPOSE_FILE), "logs", "-f", "--tail=100", "app"],
            cwd=REPO_ROOT,
            check=False,
        )
    except KeyboardInterrupt:
        print("\nОстановлено пользователем.")


def stream_match_history() -> None:
    print("\nПоказываю историю каток:")
    run(["bash", "infra/history.sh"])


def tail_latest_match_file() -> None:
    logs_root = Path("/opt/darms-fortresses/match-logs")
    if not logs_root.exists():
        print("Логов пока нет.")
        return

    txt_files = sorted(logs_root.glob("*.txt"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not txt_files:
        print("Логов пока нет.")
        return

    target = txt_files[0]
    print(f"\nLive tail файла: {target}")
    print("Ctrl+C для выхода\n")

    with target.open("r", encoding="utf-8") as f:
        f.seek(0, os.SEEK_END)
        try:
            while True:
                line = f.readline()
                if line:
                    print(line, end="")
                else:
                    time.sleep(0.5)
        except KeyboardInterrupt:
            print("\nОстановлено пользователем.")


def slugify(name: str) -> str:
    out = "".join(ch.lower() if ch.isalnum() else "-" for ch in name)
    while "--" in out:
        out = out.replace("--", "-")
    return out.strip("-") or "campaign"


def create_campaign_skeleton() -> None:
    title = input("Название кампании: ").strip()
    if not title:
        print("Название обязательно.")
        return
    slug = slugify(title)
    folder = CAMPAIGNS_DIR / slug
    folder.mkdir(parents=True, exist_ok=True)

    data = {
        "id": slug,
        "title": title,
        "description": "Новая кампания",
        "levels": [
            {
                "id": "level-1",
                "title": "Первый бой",
                "enemyTeam": ["fahira", "mirai", "markhat"],
                "playerCompanions": 3,
                "purpleCards": 6,
                "reward": {"gold": 100},
            }
        ],
        "economy": {
            "mill": {"rewardGold": 1, "cooldownMinutes": 30},
            "workshop": {"craftingUnlocked": True},
        },
    }

    (folder / "campaign.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"✅ Создан шаблон кампании: {folder / 'campaign.json'}")


def register_custom_art() -> None:
    source = Path(input("Путь к файлу картинки/gif: ").strip())
    if not source.exists():
        print("Файл не найден.")
        return

    name = input("Имя арта (без пробелов, напр. purple-fire): ").strip()
    if not name:
        print("Имя обязательно.")
        return

    dest = ART_DIR / f"{slugify(name)}{source.suffix.lower()}"
    shutil.copy2(source, dest)

    index_file = ART_DIR / "index.json"
    index: dict[str, Any] = {"assets": []}
    if index_file.exists():
        index = json.loads(index_file.read_text(encoding="utf-8"))

    assets = index.setdefault("assets", [])
    assets.append({"id": slugify(name), "file": dest.name, "addedAt": int(time.time())})
    index_file.write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"✅ Арт добавлен: {dest}")


def git_update_and_rebuild(state: dict[str, Any]) -> None:
    print("\nОбновляю репозиторий...")
    run(["git", "fetch", "origin"])
    run(["git", "pull", "--rebase"])
    state["last_update"] = int(time.time())
    save_state(state)
    write_env_from_state(state)
    print("\nПерезапускаю после обновления...")
    run(["docker", "compose", "-f", str(COMPOSE_FILE), "build"])
    run(["docker", "compose", "-f", str(COMPOSE_FILE), "up", "-d"])
    print("✅ Обновление выполнено. Настройки сохранены.")


def create_pr_helper() -> None:
    branch = input("Имя ветки для изменений [feature/rpi-control-center]: ").strip() or "feature/rpi-control-center"
    msg = input("Commit message [chore: update content/config]: ").strip() or "chore: update content/config"
    run(["git", "checkout", "-B", branch])
    run(["git", "add", "."])
    run(["git", "commit", "-m", msg])
    run(["git", "push", "-u", "origin", branch])
    print("✅ Ветка отправлена в origin.")
    print("Если установлен GitHub CLI, выполните:")
    print("   gh pr create --fill")


def print_concept_notes() -> None:
    notes = """
    Быстрый план следующих систем (в код игры):
    1) Purple-craft pool на игрока: хранить выбранные 6 карт отдельно в профиле.
    2) Companions draft: в начале матча выбор 3 из N, фиксируем в match setup.
    3) Campaign editor: JSON-кампании + UI редактор уровней и условий победы.
    4) Event economy: ограниченные ивенты, эксклюзивные скины/карты, аукцион.
    5) Ресурсы вне матча: золото, крафт-материалы, аметисты (premium).
    """
    print(textwrap.dedent(notes).strip())


def main() -> int:
    state = load_state()

    actions = {
        "1": ("Настроить Google ID / секреты", lambda: configure_project(state)),
        "2": ("Статус сервисов", show_status),
        "3": ("Запустить проект", start_stack),
        "4": ("Остановить проект", stop_stack),
        "5": ("Live-логи сервера", stream_server_logs),
        "6": ("История каток", stream_match_history),
        "7": ("Live лог последней катки", tail_latest_match_file),
        "8": ("Создать шаблон кампании", create_campaign_skeleton),
        "9": ("Добавить кастомный арт", register_custom_art),
        "10": ("Обновить код + перезапустить", lambda: git_update_and_rebuild(state)),
        "11": ("Авто-помощник для PR", create_pr_helper),
        "12": ("План развития (companion/purple/campaign)", print_concept_notes),
    }

    while True:
        menu_header()
        for key, (title, _) in actions.items():
            print(f"{key.rjust(2)}. {title}")
        print(" 0. Выход")

        choice = input("\nВыберите действие: ").strip()
        if choice == "0":
            print("Пока!")
            return 0

        selected = actions.get(choice)
        if not selected:
            print("Неизвестная команда.")
            pause()
            continue

        try:
            selected[1]()
        except subprocess.CalledProcessError as exc:
            print(f"❌ Команда завершилась ошибкой: {exc}")
        except KeyboardInterrupt:
            print("\n⛔ Прервано пользователем")
        pause()


if __name__ == "__main__":
    raise SystemExit(main())
