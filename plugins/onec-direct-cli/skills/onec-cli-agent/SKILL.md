---
name: onec-cli-agent
description: Напрямую читать метаданные и выполнять безопасные запросы на языке запросов 1С через опубликованный HTTP-сервис базы и локальный Node.js CLI. Использовать для вопросов к живой 1С, проверки структуры объектов и read-only выборок без OpenCode, RAG, локальных MCP-серверов, SSE или Docker-прокси.
---

# Direct 1C CLI

Работать по цепочке `Codex -> CLI -> HTTP-сервис внутри 1С`. Рассуждать и формировать запрос самостоятельно; не отправлять естественно-языковую задачу другой модели или агенту.

## Порядок работы

1. При первом подключении выполнить `node scripts/onec-cli.mjs health` и `node scripts/onec-cli.mjs tools`.
2. Сформулировать период, организацию и остальные бизнес-фильтры.
3. Если имена объектов или полей не подтверждены в текущей задаче, вызвать `metadata-list`, затем `metadata-get` только для нужных объектов.
4. Самостоятельно составить запрос на языке запросов 1С из подтверждённых имён.
5. Выполнить `query` с небольшим `--max-rows`; повышать лимит только по необходимости.
6. Проверить колонки, количество строк, период и фильтры. Не выдавать пустой или неоднозначный результат за отсутствие факта в 1С.

Не повторять metadata discovery, если точные имена уже подтверждены живой 1С в этой же задаче.

## Команды

```bash
node scripts/onec-cli.mjs health
node scripts/onec-cli.mjs tools
node scripts/onec-cli.mjs metadata-list --type Documents --name-mask Заказ --max-items 20
node scripts/onec-cli.mjs metadata-get --type Documents --name ЗаказКлиента
node scripts/onec-cli.mjs query --text "ВЫБРАТЬ ..." --max-rows 50
node scripts/onec-cli.mjs query --file /private/tmp/query-1c.txt --params-json '{"Организация":"Хоббика"}' --max-rows 50
node scripts/onec-cli.mjs query --file /private/tmp/query-1c.txt --max-rows 50
node scripts/onec-cli.mjs query --stdin --max-rows 50
node scripts/onec-cli.mjs query --file /private/tmp/query-1c.txt --dry-run
node scripts/onec-cli.mjs self-test
```

Для длинного запроса предпочесть `--file` или `--stdin`, чтобы текст не попадал в список процессов.

## Настройка

Хранить параметры в `~/.config/hobbyka/onec-direct.env`, `.env` рабочего каталога, `.env` навыка или отдельном файле через `ONEC_HTTP_ENV_FILE`. Общий файл в `~/.config/hobbyka/` позволяет одному защищённому конфигу работать и для установленного плагина, и для локальной копии навыка. Не просить пароль в чате.

```env
ONEC_HTTP_BASE_URL=http://server/BaseName
ONEC_HTTP_SERVICE_ROOT=mcp
ONEC_HTTP_USERNAME=ReadOnlyUser
ONEC_HTTP_PASSWORD=
ONEC_HTTP_TIMEOUT_MS=60000
```

Можно указать готовый адрес сервиса через `ONEC_HTTP_SERVICE_URL=http://server/BaseName/hs/mcp` вместо пары `BASE_URL` + `SERVICE_ROOT`.

## Жёсткие границы

- Использовать только `health`, `tools/list`, `list_metadata_objects`, `get_metadata_structure` и `execute_query` непосредственно в HTTP-сервисе 1С.
- Не запускать и не вызывать OpenCode, RAG, локальный MCP-сервер, SSE, Docker-прокси или стороннюю модель.
- Не выполнять произвольный tool по имени. CLI разрешает только две metadata-функции и `execute_query`, подтверждённые кодом переданного расширения.
- Принимать только запросы, начинающиеся с `ВЫБРАТЬ`, и отклонять команды изменения данных.
- Не писать `ПЕРВЫЕ N` вручную: передавать лимит через `--max-rows` от 1 до 2000. Это обходит дефект ветки разбора ручного `ПЕРВЫЕ` в переданном BSL-коде.
- Считать CLI-защиту дополнительной. Пользователь 1С обязан иметь read-only права на сервере.
- Разрешать обычный HTTP только для localhost, `.local` и частных IP; для другого HTTP-хоста требовать явный `ONEC_HTTP_ALLOW_INSECURE=1`.
- Не печатать пароль, Authorization header или unlock code.

Сегмент `/hs/mcp/rpc` и имена `tools/list`/`tools/call` заданы установленным расширением 1С. CLI отправляет JSON-RPC прямо туда без handshake и без промежуточного процесса. Детали: [references/direct-http.md](references/direct-http.md).
