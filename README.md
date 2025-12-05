# Mortgage Calculator - Telegram Mini App

Калькулятор расчёта времени до первоначального взноса на квартиру. Telegram Mini App для сбора лидов в CRM.

## Функционал

- Расчёт времени накопления на первоначальный взнос
- Сравнение сценариев (+50k, +100k в месяц)
- Интеграция с SaleBot CRM
- Haptic feedback на мобильных устройствах
- Сохранение значений в localStorage

## Технологии

- HTML5 + CSS3 + Vanilla JS
- Telegram Web App SDK
- SaleBot API

## Структура

```
mortgage-calculator/
├── index.html          # Основной HTML файл
├── css/
│   └── style.css       # Стили (тёмная тема)
├── js/
│   ├── app.js          # Главный контроллер
│   ├── calculator.js   # Логика расчётов
│   ├── telegram.js     # Интеграция с Telegram
│   └── format.js       # Форматирование чисел
├── .gitignore
└── README.md
```

## Настройка

### 1. SaleBot API Key

В файле `js/telegram.js` замените `YOUR_SALEBOT_API_KEY` на ваш ключ API:

```javascript
salebot: {
    apiKey: 'YOUR_ACTUAL_API_KEY',
    baseUrl: 'https://chatter.salebot.pro/api'
}
```

### 2. Деплой на сервер

Разместите файлы на сервере с HTTPS (обязательно для Telegram Mini Apps).

Путь: `https://egorsokolov.ru/mortgage-calculator/`

### 3. Настройка бота в BotFather

1. Откройте @BotFather
2. Выберите вашего бота
3. Bot Settings → Menu Button или Configure Mini App
4. Укажите URL: `https://egorsokolov.ru/mortgage-calculator/`

## Direct Link для рекламы

Формат ссылки для рекламы:
```
https://t.me/YOUR_BOT/calculator?startapp=ad_campaign_name
```

Параметр `startapp` будет передан в CRM для отслеживания источника.

## Данные в CRM

При расчёте в SaleBot отправляется:

```json
{
  "action": "calculator_result",
  "apartment_price": 15000000,
  "down_payment_pct": 30,
  "income": 350000,
  "expenses": 200000,
  "savings": 500000,
  "result_months": 32,
  "target_amount": 4500000,
  "scenario_type": "normal",
  "start_param": "ad_campaign_name",
  "timestamp": "2025-12-05T..."
}
```

## Разработка

Для локальной разработки можно открыть `index.html` в браузере.
Приложение автоматически переключится в mock-режим без Telegram API.

## Edge Cases

| Ситуация | Поведение |
|----------|-----------|
| Расходы ≥ Доход | Показать предупреждение |
| Накопления ≥ Цели | Показать сообщение об успехе |
| Срок > 120 месяцев | Показать срок + пометку |

## Лицензия

MIT
