# 📝 EditOrderModal — Последняя рабочая версия

> **⚠️ ВАЖНО:** Данная версия `EditOrderModal.js` является **последней рабочей версией** и **референсной реализацией**.  
> Все изменения должны быть согласованы и протестированы перед внесением.

**Файл:** `app/admin/features/orders/modals/EditOrderModal.js`  
**Дата фиксации:** Январь 2026  
**Версия:** Final Working Version (3-Layer Architecture)

---

## 🎯 Ключевые особенности

### ✅ 3-Layer Architecture (Трёхслойная архитектура)
- **LAYER 1: Domain/Logic Layer** (`useEditOrderPermissions`) — чистая логика разрешений, без UI и state
- **LAYER 2: State & Data Orchestration Layer** (`useEditOrderState`) — единый источник истины для состояния, цены, сохранения
- **LAYER 3: UI/Presentation Layer** (`EditOrderModal`) — "глупый" компонент, только рендеринг и вызовы handlers

### ✅ Live Conflict Recalculation
- Конфликты пересчитываются **в реальном времени** при изменении времени/дат
- Использует `useEditOrderConflicts` хук с правильными зависимостями
- Блокирующие сообщения исчезают **мгновенно** после разрешения конфликта
- **НЕ требует** сохранения или запросов к серверу для отображения конфликтов

### ✅ RBAC (Role-Based Access Control)
- **Единый источник истины:** `domain/orders/admin-rbac.js`
- Роли определяются **ТОЛЬКО** из `session.user`, **НИКОГДА** из заказа
- Использует `ROLE.ADMIN = 1` и `ROLE.SUPERADMIN = 2` из `models/user.js`
- Тип заказа определяется **ТОЛЬКО** через `order.my_order`:
  - `my_order === true` → Клиентский заказ
  - `my_order === false` → Админский заказ

### ✅ Athens Timezone (Строгое соблюдение)
- Все операции с временем используют **Athens timezone** через `athensTime.js`
- **Дыры закрыты:**
  - `athensNow()` — текущее время в Athens (не локальное)
  - `athensStartOfDay()` — парсинг "YYYY-MM-DD" как Athens дата
  - `reinterpretAsAthens()` — переинтерпретация dayjs из TimePicker как Athens
- Конвертация в UTC только при сохранении (`toServerUTC`)

### ✅ Unified Update API
- Использует единый endpoint: `PATCH /api/order/update/[orderId]`
- Один запрос вместо множественных частичных обновлений
- Полная валидация конфликтов на сервере
- **Исправлено:** Поля клиента сохраняются даже при одновременном изменении дат/цены

### ✅ Price Calculation (Единый источник истины)
- Сервер (`/api/order/calcTotalPrice`) — **ЕДИНСТВЕННЫЙ** калькулятор цены
- Пересчет при изменении: дат, insurance, childSeats
- Защита от race conditions (requestId + AbortController)
- Ручной режим (`isManualTotalPrice`) — сервер обновляет только `numberOfDays`, не `totalPrice`

---

## 🏗️ Архитектура

### 3-Layer Architecture

```
EditOrderModal (UI Layer)
├── useEditOrderPermissions (Domain/Logic Layer)
│   ├── canEditOrder
│   ├── canEditPricing
│   ├── canDeleteOrder
│   ├── canConfirmOrder
│   ├── canEditOrderField
│   └── fieldPermissions (map)
├── useEditOrderState (State & Data Orchestration Layer)
│   ├── editedOrder (state)
│   ├── startTime / endTime (Athens timezone)
│   ├── isManualTotalPrice (flag)
│   ├── price calculation (server-only)
│   ├── updateField / updateStartDate / updateEndDate / updateStartTime / updateEndTime
│   ├── handleSave (unified update)
│   ├── handleDelete
│   └── handleConfirmToggle
└── useEditOrderConflicts (Live conflict analysis)
    ├── analyzeOrderTimeConflicts
    ├── athensTime.js
    └── company.bufferTime
```

### State Management Flow

```javascript
// LAYER 1: Permissions (Domain/Logic)
const permissions = useEditOrderPermissions(order, currentUser, isViewOnly);
// Returns: { viewOnly, isCurrentOrder, fieldPermissions, canEdit, canDelete, canConfirm }

// LAYER 2: State & Data Orchestration
const {
  editedOrder,        // Single source of truth for order data
  startTime,         // Athens timezone dayjs
  endTime,           // Athens timezone dayjs
  isUpdating,
  updateField,       // Generic field updater
  updateStartDate,   // Athens date parser
  updateEndDate,     // Athens date parser
  updateStartTime,   // Athens time reinterpretation
  updateEndTime,     // Athens time reinterpretation
  handleSave,        // Unified save handler
  handleDelete,
  handleConfirmToggle,
} = useEditOrderState({
  order,
  cars,
  company,
  permissions,
  onSave,
  onClose,
  fetchAndUpdateOrders,
  setCarOrders,
});

// LAYER 3: UI (Presentation)
// EditOrderModal just renders and calls handlers
<TextField
  value={editedOrder.customerName}
  onChange={(e) => updateField("customerName", e.target.value)}
  disabled={permissions.viewOnly || !permissions.fieldPermissions.customerName}
/>
```

