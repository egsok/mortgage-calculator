# Калькулятор первоначального взноса

Telegram Mini App для расчёта времени накопления на первоначальный взнос по ипотеке (или полную стоимость квартиры).

## Функциональность

### Входные данные
- **Стоимость квартиры**: 3 000 000 — 100 000 000 ₽
- **Первоначальный взнос**: 10% — 100%
- **Доход в месяц**: 50 000 — 2 000 000 ₽
- **Расходы в месяц**: 30 000 — 1 500 000 ₽
- **Уже накоплено**: 0 — 20 000 000 ₽

### Расчёт
```
Цель = Стоимость × (Взнос% / 100)
Остаток = max(0, Цель - Накоплено)
Ежемесячные накопления = Доход - Расходы
Месяцев до цели = Остаток / Ежемесячные накопления
```

### Результаты
- **Цель**: сумма первоначального взноса (или "квартира без ипотеки" при 100%)
- **При текущем темпе**: срок накопления
- **Если откладывать +50 000 ₽**: ускоренный срок
- **Если откладывать +100 000 ₽**: ещё более ускоренный срок

### Сценарии (edge cases)
1. **already_saved** — уже накоплено достаточно → показываем поздравление
2. **no_savings** — расходы >= доход → показываем предупреждение
3. **normal** — стандартный расчёт с тремя вариантами срока

### Категории срока
Адаптивные пороги в зависимости от размера взноса:

| Взнос | "Долго" | "Очень долго" |
|-------|---------|---------------|
| < 50% | 5 лет | 10 лет |
| 50-64% | 6 лет | 12 лет |
| ≥ 65% | 7 лет | 15 лет |

## Архитектура

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Telegram App   │────▶│    api.php      │────▶│    SaleBot      │
│  (frontend JS)  │     │  (PHP proxy)    │     │    CRM API      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                        ┌──────┴──────┐
                        │ config.php  │
                        │ (API keys)  │
                        └─────────────┘
```

- **Frontend** — чистый HTML/CSS/JS, работает в Telegram WebView
- **api.php** — безопасный прокси, хранит API ключ на сервере
- **config.php** — конфиденциальные данные (не в git)

## Интеграция с CRM (SaleBot)

### Endpoint
```
POST https://chatter.salebot.pro/api/{API_KEY}/tg_callback
```

### Payload (flat format)
Каждый параметр автоматически сохраняется как переменная сделки в SaleBot:

```json
{
  "user_id": 68366024,
  "group_id": "financeforitbot",
  "message": "calculator_result",
  "calc_apartment_price": 15000000,
  "calc_down_payment_pct": 30,
  "calc_income": 350000,
  "calc_expenses": 200000,
  "calc_savings": 200000,
  "calc_monthly_savings": 150000,
  "calc_target_amount": 4500000,
  "calc_result_months": 29,
  "calc_scenario_type": "normal",
  "calc_term_category": "normal",
  "calc_start_param": "ad_campaign_1",
  "calc_timestamp": "2025-12-06T16:05:00.000Z"
}
```

### Переменные в SaleBot
После расчёта в карточке клиента появятся:
- `calc_apartment_price` — стоимость квартиры
- `calc_down_payment_pct` — процент взноса
- `calc_income` — доход
- `calc_expenses` — расходы
- `calc_savings` — накопления
- `calc_monthly_savings` — ежемесячные накопления
- `calc_target_amount` — целевая сумма
- `calc_result_months` — месяцев до цели (-1 если невозможно)
- `calc_scenario_type` — тип сценария
- `calc_term_category` — категория срока
- `calc_start_param` — UTM/start параметр
- `calc_timestamp` — время расчёта

## Безопасность

### Реализованные меры

| Мера | Описание |
|------|----------|
| **API ключ на сервере** | Ключ хранится в `config.php`, не попадает в git и не виден клиенту |
| **Origin/Referer проверка** | Только запросы с разрешённых доменов |
| **Content-Type валидация** | Только `application/json` принимается |
| **Payload size limit** | Максимум 16KB на запрос |
| **Rate limiting** | 10 запросов в минуту на IP |
| **Input validation** | Проверка `user_id` (numeric) и `message` (required) |
| **Timeout protection** | curl таймауты 5s/10s |
| **Error logging** | Ошибки в отдельный файл, не раскрываются клиенту |

### Файлы вне git
- `config.php` — API ключи
- `api-errors.log` — логи ошибок

## Файловая структура

```
mortgage-calculator/
├── index.html              # Основная разметка
├── api.php                 # Безопасный прокси для SaleBot
├── config.php              # API ключи (не в git)
├── config.example.php      # Шаблон конфигурации
├── .gitignore
├── README.md
├── css/
│   └── style.css           # Стили (CSS Variables, анимации)
└── js/
    ├── format.js           # Форматирование чисел и дат
    ├── calculator.js       # Логика расчётов и валидация
    ├── telegram.js         # Интеграция с Telegram и CRM
    └── app.js              # Главный контроллер приложения
```

## Дизайн

- **Тема**: тёмная (Dark Luxury)
- **Основной цвет**: `#0F172A`
- **Акцент**: `#00D97E` (зелёный)
- **Шрифты**: Unbounded (заголовки), Manrope (текст)
- **Слайдеры**: увеличенные для мобильных (32px thumb, 8px track)
- **Анимации**: плавные переходы, staggered появление элементов

### Особенности мобильной версии
- `format-detection: telephone=no` — отключение автоопределения телефонов на iOS
- Скрытый scrollbar с сохранением прокрутки
- Safe area поддержка для iPhone с чёлкой
- Haptic feedback в Telegram

## Деплой

### Требования
- PHP 7.4+ с curl
- HTTPS обязателен для Telegram Mini App
- Запись в `sys_get_temp_dir()` для rate limiting

### Установка

1. Клонировать репозиторий:
```bash
git clone https://github.com/egsok/mortgage-calculator.git
cd mortgage-calculator
```

2. Создать конфигурацию:
```bash
cp config.example.php config.php
nano config.php
```

3. Заполнить `config.php`:
```php
<?php
return [
    'api_key' => 'YOUR_SALEBOT_API_KEY',
    'group_id' => 'YOUR_BOT_USERNAME'
];
```

4. Настроить Mini App в @BotFather:
   - `/newapp` или `/editapp`
   - Указать URL: `https://your-domain.com/mortgage-calculator/`

### Обновление
```bash
cd /var/www/your-site/mortgage-calculator
git pull
```

`config.php` не перезапишется — он в `.gitignore`.

## Локальная разработка

```bash
# Запуск локального сервера
npx http-server -p 8080

# Открыть в браузере
open http://localhost:8080
```

В браузере работает mock-режим с тестовыми данными пользователя (user_id: 123456789).

## Telegram Integration

### Haptic Feedback
- `selection` — при изменении слайдера
- `impact light` — при отпускании слайдера, переключении экранов
- `notification success` — при успешном расчёте
- `notification error` — при ошибке валидации

### Deep Links
Start параметр из ссылки `t.me/bot?startapp=campaign_1` сохраняется в `calc_start_param` для аналитики.
