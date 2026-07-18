# Загрузка политик с внешнего API (Privacy, Cookie, Terms of Service)

Страницы **Privacy Policy** (`/privacy-policy`), **Cookie Policy** (`/cookie-policy`) и **Terms of Service** (`/terms-of-service`) получают текст не из статичных файлов, а с **внешнего API**. Ниже — как это устроено.

---

## 1. Где вызывается загрузка

- **Компонент:** `app/(legal)/_components/LegalPageContent.js` (client component).
- **Функция:** `getLegalDoc({ docType, lang, jur })` из `utils/action.js`.

Каждая из трёх страниц рендерит:

```js
<LegalPageContent docType="privacy-policy" forcedLang={locale} />
// или docType="cookie-policy" | "terms-of-service"
```

Внутри `LegalPageContent` при монтировании вызывается:

```js
const data = await getLegalDoc({ docType, lang, jur });
```

---

## 2. Внешний API (URL и параметры)

- **Базовый URL:** задаётся переменной окружения **`NEXT_PUBLIC_LEGAL_API`** (без завершающего слэша).
- **Эндпоинт:** `GET {NEXT_PUBLIC_LEGAL_API}/legal/{docType}?lang={lang}&jur={jur}`

Пример:

```
https://your-legal-api.com/legal/privacy-policy?lang=en&jur=EU
```

| Параметр | Значение | Описание |
|----------|----------|----------|
| `docType` | `privacy-policy` \| `terms-of-service` \| `cookie-policy` | Тип документа |
| `lang` | `en`, `el`, `ru` | Язык (из locale страницы или localStorage) |
| `jur` | `EU`, `IE`, `UA` | Юрисдикция (по умолчанию `EU`) |

Запрос выполняется **на клиенте** (в браузере), т.к. `LegalPageContent` — client component и `getLegalDoc` вызывается в `useEffect`.

---

## 3. Логика в `getLegalDoc` (utils/action.js)

1. **Проверка `docType`** — допускаются только `privacy-policy`, `terms-of-service`, `cookie-policy`.
2. **Проверка `NEXT_PUBLIC_LEGAL_API`** — если не задан, выбрасывается ошибка.
3. **Кэш в localStorage:**
   - Ключ: `legal:{docType}:{lang}:{jur}`.
   - Значение: `{ etag, data, savedAt }` (ETag с прошлого ответа и тело ответа).
4. **Запрос к API:**
   - В заголовки добавляется `If-None-Match: <etag>` при наличии кэша.
   - `fetch(apiUrl, { method: "GET", cache: "no-store" })`.
5. **Обработка ответа:**
   - **304 Not Modified** — возвращаются данные из кэша (без повторного парсинга тела).
   - **200 OK** — парсится JSON, проверяется структура (`data.content.sections` — массив). В кэш сохраняются новый ETag и `data`.
   - Иначе — ошибка.
6. **При ошибке сети/API:** если в кэше есть старые данные, они возвращаются с флагом `stale: true`; иначе выбрасывается исключение.

Ожидаемая структура ответа API:

```json
{
  "version": 1,
  "updatedAt": "2024-01-15T12:00:00Z",
  "content": {
    "title": "Privacy Policy",
    "jurisdiction": "EU",
    "sections": [
      { "id": "sec1", "text": "..." },
      { "id": "sec2", "text": "..." }
    ]
  }
}
```

---

## 4. Отображение на странице

`LegalPageContent` получает из `getLegalDoc` объект с `content.title` и `content.sections`. Рендер:

- заголовок страницы: `content.title`;
- блоки текста: для каждого `section` выводится `section.text` (с сохранением переносов строк, `whiteSpace: "pre-line"`).

Контейнер контента имеет отступы и ограничение ширины (как у других legal-страниц): `maxWidth: 820px`, `padding: 24px 20px 48px`.

---

## 5. Что не идёт с API: Rental Terms

Страница **Rental Terms** (`/rental-terms`) **не** использует внешний API. Её текст хранится локально в `app/data/terms.js` и рендерится компонентом `RentalTermsContent`. Выравнивание и отступы для неё сделаны такими же, как у политик (контейнер с `contentPadding`).

---

## 6. Переменные окружения

В `.env` или на хостинге должен быть задан:

```bash
NEXT_PUBLIC_LEGAL_API=https://your-legal-api.com
```

Без него загрузка политик (privacy, cookie, terms-of-service) падает с ошибкой при первом запросе.