### Price Calculation Flow

```javascript
// useEditOrderState handles price calculation
useEffect(() => {
  // Skip if manual mode or first open
  if (isFirstOpen.current || isManualTotalPrice) return;
  
  // Normalize inputs
  const normalizedInsurance = editedOrder?.insurance || "TPL";
  const normalizedChildSeats = Number(editedOrder?.ChildSeats ?? editedOrder?.childSeats ?? 0);
  
  // Fetch from server (ONLY calculator)
  fetch("/api/order/calcTotalPrice", {
    body: JSON.stringify({
      carNumber: selectedCar.carNumber,
      rentalStartDate: formatDateYYYYMMDD(editedOrder.rentalStartDate),
      rentalEndDate: formatDateYYYYMMDD(editedOrder.rentalEndDate),
      kacko: normalizedInsurance,
      childSeats: normalizedChildSeats,
    }),
  });
  
  // Update state (respect manual mode)
  if (isManualTotalPrice) {
    // Only update numberOfDays
    setEditedOrder(prev => ({ ...prev, numberOfDays: safeDays }));
  } else {
    // Update both numberOfDays and totalPrice
    setEditedOrder(prev => ({ ...prev, numberOfDays: safeDays, totalPrice: safeTotalPrice }));
  }
}, [
  selectedCar?.carNumber,
  editedOrder?.rentalStartDate,
  editedOrder?.rentalEndDate,
  normalizedInsurance,  // Memoized
  normalizedChildSeats,  // Memoized
  isManualTotalPrice,
]);
```

---

## 🔑 Критические инварианты

### 1. Order Type Determination
```javascript
// ✅ ПРАВИЛЬНО: Тип заказа определяется ТОЛЬКО через my_order
isClientOrder(order)      // order.my_order === true
isAdminCreatedOrder(order) // order.my_order === false

// ❌ НЕПРАВИЛЬНО: НЕ использовать createdByRole
// ❌ НЕПРАВИЛЬНО: НЕ использовать isSuperadminOrder(order)
```

### 2. Role Resolution
```javascript
// ✅ ПРАВИЛЬНО: Роль определяется ТОЛЬКО из user/session
isSuperAdmin(user)  // user.role === ROLE.SUPERADMIN (2)
isAdmin(user)       // user.role === ROLE.ADMIN (1)

// ❌ НЕПРАВИЛЬНО: НЕ определять роль из заказа
// ❌ НЕПРАВИЛЬНО: НЕ использовать normalizeUserRole
```

### 3. Time Handling (Athens-Only Rule)
```javascript
// ✅ ПРАВИЛЬНО: Athens timezone для всех операций
const todayStr = athensNow().format("YYYY-MM-DD");  // Not dayjs()
const athensDate = athensStartOfDay("2026-01-15");  // Not dayjs("2026-01-15")
const athensTime = reinterpretAsAthens(pickerDayjs, dateStr);  // Not direct use

// ❌ НЕПРАВИЛЬНО: Прямая работа с UTC или browser timezone
// ❌ НЕПРАВИЛЬНО: dayjs() без timezone
// ❌ НЕПРАВИЛЬНО: dayjs(e.target.value) для DatePicker
```

### 4. Price Calculation (Single Source of Truth)
```javascript
// ✅ ПРАВИЛЬНО: Server is ONLY calculator
const response = await fetch("/api/order/calcTotalPrice", { ... });
// UI never calculates price

// ✅ ПРАВИЛЬНО: Manual mode respects user override
if (isManualTotalPrice) {
  // Server updates ONLY numberOfDays, never totalPrice
} else {
  // Server updates both numberOfDays and totalPrice
}

// ❌ НЕПРАВИЛЬНО: UI calculating price
// ❌ НЕПРАВИЛЬНО: Multiple sources of truth
```

### 5. State Management (Single Source of Truth)
```javascript
// ✅ ПРАВИЛЬНО: useEditOrderState owns all state
const { editedOrder, startTime, endTime } = useEditOrderState({ ... });
// UI consumes state, never mutates directly

// ❌ НЕПРАВИЛЬНО: UI managing state
// ❌ НЕПРАВИЛЬНО: Syncing state from props after first load
```

