# План рефакторинга: Conflict Logic + Date Utilities

## Цель

Устранить дублирование функций, разнесённых по API-роутам, и вынести их в единые domain-модули.

---

## 1. Карта дублирования

### 1.1 `checkConflictsFixed` — 3 копии

| Файл | Особенности |
|---|---|
| `app/api/order/update/[orderId]/route.js` | Базовая версия, `dayjs()` без TZ |
| `app/api/order/update/changeDates/route.js` | Идентична `[orderId]` |
| `app/api/order/update/moveCar/route.js` | **Отличается**: нормализует входы в `BUSINESS_TZ` |

**Логика**: Принимает массив заказов + `newStart`/`newEnd`. Проверяет пересечение интервалов. Возвращает `{ status: 409|202|null, data }`.

**Важно**: `moveCar` добавил TZ-нормализацию, которой нет в остальных двух копиях. Это потенциальный баг — нужно при рефакторинге взять версию `moveCar` как эталон.

### 1.2 `checkForResolvedConflicts` — 2 копии

| Файл | Особенности |
|---|---|
| `app/api/order/update/[orderId]/route.js` | Стандартная версия |
| `app/api/order/update/changeDates/route.js` | Идентична |

**Логика**: Для заказа с существующими конфликтами проверяет, разрешились ли они после смены дат. Возвращает `{ resolvedConflicts, stillConflictingOrders }`.

### 1.3 `timeAndDate` — 2 копии

| Файл | Особенности |
|---|---|
| `app/api/order/update/[orderId]/route.js` | Тривиальная обёртка |
| `app/api/order/update/changeDates/route.js` | Идентична |

**Логика**: `async (startDate, endDate, startTime, endTime) => ({ start: dayjs(startTime), end: dayjs(endTime) })`. Просто проксирует `startTime`/`endTime` как dayjs-объекты. Можно удалить и использовать dayjs напрямую.

### 1.4 `checkConflicts` (utils/analyzeDates.js) — отдельная версия

Используется только в `order/add/route.js`. Реализует другой подход: работает через `analyzeDates()` и проверяет `isStart`/`isEnd`/`isBetween`. Более старый код.

### 1.5 `toBusinessStartOfDay` — 2 реализации

| Файл | Реализация |
|---|---|
| `domain/time/businessDate.js` (новый, shared) | Простая: string → `dayjs.tz()`, Date → `dayjs().tz()`. Не обрабатывает null. |
| `models/car.js` (внутренняя) | Через `parseDateInBusinessTz()`: обрабатывает null, dayjs, Date, string. Возвращает `null` при невалидном вводе. |

---

## 2. Существующие domain-аналоги

| Domain-модуль | Что делает | Где используется |
|---|---|---|
| `domain/booking/analyzeOrderTimeConflicts.js` | Анализ конфликтов для **UI календаря** (детальные сообщения, buffer, day-by-day) | `EditOrderModal` (frontend) |
| `domain/booking/analyzeConfirmationConflicts.js` | Анализ конфликтов при **подтверждении** (block/warning, buffer) | `update/[orderId]` (confirmation flow) |
| `domain/booking/conflictValidation.js` | Расширенная валидация с метаданными (ownership, origin) | Не используется активно |
| `utils/analyzeDates.js` → `checkConflicts` | Старая проверка для **создания** заказа | `order/add/route.js` |

**Проблема**: Каждый контекст (создание, обновление дат, перемещение, подтверждение, UI) имеет свою копию с небольшими отличиями.

---

## 3. План рефакторинга

### Фаза A: Unified Overlap Check (низкий риск)

**Цель**: Одна чистая функция проверки пересечения интервалов.

1. Создать `domain/booking/checkOrderOverlap.js`:
   ```
   function checkOrderOverlap(allOrders, newStart, newEnd, options?)
   ```
   - Взять за основу версию из `moveCar` (с TZ-нормализацией)
   - Возвращает `{ status: 409|202|null, data: { conflictMessage, conflictDates, conflictOrdersIds, conflictingOrders } }`
   - Опциональный `options.excludeOrderId` для фильтрации текущего заказа
   - Опциональный `options.timezone` (default: `BUSINESS_TZ`)

2. Создать `domain/booking/resolveConflicts.js`:
   ```
   async function checkForResolvedConflicts(order, newStart, newEnd)
   ```
   - Перенести из `[orderId]/route.js`

3. Обновить потребителей:
   - `update/[orderId]/route.js` → импорт из domain
   - `update/changeDates/route.js` → импорт из domain
   - `update/moveCar/route.js` → импорт из domain

