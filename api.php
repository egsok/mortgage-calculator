<?php
/**
 * SaleBot API Proxy
 * 
 * Автономный прокси - НЕ загружает WordPress.
 * Ошибки здесь не влияют на основной сайт.
 */

// Запрет прямого доступа через браузер
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    http_response_code(405);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Только POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Проверка Content-Type
$content_type = $_SERVER['CONTENT_TYPE'] ?? '';
if (strpos($content_type, 'application/json') === false) {
    http_response_code(415);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Content-Type must be application/json']);
    exit;
}

// Лимит размера payload (16KB макс)
$content_length = $_SERVER['CONTENT_LENGTH'] ?? 0;
if ($content_length > 16384) {
    http_response_code(413);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Payload too large']);
    exit;
}

// Простой rate limiting (10 запросов в минуту на IP)
$rate_limit_file = sys_get_temp_dir() . '/mortgage_calc_rate_' . md5($_SERVER['REMOTE_ADDR'] ?? 'unknown');
$rate_limit = 10;
$rate_window = 60; // секунд

$requests = [];
if (file_exists($rate_limit_file)) {
    $requests = json_decode(file_get_contents($rate_limit_file), true) ?: [];
}

// Удаляем старые записи
$now = time();
$requests = array_filter($requests, fn($t) => ($now - $t) < $rate_window);

if (count($requests) >= $rate_limit) {
    http_response_code(429);
    header('Content-Type: application/json');
    header('Retry-After: 60');
    echo json_encode(['error' => 'Too many requests']);
    exit;
}

$requests[] = $now;
file_put_contents($rate_limit_file, json_encode($requests));

// Проверка Origin - только с нашего домена или VK iframe
$allowed_origins = [
    'https://egorsokolov.ru',
    'https://vk.com',             // VK Mini App iframe
    'https://m.vk.com',           // VK мобильная версия
    'http://localhost:8080',      // для локальной разработки
    'http://192.168.0.44:8080'    // для тестов с телефона
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (!in_array($origin, $allowed_origins)) {
    // Проверяем Referer как fallback (для WebView)
    $referer = $_SERVER['HTTP_REFERER'] ?? '';
    $valid_referer = false;

    // Проверяем наш домен и VK
    $allowed_referers = ['https://egorsokolov.ru', 'https://vk.com', 'https://m.vk.com'];
    foreach ($allowed_referers as $allowed) {
        if (strpos($referer, $allowed) === 0) {
            $valid_referer = true;
            break;
        }
    }

    // WebApp может не слать Origin/Referer, проверяем User-Agent
    $user_agent = $_SERVER['HTTP_USER_AGENT'] ?? '';
    $is_telegram = (strpos($user_agent, 'Telegram') !== false);
    $is_vk = (strpos($user_agent, 'VKAndroidApp') !== false)
          || (strpos($user_agent, 'VKiOSApp') !== false)
          || (strpos($user_agent, 'vk_app') !== false);

    if (!$valid_referer && !$is_telegram && !$is_vk) {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Forbidden']);
        exit;
    }
}

// CORS headers
if ($origin && in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: $origin");
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// OPTIONS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ============================================
// API KEY - загружается из config.php (не в git)
// ============================================
$config_file = __DIR__ . '/config.php';
if (!file_exists($config_file)) {
    http_response_code(500);
    echo json_encode(['error' => 'Server configuration missing']);
    exit;
}
$config = include($config_file);
$api_key = $config['api_key'];
$group_id_telegram = $config['group_id'];
$group_id_vk = $config['group_id_vk'] ?? null;

// Получаем входные данные для определения платформы
$input = file_get_contents('php://input');
$data = json_decode($input, true);

// Определяем платформу (telegram по умолчанию)
$platform = $data['platform'] ?? 'telegram';

// Выбираем правильный callback endpoint
if ($platform === 'vk') {
    $salebot_url = "https://chatter.salebot.pro/api/{$api_key}/vk_callback";
} else {
    $salebot_url = "https://chatter.salebot.pro/api/{$api_key}/tg_callback";
}

// Валидация
if (!$data) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON']);
    exit;
}

if (!isset($data['user_id']) || !is_numeric($data['user_id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid user_id']);
    exit;
}

if (!isset($data['message'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing message']);
    exit;
}

// Добавляем правильный group_id в зависимости от платформы
if ($platform === 'vk') {
    if (!$group_id_vk) {
        http_response_code(500);
        echo json_encode(['error' => 'VK group_id not configured']);
        exit;
    }
    $data['group_id'] = $group_id_vk;
} else {
    $data['group_id'] = $group_id_telegram;
}
$payload = json_encode($data);

// Пересылаем в SaleBot
$ch = curl_init($salebot_url);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 10,           // Таймаут 10 сек
    CURLOPT_CONNECTTIMEOUT => 5,     // Таймаут подключения 5 сек
]);

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curl_error = curl_error($ch);
curl_close($ch);

// Обработка ошибок curl
if ($curl_error) {
    http_response_code(502);
    echo json_encode(['error' => 'Gateway error']);
    // Логируем для отладки (в отдельный файл, не в WordPress)
    error_log("SaleBot API error: $curl_error", 3, __DIR__ . '/api-errors.log');
    exit;
}

// Возвращаем ответ от SaleBot
http_response_code($http_code);
echo $response ?: json_encode(['success' => true]);