### 6. Customer Fields Persistence
```javascript
// ✅ ПРАВИЛЬНО: Always include customer fields in payload if permission allows
if (fieldPermissions.customerName !== false) {
  if (editedOrder.customerName !== undefined) {
    payload.customerName = editedOrder.customerName || "";
  }
}
// Backend handles customer fields even when hasDateTimeChanges is true

// ❌ НЕПРАВИЛЬНО: Skipping customer fields if hasDateTimeChanges is true
```

---

## 📋 Функциональность

### Редактирование заказа
- ✅ Изменение дат аренды (с валидацией, Athens timezone)
- ✅ Изменение времени (pickup/return, Athens timezone)
- ✅ Изменение контактных данных клиента (customerName, phone, email) — **ИСПРАВЛЕНО**
- ✅ Изменение места получения/возврата
- ✅ Изменение страховки и детских кресел (пересчет цены) — **ИСПРАВЛЕНО**
- ✅ Изменение цены (с ограничениями для админов, ручной режим)
- ✅ Подтверждение/снятие подтверждения заказа
- ✅ Удаление заказа (с ограничениями)

### Валидация
- ✅ Live-пересчет конфликтов времени
- ✅ Блокировка сохранения при блокирующих конфликтах
- ✅ Предупреждения при pending конфликтах
- ✅ Валидация дат (нельзя выбрать прошлые даты, Athens timezone)
- ✅ Валидация времени для текущих заказов

### Permissions (RBAC)
- ✅ `canEditOrder` — общая проверка редактирования
- ✅ `canEditPricing` — проверка редактирования цены/дат/времени
- ✅ `canDeleteOrder` — проверка удаления
- ✅ `canConfirmOrder` — проверка подтверждения
- ✅ `canEditOrderField` — проверка редактирования конкретного поля

### Price Calculation
- ✅ Автоматический пересчет при изменении: дат, insurance, childSeats
- ✅ Ручной режим (isManualTotalPrice) — пользователь может переопределить цену
- ✅ Защита от race conditions (requestId + AbortController)
- ✅ Нормализация входных данных (insurance → "TPL" default, childSeats → 0 default)

---

## 🚫 Что НЕЛЬЗЯ менять

### ❌ Запрещенные изменения

1. **НЕ удалять** 3-layer architecture (useEditOrderPermissions, useEditOrderState, EditOrderModal)
2. **НЕ удалять** live conflict recalculation логику
3. **НЕ изменять** зависимости `useEditOrderConflicts` без тестирования
4. **НЕ использовать** `createdByRole` для определения типа заказа
5. **НЕ использовать** `normalizeUserRole` — роль должна быть числом (1 или 2)
6. **НЕ изменять** логику работы с Athens timezone (athensNow, athensStartOfDay, reinterpretAsAthens)
7. **НЕ разбивать** unified update API на множественные запросы
8. **НЕ удалять** проверки `hasBlockingConflict` перед сохранением
9. **НЕ добавлять** UI-level price calculations — только server
10. **НЕ синхронизировать** state из props после первого открытия

### ⚠️ Требует осторожности

1. Изменение структуры `editedOrder` state в useEditOrderState
2. Изменение логики `useEditOrderConflicts` hook
3. Изменение RBAC permission checks
4. Изменение валидации дат/времени
5. Изменение логики price calculation (normalization, manual mode)

---

## 🧪 Тестирование

### Критические сценарии для проверки

1. **Live conflict recalculation:**
   - Изменить время pickup → конфликты должны обновиться мгновенно
   - Изменить дату return → конфликты должны обновиться мгновенно
   - Разрешить конфликт → блокирующее сообщение должно исчезнуть

2. **RBAC permissions:**
   - Админ не может редактировать клиентские заказы (если `ADMIN_CAN_EDIT_CLIENT_* = false`)
   - Суперадмин может редактировать все заказы
   - Админ может редактировать только свои админские заказы

3. **Timezone handling:**
   - Время отображается в Athens timezone
   - Время сохраняется в UTC
   - Конфликты анализируются в Athens timezone
   - DatePicker парсит "YYYY-MM-DD" как Athens дату
   - TimePicker переинтерпретируется как Athens время

4. **Unified update:**
   - Один запрос при сохранении
   - Все поля обновляются атомарно
   - Конфликты проверяются на сервере
   - **Поля клиента сохраняются даже при одновременном изменении дат/цены**

5. **Price calculation:**
   - Изменение insurance → цена пересчитывается автоматически
   - Изменение childSeats → цена пересчитывается автоматически
   - Изменение дат → цена пересчитывается автоматически
   - Ручной ввод цены → сервер обновляет только numberOfDays
   - Нет мигания цены (race condition protection)

