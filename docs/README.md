# 📚 Документация системы аренды автомобилей

## Содержание

### Основные документы

| Документ | Описание |
|----------|----------|
| [ORDER_FLOW.md](./ORDER_FLOW.md) | Полное описание flow создания заказа |
| [../domain/booking/ROVARO_MARKETPLACE_WORKFLOW.md](../domain/booking/ROVARO_MARKETPLACE_WORKFLOW.md) | **Канон marketplace:** заявка → подрядчик → Stripe Booking Fee → оплата → контакты |
| [../domain/admin/ROVARO_CONTRACTOR_ADMIN.md](../domain/admin/ROVARO_CONTRACTOR_ADMIN.md) | **Канон админки подрядчика:** Platform vs Internal, календарь, таблица, раздельные итоги |
| [ORDER_IMPROVEMENTS.md](./ORDER_IMPROVEMENTS.md) | Руководство по улучшениям системы |
| [TIMEZONE_GUIDE.md](./TIMEZONE_GUIDE.md) | Работа с временными зонами |
| [EDIT_ORDER_MODAL.md](./EDIT_ORDER_MODAL.md) | **Последняя рабочая версия EditOrderModal** ⭐ |

---

## Быстрый старт

### Создание заказа — как это работает?

1. **Клиент** выбирает даты → видит только занятые (confirmed) даты
2. **Админ** выбирает даты → видит все даты (confirmed + pending)
3. Система проверяет конфликты (`checkConflicts`)
4. При успехе — заказ создаётся
5. При конфликте — показывается ошибка или предупреждение

### Статусы заказов

| Код | Значение | Заказ создан? |
|-----|----------|---------------|
| 200 | Успех | ✅ |
| 202 | Есть pending конфликты | ✅ + предупреждение |
| 405 | Одинаковые даты | ❌ |
| 409 | Confirmed конфликт | ❌ |

### Временные зоны

**Правило:** Всё время = **Греческое время (Europe/Athens)**

```javascript
// Сохранение
const greekTime = dayjs.tz("2026-01-15 10:00", "Europe/Athens");
const utcTime = greekTime.utc().toDate();  // В БД

// Отображение
const dbTime = order.timeIn;
const displayTime = dayjs(dbTime).tz("Europe/Athens").format("HH:mm");
```

---

## Структура проекта (ключевые файлы)

```
car/
├── app/
│   ├── components/
│   │   ├── Admin/Order/
│   │   │   ├── AddOrderModal.js     # Форма создания (админ)
│   │   │   ├── EditOrderModal.js    # Форма редактирования ⭐ (см. EDIT_ORDER_MODAL.md)
│   │   │   └── CalendarAdmin.js     # Календарь админа
│   │   ├── CarComponent/
│   │   │   ├── BookingModal.js      # Форма создания (клиент)
│   │   │   └── CalendarPicker.js    # Выбор дат
│   │   └── Calendars/
│   │       ├── BigCalendar.js       # Главный календарь
│   │       └── MuiTimePicker.js     # Выбор времени
│   └── api/order/
│       ├── add/route.js             # API создания
│       └── update/*/route.js        # API обновления
├── utils/
│   ├── analyzeDates.js              # Анализ дат и конфликтов
│   ├── action.js                    # API вызовы
│   └── functions.js                 # Вспомогательные функции
├── models/
│   ├── order.js                     # Mongoose схема заказа
│   └── car.js                       # Mongoose схема машины
└── docs/
    ├── README.md                    # Этот файл
    ├── ORDER_FLOW.md                # Flow заказов
    ├── ORDER_IMPROVEMENTS.md        # Улучшения
    ├── TIMEZONE_GUIDE.md            # Временные зоны
    └── EDIT_ORDER_MODAL.md          # ⭐ Последняя рабочая версия EditOrderModal
```

---

## Роли пользователей

| Роль | Возможности |
|------|-------------|
| **Клиент** | Создание неподтверждённых заказов |
| **Админ** | Создание, подтверждение, редактирование заказов своей компании |
| **Суперадмин** | Полный доступ ко всем заказам и машинам |

---

## Контакты

По вопросам документации обращаться к разработчикам.

---

---

## ⭐ Важно

**EditOrderModal** — последняя рабочая версия зафиксирована в [EDIT_ORDER_MODAL.md](./EDIT_ORDER_MODAL.md).  
Все изменения должны быть согласованы и протестированы.

---

*Последнее обновление: Январь 2026*

