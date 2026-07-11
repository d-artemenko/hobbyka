---
name: manage-commercial-offers
description: Создавать и просматривать коммерческие предложения Хоббики через локальный Node.js CLI и API hobbyka.ru. Use when Codex должен сформировать КП по артикулам и количеству, вернуть ссылку или PDF по номеру, проверить доступность КП либо показать локальную историю созданных предложений.
---

# Коммерческие предложения Хоббики

Работать по цепочке `Codex -> локальный CLI -> hobbyka.ru`. CLI не требует токена и не сохраняет контактные данные клиента в истории.

## Порядок работы

1. При первом использовании выполнить `node scripts/hobbyka-commercial-offers.mjs config-check`, затем `self-test`.
2. Для просмотра по номеру сразу вызвать `view`. Добавлять `--check`, если нужно проверить доступность страницы в сети.
3. Перед созданием собрать артикулы, количество, компанию, контактное лицо, телефон, email и объект. Не придумывать отсутствующие реквизиты.
4. Выполнить `create --dry-run` и проверить итоговый JSON без отправки.
5. Выполнять реальный `create --yes` только когда пользователь прямо попросил создать КП. Не считать просьбу «покажи пример» или «подготовь данные» разрешением на отправку.
6. После успеха сообщить номер, ссылку на страницу, PDF и QR-код, если они вернулись от API. Не публиковать в ответе телефон и email без необходимости.

## Команды

```bash
node scripts/hobbyka-commercial-offers.mjs config-check
node scripts/hobbyka-commercial-offers.mjs self-test

node scripts/hobbyka-commercial-offers.mjs create \
  --item 7112:2 --item 12741:3 \
  --company "ООО Хоббика" --person "Иван Иванов" \
  --phone "+7 999 123-45-67" --email "client@example.com" \
  --object "Благоустройство парка" --dry-run

node scripts/hobbyka-commercial-offers.mjs create --input /path/to/offer.json --yes
node scripts/hobbyka-commercial-offers.mjs create --stdin --yes --json
node scripts/hobbyka-commercial-offers.mjs view 14891864-1-1
node scripts/hobbyka-commercial-offers.mjs view 14891864-1-1 --check --json
node scripts/hobbyka-commercial-offers.mjs list --limit 10 --json
```

Файл для `--input` и stdin должен соответствовать телу API:

```json
{
  "basket_items": [{"ID": "7112", "QUANTITY": 2}],
  "props": {
    "COMPANY": "ООО Хоббика",
    "PERSON": "Иван Иванов",
    "PHONE": "+7 999 123-45-67",
    "EMAIL": "client@example.com",
    "OBJECT": "Благоустройство парка"
  },
  "copy_number": null
}
```

## Границы безопасности

- Считать `create` внешней записью: всегда использовать `--dry-run` перед `--yes`.
- Не менять URL API. Разрешать другой хост только для доверенного тестового стенда через `HOBBYKA_CO_ALLOW_CUSTOM_HOST=1`; localhost разрешён для тестов.
- Не сохранять контактные реквизиты в репозитории, логах или локальной истории CLI.
- Не удалять и не изменять существующие КП: CLI намеренно не содержит таких команд.
- Не обещать, что произвольный номер существует, если `view` не запускался с `--check` или сервер не подтвердил страницу.
- Учитывать, что API может отвечать десятки секунд; таймаут задаётся через `HOBBYKA_CO_TIMEOUT_MS`.

## Настройки

По умолчанию используются API и сайт `https://hobbyka.ru`. Необязательные переменные:

```env
HOBBYKA_CO_API_URL=https://hobbyka.ru/api/commercial-offers/?action=createCommercialOffer
HOBBYKA_CO_WEB_BASE_URL=https://hobbyka.ru
HOBBYKA_CO_TIMEOUT_MS=60000
HOBBYKA_CO_HISTORY_FILE=~/.config/hobbyka/commercial-offers-history.json
```