4. Удалить `timeAndDate` — заменить на `dayjs()` напрямую

**Риски**: Минимальные — функции идентичны (кроме TZ в moveCar, который является улучшением).

**Тестирование**: Ручная проверка всех трёх сценариев:
   - Обновление заказа с конфликтом (202)
   - Обновление заказа с блокирующим конфликтом (409)
   - Перемещение заказа на машину с конфликтом

### Фаза B: Унификация `toBusinessStartOfDay` (низкий риск)

**Цель**: Одна функция с null-safety для всех потребителей.

1. Обновить `domain/time/businessDate.js`:
   - Добавить null/undefined → return null (как в `car.js`)
   - Добавить проверку `isValid()` → return null
   - Сохранить обратную совместимость (существующие вызовы не передают null)

2. Обновить `models/car.js`:
   - Заменить внутренние `parseDateInBusinessTz` + `toBusinessStartOfDay` на импорт из `domain/time/businessDate.js`
   - Удалить дублирующие функции

**Риски**: Низкие, но требует проверки `calculateTotalRentalPricePerDay` — это критический метод. Поведение при null должно остаться идентичным.

**Тестирование**: 
   - Создание заказа → проверить что цена считается корректно
   - Обновление заказа с разными форматами дат

### Фаза C: Унификация `checkConflicts` из `utils/analyzeDates.js` (средний риск)

**Цель**: Привести `order/add/route.js` к использованию `checkOrderOverlap` из domain.

**Проблема**: `checkConflicts` в `analyzeDates.js` имеет **другую** сигнатуру и логику:
- Работает через `analyzeDates()` (парсинг дат в confirmed/nonConfirmed массивы)
- Использует `isBetween` вместо прямого сравнения
- Обрабатывает больше кейсов (status 200 — полный блок от дат)

**Варианты**:
- **A**: Заменить `checkConflicts` на `checkOrderOverlap` в `order/add` → нужно проверить все edge cases
- **B**: Оставить `checkConflicts` в `analyzeDates.js` как есть, задокументировать как "legacy creation-only conflict check"

**Рекомендация**: Вариант B на данном этапе. `order/add` — критический путь (клиентские бронирования), менять conflict logic рискованно.

### Фаза D: Консолидация conflict API (высокий риск, отдельный этап)

**Цель**: Единый conflict-checking pipeline для всех контекстов.

Это объединение:
- `checkOrderOverlap` (creation/update — overlap check)
- `analyzeOrderTimeConflicts` (UI — day-level, buffer, messages)  
- `analyzeConfirmationConflicts` (confirmation — block/warning)
- `conflictValidation` (extended metadata)

В единый модуль `domain/booking/conflictEngine.js` с разными "профилями" вызова:
```
conflictEngine.checkForCreation(...)
conflictEngine.checkForUpdate(...)
conflictEngine.checkForConfirmation(...)
conflictEngine.analyzeForUI(...)
```

**Это отдельный проект**, не часть текущего рефакторинга. Требует:
- Полное покрытие тестами текущего поведения
- Постепенная миграция по одному потребителю

---

## 4. Приоритеты

| Фаза | Риск | Усилия | Рекомендация |
|---|---|---|---|
| A: Unified Overlap Check | Низкий | ~2ч | **Делать первой** |
| B: toBusinessStartOfDay | Низкий | ~1ч | Делать вместе с A |
| C: checkConflicts в add | Средний | ~2ч | Отложить |
| D: Conflict Engine | Высокий | ~8-12ч | Отдельный проект |

---

## 5. Файлы, затронутые рефакторингом

### Фаза A+B:
- **Создать**: `domain/booking/checkOrderOverlap.js`
- **Создать**: `domain/booking/resolveConflicts.js`
- **Изменить**: `domain/time/businessDate.js` (null-safety)
- **Изменить**: `models/car.js` (импорт вместо inline)
- **Изменить**: `app/api/order/update/[orderId]/route.js` (импорт)
- **Изменить**: `app/api/order/update/changeDates/route.js` (импорт)
- **Изменить**: `app/api/order/update/moveCar/route.js` (импорт)

### Не трогать:
- `utils/analyzeDates.js` → используется в `order/add` (клиентские бронирования)
- `domain/booking/analyzeOrderTimeConflicts.js` → UI-специфичная логика
- `domain/booking/analyzeConfirmationConflicts.js` → confirmation-специфичная логика
- `domain/booking/conflictValidation.js` → extended metadata
