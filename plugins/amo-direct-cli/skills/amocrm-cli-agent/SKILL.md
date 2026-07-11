---
name: amocrm-cli-agent
description: Напрямую и безопасно читать сделки, контакты, компании, пользовательские поля, воронки и пользователей amoCRM API v4 через локальный Node.js CLI. Use when Codex должен проверить подключение к amoCRM, найти или проанализировать CRM-данные без MCP-сервера, Google OAuth, PostgreSQL, Docker или сторонней модели.
---

# amoCRM Direct CLI

Работать по цепочке `Codex -> CLI -> amoCRM API v4`. Самостоятельно выбирать параметры запроса и анализировать ответ; не передавать задачу другому агенту или сервису.

## Порядок работы

1. При первом подключении выполнить `node scripts/amocrm-cli.mjs config-check`, затем `node scripts/amocrm-cli.mjs auth-check`.
2. Для неизвестных полей сначала вызвать `fields`, для статусов сделок — `pipelines`.
3. Начинать с небольшого `--limit`; использовать `--all` только когда действительно нужен полный набор страниц.
4. Проверять сущность, страницу, количество записей и применённые фильтры. Не считать пустую выборку доказательством отсутствия факта, пока не проверены параметры.
5. Оставлять маскирование включённым. Добавлять `--include-sensitive` только по явному запросу пользователя и не переносить персональные данные в лишние файлы или сообщения.

## Команды

```bash
node scripts/amocrm-cli.mjs config-check
node scripts/amocrm-cli.mjs auth-check
node scripts/amocrm-cli.mjs fields --entity leads --all
node scripts/amocrm-cli.mjs list --entity leads --limit 25 --page 1
node scripts/amocrm-cli.mjs list --entity leads --query "Хоббика" --limit 25
node scripts/amocrm-cli.mjs list --entity leads --filter-json '{"pipeline_id":123}' --order updated_at:desc --limit 50
node scripts/amocrm-cli.mjs get --entity leads --id 123456 --with contacts
node scripts/amocrm-cli.mjs pipelines
node scripts/amocrm-cli.mjs users --limit 50
node scripts/amocrm-cli.mjs self-test
```

Для сложных параметров API передавать плоский JSON через `--params-json`, например:

```bash
node scripts/amocrm-cli.mjs list --entity leads --params-json '{"filter[statuses][0][pipeline_id]":123,"with":"contacts"}' --limit 50
```

## Авторизация

Хранить поддомен и долгосрочный токен в `~/.config/hobbyka/amocrm-direct.env` с правами только владельца. Не просить токен в чате и не печатать его.

```env
AMOCRM_SUBDOMAIN=example
AMOCRM_LONG_LIVED_TOKEN=
AMOCRM_TIMEOUT_MS=60000
```

Вместо поддомена можно задать `AMOCRM_BASE_URL=https://example.amocrm.ru`. Подробная настройка и вариант обычного OAuth: [references/authentication.md](references/authentication.md).

## Жёсткие границы

- Выполнять только GET-запросы к заранее разрешённым ресурсам API v4.
- Не добавлять команды создания, изменения или удаления CRM-данных без отдельного нового проектирования и согласования.
- Не передавать токен в аргументах командной строки, URL, логах или файлах репозитория.
- Не разрешать нестандартный API-хост через `AMOCRM_ALLOW_CUSTOM_HOST=1`, пока пользователь явно не подтвердил доверенный шлюз.
- Не отключать маскирование телефона, email, ИНН, IP и похожих полей без явной необходимости.
- Не использовать исходный MCP-сервер, его Google OAuth, PostgreSQL-кеш, ngrok, Docker или тестовые mock-инструменты.
- Считать права токена верхней границей доступа: CLI не расширяет права пользователя amoCRM.
