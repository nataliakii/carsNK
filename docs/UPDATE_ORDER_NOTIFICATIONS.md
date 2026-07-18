# Update order — что и куда отправляем

## Текущее состояние

### 1. Где происходит обновление заказа

| Место | Файл | Что обновляет |
|-------|------|----------------|
| **Основной PATCH** | `app/api/order/update/[orderId]/route.js` | Даты/время, цена, страховка, место возврата, данные клиента, подтверждение |
| **Switch confirm** | `app/api/order/update/switchConfirm/[orderId]/route.js` | Только `confirmed` (вкл/выкл) |
| **Change dates** | `app/api/order/update/changeDates/route.js` | Отдельный flow смены дат |
| **Move car** | `app/api/order/update/moveCar/route.js` | Перенос заказа на другую машину |

Сейчас **ни один** из этих API **не вызывает** `notifyOrderAction`. Уведомления при update **не отправляются**.

---

### 2. Политика уведомлений (если бы вызывали notifyOrderAction)

Источник: `domain/orders/orderNotificationPolicy.js` + `orderAccessPolicy.js`.

#### Тип действия (getActionFromChangedFields)

По **изменённым полям** определяется действие:

| Изменённые поля | OrderAction | Intent |
|-----------------|-------------|--------|
| `confirmed` → true | **CONFIRM** | ORDER_CONFIRMED |
| `confirmed` → false | **UNCONFIRM** | ORDER_UNCONFIRMED |
| `rentalStartDate`, `rentalEndDate`, `timeIn`, `timeOut`, `numberOfDays` | **UPDATE_DATES** | CRITICAL_EDIT |
| `totalPrice`, `OverridePrice` | **UPDATE_PRICING** | CRITICAL_EDIT |
| `insurance` | **UPDATE_INSURANCE** | SAFE_EDIT |
| `placeOut` | **UPDATE_RETURN** | SAFE_EDIT |
| Только клиент (customerName, phone, email, Viber, …) | **UPDATE_RETURN** (fallback) | SAFE_EDIT |

#### Когда уведомляем SUPERADMIN (notifySuperadminOnEdit)

`notifySuperadminOnEdit === true` только когда:
- роль **ADMIN** (не SUPERADMIN),
- заказ **клиентский** (`my_order === true`),
- заказ **подтверждён** (`confirmed === true`).

То есть: админ правит подтверждённый клиентский заказ → суперадмину уходили бы уведомления (если бы их вызывали).

#### Куда и что отправляется (по политике)

| Действие | Условие | Получатель | Каналы | Тема/причина |
|----------|---------|------------|--------|---------------|
| **CONFIRM** | Клиентский заказ | CUSTOMER | EMAIL | Order confirmed — customer notification |
| **CONFIRM** / **UNCONFIRM** | — | SUPERADMIN | — | Нет в политике (только CRITICAL/SAFE ниже) |
| **UPDATE_DATES** | notifySuperadminOnEdit | SUPERADMIN | TELEGRAM + EMAIL | CRITICAL: CRITICAL_EDIT on confirmed client order |
| **UPDATE_PRICING** | notifySuperadminOnEdit | SUPERADMIN | TELEGRAM + EMAIL | CRITICAL: CRITICAL_EDIT on confirmed client order |
| **UPDATE_INSURANCE** | notifySuperadminOnEdit | SUPERADMIN | TELEGRAM | INFO: SAFE_EDIT on confirmed client order |
| **UPDATE_RETURN** | notifySuperadminOnEdit | SUPERADMIN | TELEGRAM | INFO: SAFE_EDIT on confirmed client order |
| **DELETE** | — | DEVELOPERS | TELEGRAM | AUDIT: Client/Internal order deleted |

Для CRITICAL (UPDATE_DATES, UPDATE_PRICING) в уведомлении используется `includePII: access.canSeeClientPII`.  
Для SAFE (UPDATE_INSURANCE, UPDATE_RETURN) в политике задано `includePII: false`, но для target SUPERADMIN диспетчер всё равно отдаёт PII (логика в `orderNotificationDispatcher.js`).

---

### 3. Где нужно вызывать notifyOrderAction

