# lead-automation-demo
mail+telegram automatization
# Lead Auto-Response & Notification System

A lightweight automation built with n8n that solves a common problem for local service businesses: leads going unanswered while staff are busy, leading to lost customers.

## What it does

When a customer submits an inquiry through a web form, the system instantly:
- Sends the customer a personalized thank-you email confirming their request was received, including their original message
- Notifies the business owner in real time via Telegram, so no lead sits unanswered

## Why it matters

Response speed is one of the biggest factors in converting an inquiry into a paying customer. This automation closes the gap between "customer submits a request" and "someone follows up," without requiring any manual monitoring.

## Tech stack

- **n8n** — workflow automation engine
- **Google Forms + Sheets** — lead capture and storage
- **Gmail API** — automated email responses
- **Telegram Bot API** — instant owner notifications

## How it works

1. Customer submits a form → response is logged to a Google Sheet
2. New row triggers the workflow automatically
3. Two parallel actions fire: a thank-you email to the customer, and a Telegram alert to the business owner
4. No manual steps required after setup

---
*Built as part of learning automation/AI-assisted development. Open to building custom versions for real businesses.*
---

# Автоматическая обработка заявок и уведомления (RU)

Лёгкая автоматизация на n8n, решающая частую проблему локального сервисного бизнеса: заявки клиентов остаются без ответа, пока сотрудники заняты — и клиент уходит к конкуренту.

## Что делает

Когда клиент отправляет заявку через веб-форму, система мгновенно:
- Отправляет клиенту персональное письмо с подтверждением, включая текст его исходного сообщения
- Уведомляет владельца бизнеса в реальном времени через Telegram, чтобы ни одна заявка не осталась незамеченной

## Почему это важно

Скорость ответа — один из главных факторов конверсии заявки в реального клиента. Эта автоматизация закрывает разрыв между "клиент отправил заявку" и "кто-то с ним связался", без необходимости вручную следить за почтой или таблицей.

## Технологии

- **n8n** — движок автоматизации
- **Google Forms + Sheets** — сбор и хранение заявок
- **Gmail API** — автоматические ответы клиентам
- **Telegram Bot API** — мгновенные уведомления владельцу

## Как это работает

1. Клиент заполняет форму → ответ сохраняется в Google-таблицу
2. Новая строка автоматически запускает workflow
3. Срабатывают два параллельных действия: письмо клиенту и уведомление в Telegram владельцу
4. После настройки никаких ручных действий не требуется

---
*Сделано в процессе обучения автоматизации с помощью ИИ. Открыт к разработке индивидуальных решений для реального бизнеса.*