6. **Customer fields persistence:**
   - Изменение customerName/phone/email → сохраняется в БД
   - После сохранения и переоткрытия → значения сохраняются
   - Поля сохраняются даже при одновременном изменении дат/цены

---

## 📚 Связанные документы

- [ORDER_FLOW.md](./ORDER_FLOW.md) — Полное описание flow создания заказа
- [TIMEZONE_GUIDE.md](./TIMEZONE_GUIDE.md) — Работа с временными зонами
- [MY_ORDER_FIELD.md](./MY_ORDER_FIELD.md) — Описание поля `my_order`

---

## 🔗 Связанные файлы

### Core Files
- `app/admin/features/orders/modals/EditOrderModal.js` — UI Layer (Presentation)
- `app/admin/features/orders/hooks/useEditOrderPermissions.js` — Domain/Logic Layer
- `app/admin/features/orders/hooks/useEditOrderState.js` — State & Data Orchestration Layer
- `app/admin/features/orders/hooks/useEditOrderConflicts.js` — Live conflict analysis
- `domain/orders/admin-rbac.js` — RBAC логика
- `domain/orders/orderPermissions.js` — Дополнительные permission checks
- `domain/time/athensTime.js` — Athens timezone utilities

### API
- `app/api/order/update/[orderId]/route.js` — Unified update endpoint
- `app/api/order/calcTotalPrice/route.js` — Price calculation endpoint
- `utils/action.js` — API actions

### Components
- `app/components/calendar-ui/MuiTimePicker.js` — Time picker компонент

### Models
- `models/order.js` — Order schema (с импортом Car для pre-save middleware)
- `models/car.js` — Car schema

---

## 📝 Changelog

### Январь 2026 — Final Working Version (3-Layer Architecture)

#### Major Refactoring
- ✅ **3-Layer Architecture:** Разделение на Domain/Logic, State/Data Orchestration, UI/Presentation слои
- ✅ **useEditOrderPermissions:** Централизованная логика разрешений
- ✅ **useEditOrderState:** Единый источник истины для состояния, цены, сохранения

#### Fixes
- ✅ **Customer fields persistence:** Поля клиента сохраняются даже при одновременном изменении дат/цены
- ✅ **Price recalculation:** Пересчет при изменении insurance и childSeats
- ✅ **kaskoPrice display:** Исправлено отображение цены КАСКО (используется selectedCar из хука)
- ✅ **Timezone holes closed:** athensNow(), athensStartOfDay(), reinterpretAsAthens()
- ✅ **Car model registration:** Исправлена ошибка MissingSchemaError для Car в pre-save middleware

#### Improvements
- ✅ **Race condition protection:** requestId + AbortController для price calculation
- ✅ **Manual price mode:** Сервер обновляет только numberOfDays, не totalPrice
- ✅ **Normalized inputs:** insurance → "TPL" default, childSeats → 0 default
- ✅ **DEV logging:** Подробное логирование payload и response для отладки

### Предыдущие версии
- ✅ Восстановлена live conflict recalculation
- ✅ Рефакторинг RBAC (единый `admin-rbac.js`)
- ✅ Удалена зависимость от `USER_ROLES` и `createdByRole`
- ✅ Упрощена логика определения ролей
- ✅ Unified update API (один endpoint вместо множественных)
- ✅ Исправлена работа с Athens timezone

---

## ⚡ Быстрая справка

### Как проверить, что всё работает?

1. **Live conflict recalculation:**
   - Откройте заказ в EditOrderModal
   - Измените время pickup/return
   - **Ожидаемое поведение:** Конфликты должны обновиться **мгновенно** без сохранения
   - Если есть блокирующий конфликт → кнопка "Сохранить" должна быть заблокирована
   - Разрешите конфликт → блокирующее сообщение должно **исчезнуть**

2. **Price calculation:**
   - Измените insurance → цена должна пересчитаться автоматически
   - Измените childSeats → цена должна пересчитаться автоматически
   - Введите цену вручную → сервер обновит только numberOfDays

3. **Customer fields:**
   - Измените customerName/phone/email
   - Сохраните заказ
   - Переоткройте заказ → значения должны сохраниться

4. **RBAC:**
   - Войдите как админ (role = 1)
   - Попробуйте отредактировать клиентский заказ (`my_order = true`)
   - **Ожидаемое поведение:** Поля должны быть заблокированы (если `ADMIN_CAN_EDIT_CLIENT_* = false`)
   - Войдите как суперадмин (role = 2)
   - **Ожидаемое поведение:** Все поля должны быть доступны для редактирования

---

**Последнее обновление:** Январь 2026  
**Статус:** ✅ Production Ready — Final Working Version (3-Layer Architecture)