Чтобы уведомления при update реально уходили, нужно вызывать `notifyOrderAction` **после успешного сохранения** заказа в тех же API, где сейчас его нет.

#### 3.1. `app/api/order/update/[orderId]/route.js`

После каждого успешного `order.save()` / `updatedOrder`:

1. Собрать **список изменённых полей** (из `payload`: только те ключи, что реально пришли и применились).
2. Определить действие:  
   `action = getActionFromChangedFields(changedFields, payload)`  
   (экспорт из `domain/orders/orderNotificationPolicy.js`).
3. Для **CONFIRM** / **UNCONFIRM** использовать действие `CONFIRM` или `UNCONFIRM` (уже заложено в `getActionFromChangedFields` по `payload.confirmed`).
4. Вызвать:
   ```js
   await notifyOrderAction({
     order: updatedOrderPlain,  // объект заказа после save (toObject())
     user: session.user,
     action,
     actorName: session.user?.name || session.user?.email,
     source: "BACKEND",
   });
   ```
   Вызов делать в `try/catch`, чтобы ошибка уведомлений не ломала ответ 200/201 (аналогично `app/api/order/add/route.js`).

Места в файле, после которых имеет смысл вызывать:
- после подтверждения (confirm): `order.confirmed = true; const updatedOrder = await order.save();` (и при unconfirm);
- после успешного обновления дат/времени/цены (нет конфликта 409/408): `const savedOrder = await order.save();` (ответ 201);
- при ответе 202 (конфликт с pending): после `const updatedOrder = await order.save();` — тоже можно уведомить с тем же action;
- после обновления только клиентских полей: `const updatedOrder = await order.save();` (ответ 200).

Важно: для одного PATCH может быть только один тип действия (confirm, dates, pricing, insurance, return, customer-only). Тип задаётся через `getActionFromChangedFields(fieldsToUpdate, payload)` в начале обработки (или по флагам `hasConfirmationChange`, `hasDateTimeChanges`, `hasCustomerChanges`), чтобы передать в `notifyOrderAction` один корректный `action`.

#### 3.2. `app/api/order/update/switchConfirm/[orderId]/route.js`

После успешного `order.save()`:
- при подтверждении: `action = "CONFIRM"`;
- при снятии подтверждения: `action = "UNCONFIRM"`.

Дальше тот же вызов `notifyOrderAction` с `order`, `user: session.user`, `source: "BACKEND"`.

---

### 4. Формат сообщений при update

В диспетчере для действий, отличных от `ORDER_CREATED`, используется общий формат (`formatNotificationText`), например:

- Заказ: `orderNumber` / `orderId`
- Авто: `carNumber`
- Действие: `action`
- Кто: `actorName`
- Источник: `source`
- Время: `timestamp`

Для UPDATE_* в payload попадают те же поля, что и для CREATE (orderNumber, carNumber, carModel, rentalStartDate, rentalEndDate, totalPrice, customerName, phone, email, Viber, Whatsapp, Telegram и т.д.), так что при `includePII`/SUPERADMIN текст может содержать и данные клиента. Специального блока «как для NEW ORDER» для update в коде сейчас нет — только общий блок.

---

### 5. Итог

| Вопрос | Ответ |
|--------|--------|
| **Отправляются ли сейчас уведомления при update?** | **Нет.** `notifyOrderAction` при update нигде не вызывается. |
| **Куда по политике должны уходить уведомления при update?** | SUPERADMIN (Telegram + email для UPDATE_DATES/UPDATE_PRICING; только Telegram для UPDATE_INSURANCE/UPDATE_RETURN); CUSTOMER (email при CONFIRM). |
| **Когда SUPERADMIN получает уведомления об update?** | Только если правит **ADMIN** и заказ **клиентский подтверждённый** (`notifySuperadminOnEdit === true`). |
| **Что нужно сделать?** | В `app/api/order/update/[orderId]/route.js` и в `app/api/order/update/switchConfirm/[orderId]/route.js` после успешного save вызывать `notifyOrderAction` с правильным `action` (через `getActionFromChangedFields` или по типу изменения). |

Если нужно, могу предложить конкретные патчи (diff) для этих двух роутов.
