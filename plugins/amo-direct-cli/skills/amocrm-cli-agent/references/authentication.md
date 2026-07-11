# Авторизация amoCRM Direct CLI

## Рекомендуемый вариант для одного аккаунта

Нужны два значения:

1. Поддомен аккаунта — часть адреса до `.amocrm.ru`.
2. Долгосрочный токен внешней или приватной интеграции с минимально необходимыми правами чтения.

В amoCRM создать или открыть интеграцию, перейти на вкладку **Ключи**, нажать **Сгенерировать токен**, выбрать срок и сразу скопировать токен: повторно он не показывается. Долгосрочный токен не имеет refresh token и может действовать от 1 дня до 5 лет.

Сохранить секрет локально, не в репозитории:

```bash
mkdir -p ~/.config/hobbyka
chmod 700 ~/.config/hobbyka
```

Файл `~/.config/hobbyka/amocrm-direct.env`:

```env
AMOCRM_SUBDOMAIN=example
AMOCRM_LONG_LIVED_TOKEN=
AMOCRM_TIMEOUT_MS=60000
```

После сохранения выполнить `chmod 600 ~/.config/hobbyka/amocrm-direct.env` и проверить команды `config-check` и `auth-check`.

## Обычный OAuth 2.0

Для нескольких аккаунтов вместо долгосрочного токена нужен полный OAuth-цикл: ID интеграции, секрет, точный Redirect URI, одноразовый authorization code, access token и refresh token. Access token действует ограниченное время; при обновлении amoCRM выдаёт новую пару access/refresh, а прежний refresh token становится недействительным.

Этот CLI намеренно не хранит client secret и не обновляет refresh token. В таком режиме внешний защищённый процесс должен обновлять `AMOCRM_ACCESS_TOKEN`, а CLI только читает API.

## Переменные

- `AMOCRM_SUBDOMAIN` — поддомен аккаунта.
- `AMOCRM_BASE_URL` — альтернатива поддомену, например `https://example.amocrm.ru`.
- `AMOCRM_LONG_LIVED_TOKEN` — рекомендуемый долгосрочный токен.
- `AMOCRM_ACCESS_TOKEN` — обычный краткоживущий access token; имеет приоритет.
- `AMOCRM_ENV_FILE` — явный путь к отдельному env-файлу.
- `AMOCRM_TIMEOUT_MS` — таймаут запроса, по умолчанию 60000.
- `AMOCRM_MAX_RESPONSE_BYTES` — предел размера одного ответа, по умолчанию 10 MiB.
- `AMOCRM_ALLOW_CUSTOM_HOST=1` — явное разрешение доверенного HTTPS-шлюза вне доменов amoCRM/Kommo; по умолчанию такие хосты блокируются, чтобы токен не ушёл на ошибочный адрес.

CLI ищет конфигурацию в явном `AMOCRM_ENV_FILE`, затем в `.env` папки навыка и `~/.config/hobbyka/amocrm-direct.env`.

Официальная документация: `https://www.amocrm.ru/developers/content/oauth/step-by-step`.
